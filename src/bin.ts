#!/usr/bin/env bun
import { main } from "./index.js";

void main().then((exitCode) => {
  process.exitCode = exitCode;
});
