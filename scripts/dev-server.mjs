import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { TARIFF_PROFILES } from "../src/data/config.js";

const rootDir = normalize(join(fileURLToPath(new URL("..", import.meta.url))));

async function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const raw = await readFile(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

await loadEnvFile(join(rootDir, ".env"));

const port = Number.parseInt(process.env.PORT ?? "4173", 10);
const dbPath = join(rootDir, "data", "app-db.json");
const pgStateId = "main";
let pgStorePromise;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

function resolvePath(urlPath) {
  const cleanPath = urlPath.split("?")[0];
  const requested = cleanPath === "/" ? "index.html" : cleanPath.replace(/^\/+/, "");
  const filePath = normalize(join(rootDir, requested));

  if (!filePath.startsWith(rootDir)) {
    return null;
  }

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    return filePath;
  }

  return existsSync(join(rootDir, "index.html")) ? join(rootDir, "index.html") : null;
}

function defaultDb() {
  return {
    users: [],
    sessions: [],
    resetTokens: [],
    events: [],
    tariffProfile: TARIFF_PROFILES[0],
  };
}

function normalizeDb(db) {
  const fallback = defaultDb();
  const tariffProfile = mergeTariff(fallback.tariffProfile, db?.tariffProfile ?? {});
  if (tariffProfile.taxes?.basisLabel === "energy charge + service charge") {
    tariffProfile.taxes = {
      ...tariffProfile.taxes,
      basisLabel: fallback.tariffProfile.taxes.basisLabel,
    };
  }

  return {
    ...fallback,
    ...db,
    tariffProfile,
  };
}

async function getPgStore() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;

  if (!pgStorePromise) {
    pgStorePromise = (async () => {
      let Pool;
      try {
        ({ Pool } = await import("pg"));
      } catch {
        throw new Error("Railway DATABASE_URL is set, but the pg package is not installed. Run npm install pg.");
      }

      const isLocalDb = /localhost|127\.0\.0\.1|\[::1\]/.test(databaseUrl);
      const sslCandidates = process.env.PGSSLMODE === "disable" || isLocalDb
        ? [false]
        : [{ rejectUnauthorized: false }, false];
      let pool;
      let connectionError;

      for (const ssl of sslCandidates) {
        const candidate = new Pool({ connectionString: databaseUrl, ssl });
        try {
          await candidate.query("SELECT 1");
          pool = candidate;
          break;
        } catch (error) {
          connectionError = error;
          await candidate.end().catch(() => {});
        }
      }

      if (!pool) {
        throw connectionError ?? new Error("Could not connect to the configured Postgres database.");
      }

      await pool.query(`
        CREATE TABLE IF NOT EXISTS app_state (
          id text PRIMARY KEY,
          data jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS app_audit_events (
          id bigserial PRIMARY KEY,
          event_type text NOT NULL,
          actor_user_id text,
          payload jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE OR REPLACE VIEW app_users AS
        SELECT
          user_record->>'id' AS id,
          user_record->>'name' AS name,
          user_record->>'email' AS email,
          user_record->>'role' AS role,
          user_record->>'status' AS status,
          (user_record->>'createdAt')::timestamptz AS created_at,
          (user_record->>'updatedAt')::timestamptz AS updated_at
        FROM app_state,
        LATERAL jsonb_array_elements(COALESCE(data->'users', '[]'::jsonb)) AS user_record
        WHERE app_state.id = '${pgStateId}'
      `);
      await pool.query(`
        CREATE OR REPLACE VIEW app_tariff_rates AS
        SELECT
          rate.key AS rate_key,
          rate.value AS rate_value,
          app_state.updated_at
        FROM app_state,
        LATERAL jsonb_each_text(COALESCE(data->'tariffProfile'->'rates', '{}'::jsonb)) AS rate(key, value)
        WHERE app_state.id = '${pgStateId}'
      `);

      return pool;
    })();
  }

  try {
    return await pgStorePromise;
  } catch (error) {
    pgStorePromise = null;
    throw error;
  }
}

