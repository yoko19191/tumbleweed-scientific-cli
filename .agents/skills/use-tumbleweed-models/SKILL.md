---
name: use-tumbleweed-models
description: Use when an Agent must choose among Tumbleweed Scientific Worker models, compare their inputs, outputs, GPU cost, limitations, or compose several models into a scientific workflow.
---

# Use Tumbleweed Models

## Overview

Route a scientific task to the smallest suitable model or model chain. Treat the live Worker registry as authoritative; the bundled catalog explains intent and handoffs, not a frozen API schema.

## When to Use

Use this skill before submitting a job when the user names a scientific goal rather than a model. Do not use it for job polling or downloads after a model is already chosen; use `run-tumbleweed-jobs` then.

## Workflow

1. Check capacity and discover the live catalog:

   ```bash
   tumbleweed jobs health
   tumbleweed jobs models
   tumbleweed jobs models <model_id>
   ```

   Done when the selected model is enabled and its current input names, required flags, parameter types, limits, GPU count, and output declaration are known.

2. Match intent using [the model catalog](references/model-catalog.md). When the task is explicitly comparative, also read [the comparison guide](references/comparison-guide.md). Use [the official source index](references/source-index.md) for scientific claims and upstream boundaries. Prefer the cheapest model that produces the artifact needed by the next step. Do not select a larger language model merely because it is larger.

3. State the routing decision before spending compute: selected model, why alternatives were rejected, required inputs, expected artifact, known limitation, GPU count, and whether a downstream validation step is needed.

4. For multi-model work, define every handoff as a file contract. Confirm that the upstream result format is accepted by the downstream input; convert or prepare files explicitly when it is not.

5. Start from [the callable recipes](references/job-recipes.md), re-check every field against the live schema, then execute through `run-tumbleweed-jobs`. Use a unique job alias plus explicit `--job-id` and `--idempotency-key` for each step.

## Routing Rules

- Need a complex structure only: choose `af3`; choose `boltz2` when affinity estimates or an open Boltz workflow matter.
- Need a pose with a known box: start with `autodock_vina`; use `gnina` for CNN ranking or `smina` for minimize/score-only.
- Need blind docking: choose `diffdock`; choose `dynamicbind` for induced fit; choose `flowdock` when flexible co-folding plus confidence/affinity is required.
- Need a new backbone: choose `rfdiffusion`; choose `rfdiffusion_aa` when a ligand or cofactor must be represented atomically.
- Need sequence for a fixed backbone: choose `proteinmpnn`.
- Need target-conditioned peptide candidates: choose `pepmlm`; choose `peptune` only for unconditional therapeutic-peptide exploration.
- Need inexpensive protein embeddings: choose `proteinbert` for its lightweight architecture or `protbert` for a ProtTrans BERT baseline.
- Need a larger ProtTrans representation: choose `prott5`; choose `esm3` when one model must span fold/generate/embed; choose `xtrimopglm` only when 100B representation capacity justifies four GPUs.
- Need genomic sequence representations or generation: choose `genos`, not a protein language model.

## Common Pitfalls

| Symptom | Repair |
| --- | --- |
| A static skill field differs from the Worker | Trust `tumbleweed jobs models <id>` and record the drift. |
| A score is described as experimental affinity | Preserve the model's uncertainty and require experimental or physical validation. |
| A chain passes an output directly because both mention PDB | Check whether it is a receptor, backbone, complex, PDBQT, or ligand-containing PDB and prepare it accordingly. |
| ProteinBERT, ProtBERT, and ProtT5 are treated as aliases | Keep `proteinbert`, `protbert`, and `prott5` distinct and query each live model card. |
| A four-GPU model is chosen for a simple embedding | Benchmark `proteinbert`, `protbert`, `prott5`, or `esm3` first unless the user needs the 100B model specifically. |
| RFdiffusion output is treated as a finished protein | Run sequence design and structure validation before presenting it as a candidate. |

## Verification Checklist

- [ ] Live model detail was queried after model selection.
- [ ] Input names and formats match the live schema.
- [ ] GPU cost and timeout are acceptable.
- [ ] The expected output is usable by the next step.
- [ ] Limitations are carried into the final interpretation.
- [ ] Every submitted step has a job ID and a downloaded result receipt.
