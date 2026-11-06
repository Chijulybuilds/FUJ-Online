import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `rm -rf .data/e2e && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      LOCAL_DB_PATH: ".data/e2e/db.json",
      QR_SIGNING_SECRET: "e2e-secret-value-that-is-long-enough-123456",
      ALLOW_DEV_LOGIN: "true",
      ADMIN_LOGIN_EMAIL: "admin@flagupjesus.org", ADMIN_LOGIN_PASSWORD: "E2E-shared-admin-pass-2026",
      WHATSAPP_TOKEN: "", WHATSAPP_PHONE_NUMBER_ID: "", TERMII_API_KEY: "", TERMII_SENDER_ID: "",
      NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", SUPABASE_SERVICE_ROLE_KEY: "", CLIENT_ID: "", CLIENT_SECRET: ""
    }
  }
});
