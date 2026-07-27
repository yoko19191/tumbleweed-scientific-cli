#!/usr/bin/env node
import { loadEnv } from "./config.js";
import { main } from "./index.js";

loadEnv();
void main().then((exitCode) => {
  process.exitCode = exitCode;
});
