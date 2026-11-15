import { config } from "dotenv";

config({ quiet: true });

/**
 * Browser tests use their OWN database and upload folder, so test accounts never
 * appear in development data. Override with TEST_DATABASE_URL if needed.
 */
export const TEST_ENV = {
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://lq:lq@localhost:5432/learnquick_test",
  STORAGE_DIR: process.env.TEST_STORAGE_DIR ?? `${process.cwd()}/storage-test`,
  SEED_ADMIN_EMAIL: "admin@learnquick.test",
  SEED_ADMIN_PASSWORD: "Admin12345",
  PAYMENT_PROVIDER: "sandbox",
};

// The test process itself (database helpers, file checks) uses the same settings
Object.assign(process.env, TEST_ENV);
