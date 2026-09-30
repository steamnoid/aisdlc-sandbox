import path from "node:path";

export const E2E_PORT = 3100;

export const BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

export const DATA_DB = path.resolve(process.cwd(), "tests/e2e/data/e2e.db");
