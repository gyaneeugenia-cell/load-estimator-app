import { APPLIANCE_LIBRARY } from "./data/appliances.js";
import {
  CATEGORIES,
  DEFAULT_SITE_PROFILE,
  POWER_UNITS,
  STORAGE_KEY,
  TARIFF_PROFILES,
  UTILITY_PROFILES,
} from "./data/config.js";
import { buildStudy, createCustomRow } from "./lib/calculator.js";

const DEFAULT_TARIFF_PROFILE = structuredClone(TARIFF_PROFILES[0]);
const AUTH_TOKEN_KEY = "gridledger-auth-token-v1";
const LOCAL_AUTH_USERS_KEY = "gridledger-local-auth-users-v1";
const LOCAL_AUTH_SESSIONS_KEY = "gridledger-local-auth-sessions-v1";
const LOCAL_TARIFF_PROFILE_KEY = "gridledger-local-tariff-profile-v1";
const LOCAL_ADMIN_EMAILS = new Set([
  "gyaneeugenia@gmail.com",
  "geniaetornam@gmail.com",
]);

const state = {
  nextRowId: 1,
  activeTab: "auth",
  authMode: "login",
  adminMode: "users",
  calculationDetailsOpen: false,
  resultsViewed: false,
  billBreakdownViewed: false,
  userGuideAccepted: false,
  pendingGuideTab: "",
  userGuideOpen: false,
  siteProfile: {
    ...structuredClone(DEFAULT_SITE_PROFILE),
    utilityProfile: "ecg",
    premisesType: "auto",
  },
  loadItems: [],
  tariffProfile: structuredClone(DEFAULT_TARIFF_PROFILE),
  authToken: localStorage.getItem(AUTH_TOKEN_KEY) ?? "",
  currentUser: null,
  adminUsers: [],
};

const DEFAULT_TARIFF_TABLE = [
  { id: "section-residential", type: "section", label: "Residential Customer Group:" },
  { id: "subsection-lifeline", type: "subsection", label: "Lifeline Customers:" },
  { id: "rate-residential-lifeline-energy", type: "rate", label: "0 - 30 kWh (Exclusive)", measure: "GHp/kWh", rateKey: "residentialLifelineGhpPerKwh", fallback: 86.9, indent: true },
  { id: "rate-residential-lifeline-service", type: "rate", label: "Service Charge", measure: "GHp/Month", rateKey: "residentialLifelineServiceGhpPerMonth", fallback: 213, indent: true },
  { id: "subsection-residential-other", type: "subsection", label: "All Other Residential Customers:" },
  { id: "rate-residential-tier-one", type: "rate", label: "0-300 kWh", measure: "GHp/kWh", rateKey: "residentialTierOneGhpPerKwh", fallback: 196.8825, indent: true },
  { id: "rate-residential-tier-two", type: "rate", label: "301+ kWh", measure: "GHp/kWh", rateKey: "residentialTierTwoGhpPerKwh", fallback: 260.1481, indent: true },
  { id: "rate-residential-service", type: "rate", label: "Service Charge", measure: "GHp/Month", rateKey: "residentialServiceGhpPerMonth", fallback: 1073.0886, indent: true },
  { id: "section-non-residential", type: "section", label: "Non-Residential Customers:" },
  { id: "rate-non-residential-tier-one", type: "rate", label: "0-300 kWh", measure: "GHp/kWh", rateKey: "nonResidentialTierOneGhpPerKwh", fallback: 177.7539 },
  { id: "rate-non-residential-tier-two", type: "rate", label: "301+ kWh", measure: "GHp/kWh", rateKey: "nonResidentialTierTwoGhpPerKwh", fallback: 216.4873 },
  { id: "rate-non-residential-service", type: "rate", label: "Service Charge", measure: "GHp/Month", rateKey: "nonResidentialServiceGhpPerMonth", fallback: 1242.8245 },
  { id: "section-slt", type: "section", label: "Special Load Tariff (SLT) Customers:" },
  { id: "subsection-slt-lv", type: "subsection", label: "Low Voltage - LV" },
  { id: "rate-slt-lv-demand", type: "rate", label: "Maximum demand charge", measure: "GHp/kVA/Month", rateKey: "sltLvDemandGhpPerKvaPerMonth", fallback: 0, indent: true },
  { id: "rate-slt-lv-energy", type: "rate", label: "Energy Charge per kWh", measure: "GHp/kWh", rateKey: "sltLvGhpPerKwh", fallback: 232.113, indent: true },
  { id: "rate-slt-lv-service", type: "rate", label: "Service Charge", measure: "GHp/Month", rateKey: "sltLvServiceGhpPerMonth", fallback: 50000, indent: true },
  { id: "subsection-slt-mv", type: "subsection", label: "Medium Voltage - MV" },
  { id: "rate-slt-mv-demand", type: "rate", label: "Maximum demand charge", measure: "GHp/kVA/Month", rateKey: "sltMvDemandGhpPerKvaPerMonth", fallback: 0, indent: true },
  { id: "rate-slt-mv-energy", type: "rate", label: "Energy Charge per kWh", measure: "GHp/kWh", rateKey: "sltMvGhpPerKwh", fallback: 201.6, indent: true },
  { id: "rate-slt-mv-service", type: "rate", label: "Service Charge", measure: "GHp/Month", rateKey: "sltMvServiceGhpPerMonth", fallback: 50000, indent: true },
  { id: "subsection-slt-mv2", type: "subsection", label: "Medium Voltage - MV-2" },
  { id: "rate-slt-mv2-energy", type: "rate", label: "Energy Charge per kWh", measure: "GHp/kWh", rateKey: "sltMv2GhpPerKwh", fallback: 132.0448, indent: true },
  { id: "rate-slt-mv2-service", type: "rate", label: "Service Charge", measure: "GHp/Month", rateKey: "sltMv2ServiceGhpPerMonth", fallback: 50000, indent: true },
  { id: "subsection-slt-hv", type: "subsection", label: "High Voltage - HV" },
  { id: "rate-slt-hv-demand", type: "rate", label: "Maximum demand charge", measure: "GHp/kVA/Month", rateKey: "sltHvDemandGhpPerKvaPerMonth", fallback: 0, indent: true },
  { id: "rate-slt-hv-energy", type: "rate", label: "Energy Charge per kWh", measure: "GHp/kWh", rateKey: "sltHvGhpPerKwh", fallback: 182.1228, indent: true },
  { id: "rate-slt-hv-service", type: "rate", label: "Service Charge", measure: "GHp/Month", rateKey: "sltHvServiceGhpPerMonth", fallback: 50000, indent: true },
  { id: "subsection-ev", type: "subsection", label: "EV Charging" },
  { id: "rate-ev-energy", type: "rate", label: "Energy Charge per kWh", measure: "GHp/kWh", rateKey: "evChargingGhpPerKwh", fallback: 201.6, indent: true },
  { id: "rate-ev-service", type: "rate", label: "Service Charge", measure: "GHp/Month", rateKey: "evChargingServiceGhpPerMonth", fallback: 50000, indent: true },
];

const elements = {
  siteForm: document.querySelector("#site-form"),
  customerCategory: document.querySelector("#customer-category"),
  phasePreference: document.querySelector("#phase-preference"),
  voltageStability: document.querySelector("#voltage-stability"),
  voltageDropBasis: document.querySelector("#voltage-drop-basis"),
  defaultPowerFactor: document.querySelector("#default-pf"),
  growthMargin: document.querySelector("#growth-margin"),
  mainRunLength: document.querySelector("#main-run-length"),
  defaultDaysPerMonth: document.querySelector("#default-days"),
  presetSelector: document.querySelector("#preset-selector"),
  loadList: document.querySelector("#load-list"),
  summaryCards: document.querySelector("#summary-cards"),
  summaryDetails: document.querySelector("#summary-details"),
  calculationDetailsPanel: document.querySelector("#calculation-details-panel"),
  calculationDetailsToggle: document.querySelector("#calculation-details-toggle"),
  recommendationCard: document.querySelector("#recommendation-card"),
  breakdownBars: document.querySelector("#breakdown-bars"),
  tariffSummary: document.querySelector("#tariff-summary"),
  printReport: document.querySelector("#print-report"),
  timestamp: document.querySelector("#timestamp"),
  saveStatus: document.querySelector("#save-status"),
  authStatus: document.querySelector("#auth-status"),
  authPageTitle: document.querySelector("#auth-page-title"),
  authWelcomeTitle: document.querySelector("#auth-welcome-title"),
  authHeroSubtitle: document.querySelector("#auth-hero-subtitle"),
  addPresetButton: document.querySelector("#add-preset-btn"),
  addRowButton: document.querySelector("#add-row-btn"),
  printButton: document.querySelector("#print-btn"),
  exportLoadDataButton: document.querySelector("#export-load-data-btn"),
  loginForm: document.querySelector("#login-form"),
  registerForm: document.querySelector("#register-form"),
  forgotForm: document.querySelector("#forgot-form"),
  resetForm: document.querySelector("#reset-form"),
  signOutButton: document.querySelector("#sign-out-btn"),
  accountSummary: document.querySelector("#account-summary"),
  userInfoModal: document.querySelector("#user-info-modal"),
  userInfoOkButton: document.querySelector("#user-info-ok-btn"),
  authModeButtons: [...document.querySelectorAll(".auth-mode-button")],
  authViews: [...document.querySelectorAll(".auth-view")],
  adminCreateUserForm: document.querySelector("#admin-create-user-form"),
  adminUsers: document.querySelector("#admin-users"),
  adminTariffForm: document.querySelector("#admin-tariff-form"),
  adminModeButtons: [...document.querySelectorAll(".admin-mode-button")],
  adminViews: [...document.querySelectorAll("[data-admin-view]")],
  tabButtons: [...document.querySelectorAll(".tab-button")],
  tabPanels: [...document.querySelectorAll(".tab-panel")],
};

