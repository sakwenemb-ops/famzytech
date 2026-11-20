#!/usr/bin/env node
// Learn Quick: get a working copy running on your own computer (Windows, Mac or Linux).
// Run from the learn-quick folder:   npm run setup     then:   npm run dev
// It creates .env, starts the database in Docker, installs everything and adds sample data.
// Safe to run again: your .env and data are kept.
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const say = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);
const fail = (m) => {
  console.error(`\n\x1b[31m${m}\x1b[0m`);
  process.exit(1);
};
const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });
const works = (cmd) => {
  try {
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};
const portOpen = (port) =>
  new Promise((resolve) => {
    const s = net.connect({ port, host: "127.0.0.1" });
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
    s.setTimeout(1500, () => (s.destroy(), resolve(false)));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) fail(`Node.js ${process.versions.node} is too old. Install Node.js 22 from https://nodejs.org, then run this again.`);

// 1. Settings file
if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  say("Created .env from .env.example");
}
let text = readFileSync(".env", "utf8");
const get = (k) => text.match(new RegExp(`^${k}=["']?([^"'\\n]*)["']?`, "m"))?.[1] ?? "";
const set = (k, v) => {
  const line = `${k}="${v}"`;
  if (new RegExp(`^#?\\s*${k}=.*$`, "m").test(text)) text = text.replace(new RegExp(`^#?\\s*${k}=.*$`, "m"), line);
  else text += `\n${line}\n`;
};
const filled = [];
const fill = (k, v) => {
  if (get(k)) return;
  set(k, v);
  filled.push(k);
};
fill("AUTH_SECRET", randomBytes(32).toString("base64"));
fill("FILE_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
if (!get("SEED_ADMIN_PASSWORD")) {
  set("SEED_ADMIN_EMAIL", "admin@learnquick.local");
  set("SEED_ADMIN_PASSWORD", "Admin12345");
  filled.push("admin login");
}
fill("OTP_FIXED_CODE", "123456"); // every verification code is 123456 on your computer
fill("PAYMENT_PROVIDER", "sandbox");
writeFileSync(".env", text);
if (filled.length) say(`Filled in .env: ${filled.join(", ")}`);
const dbUrl = get("DATABASE_URL");
const dbPort = Number(dbUrl.match(/@[^:/]+:(\d+)\//)?.[1] ?? 5432);

// 2. Database
if (await portOpen(dbPort)) {
  say(`A database is already answering on port ${dbPort}: using it.`);
} else {
  if (!works("docker --version")) fail("Docker is not installed. Install Docker Desktop from https://www.docker.com/products/docker-desktop, open it, then run this again.");
  if (!works("docker info")) fail("Docker Desktop is not running. Open it, wait until it says it is running, then run this again.");
  say("Starting the database (PostgreSQL in Docker)...");
  run("docker compose up -d db");
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    up = (await portOpen(dbPort)) && works("docker compose exec -T db pg_isready -U lq");
    if (!up) await sleep(1000);
  }
  if (!up) fail("The database did not start. See:  docker compose logs db");
  await sleep(1500);
}

// 3. Code libraries, database tables, sample data
say("Installing libraries (first time: a few minutes)...");
run("npm install");
say("Creating the database tables...");
run("npx prisma migrate deploy");
run("npx prisma generate");
say("Adding the admin account, library and sample teachers...");
run("npx prisma db seed", { SEED_DEMO: "1" });

say("Ready! Now run:   npm run dev");
console.log(`Then open http://localhost:3000

Sign in with (password in brackets):
  Admin    ${get("SEED_ADMIN_EMAIL")} (${get("SEED_ADMIN_PASSWORD") === "Admin12345" ? "Admin12345" : "your SEED_ADMIN_PASSWORD in .env"})
  Student  student@demo.learnquick.test (Demo12345)
  Teachers jeanpaul@demo.learnquick.test, brenda@demo.learnquick.test, aicha@demo.learnquick.test (Demo12345)

Payments are pretend (sandbox): approve or decline them on the checkout page.
Any verification code asked for is 123456. Stop the site with Ctrl+C.`);
