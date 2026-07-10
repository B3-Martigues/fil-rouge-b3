import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const distServiceWorkerPath = resolve("dist", "sw.js");
const packageJsonPath = resolve("package.json");

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const rawSha = process.env.GITHUB_SHA || process.env.COMMIT_SHA || "";
const sha = rawSha ? rawSha.slice(0, 12) : "local";
const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
const cacheVersion = `mappening-${packageJson.version}-${sha}-${timestamp}`;

const source = await readFile(distServiceWorkerPath, "utf8");
const stamped = source.replace(
  /const CACHE_VERSION = "mappening-[^"]+";/,
  `const CACHE_VERSION = "${cacheVersion}";`,
);

if (stamped === source) {
  throw new Error("Unable to stamp CACHE_VERSION in dist/sw.js");
}

await writeFile(distServiceWorkerPath, stamped);
console.log(`Stamped service worker cache version: ${cacheVersion}`);
