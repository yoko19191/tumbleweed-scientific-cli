---
name: predict-structures-with-tumbleweed
description: Use when choosing and running AlphaFold 3, Boltz-2, or ESM-3 folding on Tumbleweed for protein, nucleic-acid, ligand, or multimolecular structure prediction and interpreting confidence or affinity outputs.
---

# Predict Structures With Tumbleweed

## Overview

Separate three questions before choosing a model: what components are present, whether affinity is required, and whether the input is a full multimolecular specification or only a protein sequence.

## Selection

| Need | Model | Reason |
| --- | --- | --- |
| Protein/nucleic-acid/ligand complex geometry | `af3` | Broad all-atom complex representation and confidence outputs |
| Complex structure plus ligand affinity estimate | `boltz2` | Joint structure and affinity workflow |
| Fast single-protein sequence folding | `esm3` with `task=fold` | Simple FASTA input and direct PDB output |

Read exact inputs and limitations in [the shared catalog](../use-tumbleweed-models/references/model-catalog.md), trace scientific claims through [the official source index](../use-tumbleweed-models/references/source-index.md), then query each live schema. Use [the callable recipes](../use-tumbleweed-models/references/job-recipes.md) only after that check.

## Workflow

1. Validate biological entities, chain identifiers, stoichiometry, sequence alphabet, ligand identifiers, and any templates/MSAs before submission.
2. For `af3`, create official AF3 JSON. For `boltz2`, create official Boltz YAML and decide explicitly whether MSA is provided, empty, or fetched. For `esm3`, provide FASTA/raw protein sequence only.
3. Reduce samples or recycles only for wiring smoke tests. Do not interpret a deliberately minimal run as a quality benchmark.
4. Retrieve structures plus confidence/affinity metadata. A single downloaded canonical object may not contain every collected file; preserve the job ID and logs.
5. Interpret confidence locally: low-confidence regions and interfaces require caution. Never equate confidence with affinity, activity, or experimental correctness.

## Cross-Checks

- Compare `af3` and `boltz2` when the decision depends on a fragile interface or ligand pose.
- Use `boltz2` affinity only for prioritization, then validate with docking, physics, or experiment.
- Refold generated sequences from `proteinmpnn`, `pepmlm`, `peptune`, or `esm3` before advancing candidates.

## Common Pitfalls

| Symptom | Repair |
| --- | --- |
| A smoke-test structure is treated as production quality | Rerun with scientifically justified sampling/recycle settings. |
| Empty MSA is silently assumed | Record the MSA mode and its expected effect. |
| High confidence is reported as strong binding | Keep confidence, pose quality, and affinity as separate evidence. |
| Only the first Worker output is downloaded | Retain the job receipt and inspect metadata/logs before claiming the full result set. |

## Verification Checklist

- [ ] Entity specification and file syntax were validated.
- [ ] Model choice follows component and affinity needs.
- [ ] Compute settings match smoke-test or scientific intent.
- [ ] Structure and metadata were retrieved.
- [ ] Confidence and affinity are interpreted with stated limitations.
