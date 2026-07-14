import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { CliError } from "./errors.js";

export interface JobsConfig {
  worker_url: string;
  job_owner?: string;
}

export interface ConfigOptions {
  env?: Record<string, string | undefined>;
  configPath?: string;
}

export const DEFAULT_WORKER_URL = "http://10.39.13.209:9050";
export const CONFIG_PATH = join(
  homedir(),
  ".config",
  "tumbleweed",
  "config.json",
);

export function normalizeWorkerUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error("unsupported Worker URL");
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    throw new CliError(
      `Invalid Worker URL: ${value}. Expected an HTTP(S) base URL without credentials, query, or hash.`,
      "invalid_worker_url",
      2,
    );
  }
}

export function loadConfig(options: ConfigOptions = {}): JobsConfig {
  const env = options.env ?? process.env;
  const fileConfig = loadConfigFile(options.configPath ?? CONFIG_PATH);

  return {
    worker_url: normalizeWorkerUrl(
      env.TUMBLEWEED_WORKER_URL ?? fileConfig.worker_url ?? DEFAULT_WORKER_URL,
    ),
    job_owner: fileConfig.job_owner,
  };
}

function loadConfigFile(configPath: string): Partial<JobsConfig> {
  if (!existsSync(configPath)) return {};

  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as Partial<JobsConfig>;
  } catch {
    return {};
  }
}

export function saveConfig(
  patch: Partial<JobsConfig>,
  options: Pick<ConfigOptions, "configPath"> = {},
): JobsConfig {
  const configPath = options.configPath ?? CONFIG_PATH;
  const merged: JobsConfig = {
    worker_url: DEFAULT_WORKER_URL,
    ...loadConfigFile(configPath),
    ...patch,
  };
  merged.worker_url = normalizeWorkerUrl(merged.worker_url);

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`, "utf-8");
  return merged;
}

export function configWithSources(
  options: ConfigOptions = {},
): Record<string, { value: string; source: string }> {
  const env = options.env ?? process.env;
  const configPath = options.configPath ?? CONFIG_PATH;
  const fileConfig = loadConfigFile(configPath);

  const workerUrl = env.TUMBLEWEED_WORKER_URL
    ? {
        value: normalizeWorkerUrl(env.TUMBLEWEED_WORKER_URL),
        source: "env TUMBLEWEED_WORKER_URL",
      }
    : fileConfig.worker_url
      ? { value: normalizeWorkerUrl(fileConfig.worker_url), source: configPath }
      : { value: DEFAULT_WORKER_URL, source: "default" };
  const jobOwner = fileConfig.job_owner
    ? { value: fileConfig.job_owner, source: configPath }
    : { value: "(not set)", source: "default" };

  return { worker_url: workerUrl, job_owner: jobOwner };
}
