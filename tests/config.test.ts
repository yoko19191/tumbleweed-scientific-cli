import { describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  configWithSources,
  DEFAULT_WORKER_URL,
  loadConfig,
  loadEnv,
  normalizeWorkerUrl,
  saveConfig,
} from "../src/config.js";

describe("jobs configuration", () => {
  test("uses the new worker URL contract and ignores the removed API URL variable", () => {
    expect(loadConfig({ env: {} }).worker_url).toBe(DEFAULT_WORKER_URL);
    expect(
      loadConfig({
        env: {
          TW_API_URL: "http://legacy.invalid:8080/",
          TUMBLEWEED_WORKER_URL: "http://worker.example:9050/",
        },
      }).worker_url,
    ).toBe("http://worker.example:9050");
  });

  test("loads, saves, and annotates the jobs config file", () => {
    const directory = mkdtempSync(join(tmpdir(), "tumbleweed-config-"));
    const configPath = join(directory, "nested", "config.json");
    try {
      const saved = saveConfig(
        {
          worker_url: "http://saved.example:9050///",
          job_owner: "liangzhu-lab",
        },
        { configPath },
      );
      expect(saved).toEqual({
        worker_url: "http://saved.example:9050",
        job_owner: "liangzhu-lab",
      });
      expect(JSON.parse(readFileSync(configPath, "utf-8"))).toEqual(saved);
      expect(loadConfig({ env: {}, configPath })).toEqual(saved);
      expect(configWithSources({ env: {}, configPath })).toEqual({
        worker_url: { value: saved.worker_url, source: configPath },
        job_owner: { value: "liangzhu-lab", source: configPath },
      });

      expect(
        configWithSources({
          env: { TUMBLEWEED_WORKER_URL: "http://env.example:9050/" },
          configPath,
        }).worker_url,
      ).toEqual({
        value: "http://env.example:9050",
        source: "env TUMBLEWEED_WORKER_URL",
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("falls back safely when the config file is malformed", () => {
    const directory = mkdtempSync(join(tmpdir(), "tumbleweed-config-"));
    const configPath = join(directory, "config.json");
    try {
      writeFileSync(configPath, "not-json");
      expect(loadConfig({ env: {}, configPath })).toEqual({
        worker_url: DEFAULT_WORKER_URL,
        job_owner: undefined,
      });
      expect(configWithSources({ env: {}, configPath })).toEqual({
        worker_url: { value: DEFAULT_WORKER_URL, source: "default" },
        job_owner: { value: "(not set)", source: "default" },
      });
      expect(normalizeWorkerUrl("  http://worker.example:9050////  ")).toBe(
        "http://worker.example:9050",
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("rejects malformed or unsafe Worker URLs at the configuration boundary", () => {
    for (const workerUrl of [
      "not-a-url",
      "ftp://worker.example",
      "http://user:secret@worker.example:9050",
      "http://worker.example:9050/?token=secret",
    ]) {
      expect(() =>
        loadConfig({ env: { TUMBLEWEED_WORKER_URL: workerUrl } }),
      ).toThrow("Invalid Worker URL");
    }
  });

  test("loads Worker URL from a .env file", () => {
    const directory = mkdtempSync(join(tmpdir(), "tumbleweed-dotenv-"));
    const envPath = join(directory, ".env");
    const original = process.env.TUMBLEWEED_WORKER_URL;
    try {
      delete process.env.TUMBLEWEED_WORKER_URL;
      writeFileSync(
        envPath,
        "TUMBLEWEED_WORKER_URL=http://dotenv.example:9050/\n",
      );
      loadEnv({ path: envPath });
      expect(loadConfig().worker_url).toBe("http://dotenv.example:9050");
    } finally {
      if (original === undefined) delete process.env.TUMBLEWEED_WORKER_URL;
      else process.env.TUMBLEWEED_WORKER_URL = original;
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("does not override an existing environment variable from .env by default", () => {
    const directory = mkdtempSync(join(tmpdir(), "tumbleweed-dotenv-"));
    const envPath = join(directory, ".env");
    const original = process.env.TUMBLEWEED_WORKER_URL;
    try {
      process.env.TUMBLEWEED_WORKER_URL = "http://existing.example:9050/";
      writeFileSync(
        envPath,
        "TUMBLEWEED_WORKER_URL=http://dotenv.example:9050/\n",
      );
      loadEnv({ path: envPath });
      expect(loadConfig().worker_url).toBe("http://existing.example:9050");
    } finally {
      if (original === undefined) delete process.env.TUMBLEWEED_WORKER_URL;
      else process.env.TUMBLEWEED_WORKER_URL = original;
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("can override an existing environment variable from .env when requested", () => {
    const directory = mkdtempSync(join(tmpdir(), "tumbleweed-dotenv-"));
    const envPath = join(directory, ".env");
    const original = process.env.TUMBLEWEED_WORKER_URL;
    try {
      process.env.TUMBLEWEED_WORKER_URL = "http://existing.example:9050/";
      writeFileSync(
        envPath,
        "TUMBLEWEED_WORKER_URL=http://dotenv.example:9050/\n",
      );
      loadEnv({ path: envPath, override: true });
      expect(loadConfig().worker_url).toBe("http://dotenv.example:9050");
    } finally {
      if (original === undefined) delete process.env.TUMBLEWEED_WORKER_URL;
      else process.env.TUMBLEWEED_WORKER_URL = original;
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