async function readDb() {
  const pgStore = await getPgStore();
  if (pgStore) {
    const fallback = defaultDb();
    await pgStore.query(
      "INSERT INTO app_state (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING",
      [pgStateId, JSON.stringify(fallback)],
    );
    const result = await pgStore.query("SELECT data FROM app_state WHERE id = $1", [pgStateId]);
    return normalizeDb(result.rows[0]?.data ?? fallback);
  }

  await mkdir(dirname(dbPath), { recursive: true });
  if (!existsSync(dbPath)) {
    await writeDb(defaultDb());
  }

  const raw = await readFile(dbPath, "utf8");
  return normalizeDb(JSON.parse(raw));
}

async function writeDb(db) {
  const pgStore = await getPgStore();
  if (pgStore) {
    await pgStore.query(
      `
        INSERT INTO app_state (id, data, updated_at)
        VALUES ($1, $2::jsonb, now())
        ON CONFLICT (id)
        DO UPDATE SET data = EXCLUDED.data, updated_at = now()
      `,
      [pgStateId, JSON.stringify(db)],
    );
    return;
  }

  await mkdir(dirname(dbPath), { recursive: true });
  await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

async function recordEvent(eventType, actorUserId, payload = {}) {
  const pgStore = await getPgStore();
  if (!pgStore) return;
  await pgStore.query(
    "INSERT INTO app_audit_events (event_type, actor_user_id, payload) VALUES ($1, $2, $3::jsonb)",
    [eventType, actorUserId ?? null, JSON.stringify(payload)],
  );
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) {
      throw new Error("Request body is too large.");
    }
  }
  return body ? JSON.parse(body) : {};
}

function makeId(prefix) {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 32).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  const candidate = scryptSync(password, user.passwordSalt, 32);
  const stored = Buffer.from(user.passwordHash, "hex");
  return stored.length === candidate.length && timingSafeEqual(stored, candidate);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function tokenFromRequest(request) {
  const header = request.headers.authorization ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

async function getAuthContext(request) {
  const token = tokenFromRequest(request);
  if (!token) return { db: await readDb(), user: null, token: "" };

  const db = await readDb();
  const now = Date.now();
  db.sessions = db.sessions.filter((session) => new Date(session.expiresAt).getTime() > now);
  const session = db.sessions.find((entry) => entry.token === token);
  const user = session ? db.users.find((entry) => entry.id === session.userId && entry.status === "active") : null;
  return { db, user: user ?? null, token };
}

function requireAdmin(user, response) {
  if (!user) {
    sendJson(response, 401, { error: "Sign in is required." });
    return false;
  }
  if (user.role !== "admin") {
    sendJson(response, 403, { error: "Admin access is required." });
    return false;
  }
  return true;
}

function createSession(db, userId) {
  const token = randomBytes(32).toString("hex");
  const session = {
    token,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  };
  db.sessions.push(session);
  return token;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? ""));
}

function mergeTariff(existing, updates) {
  return {
    ...existing,
    ...updates,
    rates: {
      ...(existing.rates ?? {}),
      ...(updates.rates ?? {}),
    },
    taxes: {
      ...(existing.taxes ?? {}),
      ...(updates.taxes ?? {}),
    },
  };
}

