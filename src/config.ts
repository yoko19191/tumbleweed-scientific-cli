import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------
export interface TwConfig {
  api_url: string;
  job_owner?: string;
}

const DEFAULT_API_URL = "http://localhost:8080";
const CONFIG_DIR = join(homedir(), ".config", "tumbleweed");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

// ---------------------------------------------------------------------------
// Load config: env vars → config file → defaults
// ---------------------------------------------------------------------------
export function loadConfig(): TwConfig {
  const fileConfig = loadConfigFile();

  return {
    api_url:
      process.env.TW_API_URL ?? fileConfig.api_url ?? DEFAULT_API_URL,
    job_owner: process.env.TW_JOB_OWNER ?? fileConfig.job_owner,
  };
}

function loadConfigFile(): Partial<TwConfig> {
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as Partial<TwConfig>;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Save config
// ---------------------------------------------------------------------------
export function saveConfig(patch: Partial<TwConfig>): TwConfig {
  const current = loadConfig();
  const merged: TwConfig = { ...current, ...patch };

  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2) + "\n", "utf-8");
  return merged;
}

// ---------------------------------------------------------------------------
// Show config (with source annotation)
// ---------------------------------------------------------------------------
export function configWithSources(): Record<string, { value: string; source: string }> {
  const fileConfig = loadConfigFile();

  const apiUrl = process.env.TW_API_URL
    ? { value: process.env.TW_API_URL, source: "env TW_API_URL" }
    : fileConfig.api_url
      ? { value: fileConfig.api_url, source: CONFIG_PATH }
      : { value: DEFAULT_API_URL, source: "default" };

  const jobOwner = process.env.TW_JOB_OWNER
    ? { value: process.env.TW_JOB_OWNER, source: "env TW_JOB_OWNER" }
    : fileConfig.job_owner
      ? { value: fileConfig.job_owner, source: CONFIG_PATH }
      : { value: "(not set)", source: "default" };

  return { api_url: apiUrl, job_owner: jobOwner };
}

export { CONFIG_PATH };
