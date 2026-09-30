/**
 * QA: WELLBEINGT-17 — Dockerization static analysis
 *
 * Verifies Dockerfile and .dockerignore content against approved Product AC
 * without requiring a Docker daemon. Covers AC1 (Dockerfile exists),
 * AC4 (HEALTHCHECK present), AC5 (.dockerignore excludes), AC6 (multi-stage).
 *
 * Traceability: proposal:ecadf4a9, proposal:22fbaef9, proposal:efd1f747,
 *   proposal:47e008d2, proposal:746d7643, proposal:c27f92d2
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");

function load(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf-8");
}

function parseDockerfile(content: string) {
  const lines = content.split("\n");
  const fromLines = lines.filter((l) => /^\s*FROM\s+/i.test(l));
  return {
    exists: content.trim().length > 0,
    fromCount: fromLines.length,
    isMultiStage: fromLines.length >= 2,
    hasBuildStage: /AS\s+build/i.test(content),
    hasRuntimeStage: /AS\s+runtime/i.test(content),
    hasHealthcheck: /^\s*HEALTHCHECK\s+/im.test(content),
    healthcheckInterval: /--interval=(\d+s)/i.exec(content)?.[1] ?? null,
    healthcheckTimeout: /--timeout=(\d+s)/i.exec(content)?.[1] ?? null,
    exposes3000: /^\s*EXPOSE\s+3000/im.test(content),
    hasCmd: /^\s*CMD\s+/im.test(content),
    copiesBetterSqlite3: /better-sqlite3/i.test(content),
    buildHasBuildEssential: false,
    runtimeIsSlim: false,
  };
}

describe("QA: WELLBEINGT-17 Dockerization — static analysis", () => {
  let dockerfile: string;
  let dockerignore: string;

  try {
    dockerfile = load("Dockerfile");
  } catch {
    dockerfile = "";
  }
  try {
    dockerignore = load(".dockerignore");
  } catch {
    dockerignore = "";
  }

  const df = parseDockerfile(dockerfile);

  // ── AC1 — Dockerfile exists and is valid ──────────────────────────
  it("AC1: Dockerfile exists and is non-empty", () => {
    expect(df.exists).toBe(true);
  });

  it("AC1: Dockerfile uses FROM instruction", () => {
    expect(df.fromCount).toBeGreaterThanOrEqual(1);
  });

  // ── AC2 — better-sqlite3 native module ────────────────────────────
  it("AC2: Dockerfile references better-sqlite3 for native compilation", () => {
    expect(df.copiesBetterSqlite3).toBe(true);
  });

  it("AC2: Build stage includes build-essential for native modules", () => {
    // Extract build stage content (between first FROM and second FROM)
    const buildStageEnd = dockerfile.indexOf("\nFROM ", dockerfile.indexOf("FROM ") + 1);
    const buildStage = buildStageEnd > 0 ? dockerfile.slice(0, buildStageEnd) : dockerfile;
    expect(/build-essential/i.test(buildStage)).toBe(true);
  });

  // ── AC4 — HEALTHCHECK instruction ─────────────────────────────────
  it("AC4: HEALTHCHECK instruction present in Dockerfile", () => {
    expect(df.hasHealthcheck).toBe(true);
  });

  it("AC4: HEALTHCHECK has --interval=30s", () => {
    expect(df.healthcheckInterval).toBe("30s");
  });

  it("AC4: HEALTHCHECK has --timeout=3s", () => {
    expect(df.healthcheckTimeout).toBe("3s");
  });

  it("AC4: HEALTHCHECK verifies HTTP via curl or wget on port 3000", () => {
    expect(/curl\s+-f\s+http:\/\/localhost:3000/i.test(dockerfile) ||
           /wget\s+-qO-\s+http:\/\/localhost:3000/i.test(dockerfile)).toBe(true);
  });

  // ── AC5 — .dockerignore exclusions ────────────────────────────────
  it("AC5: .dockerignore exists and is non-empty", () => {
    expect(dockerignore.trim().length).toBeGreaterThan(0);
  });

  it("AC5: .dockerignore excludes node_modules", () => {
    const lines = dockerignore.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.some((l) => l === "node_modules" || l === "node_modules/")).toBe(true);
  });

  it("AC5: .dockerignore excludes .next", () => {
    const lines = dockerignore.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.some((l) => l === ".next" || l === ".next/")).toBe(true);
  });

  // ── AC6 — Multi-stage produces minimal image ──────────────────────
  it("AC6: Dockerfile is multi-stage (>=2 FROM)", () => {
    expect(df.isMultiStage).toBe(true);
  });

  it("AC6: Build stage is named 'build'", () => {
    expect(df.hasBuildStage).toBe(true);
  });

  it("AC6: Runtime stage is named 'runtime' and uses slim base", () => {
    const runtimeFrom = dockerfile.split("\n").filter((l) =>
      /^\s*FROM\s+/i.test(l) && /runtime/i.test(l)
    );
    expect(runtimeFrom.length).toBe(1);
    expect(/slim/i.test(runtimeFrom[0])).toBe(true);
  });

  it("AC6: Runtime stage does NOT contain build-essential", () => {
    const runtimeStart = dockerfile.indexOf("FROM", dockerfile.indexOf("FROM") + 1);
    const runtimeStage = runtimeStart > 0 ? dockerfile.slice(runtimeStart) : "";
    expect(/build-essential/i.test(runtimeStage)).toBe(false);
  });

  // ── AC3 — EXPOSE 3000 ────────────────────────────────────────────
  it("AC3: Dockerfile exposes port 3000", () => {
    expect(df.exposes3000).toBe(true);
  });

  it("AC3: Dockerfile has CMD to start the app", () => {
    expect(df.hasCmd).toBe(true);
  });
});