async function handleApi(request, response) {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const method = request.method ?? "GET";

  try {
    if (method === "GET" && url.pathname === "/api/tariff") {
      const db = await readDb();
      sendJson(response, 200, { tariffProfile: db.tariffProfile });
      return;
    }

    if (method === "POST" && url.pathname === "/api/auth/register") {
      const body = await readBody(request);
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      if (!name || !validateEmail(email) || password.length < 8) {
        sendJson(response, 400, { error: "Enter a name, valid email and password of at least 8 characters." });
        return;
      }

      const db = await readDb();
      if (db.users.some((user) => user.email === email)) {
        sendJson(response, 409, { error: "A user with this email already exists." });
        return;
      }

      const passwordRecord = hashPassword(password);
      const user = {
        id: makeId("usr"),
        name,
        email,
        role: db.users.length === 0 ? "admin" : "user",
        status: "active",
        passwordHash: passwordRecord.hash,
        passwordSalt: passwordRecord.salt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.users.push(user);
      const token = createSession(db, user.id);
      await writeDb(db);
      await recordEvent("auth.register", user.id, { email, role: user.role });
      sendJson(response, 201, { token, user: publicUser(user) });
      return;
    }

    if (method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readBody(request);
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const db = await readDb();
      const user = db.users.find((entry) => entry.email === email && entry.status === "active");
      if (!user || !verifyPassword(password, user)) {
        sendJson(response, 401, { error: "Invalid email or password." });
        return;
      }

      const token = createSession(db, user.id);
      await writeDb(db);
      await recordEvent("auth.login", user.id, { email });
      sendJson(response, 200, { token, user: publicUser(user) });
      return;
    }

    if (method === "POST" && url.pathname === "/api/auth/logout") {
      const { db, token, user } = await getAuthContext(request);
      db.sessions = db.sessions.filter((session) => session.token !== token);
      await writeDb(db);
      await recordEvent("auth.logout", user?.id, {});
      sendJson(response, 200, { ok: true });
      return;
    }

    if (method === "GET" && url.pathname === "/api/auth/me") {
      const { user } = await getAuthContext(request);
      sendJson(response, 200, { user: user ? publicUser(user) : null });
      return;
    }

    if (method === "POST" && url.pathname === "/api/auth/forgot-password") {
      const body = await readBody(request);
      const email = String(body.email ?? "").trim().toLowerCase();
      const db = await readDb();
      const user = db.users.find((entry) => entry.email === email && entry.status === "active");
      const resetToken = randomBytes(16).toString("hex");
      if (user) {
        db.resetTokens = db.resetTokens.filter((entry) => entry.userId !== user.id);
        db.resetTokens.push({
          token: resetToken,
          userId: user.id,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
        });
        await writeDb(db);
      }
      sendJson(response, 200, {
        message: user
          ? "Reset token generated."
          : "If the email exists, a reset link will be sent.",
        resetToken: user ? resetToken : "",
      });
      return;
    }

    if (method === "POST" && url.pathname === "/api/auth/reset-password") {
      const body = await readBody(request);
      const resetToken = String(body.resetToken ?? "").trim();
      const password = String(body.password ?? "");
      if (!resetToken || password.length < 8) {
        sendJson(response, 400, { error: "Enter the reset token and a new password of at least 8 characters." });
        return;
      }

      const db = await readDb();
      const tokenRecord = db.resetTokens.find((entry) => entry.token === resetToken && new Date(entry.expiresAt).getTime() > Date.now());
      const user = tokenRecord ? db.users.find((entry) => entry.id === tokenRecord.userId) : null;
      if (!user) {
        sendJson(response, 400, { error: "Reset token is invalid or expired." });
        return;
      }

      const passwordRecord = hashPassword(password);
      user.passwordHash = passwordRecord.hash;
      user.passwordSalt = passwordRecord.salt;
      user.updatedAt = new Date().toISOString();
      db.resetTokens = db.resetTokens.filter((entry) => entry.token !== resetToken);
      db.sessions = db.sessions.filter((session) => session.userId !== user.id);
      await writeDb(db);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (url.pathname.startsWith("/api/admin")) {
      const { db, user } = await getAuthContext(request);
      if (!requireAdmin(user, response)) return;

      if (method === "GET" && url.pathname === "/api/admin/users") {
        sendJson(response, 200, { users: db.users.map(publicUser) });
        return;
      }

      if (method === "POST" && url.pathname === "/api/admin/users") {
        const body = await readBody(request);
        const name = String(body.name ?? "").trim();
        const email = String(body.email ?? "").trim().toLowerCase();
        const password = String(body.password ?? "");
        const role = body.role === "admin" ? "admin" : "user";
        if (!name || !validateEmail(email) || password.length < 8) {
          sendJson(response, 400, { error: "Enter a name, valid email and password of at least 8 characters." });
          return;
        }
        if (db.users.some((entry) => entry.email === email)) {
          sendJson(response, 409, { error: "A user with this email already exists." });
          return;
        }

        const passwordRecord = hashPassword(password);
        const newUser = {
          id: makeId("usr"),
          name,
          email,
          role,
          status: body.status === "disabled" ? "disabled" : "active",
          passwordHash: passwordRecord.hash,
          passwordSalt: passwordRecord.salt,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        db.users.push(newUser);
        await writeDb(db);
        await recordEvent("admin.user_create", user.id, { targetUserId: newUser.id, email: newUser.email, role: newUser.role });
        sendJson(response, 201, { user: publicUser(newUser) });
        return;
      }

      const userMatch = /^\/api\/admin\/users\/([^/]+)$/.exec(url.pathname);
      if (userMatch && method === "PATCH") {
        const body = await readBody(request);
        const target = db.users.find((entry) => entry.id === userMatch[1]);
        if (!target) {
          sendJson(response, 404, { error: "User was not found." });
          return;
        }

        target.name = String(body.name ?? target.name).trim() || target.name;
        target.email = validateEmail(body.email) ? String(body.email).trim().toLowerCase() : target.email;
        target.role = body.role === "admin" ? "admin" : "user";
        target.status = body.status === "disabled" ? "disabled" : "active";
        if (String(body.password ?? "").length >= 8) {
          const passwordRecord = hashPassword(String(body.password));
          target.passwordHash = passwordRecord.hash;
          target.passwordSalt = passwordRecord.salt;
        }
        target.updatedAt = new Date().toISOString();
        await writeDb(db);
        await recordEvent("admin.user_update", user.id, { targetUserId: target.id, email: target.email, role: target.role, status: target.status });
        sendJson(response, 200, { user: publicUser(target) });
        return;
      }

      if (userMatch && method === "DELETE") {
        if (userMatch[1] === user.id) {
          sendJson(response, 400, { error: "You cannot delete your own admin account while signed in." });
          return;
        }
        db.users = db.users.filter((entry) => entry.id !== userMatch[1]);
        db.sessions = db.sessions.filter((session) => session.userId !== userMatch[1]);
        await writeDb(db);
        await recordEvent("admin.user_delete", user.id, { targetUserId: userMatch[1] });
        sendJson(response, 200, { ok: true });
        return;
      }

      if (method === "GET" && url.pathname === "/api/admin/tariff") {
        sendJson(response, 200, { tariffProfile: db.tariffProfile });
        return;
      }

      if (method === "PATCH" && url.pathname === "/api/admin/tariff") {
        const body = await readBody(request);
        db.tariffProfile = mergeTariff(db.tariffProfile, body.tariffProfile ?? body);
        await writeDb(db);
        await recordEvent("admin.tariff_update", user.id, {
          label: db.tariffProfile.label,
          rowCount: Array.isArray(db.tariffProfile.tableRows) ? db.tariffProfile.tableRows.length : 0,
        });
        sendJson(response, 200, { tariffProfile: db.tariffProfile });
        return;
      }
    }

    sendJson(response, 404, { error: "API route not found." });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Server error." });
  }
}

createServer((request, response) => {
  const url = request.url ?? "/";
  if (url.startsWith("/api/")) {
    handleApi(request, response);
    return;
  }

  const filePath = resolvePath(url);

  if (!filePath) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const contentType = mimeTypes[extname(filePath)] ?? "application/octet-stream";
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  });

  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  console.log(`GridLedger is running at http://localhost:${port}`);
});