function numberFormat(value, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function currencyFormat(value) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const BREAKDOWN_PALETTE = ["#2d63ad", "#dd9a38", "#2c8b9a", "#6574cd", "#4a9f5d", "#8d63c7", "#bb5d86"];
const CATEGORY_VISUALS = {
  Heating: { color: "#2d63ad", subtitle: "Space heating systems", icon: "heating" },
  Kitchen: { color: "#dd9a38", subtitle: "Kitchen appliances", icon: "kitchen" },
  Office: { color: "#2c8b9a", subtitle: "Office equipment", icon: "office" },
  Lighting: { color: "#4a9f5d", subtitle: "Lighting circuits", icon: "lighting" },
  HVAC: { color: "#2d63ad", subtitle: "Cooling and ventilation", icon: "hvac" },
  IT: { color: "#6574cd", subtitle: "IT and data equipment", icon: "it" },
  Motors: { color: "#8d63c7", subtitle: "Motor-driven equipment", icon: "motors" },
  Workshop: { color: "#bb5d86", subtitle: "Workshop equipment", icon: "motors" },
  Commercial: { color: "#dd9a38", subtitle: "Commercial appliances", icon: "kitchen" },
  Transport: { color: "#4a9f5d", subtitle: "Transport equipment", icon: "office" },
  "Plug loads": { color: "#2c8b9a", subtitle: "General plug-in loads", icon: "office" },
  Other: { color: "#6574cd", subtitle: "General electrical loads", icon: "other" },
};

function categoryVisual(category, index = 0) {
  const preset = CATEGORY_VISUALS[category];
  if (preset) return preset;
  return {
    color: BREAKDOWN_PALETTE[index % BREAKDOWN_PALETTE.length],
    subtitle: "Electrical loads",
    icon: "other",
  };
}

function categoryIconMarkup(category, index = 0) {
  const { color, icon } = categoryVisual(category, index);
  const stroke = "#ffffff";
  const iconPaths = {
    heating: `<path d="M10 7c-1.2 1.1-1.8 2.4-1.8 4s.6 2.9 1.8 4M15 7c-1.2 1.1-1.8 2.4-1.8 4s.6 2.9 1.8 4M20 7c-1.2 1.1-1.8 2.4-1.8 4s.6 2.9 1.8 4" fill="none" stroke="${stroke}" stroke-width="1.9" stroke-linecap="round"/>`,
    kitchen: `<path d="M8 12h14l-1 8H9l-1-8Z" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round"/><path d="M11 10V8.8a2.2 2.2 0 0 1 2.2-2.2h3.6A2.2 2.2 0 0 1 19 8.8V10" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/>`,
    office: `<rect x="7" y="7.5" width="16" height="10.5" rx="1.8" fill="none" stroke="${stroke}" stroke-width="1.8"/><path d="M12 21h6M15 18v3" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/>`,
    lighting: `<path d="M15 6.5a5.1 5.1 0 0 0-3.3 9l.8.7V18h5v-1.8l.8-.7A5.1 5.1 0 0 0 15 6.5Z" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round"/><path d="M13 21h4" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/>`,
    hvac: `<path d="M8 13h14M10 9.5h10M10 16.5h10" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/><circle cx="15" cy="13" r="6.5" fill="none" stroke="${stroke}" stroke-width="1.6" opacity="0.55"/>`,
    it: `<path d="M9 8h12v8H9z" fill="none" stroke="${stroke}" stroke-width="1.8"/><path d="M12 20h6M15 16v4" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/>`,
    motors: `<circle cx="15" cy="14" r="5.5" fill="none" stroke="${stroke}" stroke-width="1.8"/><path d="M15 8V5M20 14h3M15 23v-3M7 14H4" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/>`,
    other: `<circle cx="15" cy="14" r="6.5" fill="none" stroke="${stroke}" stroke-width="1.8"/><path d="M15 10.5v3.8l2.4 1.8" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  };

  return `
    <span class="load-mix__icon" style="--icon-color:${color}">
      <svg viewBox="0 0 30 28" aria-hidden="true" focusable="false">
        ${iconPaths[icon] ?? iconPaths.other}
      </svg>
    </span>
  `;
}

function uiIconMarkup(icon, className = "ui-icon") {
  const paths = {
    chart: `<path d="M5 15.5l4.1-4.1 3.1 3.1 5.5-6.2 2.3 2.3" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 19h17" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/>`,
    bolt: `<path d="M13.2 3 6.7 14.2h5.2L10.8 21 17.5 9.2h-5.1L13.2 3Z" fill="currentColor"/>`,
    gauge: `<path d="M5.5 17a8.5 8.5 0 1 1 17 0" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><path d="m15 15 4.7-4.7" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><path d="M8.4 17h2M19.6 17h2M15 8.6v2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
    wave: `<path d="M4 15c2.8 0 2.8-8 5.6-8s2.8 12 5.6 12S18 11 21 11" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>`,
    shield: `<path d="M12 3.5 20 6.8v5.8c0 4.3-3.2 7.3-8 8.9-4.8-1.6-8-4.6-8-8.9V6.8l8-3.3Z" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/><path d="m9 12 2 2 4-5" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>`,
    amp: `<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.1"/><path d="m8.8 16 3-8h.4l3 8M10.2 13.2h3.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    cable: `<path d="m7 17 10-10 3 3-10 10-3-3Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="m5 15 4 4M15 5l4 4M8.5 12.5l3 3M11.5 9.5l3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    bars: `<path d="M5 19v-5M12 19V9M19 19V5" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`,
    plug: `<path d="M9 4v5M15 4v5M7 9h10v3a5 5 0 0 1-10 0V9Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 17v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    frequency: `<path d="M3 12h3l2.5-5 5 10 2.5-5h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    service: `<circle cx="12" cy="5" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="5" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="19" cy="18" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5v4L6.7 16M12 11.5l5.3 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    info: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 10.8v5.4M12 7.5h.01" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
    house: `<path d="M5 11.5 12 5l7 6.5V20H7v-8.5Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 20v-5h4v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
    check: `<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m8.5 12 2.2 2.2 4.8-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  };

  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[icon] ?? paths.info}</svg>`;
}

function setAuthNotice(message = "", tone = "error") {
  if (!elements.authStatus) return;
  const notice = String(message ?? "").trim();
  elements.authStatus.hidden = !notice;
  if (notice) {
    elements.authStatus.dataset.tone = tone;
    if (tone === "success" && notice.toLowerCase().startsWith("signed in successfully")) {
      elements.authStatus.innerHTML = `
        <span class="auth-status__message">
          <strong>Signed in successfully.</strong>
          <span>Your session is active and secure.</span>
        </span>
      `;
    } else {
      elements.authStatus.textContent = notice;
    }
  } else {
    delete elements.authStatus.dataset.tone;
    elements.authStatus.textContent = "";
  }
}

function setFooterNotice(message = "") {
  elements.saveStatus.textContent = message;
}

function showUserInfoModal(nextTab = "loads") {
  if (!elements.userInfoModal) return;
  state.pendingGuideTab = nextTab;
  state.userGuideOpen = true;
  elements.userInfoModal.hidden = false;
  document.body.classList.add("user-info-modal-open");
  elements.userInfoOkButton?.focus();
}

function acceptUserInfoModal() {
  state.userGuideAccepted = true;
  state.userGuideOpen = false;
  elements.userInfoModal.hidden = true;
  document.body.classList.remove("user-info-modal-open");
  const nextTab = state.pendingGuideTab || "loads";
  state.pendingGuideTab = "";
  setActiveTab(nextTab);
}

async function apiFetch(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };
  if (state.authToken) {
    headers.Authorization = `Bearer ${state.authToken}`;
  }

  try {
    const response = await fetch(path, {
      ...options,
      headers,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 404 && String(path).startsWith("/api/")) {
        return localApiFetch(path, options);
      }
      throw new Error(payload.error ?? "Request failed.");
    }
    return payload;
  } catch (error) {
    if (String(path).startsWith("/api/")) {
      return localApiFetch(path, options);
    }
    throw error;
  }
}

function formDataObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function readLocalJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function localPublicUser(user) {
  if (!user) return null;
  const { password, ...publicUser } = user;
  return publicUser;
}

function makeLocalToken() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return `local_${cryptoApi.randomUUID()}`;
  return `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getLocalBody(options = {}) {
  if (!options.body) return {};
  try {
    return JSON.parse(options.body);
  } catch {
    return {};
  }
}

function getLocalCurrentUser() {
  if (!state.authToken?.startsWith("local_")) return null;
  const sessions = readLocalJson(LOCAL_AUTH_SESSIONS_KEY, []);
  const session = sessions.find((entry) => entry.token === state.authToken && new Date(entry.expiresAt).getTime() > Date.now());
  if (!session) return null;
  const users = readLocalJson(LOCAL_AUTH_USERS_KEY, []);
  const user = users.find((entry) => entry.id === session.userId) ?? null;
  return syncLocalUserRole(users, user);
}

function createLocalSession(userId) {
  const sessions = readLocalJson(LOCAL_AUTH_SESSIONS_KEY, []);
  const token = makeLocalToken();
  sessions.push({
    token,
    userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  });
  writeLocalJson(LOCAL_AUTH_SESSIONS_KEY, sessions);
  return token;
}

function roleForLocalEmail(email) {
  return LOCAL_ADMIN_EMAILS.has(String(email ?? "").trim().toLowerCase()) ? "admin" : "user";
}

function syncLocalUserRole(users, user = null) {
  if (!user) return null;
  if (!LOCAL_ADMIN_EMAILS.has(String(user.email ?? "").trim().toLowerCase()) || user.role === "admin") return user;
  user.role = "admin";
  user.updatedAt = new Date().toISOString();
  writeLocalJson(LOCAL_AUTH_USERS_KEY, users);
  return user;
}

function requireLocalAdmin() {
  const user = getLocalCurrentUser();
  if (user?.role !== "admin") {
    throw new Error("Admin access is required.");
  }
  return user;
}

async function localApiFetch(path, options = {}) {
  const method = String(options.method ?? "GET").toUpperCase();
  const body = getLocalBody(options);
  const users = readLocalJson(LOCAL_AUTH_USERS_KEY, []);

  if (method === "GET" && path === "/api/tariff") {
    return { tariffProfile: readLocalJson(LOCAL_TARIFF_PROFILE_KEY, structuredClone(DEFAULT_TARIFF_PROFILE)) };
  }

  if (method === "POST" && path === "/api/auth/register") {
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
      throw new Error("Enter a name, valid email and password of at least 8 characters.");
    }
    if (users.some((user) => user.email === email)) {
      throw new Error("A user with this email already exists.");
    }
    const user = {
      id: `local_user_${Date.now()}`,
      name,
      email,
      password,
      role: roleForLocalEmail(email),
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    users.push(user);
    writeLocalJson(LOCAL_AUTH_USERS_KEY, users);
    const token = createLocalSession(user.id);
    return { token, user: localPublicUser(user) };
  }

  if (method === "POST" && path === "/api/auth/login") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const user = users.find((entry) => entry.email === email && entry.password === password && entry.status === "active");
    if (!user) throw new Error("Invalid email or password.");
    syncLocalUserRole(users, user);
    const token = createLocalSession(user.id);
    return { token, user: localPublicUser(user) };
  }

  if (method === "POST" && path === "/api/auth/logout") {
    const sessions = readLocalJson(LOCAL_AUTH_SESSIONS_KEY, []).filter((entry) => entry.token !== state.authToken);
    writeLocalJson(LOCAL_AUTH_SESSIONS_KEY, sessions);
    return { ok: true };
  }

  if (method === "GET" && path === "/api/auth/me") {
    return { user: localPublicUser(getLocalCurrentUser()) };
  }

  if (method === "POST" && path === "/api/auth/forgot-password") {
    return {
      message: "For this review link, create a new account or sign in with the password used on this browser.",
      resetToken: "",
    };
  }

  if (method === "POST" && path === "/api/auth/reset-password") {
    throw new Error("Password reset is not available on the static review link. Create a new review account instead.");
  }

  if (String(path).startsWith("/api/admin")) {
    requireLocalAdmin();

    if (method === "GET" && path === "/api/admin/users") {
      return { users: users.map(localPublicUser) };
    }

    if (method === "POST" && path === "/api/admin/users") {
      const name = String(body.name ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const role = body.role === "admin" ? "admin" : "user";
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
        throw new Error("Enter a name, valid email and password of at least 8 characters.");
      }
      if (users.some((user) => user.email === email)) {
        throw new Error("A user with this email already exists.");
      }
      users.push({
        id: `local_user_${Date.now()}`,
        name,
        email,
        password,
        role,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      writeLocalJson(LOCAL_AUTH_USERS_KEY, users);
      return { users: users.map(localPublicUser) };
    }

    const userMatch = String(path).match(/^\/api\/admin\/users\/([^/]+)$/);
    if (userMatch && method === "PATCH") {
      const user = users.find((entry) => entry.id === decodeURIComponent(userMatch[1]));
      if (!user) throw new Error("User not found.");
      if (body.name !== undefined) user.name = String(body.name).trim() || user.name;
      if (body.email !== undefined) {
        const nextEmail = String(body.email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) throw new Error("Enter a valid email.");
        if (users.some((entry) => entry.id !== user.id && entry.email === nextEmail)) throw new Error("A user with this email already exists.");
        user.email = nextEmail;
      }
      if (body.role !== undefined) user.role = body.role === "admin" ? "admin" : "user";
      if (body.status !== undefined) user.status = body.status === "inactive" ? "inactive" : "active";
      user.updatedAt = new Date().toISOString();
      writeLocalJson(LOCAL_AUTH_USERS_KEY, users);
      return { user: localPublicUser(user) };
    }

    if (userMatch && method === "DELETE") {
      writeLocalJson(LOCAL_AUTH_USERS_KEY, users.filter((entry) => entry.id !== decodeURIComponent(userMatch[1])));
      return { ok: true };
    }

    if (method === "GET" && path === "/api/admin/tariff") {
      return { tariffProfile: readLocalJson(LOCAL_TARIFF_PROFILE_KEY, structuredClone(DEFAULT_TARIFF_PROFILE)) };
    }

    if (method === "PATCH" && path === "/api/admin/tariff") {
      const tariffProfile = body.tariffProfile ?? structuredClone(DEFAULT_TARIFF_PROFILE);
      writeLocalJson(LOCAL_TARIFF_PROFILE_KEY, tariffProfile);
      return { tariffProfile };
    }
  }

  throw new Error("This feature is not available on the static review link.");
}

function setAuthSession(token, user) {
  state.authToken = token ?? "";
  state.currentUser = user ?? null;
  if (!state.currentUser) {
    state.resultsViewed = false;
    state.billBreakdownViewed = false;
    state.userGuideAccepted = false;
    state.pendingGuideTab = "";
    state.userGuideOpen = false;
    if (elements.userInfoModal) {
      elements.userInfoModal.hidden = true;
      document.body.classList.remove("user-info-modal-open");
    }
  }
  if (state.authToken) {
    localStorage.setItem(AUTH_TOKEN_KEY, state.authToken);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
  renderAuthState();
}

function optionMarkup(options, selectedValue) {
  return options
    .map((option) => {
      const value = option.value ?? option.id ?? option;
      const label = option.label ?? option.name ?? option;
      const selected = value === selectedValue ? " selected" : "";
      return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function normalizeCustomerCategory(value) {
  const normalized = String(value ?? "auto").toLowerCase().replaceAll("-", "_");
  if (normalized === "residential" || normalized === "slt" || normalized === "auto") return normalized;
  if (["commercial", "industrial", "mixed", "non_residential", "nonresidential", "non_resi"].includes(normalized)) {
    return "non_residential";
  }
  return "auto";
}

function normalizeVoltageDropBasis(value) {
  const normalized = String(value ?? "power").toLowerCase();
  if (normalized === "lighting" || normalized === "legacy") return normalized;
  return "power";
}

function applianceToRow(applianceId, quantity = 1) {
  const appliance = APPLIANCE_LIBRARY.find((item) => item.id === applianceId) ?? APPLIANCE_LIBRARY[0];
  return {
    ...appliance,
    quantity,
    rowId: `row-${state.nextRowId++}`,
  };
}

function deriveNextRowId(loadItems) {
  return loadItems.reduce((maxValue, item) => {
    const match = /row-(\d+)/.exec(item.rowId ?? "");
    return Math.max(maxValue, match ? Number.parseInt(match[1], 10) + 1 : maxValue);
  }, 1);
}

function hasEnteredLoad() {
  return state.loadItems.some(
    (item) => Number(item.quantity) > 0 && Number(item.rating) > 0,
  );
}

function canAccessTab(tabId) {
  if (tabId === "auth") return true;
  if (tabId === "admin") return state.currentUser?.role === "admin";
  if (!state.currentUser) return false;
  if (tabId === "loads") return true;
  if (tabId === "results") return hasEnteredLoad();
  if (tabId === "tariff") return hasEnteredLoad() && state.resultsViewed;
  return false;
}

function fallbackTabFor(tabId) {
  if (!state.currentUser) return "auth";
  if (tabId === "tariff" && hasEnteredLoad()) return "results";
  return "loads";
}

function updateWorkflowControls() {
  const isAdmin = state.currentUser?.role === "admin";

  elements.tabButtons.forEach((button) => {
    const tabId = button.dataset.tab;
    if (tabId === "admin") {
      button.hidden = !isAdmin;
    }

    const isDisabled = !canAccessTab(tabId);
    button.disabled = isDisabled;
    button.setAttribute("aria-disabled", String(isDisabled));
    button.classList.toggle("is-locked", isDisabled);
  });

  const canPrint = hasEnteredLoad() && state.billBreakdownViewed;
  const canExportLoadData = Boolean(state.currentUser) && hasEnteredLoad();
  elements.printButton.hidden = state.activeTab === "auth";
  elements.printButton.disabled = !canPrint;
  elements.printButton.setAttribute("aria-disabled", String(!canPrint));
  elements.exportLoadDataButton.hidden = state.activeTab === "auth";
  elements.exportLoadDataButton.disabled = !canExportLoadData;
  elements.exportLoadDataButton.setAttribute("aria-disabled", String(!canExportLoadData));
}

function setAuthMode(mode) {
  const nextMode = state.currentUser
    ? "signout"
    : mode === "signout"
      ? "login"
      : mode;
  state.authMode = nextMode;

  const titles = {
    login: ["SIGN IN PAGE", "Welcome back", "Access your Load Estimator workspace."],
    register: ["REGISTER PAGE", "Create your workspace", "Set up access to your Load Estimator account."],
    forgot: ["PASSWORD RESET PAGE", "Recover access", "Generate a reset token and set a new password."],
    signout: ["ACCOUNT DASHBOARD", "You are signed in", "You are signed in to your Load Estimator account."],
  };
  const [pageTitle, welcomeTitle, subtitle] = titles[nextMode] ?? titles.login;
  elements.authPageTitle.textContent = pageTitle;
  elements.authWelcomeTitle.textContent = state.currentUser && nextMode === "signout"
    ? `Welcome, ${state.currentUser.name}`
    : welcomeTitle;
  if (elements.authHeroSubtitle) {
    elements.authHeroSubtitle.textContent = subtitle;
  }

  elements.authModeButtons.forEach((button) => {
    const isSignOut = button.dataset.authMode === "signout";
    button.hidden = state.currentUser ? !isSignOut : isSignOut;
    button.classList.toggle("is-active", button.dataset.authMode === nextMode);
    button.setAttribute("aria-selected", String(button.dataset.authMode === nextMode));
  });

  elements.authViews.forEach((view) => {
    view.hidden = view.dataset.authView !== nextMode;
  });
}

function setAdminMode(mode) {
  state.adminMode = mode === "tariff" ? "tariff" : "users";

  elements.adminModeButtons.forEach((button) => {
    const isActive = button.dataset.adminMode === state.adminMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  elements.adminViews.forEach((view) => {
    view.hidden = view.dataset.adminView !== state.adminMode;
  });
}

function setActiveTab(tabId) {
  if (!canAccessTab(tabId)) {
    if (tabId === "loads") {
      elements.saveStatus.textContent = "Sign in before entering loads.";
    } else if (tabId === "results") {
      elements.saveStatus.textContent = "Enter at least one load before opening results.";
    } else if (tabId === "tariff") {
      elements.saveStatus.textContent = "Open the results first, then the bill breakdown will unlock.";
    }
    tabId = fallbackTabFor(tabId);
  }

  if (tabId === "loads" && state.currentUser && !state.userGuideAccepted) {
    if (!state.userGuideOpen) {
      showUserInfoModal("loads");
    }
    return;
  }

  if (tabId === "results") {
    state.resultsViewed = true;
  }
  if (tabId === "tariff") {
    state.billBreakdownViewed = true;
  }

  state.activeTab = tabId;
  updateWorkflowControls();

  elements.tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  elements.tabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tabId;
  });
}

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (parsed?.siteProfile) {
      const {
        actualMeterReadingKwh: _legacyActualMeterReadingKwh,
        meterReadingKwh: _legacyMeterReadingKwh,
        userMeterReadingKwh: _legacyUserMeterReadingKwh,
        ...persistedSiteProfile
      } = parsed.siteProfile;

      state.siteProfile = {
        ...structuredClone(DEFAULT_SITE_PROFILE),
        ...persistedSiteProfile,
        utilityProfile: "ecg",
        customerCategory: normalizeCustomerCategory(parsed.siteProfile?.customerCategory ?? parsed.siteProfile?.premisesType),
        premisesType: normalizeCustomerCategory(parsed.siteProfile?.customerCategory ?? parsed.siteProfile?.premisesType),
      };
    }

    if (parsed?.loadItems) {
      state.loadItems = parsed.loadItems.map((item) => ({
        ...item,
        rowId: item.rowId ?? `row-${state.nextRowId++}`,
      }));
    }

    if (parsed?.activeTab) {
      state.activeTab = parsed.activeTab;
    }

    state.nextRowId = deriveNextRowId(state.loadItems);
    elements.saveStatus.textContent = "Restored last saved local draft.";
  } catch {
    elements.saveStatus.textContent = "Saved draft could not be restored.";
  }
}

function syncFormFromState() {
  elements.customerCategory.value = normalizeCustomerCategory(state.siteProfile.customerCategory ?? state.siteProfile.premisesType);
  elements.phasePreference.value = state.siteProfile.phasePreference ?? "auto";
  elements.voltageStability.value = state.siteProfile.voltageStability ?? "stable";
  elements.voltageDropBasis.value = normalizeVoltageDropBasis(state.siteProfile.voltageDropBasis);
  elements.defaultPowerFactor.value = state.siteProfile.defaultPowerFactor ?? 0.9;
  elements.growthMargin.value = Math.round((state.siteProfile.growthMargin ?? 0.15) * 100);
  elements.mainRunLength.value = state.siteProfile.mainRunLengthM ?? "";
  elements.defaultDaysPerMonth.value = state.siteProfile.defaultDaysPerMonth ?? 30;
}

function collectFormState() {
  const powerFactor = Number.parseFloat(elements.defaultPowerFactor.value);
  const growthMargin = Number.parseFloat(elements.growthMargin.value);
  const mainRunLength = Number.parseFloat(elements.mainRunLength.value);
  const defaultDaysPerMonth = Number.parseInt(elements.defaultDaysPerMonth.value, 10);

  state.siteProfile = {
    ...state.siteProfile,
    utilityProfile: "ecg",
    customerCategory: elements.customerCategory.value,
    premisesType: elements.customerCategory.value,
    phasePreference: elements.phasePreference.value,
    voltageStability: elements.voltageStability.value === "unstable" ? "unstable" : "stable",
    voltageDropBasis: normalizeVoltageDropBasis(elements.voltageDropBasis.value),
    defaultPowerFactor: Number.isFinite(powerFactor) ? powerFactor : 0.9,
    growthMargin: (Number.isFinite(growthMargin) ? growthMargin : 15) / 100,
    mainRunLengthM: Number.isFinite(mainRunLength) ? mainRunLength : "",
    defaultDaysPerMonth: Number.isFinite(defaultDaysPerMonth) ? defaultDaysPerMonth : 30,
    tariffMultiplier: 1,
  };
}

function loadCardMarkup(row, metrics) {
  const rowConnectedKw = metrics?.connectedKw ?? 0;
  const rowSizingKw = metrics?.diversifiedKw ?? 0;
  const rowDemandFactorPercent = rowConnectedKw > 0 ? (rowSizingKw / rowConnectedKw) * 100 : 0;
  const rowDemandFactorLabel = rowConnectedKw > 0 ? `${numberFormat(rowDemandFactorPercent, 1)}%` : "Not applied";
  const rowDemandFactorNote = metrics?.sizingNote ?? "Connected load";
  const rowLoadsAreSame = Math.abs(rowConnectedKw - rowSizingKw) < 0.005;
  const loadMetricPills = rowLoadsAreSame
    ? `
        <article class="metric-pill">
          <p class="metric-pill__label">Connected load</p>
          <p class="metric-pill__value">${numberFormat(rowConnectedKw, 2)} kW</p>
        </article>
      `
    : `
        <article class="metric-pill">
          <p class="metric-pill__label">Connected load</p>
          <p class="metric-pill__value">${numberFormat(rowConnectedKw, 2)} kW</p>
        </article>
        <article class="metric-pill">
          <p class="metric-pill__label">Sizing contribution</p>
          <p class="metric-pill__value">${numberFormat(rowSizingKw, 2)} kW</p>
        </article>
      `;

  return `
    <article class="load-card" data-row-id="${escapeHtml(row.rowId)}">
      <div class="load-card__header">
        <div class="load-card__title">
          <label>
            <span>Load name</span>
            <input class="load-card__name" data-field="name" type="text" value="${escapeHtml(row.name ?? "")}" />
          </label>
          <p class="load-card__sub">
            ${rowLoadsAreSame
              ? `Connected load ${numberFormat(rowConnectedKw, 2)} kW`
              : `Connected ${numberFormat(rowConnectedKw, 2)} kW | Sizing contribution ${numberFormat(rowSizingKw, 2)} kW`} |
            Expected energy ${numberFormat(metrics?.monthlyEnergyKwh ?? 0, 1)} kWh/month
          </p>
        </div>
        <button class="button button--ghost" type="button" data-action="remove">Remove</button>
      </div>

      <div class="load-card__grid">
        <label>
          <span>Quantity</span>
          <input data-field="quantity" type="number" min="0" step="1" value="${row.quantity ?? 1}" />
        </label>
        <label>
          <span>Rating</span>
          <input data-field="rating" type="number" min="0" step="0.01" value="${row.rating ?? 0}" />
        </label>
        <label>
          <span>Unit</span>
          <select data-field="unit">${optionMarkup(POWER_UNITS, row.unit ?? "W")}</select>
        </label>
        <label>
          <span>Hours / day</span>
          <input data-field="hoursPerDay" type="number" min="0" max="24" step="0.1" value="${row.hoursPerDay ?? 1}" />
        </label>
      </div>

      <div class="load-card__metrics">
        ${loadMetricPills}
        <article class="metric-pill">
          <p class="metric-pill__label">Estimated monthly energy</p>
          <p class="metric-pill__value">${numberFormat(metrics?.monthlyEnergyKwh ?? 0, 1)} kWh</p>
        </article>
      </div>

      <details class="details-card details-card--soft">
        <summary>Advanced row settings</summary>
        <div class="load-card__grid field-grid--nested">
          <label>
            <span>Category</span>
            <select data-field="category">${optionMarkup(CATEGORIES, row.category ?? "Other")}</select>
          </label>
          <label>
            <span>Power factor</span>
            <input data-field="powerFactor" type="number" min="0.4" max="1" step="0.01" value="${row.powerFactor ?? 0.92}" />
          </label>
          <label>
            <span>Energy duty cycle (%)</span>
            <input data-field="dutyCycleBilling" type="number" min="0" max="100" step="1" value="${Math.round((row.dutyCycleBilling ?? row.duty_cycle ?? metrics?.dutyCycleBilling ?? 1) * 100)}" />
          </label>
          <label>
            <span>Days / month</span>
            <input data-field="daysPerMonth" type="number" min="0" max="31" step="1" value="${row.daysPerMonth ?? state.siteProfile.defaultDaysPerMonth}" />
          </label>
          <label>
            <span>Demand factor used (%)</span>
            <input type="text" value="${escapeHtml(rowDemandFactorLabel)}" readonly />
          </label>
          <div class="load-card__setting-note">
            <p class="load-card__setting-note-label">Demand factor rule applied</p>
            <p class="load-card__setting-note-value">${escapeHtml(rowDemandFactorNote)}</p>
          </div>
        </div>
      </details>
    </article>
  `;
}

function renderLoadList(study) {
  if (!state.loadItems.length) {
    elements.loadList.innerHTML = `
      <div class="empty-state">
        No load has been added yet. Start by selecting a library item or by creating a custom load.
      </div>
    `;
    return;
  }

  const metricsById = new Map(study.rows.map((row) => [row.rowId, row]));
  elements.loadList.innerHTML = state.loadItems
    .map((row) => loadCardMarkup(row, metricsById.get(row.rowId)))
    .join("");
}

function summaryCardMarkup(card) {
  return `
    <article class="summary-card ${card.wide ? "summary-card--wide" : ""}">
      <span class="summary-card__icon">${uiIconMarkup(card.icon ?? "bolt")}</span>
      <span class="summary-card__content">
        <p class="summary-card__label">${escapeHtml(card.label)}</p>
        <p class="summary-card__value">${escapeHtml(card.value)}</p>
      </span>
    </article>
  `;
}

function updateCalculationDetailsToggle() {
  if (!elements.calculationDetailsToggle || !elements.calculationDetailsPanel) return;
  elements.calculationDetailsPanel.hidden = !state.calculationDetailsOpen;
  elements.calculationDetailsToggle.textContent = state.calculationDetailsOpen
    ? "Hide Calculation Details and Notes"
    : "View Calculation Details and Notes";
}

function calculationDetailCardMarkup({ title, body, formula = "", substitution = "", items = [], total }) {
  return `
    <article class="calculation-details__card">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
      ${formula ? `<p class="calculation-details__formula">${escapeHtml(formula)}</p>` : ""}
      ${substitution ? `<p class="calculation-details__substitution">${escapeHtml(substitution)}</p>` : ""}
      ${items.length ? `<ul class="list-tight">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${total ? `<p class="calculation-details__total">${escapeHtml(total)}</p>` : ""}
    </article>
  `;
}

function demandFactorExplanation(summary) {
  if (summary.customerCategory === "residential") {
    if (Math.abs(summary.connectedKw - summary.peakRealKw) < 0.005) {
      return "Demand method used is Ghana residential practical demand method. Because the connected load is small, the app treats 100% of the connected load as the peak active demand before reserve.";
    }

    return "Demand method used is Ghana residential practical demand method. The app estimates residential maximum demand from connected load, practical simultaneity, and noncoincident load treatment before reserve is added.";
  }

  if (summary.customerCategory === "non_residential") {
    return "Demand method used: Ghana commercial practical demand method. The app estimates peak demand from connected load, practical simultaneity, continuous-load treatment, and expected business-hour coincidence before reserve is added.";
  }

  return "Demand method used: Ghana industrial / motor demand method. Peak demand is estimated from connected load, expected simultaneous operation, and full-capacity industrial service screening before reserve is added.";
}

function renderCalculationDetails(study) {
  if (!elements.summaryDetails) return;

  const { recommendation, rows, summary } = study;
  const reserveKw = summary.designRealKw - summary.peakRealKw;
  const reserveKva = summary.designApparentKva - summary.peakApparentKva;
  const activeDemandRows = rows.filter((row) => row.sizingDemandKw > 0.0005 || row.sizingDemandKva > 0.0005);
  const peakDemandKwTerms = activeDemandRows.map((row) => numberFormat(row.sizingDemandKw, 3));
  const peakDemandKvaTerms = activeDemandRows.map((row) => numberFormat(row.sizingDemandKva, 3));
  const peakDemandKwSubstitution = peakDemandKwTerms.length
    ? `Peak demand = ${peakDemandKwTerms.join(" + ")} = ${numberFormat(summary.peakRealKw, 3)} kW`
    : `Peak demand = ${numberFormat(summary.peakRealKw, 3)} kW`;
  const peakDemandKvaSubstitution = peakDemandKvaTerms.length
    ? `Peak demand kVA = ${peakDemandKvaTerms.join(" + ")} = ${numberFormat(summary.peakApparentKva, 3)} kVA`
    : `Peak demand kVA = ${numberFormat(summary.peakApparentKva, 3)} kVA`;
  const currentFormula = recommendation.currentFormulaMode === "three-phase"
    ? "Formula: I = (S x 1000) / (1.732 x V)"
    : "Formula: I = (S x 1000) / V";
  const currentSubstitution = recommendation.currentFormulaMode === "three-phase"
    ? `Substitution: I = (${numberFormat(summary.designApparentKva, 2)} x 1000) / (1.732 x ${numberFormat(recommendation.currentVoltageV, 0)}) = ${numberFormat(recommendation.recommendedCurrentA, 1)} A`
    : `Substitution: I = (${numberFormat(summary.designApparentKva, 2)} x 1000) / ${numberFormat(recommendation.currentVoltageV, 0)} = ${numberFormat(recommendation.recommendedCurrentA, 1)} A`;

  elements.summaryDetails.innerHTML = [
    calculationDetailCardMarkup({
      title: "Connected load",
      body: "Connected load is the installed nameplate load.",
      formula: "Formula: Connected load = sum of (quantity x rated watts) / 1000",
      total: `Total connected load = ${numberFormat(summary.connectedKw, 2)} kW`,
    }),
    calculationDetailCardMarkup({
      title: "Maximum apparent demand",
      body: "Maximum apparent demand is the demand-adjusted apparent load before reserve is added.",
      formula: "Formula: Row kVA = row kW / power factor.\nMaximum apparent demand = sum of demand-adjusted row kVA.",
      substitution: `${peakDemandKvaSubstitution}.`,
      total: `Maximum apparent demand = ${numberFormat(summary.peakApparentKva, 3)} kVA`,
    }),
    calculationDetailCardMarkup({
      title: "Sizing apparent load",
      body: "Sizing apparent load is the apparent load after the selected sizing reserve is added. This value is used to calculate sizing current and to size breaker and cable selection.",
      formula: "Formula: Sizing apparent load = maximum apparent demand x (1 + sizing reserve percentage).",
      substitution: `${numberFormat(summary.designApparentKva, 3)} kVA = ${numberFormat(summary.peakApparentKva, 3)} kVA x (1 + ${numberFormat(summary.growthMargin * 100, 1)}%).`,
      total: `Sizing apparent load = ${numberFormat(summary.designApparentKva, 3)} kVA`,
    }),
    calculationDetailCardMarkup({
      title: "Maximum active demand",
      body: "Maximum demand is the calculated expected peak active load before reserve is added. Demand method used is Ghana residential practical demand method. Because the connected load is small, the app treats 100% of the connected load as the peak active demand before reserve.",
      formula: `Method: ${summary.sizingMethodLabel}. Maximum demand = sum of demand-adjusted row kW.`,
      substitution: `${peakDemandKwSubstitution}.`,
      total: `Maximum demand = ${numberFormat(summary.peakRealKw, 3)} kW`,
    }),
    calculationDetailCardMarkup({
      title: "Sizing active load",
      body: "Sizing active load is the final design active load used after maximum demand and reserve are considered.",
      formula: "Formula: Sizing active load = maximum demand x (1 + sizing reserve percentage).",
      substitution: `${numberFormat(summary.designRealKw, 3)} kW = ${numberFormat(summary.peakRealKw, 3)} kW x (1 + ${numberFormat(summary.growthMargin * 100, 1)}%).`,
      total: `Sizing active load = ${numberFormat(summary.designRealKw, 3)} kW`,
    }),
    calculationDetailCardMarkup({
      title: "Sizing reserve",
      body: "Sizing reserve is the extra margin added after maximum demand. It allows for future load growth or a conservative design allowance.",
      formula: "Formula: Reserve amount = maximum demand x reserve percentage",
      substitution: `${numberFormat(reserveKw, 3)} kW = ${numberFormat(summary.peakRealKw, 3)} kW x ${numberFormat(summary.growthMargin * 100, 1)}%. ${numberFormat(reserveKva, 3)} kVA = ${numberFormat(summary.peakApparentKva, 3)} kVA x ${numberFormat(summary.growthMargin * 100, 1)}%.`,
      total: `Reserve added = ${numberFormat(reserveKw, 3)} kW`,
    }),
    calculationDetailCardMarkup({
      title: "Sizing current",
      body: "Sizing current is calculated from the design apparent load and the recommended supply voltage. Apparent power is used here, so power factor affects the current even when the connected load in kW stays the same.",
      formula: currentFormula,
      substitution: currentSubstitution,
      total: `Recommended sizing current = ${numberFormat(recommendation.recommendedCurrentA, 1)} A`,
    }),
    calculationDetailCardMarkup({
      title: "Cable voltage drop",
      body: recommendation.voltageDropChecked
        ? "Cable sizing starts with the design current, but current capacity alone may not be enough. Long cable runs can cause excessive voltage drop, which means the appliance or distribution board receives less voltage than expected.\n\nEnter the main cable run length under Load Study Settings so the app can check voltage drop. If the selected cable size causes voltage drop above the chosen limit, the app will recommend a larger cable."
        : "Cable sizing starts with the design current, but current capacity alone may not be enough. Long cable runs can cause excessive voltage drop, which means the appliance or distribution board receives less voltage than expected.\n\nEnter the main cable run length under Load Study Settings so the app can check voltage drop. If the selected cable size causes voltage drop above the chosen limit, the app will recommend a larger cable.",
      formula: recommendation.voltageDropChecked
        ? "Formula: Voltage drop (V) = cable drop factor x current x one-way run length / 1000. Percent drop = voltage drop / supply voltage x 100."
        : "",
      substitution: recommendation.voltageDropChecked && recommendation.estimatedVoltageDropPercent !== null
        ? `${numberFormat(recommendation.estimatedVoltageDropV, 2)} V = ${numberFormat(recommendation.voltageDropFactorMvPerAmpPerM, 2)} mV/A/m x ${numberFormat(recommendation.recommendedCurrentA, 1)} A x ${numberFormat(summary.mainRunLengthM ?? 0, 0)} m / 1000`
        : "",
      total: recommendation.voltageDropChecked && recommendation.estimatedVoltageDropPercent !== null
        ? `Estimated voltage drop = ${numberFormat(recommendation.estimatedVoltageDropV, 2)} V (${numberFormat(recommendation.estimatedVoltageDropPercent, 2)}%) against the selected ${numberFormat(recommendation.voltageDropLimitPercent, 0)}% ${recommendation.voltageDropBasisLabel} limit.`
        : "Selected voltage-drop limit: 5% maximum voltage drop for the selected feeder/appliance supply path.",
    }),
    calculationDetailCardMarkup({
      title: "Estimated Monthly energy",
      body: "Monthly billing energy is calculated from connected watts, user hours and appliance duty cycle. Sizing diversity is not used here. If voltage stability is set to unstable, the app may apply a conservative adjustment to cooling appliance duty cycles for energy-estimation purposes only. ",
      formula: "Formula: kWh = quantity x watts x hours/day x duty cycle x days/month / 1000",
      total: `Total monthly energy = ${numberFormat(summary.monthlyEnergyKwh, 1)} kWh`,
    }),
  ].join("");
}

function renderSummary(study) {
  const { recommendation, summary } = study;
  const cards = [
    {
      label: "Connected load",
      value: `${numberFormat(summary.connectedKw, 2)} kW`,
      icon: "bolt",
    },
    {
      label: "Maximum active demand",
      value: `${numberFormat(summary.peakRealKw, 2)} kW`,
      icon: "gauge",
    },
    {
      label: "Maximum apparent demand",
      value: `${numberFormat(summary.peakApparentKva, 2)} kVA`,
      icon: "wave",
    },
    {
      label: "Sizing active load",
      value: `${numberFormat(summary.designRealKw, 2)} kW`,
      icon: "bolt",
    },
    {
      label: "Sizing apparent load",
      value: `${numberFormat(summary.designApparentKva, 2)} kVA`,
      icon: "frequency",
    },
    {
      label: "Design current",
      value: `${numberFormat(recommendation.recommendedCurrentA, 1)} A`,
      icon: "amp",
    },
    {
      label: "Main breaker size",
      value: recommendation.mainBreakerSize,
      icon: "shield",
    },
    {
      label: "Recommended cable",
      value: recommendation.recommendedCable,
      icon: "cable",
    },
    {
      label: "Estimated monthly energy",
      value: `${numberFormat(summary.monthlyEnergyKwh, 1)} kWh`,
      icon: "bars",
      wide: true,
    },
  ];

  elements.summaryCards.innerHTML = cards.map((card) => summaryCardMarkup(card)).join("");
  renderCalculationDetails(study);
  updateCalculationDetailsToggle();
}

function renderRecommendation(study) {
  const { recommendation, summary } = study;
  const categoryChips = [recommendation.meterClass];
  const isSlt = recommendation.meterClass === "SLT";
  const customerCategoryLabel = isSlt
    ? "SLT"
    : summary.customerCategory === "residential"
      ? "Residential / Non-SLT LV"
      : "Non-Residential / Non-SLT LV";
  const whyItems = isSlt
    ? [
        "Customer classification is based on maximum apparent demand before reserve.",
        `Maximum apparent demand is ${numberFormat(summary.peakApparentKva, 2)} kVA, which is at or above the ${numberFormat(100, 0)} kVA SLT threshold.`,
        "The customer therefore remains in the SLT category, subject to utility approval.",
        `The ${numberFormat(summary.designApparentKva, 2)} kVA sizing apparent load includes a ${numberFormat(summary.growthMargin * 100, 0)}% design reserve and is used for design current, breaker, and cable screening, not tariff classification.`,
      ]
    : [
        "Customer classification is based on maximum apparent demand before reserve.",
        `Maximum apparent demand is ${numberFormat(summary.peakApparentKva, 2)} kVA, which is below the ${numberFormat(100, 0)} kVA SLT threshold.`,
        `The customer therefore remains in the ${customerCategoryLabel} category, subject to utility approval.`,
        `The ${numberFormat(summary.designApparentKva, 2)} kVA sizing apparent load includes a ${numberFormat(summary.growthMargin * 100, 0)}% design reserve and is used for design current, breaker, and cable screening, not tariff classification.`,
      ];
  const importantNotes = [
    "Enter the main cable run length under Load Study Settings so the app can check voltage drop. If the selected cable size causes voltage drop above the chosen limit, the app will recommend a larger cable.",
  ];
  const whySummary = isSlt
    ? `Maximum apparent demand is ${numberFormat(summary.peakApparentKva, 2)} kVA, so the customer remains in the SLT category, subject to utility approval.`
    : `The maximum apparent demand is below the 100 kVA SLT threshold, so the customer remains in the ${customerCategoryLabel} range, subject to utility approval.`;
  const warningsSection = importantNotes.length
    ? `
      <article class="recommendation-card__section">
        <div class="recommendation-card__section-title">
          <span class="recommendation-card__section-icon recommendation-card__section-icon--info">${uiIconMarkup("info")}</span>
          <h3>Important note</h3>
        </div>
        ${importantNotes.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
      </article>
    `
    : "";

  elements.recommendationCard.innerHTML = `
    <section class="recommendation-card__hero">
      <div class="recommendation-card__tower" aria-hidden="true"></div>
      <div class="chip-row">
        ${categoryChips
          .map((chip, index) => `<span class="chip ${index === 0 ? "chip--accent" : "chip--surface"}">${uiIconMarkup("check", "chip__icon")}${escapeHtml(chip)}</span>`)
          .join("")}
      </div>
      <h3 class="recommendation-card__title">${escapeHtml(recommendation.meterSetup)}</h3>
      <p>Calculated design current: ${numberFormat(recommendation.recommendedCurrentA, 1)} A at ${escapeHtml(recommendation.serviceVoltage)}</p>
      <div class="recommendation-card__facts">
        <span>${uiIconMarkup("plug")}<strong>${numberFormat(recommendation.currentVoltageV, 0)} V</strong><small>Voltage</small></span>
        <span>${uiIconMarkup("frequency")}<strong>50 Hz</strong><small>Frequency</small></span>
        <span>${uiIconMarkup("service")}<strong>${recommendation.currentFormulaMode === "three-phase" ? "3-phase" : "2-wire"}</strong><small>Service</small></span>
      </div>
      <div class="recommendation-card__checks">
        <p>${uiIconMarkup("check")}<span>Recommended supply: ${escapeHtml(recommendation.feeder)}</span></p>
        <p>${uiIconMarkup("check")}<span>Recommended main breaker: ${escapeHtml(recommendation.mainBreakerSize)}, subject to cable ampacity and utility requirements</span></p>
        <p>${uiIconMarkup("check")}<span>Recommended cable: ${escapeHtml(recommendation.recommendedCable)}, subject to cable length, installation method, voltage drop, and local code requirements</span></p>
        <p>${uiIconMarkup("check")}<span>Customer category: ${escapeHtml(customerCategoryLabel)}</span></p>
      </div>
    </section>

    <div class="recommendation-card__grid">
      <article class="recommendation-card__section">
        <div class="recommendation-card__section-title">
          <span class="recommendation-card__section-icon recommendation-card__section-icon--success">${uiIconMarkup("house")}</span>
          <h3>Why this recommendation</h3>
        </div>
        <p>${escapeHtml(whySummary)}</p>
      </article>
      ${warningsSection}
    </div>
  `;
}

function renderBreakdown(study) {
  if (!study.breakdown.length) {
    elements.breakdownBars.innerHTML = "<div class='empty-state'>Add loads to see the category breakdown.</div>";
    return;
  }

  const totalEnergy = study.breakdown.reduce((sum, item) => sum + item.monthlyEnergyKwh, 0);
  const totalPower = study.breakdown.reduce((sum, item) => sum + item.connectedKw, 0);
  const maxConnected = Math.max(...study.breakdown.map((item) => item.connectedKw), 0);
  let runningShare = 0;
  const gradientStops = [];
  const gaugeLabels = [];
  const legendItems = [];
  const gaugeCenter = 180;
  const gaugeLabelRadius = 136;
  const rows = study.breakdown.map((item, index) => {
    const share = totalEnergy > 0 ? item.monthlyEnergyKwh / totalEnergy : 0;
    const visibleStart = runningShare * 50;
    const visibleEnd = visibleStart + share * 50;
    const percent = share * 100;
    const { color, subtitle } = categoryVisual(item.category, index);
    gradientStops.push(`${color} ${visibleStart}% ${visibleEnd}%`);
    const midAngle = 180 + (runningShare + share / 2) * 180;
    const radians = (midAngle * Math.PI) / 180;
    const labelX = gaugeCenter + Math.cos(radians) * gaugeLabelRadius;
    const labelY = gaugeCenter + Math.sin(radians) * gaugeLabelRadius;
    if (percent >= 5) {
      gaugeLabels.push(
        `<span class="load-mix__gauge-label" style="left:${labelX}px;top:${labelY}px">${numberFormat(percent, 1)}%</span>`,
      );
    }
    legendItems.push(`
      <span class="load-mix__legend-item">
        <span class="load-mix__legend-dot" style="--legend-color:${color}"></span>
        <span>${escapeHtml(item.category)}</span>
      </span>
    `);
    runningShare += share;

    return `
      <div class="load-mix__table-row">
        <div class="load-mix__category-cell">
          ${categoryIconMarkup(item.category, index)}
          <div>
            <strong>${escapeHtml(item.category)}</strong>
            <span>${escapeHtml(subtitle)}</span>
          </div>
        </div>
        <div class="load-mix__progress">
          <span class="load-mix__progress-fill" style="--fill-color:${color};width:${maxConnected ? (item.connectedKw / maxConnected) * 100 : 0}%"></span>
        </div>
        <div class="load-mix__metric">${numberFormat(item.connectedKw, 2)} kW</div>
        <div class="load-mix__metric">${numberFormat(item.monthlyEnergyKwh, 1)} kWh</div>
      </div>
    `;
  });

  elements.breakdownBars.innerHTML = `
    <section class="load-mix">
      <div class="load-mix__chart-column">
        <div class="load-mix__gauge" style="--gauge-gradient:conic-gradient(from 270deg, ${gradientStops.join(", ")}, #e8edf3 ${Math.max(runningShare * 50, 0)}% 50%, transparent 50% 100%);">
          <div class="load-mix__gauge-ring"></div>
          <div class="load-mix__gauge-cutout"></div>
          ${gaugeLabels.join("")}
          <div class="load-mix__gauge-center">
            <strong>${numberFormat(study.summary.monthlyEnergyKwh, 1)}</strong>
            <span>kWh</span>
            <p>Total Monthly Energy</p>
          </div>
        </div>
        <div class="load-mix__legend">
          ${legendItems.join("")}
        </div>
      </div>

      <div class="load-mix__table">
        <div class="load-mix__table-head">
          <span>Category</span>
          <span></span>
          <span>Power (kW)</span>
          <span>Energy (kWh / month)</span>
        </div>
        ${rows.join("")}
        <div class="load-mix__table-total">
          <span>Total</span>
          <span></span>
          <strong>${numberFormat(totalPower, 2)} kW</strong>
          <strong>${numberFormat(totalEnergy, 1)} kWh</strong>
        </div>
      </div>
    </section>
  `;
}

function buildEnergyChargeFormula(tariffEstimate) {
  if (!tariffEstimate.energyBlocks.length) {
    return "No charge";
  }

  const parts = tariffEstimate.energyBlocks.map(
    (block) =>
      `${numberFormat(block.unitsKwh, 3)} kWh x ${numberFormat(block.rateGhpPerKwh / 100, 6)} GHS/kWh = ${currencyFormat(block.chargeGhs)}`,
  );

  return parts.length === 1 ? parts[0] : `${parts.join(" + ")}; total = ${currencyFormat(tariffEstimate.energyChargeGhs)}`;
}

function buildBillLineItems(study) {
  const { tariffEstimate } = study;
  const rates = tariffEstimate.taxRates;
  const labels = tariffEstimate.taxBasisLabels;
  const taxFormula = tariffEstimate.isResidentialTaxExempt
    ? "Residential customers are exempt from tax = GH₵0.00"
    : `${numberFormat(rates.taxRate * 100, 1)}% x (${labels.basisLabel}) = ${currencyFormat(tariffEstimate.taxGhs)}`;
  const totalFormula = tariffEstimate.isResidentialTaxExempt
    ? "Energy charge + Service charge + Demand charge + Levy"
    : "Energy charge + Service charge + Demand charge + Levy + Tax";
  const displayTaxFormula = tariffEstimate.isResidentialTaxExempt
    ? `Residential customers are exempt from tax = ${currencyFormat(0)}`
    : taxFormula;

  return [
    {
      item: "Energy charge",
      formula: buildEnergyChargeFormula(tariffEstimate),
      value: tariffEstimate.energyChargeGhs,
    },
    {
      item: "Service charge",
      formula: `Monthly service charge = ${currencyFormat(tariffEstimate.serviceChargeGhs)}`,
      value: tariffEstimate.serviceChargeGhs,
    },
    ...(study.recommendation.meterClass === "SLT"
      ? [
          {
            item: "Maximum demand charge",
            formula: `${numberFormat(tariffEstimate.demandQuantityKva, 2)} kVA x ${numberFormat(tariffEstimate.demandRateGhpPerKva / 100, 6)} GHS/kVA/month = ${currencyFormat(tariffEstimate.demandChargeGhs)}`,
            value: tariffEstimate.demandChargeGhs,
          },
        ]
      : []),
    {
      item: labels.levyLabel,
      formula: `${numberFormat(rates.levyRate * 100, 1)}% x Energy charge = ${currencyFormat(tariffEstimate.levyGhs)}`,
      value: tariffEstimate.levyGhs,
    },
    {
      item: labels.taxLabel,
      formula: displayTaxFormula,
      value: tariffEstimate.taxGhs,
    },
    {
      item: "Estimated total bill",
      formula: totalFormula,
      value: tariffEstimate.totalGhs,
    },
  ];
}

function excelValue(value) {
  return escapeHtml(value);
}

function breakdownPieSvgDataUri(breakdown) {
  const totalEnergy = breakdown.reduce((sum, item) => sum + item.monthlyEnergyKwh, 0);
  const cx = 110;
  const cy = 110;
  const radius = 86;
  let startAngle = -90;

  const pointOnCircle = (angle) => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: cx + Math.cos(radians) * radius,
      y: cy + Math.sin(radians) * radius,
    };
  };

  const slices = breakdown.map((item, index) => {
    const share = totalEnergy > 0 ? item.monthlyEnergyKwh / totalEnergy : 0;
    const endAngle = startAngle + share * 360;
    const start = pointOnCircle(startAngle);
    const end = pointOnCircle(endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    const { color } = categoryVisual(item.category, index);
    const path = `M ${cx} ${cy} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
    startAngle = endAngle;
    return `<path d="${path}" fill="${color}"></path>`;
  });

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="260" height="220" viewBox="0 0 260 220">
      <rect width="260" height="220" rx="18" fill="#ffffff"/>
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#eef3f9"/>
      ${slices.join("")}
      <circle cx="${cx}" cy="${cy}" r="38" fill="#ffffff"/>
      <text x="${cx}" y="108" text-anchor="middle" font-family="Calibri, Arial, sans-serif" font-size="26" font-weight="700" fill="#11274a">${numberFormat(totalEnergy, 0)}</text>
      <text x="${cx}" y="131" text-anchor="middle" font-family="Calibri, Arial, sans-serif" font-size="15" fill="#445b78">kWh</text>
      <text x="${cx}" y="151" text-anchor="middle" font-family="Calibri, Arial, sans-serif" font-size="12" fill="#60738b">Total Monthly Energy</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function buildExcelLoadMixCard(study) {
  const totalEnergy = study.breakdown.reduce((sum, item) => sum + item.monthlyEnergyKwh, 0);
  const totalPower = study.breakdown.reduce((sum, item) => sum + item.connectedKw, 0);
  const maxConnected = Math.max(...study.breakdown.map((item) => item.connectedKw), 0);
  const chartUri = breakdownPieSvgDataUri(study.breakdown);
  const rows = study.breakdown.map((item, index) => {
    const { color, subtitle } = categoryVisual(item.category, index);
    return `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #d8e1ec;">
          <span style="display:inline-block;width:12px;height:12px;border-radius:999px;background:${color};margin-right:8px;"></span>
          <strong style="color:#17335b;font-size:14px;">${excelValue(item.category)}</strong><br />
          <span style="color:#657b95;font-size:12px;">${excelValue(subtitle)}</span>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #d8e1ec;">
          <div style="height:10px;background:#e7ecf3;border-radius:999px;overflow:hidden;">
            <div style="height:10px;width:${maxConnected ? (item.connectedKw / maxConnected) * 100 : 0}%;background:${color};border-radius:999px;"></div>
          </div>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #d8e1ec;color:#17335b;font-size:14px;white-space:nowrap;">${numberFormat(item.connectedKw, 2)} kW</td>
        <td style="padding:10px 8px;border-bottom:1px solid #d8e1ec;color:#17335b;font-size:14px;white-space:nowrap;">${numberFormat(item.monthlyEnergyKwh, 1)} kWh</td>
      </tr>
    `;
  }).join("");

  return `
    <table style="width:100%;border-collapse:collapse;border:1px solid #d8e1ec;border-radius:18px;overflow:hidden;background:#ffffff;">
      <tr>
        <td colspan="2" style="padding:18px 20px 8px 20px;vertical-align:top;">
          <div style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#17335b;">Load Mix</div>
          <div style="font-size:19px;font-weight:700;color:#11274a;margin-top:4px;">Category Breakdown</div>
          <div style="font-size:12px;color:#60738b;margin-top:4px;">See which category is driving the total load.</div>
        </td>
        <td style="padding:18px 20px 8px 20px;text-align:right;vertical-align:top;"></td>
      </tr>
      <tr>
        <td style="width:260px;padding:0 16px 16px 20px;vertical-align:top;">
          <img src="${chartUri}" alt="Load mix pie chart" style="width:240px;height:auto;display:block;" />
        </td>
        <td colspan="2" style="padding:0 20px 18px 0;vertical-align:top;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <th style="padding:8px 8px 12px 8px;text-align:left;color:#294f84;font-size:13px;text-transform:uppercase;border-bottom:1px solid #d8e1ec;">Category</th>
              <th style="padding:8px 8px 12px 8px;text-align:left;color:#294f84;font-size:13px;text-transform:uppercase;border-bottom:1px solid #d8e1ec;"></th>
              <th style="padding:8px 8px 12px 8px;text-align:right;color:#294f84;font-size:13px;text-transform:uppercase;border-bottom:1px solid #d8e1ec;">Power (kW)</th>
              <th style="padding:8px 8px 12px 8px;text-align:right;color:#294f84;font-size:13px;text-transform:uppercase;border-bottom:1px solid #d8e1ec;">Energy (kWh / month)</th>
            </tr>
            ${rows}
            <tr>
              <td style="padding:12px 8px 0 8px;font-size:14px;font-weight:700;color:#11274a;text-transform:uppercase;">Total</td>
              <td></td>
              <td style="padding:12px 8px 0 8px;text-align:right;font-size:14px;font-weight:700;color:#11274a;">${numberFormat(totalPower, 2)} kW</td>
              <td style="padding:12px 8px 0 8px;text-align:right;font-size:14px;font-weight:700;color:#11274a;">${numberFormat(totalEnergy, 1)} kWh</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function downloadFile(filename, contents, mimeType) {
  const blob = contents instanceof Blob ? contents : new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildLoadItemExcel(study) {
  const columns = [
    "Load Item",
    "Category",
    "Quantity",
    "Equivalent Wattage per Unit (W)",
    "Energy Duty Cycle (%)",
    "Hours of Usage per Day",
    "Days per Month",
    "Daily Consumption (kWh)",
    "Monthly Consumption (kWh)",
  ];

  const bodyRows = study.rows.map((row) => [
      row.name,
      row.category,
      row.quantity,
      numberFormat(row.realKwPerUnit * 1000, 2),
      numberFormat(row.dutyCycleBilling * 100, 0),
      numberFormat(row.hoursPerDay, 2),
      numberFormat(row.daysPerMonth, 0),
      numberFormat(row.dailyEnergyKwh, 3),
      numberFormat(row.monthlyEnergyKwh, 3),
    ]);

  const summaryRows = [
    ["Prepared For", state.currentUser?.name ?? ""],
    ["Connected Load", `${numberFormat(study.summary.connectedKw, 3)} kW`],
    ["Maximum Active Demand", `${numberFormat(study.summary.peakRealKw, 3)} kW`],
    ["Maximum Apparent Demand", `${numberFormat(study.summary.peakApparentKva, 3)} kVA`],
    ["Sizing Reserve", `${numberFormat(study.summary.growthMargin * 100, 1)}%`],
    ["Voltage Stability", state.siteProfile.voltageStability === "unstable" ? "Unstable / fluctuating supply" : "Stable supply"],
    ["Main Run Length", state.siteProfile.mainRunLengthM === "" ? "Not entered" : `${numberFormat(state.siteProfile.mainRunLengthM, 0)} m`],
    ["Sizing Active Load", `${numberFormat(study.summary.designRealKw, 3)} kW`],
    ["Sizing Apparent Load", `${numberFormat(study.summary.designApparentKva, 3)} kVA`],
    ["Design Current", `${numberFormat(study.recommendation.recommendedCurrentA, 1)} A`],
    ["Main Breaker Size", study.recommendation.mainBreakerSize],
    ["Recommended Cable", study.recommendation.recommendedCable],
    ["Estimated Monthly Energy", `${numberFormat(study.summary.monthlyEnergyKwh, 3)} kWh`],
  ];

  const tableRows = [
    `<tr>${columns.map((column) => `<th>${excelValue(column)}</th>`).join("")}</tr>`,
    ...bodyRows.map((row) => `<tr>${row.map((cell, index) => `<td${index >= 2 ? ' class="number"' : ""}>${excelValue(cell)}</td>`).join("")}</tr>`),
  ].join("");

  const summaryTable = summaryRows
    .map((row) => `<tr><td class="summary-label">${excelValue(row[0])}</td><td class="summary-value">${excelValue(row[1])}</td></tr>`)
    .join("");

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Load Items</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          body { font-family: Calibri, Arial, sans-serif; color: #11274a; }
          .sheet-title { font-size: 26px; font-weight: 700; margin: 0 0 6px; }
          .prepared-for { font-size: 18px; margin: 0 0 10px; }
          .summary-table, .detail-table { border-collapse: collapse; }
          .summary-table td, .summary-table th, .detail-table td, .detail-table th { border: 1px solid #2b2b2b; }
          .summary-table th { background: #d9e2f3; font-size: 16px; text-align: center; padding: 4px 8px; }
          .summary-table td { padding: 3px 8px; font-size: 14px; }
          .summary-label { width: 180px; }
          .summary-value { width: 130px; font-weight: 600; }
          .detail-table th { background: #d9e2f3; padding: 6px 8px; font-size: 14px; text-align: center; }
          .detail-table td { padding: 4px 6px; font-size: 13px; }
          .number { text-align: right; }
          .top-layout { width: 100%; border-collapse: collapse; }
          .top-layout td { vertical-align: top; border: none; }
        </style>
      </head>
      <body>
        <div class="sheet-title">Electrical Load Estimation Platform</div>
        <div class="prepared-for">PREPARED FOR : ${excelValue((state.currentUser?.name ?? "").toUpperCase())}</div>
        <table class="top-layout">
          <tr>
            <td style="width:340px;padding-right:22px;">
              <table class="summary-table">
                <tr><th colspan="2">SUMMARY TABLE</th></tr>
                ${summaryTable}
              </table>
            </td>
            <td>
              ${buildExcelLoadMixCard(study)}
            </td>
          </tr>
        </table>
        <br />
        <table class="detail-table">${tableRows}</table>
      </body>
    </html>
  `;
}

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function excelColumnName(index) {
  let name = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function xlsxCell(row, column, value, style = 0) {
  const ref = `${excelColumnName(column)}${row}`;
  const styleAttr = style ? ` s="${style}"` : "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"${styleAttr}><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t>${xmlEscape(value)}</t></is></c>`;
}

function xlsxRow(rowNumber, cells) {
  return `<row r="${rowNumber}">${cells.join("")}</row>`;
}

function buildLoadItemWorkbookModel(study) {
  const summaryRows = [
    ["Prepared For", state.currentUser?.name ?? ""],
    ["Connected Load", `${numberFormat(study.summary.connectedKw, 2)} kW`],
    ["Maximum Active Demand", `${numberFormat(study.summary.peakRealKw, 2)} kW`],
    ["Maximum Apparent Demand", `${numberFormat(study.summary.peakApparentKva, 3)} kVA`],
    ["Sizing Reserve", `${numberFormat(study.summary.growthMargin * 100, 0)}%`],
    ["Voltage Stability", state.siteProfile.voltageStability === "unstable" ? "Unstable / fluctuating supply" : "Stable supply"],
    ["Main Run Length", state.siteProfile.mainRunLengthM === "" ? "Not entered" : `${numberFormat(state.siteProfile.mainRunLengthM, 0)} m`],
    ["Sizing Active Load", `${numberFormat(study.summary.designRealKw, 3)} kW`],
    ["Sizing Apparent Load", `${numberFormat(study.summary.designApparentKva, 3)} kVA`],
    ["Design Current", `${numberFormat(study.recommendation.recommendedCurrentA, 1)} A`],
    ["Main Breaker Size", study.recommendation.mainBreakerSize],
    ["Recommended Cable", study.recommendation.recommendedCable],
    ["Estimated Monthly Energy", `${numberFormat(study.summary.monthlyEnergyKwh, 2)} kWh`],
  ];
  const detailHeaders = [
    "Load Item",
    "Category",
    "Quantity",
    "Equivalent Wattage per Unit (W)",
    "Energy Duty Cycle (%)",
    "Hours of Usage per Day",
    "Days per Month",
    "Daily Consumption (kWh)",
    "Monthly Consumption (kWh)",
  ];
  const detailRows = study.rows.map((row) => [
    row.name,
    row.category,
    row.quantity,
    Number((row.realKwPerUnit * 1000).toFixed(2)),
    Number((row.dutyCycleBilling * 100).toFixed(0)),
    Number(row.hoursPerDay.toFixed(2)),
    Number(row.daysPerMonth.toFixed(0)),
    Number(row.dailyEnergyKwh.toFixed(3)),
    Number(row.monthlyEnergyKwh.toFixed(3)),
  ]);
  const chartRows = study.breakdown.map((item) => [
    item.category,
    Number(item.monthlyEnergyKwh.toFixed(2)),
  ]);

  return { summaryRows, detailHeaders, detailRows, chartRows };
}

function buildWorksheetXml(study) {
  const { summaryRows, detailHeaders, detailRows, chartRows } = buildLoadItemWorkbookModel(study);
  const rowCells = new Map();
  const addCell = (row, cell) => {
    if (!rowCells.has(row)) rowCells.set(row, []);
    rowCells.get(row).push(cell);
  };

  addCell(1, xlsxCell(1, 1, "Electrical Load Estimation Platform", 1));
  addCell(2, xlsxCell(2, 1, `PREPARED FOR : ${(state.currentUser?.name ?? "").toUpperCase()}`, 2));
  addCell(3, xlsxCell(3, 1, "SUMMARY TABLE", 3));
  addCell(3, xlsxCell(3, 2, "", 3));

  summaryRows.forEach((entry, index) => {
    const row = 4 + index;
    addCell(row, xlsxCell(row, 1, entry[0], 4));
    addCell(row, xlsxCell(row, 2, entry[1], 5));
  });

  addCell(3, xlsxCell(3, 10, "WHICH CATEGORY IS DRIVING THE TOTAL LOAD?", 2));
  addCell(4, xlsxCell(4, 10, "Category", 3));
  addCell(4, xlsxCell(4, 11, "Energy (kWh / month)", 3));
  chartRows.forEach((entry, index) => {
    const row = 5 + index;
    addCell(row, xlsxCell(row, 10, entry[0], 4));
    addCell(row, xlsxCell(row, 11, entry[1], 6));
  });

  const detailStart = 22;
  detailHeaders.forEach((header, index) => addCell(detailStart, xlsxCell(detailStart, index + 1, header, 3)));
  detailRows.forEach((entry, index) => {
    const row = detailStart + 1 + index;
    entry.forEach((cell, columnIndex) => {
      addCell(row, xlsxCell(row, columnIndex + 1, cell, columnIndex >= 2 ? 6 : 4));
    });
  });

  const lastRow = Math.max(detailStart + detailRows.length, 8);
  const rows = [...rowCells.entries()]
    .sort(([a], [b]) => a - b)
    .map(([row, cells]) => xlsxRow(row, cells))
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="A1:K${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="22" customWidth="1"/>
    <col min="2" max="2" width="20" customWidth="1"/>
    <col min="3" max="3" width="9" customWidth="1"/>
    <col min="4" max="4" width="22" customWidth="1"/>
    <col min="5" max="5" width="16" customWidth="1"/>
    <col min="6" max="6" width="17" customWidth="1"/>
    <col min="7" max="7" width="15" customWidth="1"/>
    <col min="8" max="8" width="18" customWidth="1"/>
    <col min="9" max="9" width="30" customWidth="1"/>
    <col min="10" max="10" width="19" customWidth="1"/>
    <col min="11" max="11" width="31" customWidth="1"/>
  </cols>
  <sheetData>${rows}</sheetData>
  <autoFilter ref="J4:K${4 + chartRows.length}"/>
  <mergeCells count="2">
    <mergeCell ref="A3:B3"/>
    <mergeCell ref="J3:K3"/>
  </mergeCells>
  <drawing r:id="rId1"/>
</worksheet>`;
}

function buildChartXml(chartRowCount) {
  const lastRow = 4 + chartRowCount;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:date1904 val="0"/>
  <c:lang val="en-US"/>
  <c:chart>
    <c:title>
      <c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1400"/><a:t>Energy (kWh / month)</a:t></a:r></a:p></c:rich></c:tx>
      <c:layout/>
      <c:overlay val="0"/>
    </c:title>
    <c:plotArea>
      <c:layout/>
      <c:pieChart>
        <c:varyColors val="1"/>
        <c:ser>
          <c:idx val="0"/>
          <c:order val="0"/>
          <c:cat><c:strRef><c:f>'Load Items'!$J$5:$J$${lastRow}</c:f></c:strRef></c:cat>
          <c:val><c:numRef><c:f>'Load Items'!$K$5:$K$${lastRow}</c:f></c:numRef></c:val>
          <c:dLbls>
            <c:showLegendKey val="0"/>
            <c:showVal val="0"/>
            <c:showCatName val="0"/>
            <c:showSerName val="0"/>
            <c:showPercent val="1"/>
            <c:showLeaderLines val="0"/>
          </c:dLbls>
        </c:ser>
        <c:firstSliceAng val="270"/>
      </c:pieChart>
    </c:plotArea>
    <c:legend>
      <c:legendPos val="b"/>
      <c:layout/>
      <c:overlay val="0"/>
    </c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
  <c:printSettings>
    <c:headerFooter/>
    <c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/>
    <c:pageSetup/>
  </c:printSettings>
</c:chartSpace>`;
}

function buildDrawingXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>3</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>8</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>18</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame>
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="2" name="Energy chart"/>
        <xdr:cNvGraphicFramePr/>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><color rgb="FF002060"/><name val="Cambria"/></font>
    <font><b/><sz val="16"/><color rgb="FF002060"/><name val="Cambria"/></font>
    <font><b/><sz val="11"/><color rgb="FF002060"/><name val="Cambria"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9E2F3"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

const crc32Table = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(bytes, value) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(bytes, value) {
  bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function textBytes(value) {
  return new TextEncoder().encode(value);
}

function zipBlob(files) {
  const output = [];
  const centralDirectory = [];
  let offset = 0;

  files.forEach(({ name, content }) => {
    const nameBytes = textBytes(name);
    const dataBytes = textBytes(content);
    const checksum = crc32(dataBytes);
    const local = [];
    writeUint32(local, 0x04034b50);
    writeUint16(local, 20);
    writeUint16(local, 0);
    writeUint16(local, 0);
    writeUint16(local, 0);
    writeUint16(local, 0);
    writeUint32(local, checksum);
    writeUint32(local, dataBytes.length);
    writeUint32(local, dataBytes.length);
    writeUint16(local, nameBytes.length);
    writeUint16(local, 0);
    output.push(new Uint8Array(local), nameBytes, dataBytes);

    const central = [];
    writeUint32(central, 0x02014b50);
    writeUint16(central, 20);
    writeUint16(central, 20);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, checksum);
    writeUint32(central, dataBytes.length);
    writeUint32(central, dataBytes.length);
    writeUint16(central, nameBytes.length);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint16(central, 0);
    writeUint32(central, 0);
    writeUint32(central, offset);
    centralDirectory.push(new Uint8Array(central), nameBytes);
    offset += local.length + nameBytes.length + dataBytes.length;
  });

  const centralOffset = offset;
  const centralSize = centralDirectory.reduce((sum, part) => sum + part.length, 0);
  const end = [];
  writeUint32(end, 0x06054b50);
  writeUint16(end, 0);
  writeUint16(end, 0);
  writeUint16(end, files.length);
  writeUint16(end, files.length);
  writeUint32(end, centralSize);
  writeUint32(end, centralOffset);
  writeUint16(end, 0);

  return new Blob([...output, ...centralDirectory, new Uint8Array(end)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function buildLoadItemXlsx(study) {
  const chartRowCount = study.breakdown.length;
  const files = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    },
    {
      name: "docProps/core.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Electrical Load Estimation Platform</dc:title><dc:creator>Load Estimator</dc:creator><cp:lastModifiedBy>Load Estimator</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified></cp:coreProperties>`,
    },
    {
      name: "docProps/app.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Load Estimator</Application></Properties>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Load Items" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/styles.xml", content: buildStylesXml() },
    { name: "xl/worksheets/sheet1.xml", content: buildWorksheetXml(study) },
    {
      name: "xl/worksheets/_rels/sheet1.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`,
    },
    { name: "xl/drawings/drawing1.xml", content: buildDrawingXml() },
    {
      name: "xl/drawings/_rels/drawing1.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>`,
    },
    { name: "xl/charts/chart1.xml", content: buildChartXml(chartRowCount) },
  ];
  return zipBlob(files);
}

function exportLoadItemData() {
  collectFormState();
  const study = buildStudy(state.loadItems, state.siteProfile, UTILITY_PROFILES[0], state.tariffProfile);
  if (!study.rows.length) {
    setFooterNotice("Add at least one load item before exporting.");
    return;
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  downloadFile(
    `load-item-data-${dateStamp}.xlsx`,
    buildLoadItemXlsx(study),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  setFooterNotice("Load item data exported.");
}

function diagnosticMarkup(diagnostic) {
  if (!diagnostic) return "";

  const differencePercent = diagnostic.differencePercentage === null
    ? "N/A"
    : `${numberFormat(diagnostic.differencePercentage, 1)}%`;

  return `
    <article class="tariff-box">
      <h3>Meter Reading Diagnostic</h3>
      <ul class="list-tight">
        <li>Expected kWh: ${numberFormat(diagnostic.expectedKwh, 1)}</li>
        <li>Actual meter reading: ${numberFormat(diagnostic.actualKwh, 1)} kWh</li>
        <li>Difference: ${numberFormat(diagnostic.differenceKwh, 1)} kWh (${differencePercent})</li>
        <li>Flag: ${escapeHtml(diagnostic.flag)}</li>
      </ul>
    </article>
  `;
}

function renderTariffSummary(study) {
  const tariffEstimate = study.tariffEstimate;
  if (!tariffEstimate) {
    elements.tariffSummary.innerHTML = "<div class='empty-state'>Total bill estimate is not available.</div>";
    return;
  }

  const billLines = buildBillLineItems(study);

  elements.tariffSummary.innerHTML = `
    <section class="tariff-summary__hero">
      <p class="panel__eyebrow">Estimated Total Bill</p>
      <p class="tariff-summary__value">${currencyFormat(tariffEstimate.totalGhs)}</p>
    </section>
    <article class="tariff-box">
      <h3>Current Tariff Applied</h3>
      <div class="table-wrap">
        <table class="formula-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Current Tariff Applied</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            ${billLines
              .map(
                (line) => `
                  <tr>
                    <td>${escapeHtml(line.item)}</td>
                    <td>${escapeHtml(line.formula)}</td>
                    <td>${currencyFormat(line.value)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </article>
    ${diagnosticMarkup(study.billingDiagnostic)}
  `;
}

function renderPrintReport(study) {
  const billLines = buildBillLineItems(study);
  const preparedFor = state.currentUser?.name ?? "Not signed in";
  const summaryRows = [
    { label: "Billing category", value: study.recommendation.meterClass },
    { label: "Meter", value: study.recommendation.meterSetup },
    { label: "Sizing current", value: `${numberFormat(study.recommendation.recommendedCurrentA, 1)} A` },
    { label: "Feeder", value: study.recommendation.feeder },
    { label: "Supply basis", value: study.recommendation.serviceVoltage },
    { label: "Voltage stability", value: study.summary.voltageStability === "unstable" ? "Unstable / fluctuating supply" : "Stable supply" },
    { label: "Main run length", value: study.summary.mainRunLengthM === null ? "Not entered" : `${numberFormat(study.summary.mainRunLengthM, 0)} m` },
    { label: "Connected load", value: `${numberFormat(study.summary.connectedKw, 2)} kW` },
    { label: "Maximum active demand", value: `${numberFormat(study.summary.peakRealKw, 2)} kW` },
    { label: "Maximum apparent demand", value: `${numberFormat(study.summary.peakApparentKva, 2)} kVA` },
    { label: "Sizing active load", value: `${numberFormat(study.summary.designRealKw, 2)} kW` },
    { label: "Sizing apparent load", value: `${numberFormat(study.summary.designApparentKva, 2)} kVA` },
    { label: "Design current", value: `${numberFormat(study.recommendation.recommendedCurrentA, 1)} A` },
    { label: "Sizing reserve", value: `${numberFormat(study.summary.growthMargin * 100, 1)}%` },
    { label: "Main breaker size", value: study.recommendation.mainBreakerSize, isTotal: true },
    { label: "Recommended cable", value: study.recommendation.recommendedCable, isTotal: true },
    ...(study.recommendation.voltageDropChecked && study.recommendation.estimatedVoltageDropPercent !== null
      ? [{ label: "Estimated voltage drop", value: `${numberFormat(study.recommendation.estimatedVoltageDropPercent, 2)}%` }]
      : []),
    { label: "Estimated monthly energy", value: `${numberFormat(study.summary.monthlyEnergyKwh, 1)} kWh`, isTotal: true },
    { label: "Estimated total bill", value: currencyFormat(study.tariffEstimate.totalGhs), isTotal: true },
    { label: "Tariff class", value: study.tariffEstimate.bandLabel },
    { label: "Tariff profile", value: `${state.tariffProfile.label} (${state.tariffProfile.lastUpdated})` },
  ];

  elements.printReport.innerHTML = `
    <div class="print-report__sheet">
      <header class="print-report__header">
        <div>
          <h1>Load Estimation Report</h1>
        </div>
        <p>Generated ${escapeHtml(new Date().toLocaleString())}</p>
      </header>

      <section class="print-report__section">
        <h2 class="print-report__prepared-for">Prepared for : ${escapeHtml(preparedFor)}</h2>
        <h2>Recommendation Summary</h2>
        <table class="report-table">
          <tbody>
            ${summaryRows
              .map(
                (row) => `
                  <tr class="${row.isTotal ? "report-total-row" : ""}">
                    <th>${escapeHtml(row.label)}</th>
                    <td>${row.isTotal ? `<strong>${escapeHtml(row.value)}</strong>` : escapeHtml(row.value)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </section>

      <section class="print-report__section">
        <h2>Load Schedule</h2>
        <table class="report-table report-table--wide">
          <thead>
            <tr>
              <th>Load</th>
              <th>Category</th>
              <th>Qty</th>
              <th>Rating</th>
              <th>Unit</th>
              <th>PF</th>
              <th>Duty %</th>
              <th>Hours/day</th>
              <th>Days/month</th>
              <th>Connected kW</th>
              <th>Sizing kW</th>
              <th>Daily kWh</th>
              <th>Monthly kWh</th>
            </tr>
          </thead>
          <tbody>
            ${
              study.rows.length
                ? study.rows
                    .map(
                      (row) => `
                        <tr>
                          <td>${escapeHtml(row.name)}</td>
                          <td>${escapeHtml(row.category)}</td>
                          <td>${numberFormat(row.quantity, 0)}</td>
                          <td>${numberFormat(row.rating, 2)}</td>
                          <td>${escapeHtml(row.unit)}</td>
                          <td>${numberFormat(row.powerFactor, 2)}</td>
                          <td>${numberFormat(row.dutyCycleBilling * 100, 0)}%</td>
                          <td>${numberFormat(row.hoursPerDay, 1)}</td>
                          <td>${numberFormat(row.daysPerMonth, 0)}</td>
                          <td>${numberFormat(row.connectedKw, 2)}</td>
                          <td>${numberFormat(row.diversifiedKw, 2)}</td>
                          <td>${numberFormat(row.dailyEnergyKwh, 2)}</td>
                          <td>${numberFormat(row.monthlyEnergyKwh, 1)}</td>
                        </tr>
                      `,
                    )
                    .join("")
                : `
                  <tr>
                    <td colspan="13">No loads entered.</td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </section>

      <section class="print-report__section">
        <h2>Total Bill Breakdown</h2>
        <table class="report-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Current Tariff Applied</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            ${billLines
              .map(
                (line) => `
                  <tr class="${line.item === "Estimated total bill" ? "report-total-row" : ""}">
                    <td>${escapeHtml(line.item)}</td>
                    <td>${escapeHtml(line.formula)}</td>
                    <td class="report-amount">${currencyFormat(line.value)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </section>
      ${
        study.billingDiagnostic
          ? `
            <section class="print-report__section">
              <h2>Meter Reading Diagnostic</h2>
              <table class="report-table">
                <tbody>
                  <tr><th>Expected kWh</th><td>${numberFormat(study.billingDiagnostic.expectedKwh, 1)}</td></tr>
                  <tr><th>Actual meter reading</th><td>${numberFormat(study.billingDiagnostic.actualKwh, 1)} kWh</td></tr>
                  <tr><th>Difference</th><td>${numberFormat(study.billingDiagnostic.differenceKwh, 1)} kWh</td></tr>
                  <tr><th>Flag</th><td>${escapeHtml(study.billingDiagnostic.flag)}</td></tr>
                </tbody>
              </table>
            </section>
          `
          : ""
      }
    </div>
  `;
}

function renderTimestamp() {
  elements.timestamp.textContent = `Updated ${new Date().toLocaleString()}`;
}

function renderAuthState() {
  const isSignedIn = Boolean(state.currentUser);
  document.body.dataset.authenticated = String(isSignedIn);
  elements.accountSummary.innerHTML = isSignedIn
    ? `
      <article class="account-info-card">
        <span class="account-info-card__icon" aria-hidden="true"></span>
        <div class="account-info-card__body">
          <p>Account Information</p>
          <h3>${escapeHtml(state.currentUser.name)}</h3>
          <span>${escapeHtml(state.currentUser.email)}</span>
        </div>
      </article>
    `
    : "";

  if (isSignedIn && state.authMode !== "signout") {
    setAuthMode("signout");
  } else if (!isSignedIn && state.authMode === "signout") {
    setAuthMode("login");
  } else {
    setAuthMode(state.authMode);
  }

  if (isSignedIn && !elements.authStatus.textContent.trim()) {
    setAuthNotice("Signed in successfully.", "success");
  }

  updateWorkflowControls();
  if (!canAccessTab(state.activeTab)) {
    setActiveTab(fallbackTabFor(state.activeTab));
  }
}

function renderAdminUsers() {
  if (!state.adminUsers.length) {
    elements.adminUsers.innerHTML = "<div class='empty-state'>No users found.</div>";
    return;
  }

  elements.adminUsers.innerHTML = `
    <table class="formula-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${state.adminUsers
          .map(
            (user) => `
              <tr data-user-id="${escapeHtml(user.id)}">
                <td><input data-user-field="name" value="${escapeHtml(user.name)}" /></td>
                <td><input data-user-field="email" type="email" value="${escapeHtml(user.email)}" /></td>
                <td>
                  <select data-user-field="role">
                    <option value="user"${user.role === "user" ? " selected" : ""}>User</option>
                    <option value="admin"${user.role === "admin" ? " selected" : ""}>Admin</option>
                  </select>
                </td>
                <td>
                  <select data-user-field="status">
                    <option value="active"${user.status === "active" ? " selected" : ""}>Active</option>
                    <option value="disabled"${user.status === "disabled" ? " selected" : ""}>Disabled</option>
                  </select>
                </td>
                <td>
                  <div class="admin-actions">
                    <button class="button button--secondary" type="button" data-admin-action="save-user">Save</button>
                    <button class="button button--ghost" type="button" data-admin-action="delete-user">Delete</button>
                  </div>
                </td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function tariffRateValue(key, fallback = 0) {
  return state.tariffProfile.rates?.[key] ?? fallback;
}

function tariffRows() {
  const rows = Array.isArray(state.tariffProfile.tableRows) && state.tariffProfile.tableRows.length
    ? state.tariffProfile.tableRows
    : DEFAULT_TARIFF_TABLE;
  return rows.map((row, index) => ({
    id: row.id ?? `tariff-row-${index}`,
    type: row.type ?? "rate",
    label: row.label ?? "",
    measure: row.measure ?? "",
    rateKey: row.rateKey ?? `customRate${index}`,
    fallback: row.fallback ?? 0,
    indent: Boolean(row.indent),
  }));
}

function newTariffRow(type = "rate") {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  if (type === "section") {
    return {
      id: `section-${suffix}`,
      type: "section",
      label: "New Customer Category:",
      measure: "",
      rateKey: `customCategory${suffix}`,
      fallback: 0,
      indent: false,
    };
  }

  return {
    id: `rate-${suffix}`,
    type: "rate",
    label: "New tariff block",
    measure: "GHp/kWh",
    rateKey: `customRate${suffix}`,
    fallback: 0,
    indent: true,
  };
}

function tariffInputRow(row, index) {
  const isRate = row.type === "rate";
  const isCategory = row.type === "section" || row.type === "subsection";
  const labelClass = row.indent ? "tariff-indent" : "";
  const value = isRate ? tariffRateValue(row.rateKey, row.fallback) : "";

  return `
    <tr data-tariff-row="${index}">
      <td class="${labelClass}">
        <input name="tariff:${index}:id" type="hidden" value="${escapeHtml(row.id)}" />
        <input name="tariff:${index}:type" type="hidden" value="${escapeHtml(row.type)}" />
        <input name="tariff:${index}:rateKey" type="hidden" value="${escapeHtml(row.rateKey)}" />
        <input name="tariff:${index}:indent" type="hidden" value="${row.indent ? "1" : "0"}" />
        <input class="tariff-cell-input tariff-cell-input--label ${isCategory ? "tariff-cell-input--strong" : ""}" name="tariff:${index}:label" value="${escapeHtml(row.label)}" />
        <div class="tariff-row-actions">
          ${isCategory ? `<button class="link-button" type="button" data-tariff-action="add-block-after" data-row-index="${index}">Add block</button>` : ""}
          <button class="link-button" type="button" data-tariff-action="delete-row" data-row-index="${index}">Delete</button>
        </div>
      </td>
      <td>
        <input class="tariff-cell-input" name="tariff:${index}:measure" value="${escapeHtml(row.measure)}" ${isRate ? "" : "aria-label='Measure not used for category rows'"} />
      </td>
      <td>
        <input class="tariff-cell-input tariff-cell-input--amount" name="tariff:${index}:value" type="number" step="0.0001" value="${escapeHtml(value)}" ${isRate ? "" : "disabled"} />
      </td>
    </tr>
  `;
}

function renderAdminTariffForm() {
  const tariff = state.tariffProfile;
  const rows = tariffRows();

  elements.adminTariffForm.innerHTML = `
    <input name="label" type="hidden" value="${escapeHtml(tariff.label ?? "")}" />
    <input name="lastUpdated" type="hidden" value="${escapeHtml(tariff.lastUpdated ?? "")}" />
    <div class="tariff-control-actions field-grid__wide">
      <button class="button button--secondary" type="button" data-tariff-action="add-category">Add customer category</button>
      <button class="button button--ghost" type="button" data-tariff-action="add-block">Add tariff block</button>
    </div>
    <div class="table-wrap field-grid__wide tariff-control-wrap">
      <table class="tariff-control-table">
        <thead>
          <tr>
            <th>Customer Category</th>
            <th>Measure</th>
            <th>Tariff</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, index) => tariffInputRow(row, index)).join("")}
        </tbody>
      </table>
    </div>
    <div class="field-grid__wide">
      <button class="button" type="submit">Update tariff</button>
    </div>
  `;
}

function collectAdminTariffDraft() {
  const form = formDataObject(elements.adminTariffForm);
  const rates = { ...(state.tariffProfile.rates ?? {}) };
  const tableRows = [];

  elements.adminTariffForm.querySelectorAll("[data-tariff-row]").forEach((rowElement) => {
    const index = rowElement.dataset.tariffRow;
    const type = rowElement.querySelector(`[name="tariff:${index}:type"]`)?.value ?? "rate";
    const rateKey = rowElement.querySelector(`[name="tariff:${index}:rateKey"]`)?.value ?? `customRate${index}`;
    const tariffRow = {
      id: rowElement.querySelector(`[name="tariff:${index}:id"]`)?.value ?? `tariff-row-${index}`,
      type,
      label: rowElement.querySelector(`[name="tariff:${index}:label"]`)?.value?.trim() || "Untitled tariff item",
      measure: rowElement.querySelector(`[name="tariff:${index}:measure"]`)?.value?.trim() ?? "",
      rateKey,
      indent: rowElement.querySelector(`[name="tariff:${index}:indent"]`)?.value === "1",
    };

    if (type === "rate") {
      const value = rowElement.querySelector(`[name="tariff:${index}:value"]`)?.value;
      rates[rateKey] = Number.parseFloat(value) || 0;
    }

    tableRows.push(tariffRow);
  });

  return {
    ...state.tariffProfile,
    label: form.label,
    lastUpdated: form.lastUpdated,
    rates,
    tableRows,
  };
}

function mutateAdminTariffRows(mutator) {
  const draft = collectAdminTariffDraft();
  const tableRows = [...draft.tableRows];
  mutator(tableRows);
  state.tariffProfile = {
    ...draft,
    tableRows,
  };
  renderAdminTariffForm();
}

async function loadActiveTariff() {
  try {
    const payload = await apiFetch("/api/tariff");
    state.tariffProfile = structuredClone(payload.tariffProfile ?? DEFAULT_TARIFF_PROFILE);
  } catch {
    state.tariffProfile = structuredClone(DEFAULT_TARIFF_PROFILE);
  }
}

async function loadCurrentUser() {
  if (!state.authToken) {
    renderAuthState();
    return;
  }

  try {
    const payload = await apiFetch("/api/auth/me");
    state.currentUser = payload.user;
    if (!state.currentUser) {
      setAuthSession("", null);
    } else {
      renderAuthState();
    }
  } catch {
    setAuthSession("", null);
  }
}

async function loadAdminData() {
  if (state.currentUser?.role !== "admin") return;
  const [usersPayload, tariffPayload] = await Promise.all([
    apiFetch("/api/admin/users"),
    apiFetch("/api/admin/tariff"),
  ]);
  state.adminUsers = usersPayload.users ?? [];
  state.tariffProfile = structuredClone(tariffPayload.tariffProfile ?? state.tariffProfile);
  renderAdminUsers();
  renderAdminTariffForm();
  render();
}

function updateRow(rowId, field, value) {
  state.loadItems = state.loadItems.map((row) => {
    if (row.rowId !== rowId) return row;
    const next = { ...row };

    if (["quantity", "rating", "powerFactor", "efficiency", "hoursPerDay", "daysPerMonth"].includes(field)) {
      next[field] = Number.parseFloat(value) || 0;
    } else if (field === "demandFactor" || field === "dutyCycleBilling") {
      next[field] = (Number.parseFloat(value) || 0) / 100;
    } else {
      next[field] = value;
    }

    return next;
  });
}

function render() {
  collectFormState();
  const utilityProfile = UTILITY_PROFILES[0];
  const study = buildStudy(state.loadItems, state.siteProfile, utilityProfile, state.tariffProfile);

  renderLoadList(study);
  renderSummary(study);
  renderRecommendation(study);
  renderBreakdown(study);
  renderTariffSummary(study);
  renderPrintReport(study);
  renderTimestamp();
  updateCalculationDetailsToggle();
  updateWorkflowControls();
  if (!canAccessTab(state.activeTab)) {
    setActiveTab(fallbackTabFor(state.activeTab));
  }
}

function preparePrint() {
  if (!state.billBreakdownViewed) {
    elements.saveStatus.textContent = "Open Total Bill Breakdown before printing the report.";
    return;
  }
  window.print();
}

function bindEvents() {
  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  elements.authModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setAuthNotice("");
      setAuthMode(button.dataset.authMode);
    });
  });

  elements.adminModeButtons.forEach((button) => {
    button.addEventListener("click", () => setAdminMode(button.dataset.adminMode));
  });

  elements.siteForm.addEventListener("change", () => {
    state.resultsViewed = false;
    state.billBreakdownViewed = false;
    render();
  });

  elements.addPresetButton.addEventListener("click", () => {
    state.loadItems.push(applianceToRow(elements.presetSelector.value, 1));
    state.resultsViewed = false;
    state.billBreakdownViewed = false;
    render();
  });

  elements.addRowButton.addEventListener("click", () => {
    state.loadItems.push(createCustomRow(`row-${state.nextRowId++}`, state.siteProfile.defaultDaysPerMonth));
    state.resultsViewed = false;
    state.billBreakdownViewed = false;
    render();
  });

  elements.loadList.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    const rowElement = target.closest("[data-row-id]");
    if (!rowElement) return;
    updateRow(rowElement.dataset.rowId, target.dataset.field, target.value);
    state.resultsViewed = false;
    state.billBreakdownViewed = false;
    render();
  });

  elements.loadList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const removeButton = target.closest("[data-action='remove']");
    if (!removeButton) return;
    const rowElement = removeButton.closest("[data-row-id]");
    if (!rowElement) return;
    state.loadItems = state.loadItems.filter((row) => row.rowId !== rowElement.dataset.rowId);
    state.resultsViewed = false;
    state.billBreakdownViewed = false;
    render();
  });

  elements.printButton.addEventListener("click", preparePrint);
  elements.exportLoadDataButton.addEventListener("click", exportLoadItemData);
  elements.calculationDetailsToggle?.addEventListener("click", () => {
    state.calculationDetailsOpen = !state.calculationDetailsOpen;
    updateCalculationDetailsToggle();
  });
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const control = target.closest("[data-show-password]");
    if (!(control instanceof HTMLElement)) return;
    const input = document.querySelector(control.dataset.showPassword);
    if (input instanceof HTMLInputElement) {
      const shouldShow = input.type === "password";
      input.type = shouldShow ? "text" : "password";
      control.classList.toggle("is-visible", shouldShow);
      control.setAttribute("aria-pressed", String(shouldShow));
      control.setAttribute("aria-label", shouldShow ? "Hide password" : "Show password");
    }
  });

  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthNotice("");
    try {
      const payload = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(formDataObject(elements.loginForm)),
      });
      setAuthSession(payload.token, payload.user);
      setAuthNotice("Signed in successfully.", "success");
      if (payload.user?.role === "admin") await loadAdminData();
      setActiveTab("auth");
      showUserInfoModal("loads");
    } catch (error) {
      setAuthNotice(error.message);
    }
  });

  elements.registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthNotice("");
    try {
      const payload = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(formDataObject(elements.registerForm)),
      });
      setAuthSession(payload.token, payload.user);
      setAuthNotice("Account ready. You are signed in.", "success");
      if (payload.user?.role === "admin") await loadAdminData();
      setActiveTab("auth");
      showUserInfoModal("loads");
    } catch (error) {
      setAuthNotice(error.message);
    }
  });

  elements.signOutButton.addEventListener("click", async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST", body: "{}" });
    } catch {}
    setAuthSession("", null);
    setAuthNotice("Signed out.", "info");
    setAuthMode("login");
    setActiveTab("auth");
  });

  elements.userInfoOkButton?.addEventListener("click", acceptUserInfoModal);

  elements.forgotForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthNotice("");
    try {
      const payload = await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(formDataObject(elements.forgotForm)),
      });
      setAuthNotice(payload.resetToken
        ? `${payload.message} Token: ${payload.resetToken}`
        : payload.message, "info");
    } catch (error) {
      setAuthNotice(error.message);
    }
  });

  elements.resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAuthNotice("");
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(formDataObject(elements.resetForm)),
      });
      setAuthNotice("Password reset successfully. Sign in with the new password.", "success");
    } catch (error) {
      setAuthNotice(error.message);
    }
  });

  elements.adminCreateUserForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(formDataObject(elements.adminCreateUserForm)),
      });
      elements.adminCreateUserForm.reset();
      await loadAdminData();
      elements.saveStatus.textContent = "User created.";
    } catch (error) {
      elements.saveStatus.textContent = error.message;
    }
  });

  elements.adminUsers.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.adminAction;
    if (!action) return;
    const row = target.closest("[data-user-id]");
    if (!(row instanceof HTMLElement)) return;
    const userId = row.dataset.userId;
    try {
      if (action === "delete-user") {
        await apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
        elements.saveStatus.textContent = "User deleted.";
      } else {
        const body = {};
        row.querySelectorAll("[data-user-field]").forEach((field) => {
          body[field.dataset.userField] = field.value;
        });
        await apiFetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        elements.saveStatus.textContent = "User updated.";
      }
      await loadAdminData();
    } catch (error) {
      elements.saveStatus.textContent = error.message;
    }
  });

  elements.adminTariffForm.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest("[data-tariff-action]");
    if (!(button instanceof HTMLElement)) return;

    const action = button.dataset.tariffAction;
    const rowIndex = Number.parseInt(button.dataset.rowIndex ?? "-1", 10);
    mutateAdminTariffRows((rows) => {
      if (action === "add-category") {
        rows.push(newTariffRow("section"));
      }

      if (action === "add-block") {
        rows.push(newTariffRow("rate"));
      }

      if (action === "add-block-after") {
        rows.splice(Number.isFinite(rowIndex) ? rowIndex + 1 : rows.length, 0, newTariffRow("rate"));
      }

      if (action === "delete-row" && Number.isFinite(rowIndex) && rowIndex >= 0) {
        const targetType = rows[rowIndex]?.type;
        const boundaryTypes = targetType === "section" ? new Set(["section"]) : new Set(["section", "subsection"]);
        let deleteCount = 1;
        if (targetType === "section" || targetType === "subsection") {
          for (let index = rowIndex + 1; index < rows.length; index += 1) {
            if (boundaryTypes.has(rows[index].type)) break;
            deleteCount += 1;
          }
        }
        rows.splice(rowIndex, deleteCount);
      }
    });
  });

  elements.adminTariffForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const tariffProfile = collectAdminTariffDraft();

    try {
      const payload = await apiFetch("/api/admin/tariff", {
        method: "PATCH",
        body: JSON.stringify({ tariffProfile }),
      });
      state.tariffProfile = structuredClone(payload.tariffProfile);
      render();
      renderAdminTariffForm();
      elements.saveStatus.textContent = "Tariff updated.";
    } catch (error) {
      elements.saveStatus.textContent = error.message;
    }
  });
}

function populateStaticControls() {
  elements.presetSelector.innerHTML = optionMarkup(
    APPLIANCE_LIBRARY.map((item) => ({ value: item.id, label: item.name })),
    APPLIANCE_LIBRARY[0]?.id,
  );
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      elements.saveStatus.textContent = "Service worker registration skipped.";
    });
  }
}

async function init() {
  populateStaticControls();
  loadPersistedState();
  syncFormFromState();
  bindEvents();
  await loadActiveTariff();
  await loadCurrentUser();
  setActiveTab(["loads", "results", "tariff", "auth", "admin"].includes(state.activeTab) ? state.activeTab : "loads");
  renderAuthState();
  setAdminMode(state.adminMode);
  render();
  if (state.currentUser?.role === "admin") {
    await loadAdminData();
  }
  registerServiceWorker();
}

init().catch((error) => {
  elements.saveStatus.textContent = error.message || "The app could not finish loading.";
});
