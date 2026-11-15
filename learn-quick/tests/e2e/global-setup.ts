import { execSync } from "node:child_process";
import { TEST_ENV } from "./test-env";

/** Before the browser tests: bring the separate test database up to date and create the test admin. */
export default function globalSetup() {
  const env = { ...process.env, ...TEST_ENV };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx prisma db seed", { env, stdio: "pipe" });
}
