import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const dist = resolve(root, "dist");

const filesToCopy = [
  "index.html",
  "manifest.webmanifest",
  "service-worker.js",
];

const directoriesToCopy = [
  "assets",
  "src",
];

async function main() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  for (const file of filesToCopy) {
    await cp(resolve(root, file), resolve(dist, file));
  }

  for (const directory of directoriesToCopy) {
    await cp(resolve(root, directory), resolve(dist, directory), { recursive: true });
  }

  console.log(`Build output ready in ${dist}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
