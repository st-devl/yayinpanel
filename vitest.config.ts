import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
      "@": path.resolve(__dirname, ".")
    }
  },
  test: {
    exclude: ["node_modules", ".next", "test-results", "playwright-report"],
    include: ["tests/**/*.test.ts"],
    // Tum entegrasyon testleri tek bir paylasilan SQLite dev.db kullanir ve
    // bazi testler global DB durumuna bakar (or. tek aktif X hesabi fallback'i).
    // Dosyalari seri calistirarak paylasilan DB uzerindeki yarislari engelle.
    fileParallelism: false,
    env: {
      DATABASE_URL: "file:./dev.db",
      APP_BASE_URL: "http://localhost:3000",
      STORAGE_DIR: "storage",
      TIMEZONE: "Europe/Istanbul",
      ADMIN_EMAIL: "admin@example.com",
      ADMIN_PASSWORD: "test-password-123",
      ENCRYPTION_KEY:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }
  }
});
