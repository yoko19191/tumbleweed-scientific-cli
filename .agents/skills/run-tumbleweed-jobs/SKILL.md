---
name: run-tumbleweed-jobs
description: Use when an Agent must discover a Tumbleweed Worker model schema, download example inputs, submit an idempotent remote job, poll it, inspect logs, and retrieve the result through the tumbleweed CLI.
metadata:
  author: yoko19191
---

# Run Tumbleweed Jobs

## Overview

Execute the complete Worker lifecycle without scraping prose or losing the recovery handle. Machine-readable JSON is the default; progress and errors belong on stderr.

## When to Use

Use after selecting a model, or whenever the user supplies a model ID and asks to run it. Use `use-tumbleweed-models` first when model choice is unclear.

## Workflow

1. Preflight Worker and model:

   ```bash
   tumbleweed jobs health
   tumbleweed jobs models <model_id>
   ```

   Stop if readiness is not `ok`, the model is absent, GPU requirements exceed available capacity, or a required input has no source.

2. Obtain inputs. When a live input declaration has a non-empty `example`, download it explicitly:

   ```bash
   tumbleweed jobs example <model_id> <input_name> --output ./inputs/<filename>
   ```

   Inspect examples before using them for scientific work; they prove wiring, not biological relevance.

   For a starter command covering the selected live model, read [the callable recipe](../use-tumbleweed-models/references/job-recipes.md). Treat it as a launch template only: the current `jobs models <model_id>` response wins whenever a field differs.

3. Submit with recoverable identifiers:

   ```bash
   tumbleweed jobs submit \
     --model <model_id> \
     --input <name>=<local_path> \
     --param <name>=<value> \
     --job-id <job_YYYYMMDD_HHMMSS_8hex> \
     --job-alias <meaningful_alias> \
     --idempotency-key <stable_key>
   ```

   Preserve the returned `id`. Never retry an uncertain mutation with a new job ID or idempotency key.

4. Wait within the model's declared timeout:

   ```bash
   tumbleweed jobs wait <job_id> --interval 5 --timeout <seconds>
   ```

   A CLI wait timeout does not mean the remote job stopped. Query `jobs show` before retrying or canceling.

5. On failure, inspect:

   ```bash
   tumbleweed jobs show <job_id>
   tumbleweed jobs logs <job_id>
   ```

   Report the Worker error and final status. Do not call `result` for `FAILED` or `CANCELED`.

6. Retrieve and verify:

   ```bash
   tumbleweed jobs result <job_id> --output-dir ./results/<job_id>
   ```

   Confirm the JSON receipt path exists and is non-empty. Record the job ID, model ID, status, object key, local path, and parameters with the scientific interpretation.

## Chaining

Treat each downstream model as a new job. Inspect the downloaded artifact, select or convert the exact file the next model expects, then submit it under a new job ID. Do not pass `output_uri` as `--input-key` unless the object itself is the intended single artifact and the next model accepts that format.

## Common Pitfalls

| Symptom | Repair |
| --- | --- |
| `wait` times out | Run `jobs show`; the server job may still be queued or running. |
| A submit response is lost | Re-query the explicit job ID; reuse the same idempotency key. |
| Result retrieval returns one file from a multi-file model | Treat it as the Worker's canonical result handle and inspect job logs/metadata; do not claim every collected artifact was downloaded. |
| A required model input has an empty example | Supply a scientifically valid file; do not fabricate a placeholder. |
| A paper feature has no matching live input or parameter | Do not pass or promise it; document the upstream/deployment difference. |
| A job uses shared GPUs without clear authorization | State GPU count and expected duration before submission. |

## Verification Checklist

- [ ] Health and live schema were checked.
- [ ] All required inputs exist and match declared formats.
- [ ] Job ID, alias, and idempotency key were explicit.
- [ ] Terminal status is `SUCCEEDED`.
- [ ] Result was downloaded to a known path and is non-empty.
- [ ] Job receipt and model limitations accompany the result.

For a full deployed-model acceptance run, follow [the repository E2E runbook](https://github.com/yoko19191/tumbleweed-scientific-cli/blob/main/docs/E2E_RUNBOOK.md). Its low-iteration parameters verify transport and execution only; do not use those outputs for scientific model comparison. Never submit the shared-GPU suite without explicit authorization.
