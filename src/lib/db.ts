import { createClient } from "@libsql/client";

const dbUrl = process.env.TURSO_DATABASE_URL;
const dbToken = process.env.TURSO_AUTH_TOKEN;

if (!dbUrl || !dbToken) {
  console.warn("⚠️ TURSO_DATABASE_URL 또는 TURSO_AUTH_TOKEN 설정이 확인되지 않습니다. (빌드 환경에서는 무시될 수 있음)");
}

export const db = createClient({
  url: dbUrl || "libsql://dummy-url-for-build",
  authToken: dbToken || "dummy-token-for-build",
});
