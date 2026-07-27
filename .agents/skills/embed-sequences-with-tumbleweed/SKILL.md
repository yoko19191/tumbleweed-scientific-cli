---
name: embed-sequences-with-tumbleweed
description: Use when selecting ProteinBERT, ProtBERT, ProtT5, ESM-3, xTrimoPGLM, or Genos on Tumbleweed for protein or genomic embeddings and sequence generation, including cost-aware model choice and downstream use.
metadata:
  author: yoko19191
---

# Embed Sequences With Tumbleweed

## Overview

Choose by biological alphabet, downstream representation need, and compute budget. Embeddings are features, not biological conclusions.

## Selection

| Need | Model |
| --- | --- |
| Lightweight global and residue-level protein embeddings | `proteinbert` |
| ProtTrans BERT baseline with pooled or residue embeddings | `protbert` |
| Larger ProtTrans encoder embeddings | `prott5` |
| Protein fold, generation, and embedding in one model | `esm3` |
| Specifically justified 100B protein representation or generation | `xtrimopglm` |
| DNA/RNA genomic embedding or generation | `genos` |

Read exact file contracts and limitations in [the shared catalog](../use-tumbleweed-models/references/model-catalog.md). Use [the comparison guide](../use-tumbleweed-models/references/comparison-guide.md) to distinguish upstream capabilities from what this Worker actually exposes, and [the official source index](../use-tumbleweed-models/references/source-index.md) to trace model identity. Query the live schema, then adapt [the callable recipe](../use-tumbleweed-models/references/job-recipes.md).

## Workflow

1. Validate whether sequences are protein or nucleotide, remove formatting artifacts, preserve stable sequence IDs, and record truncation/padding decisions.
2. Define the downstream task before model choice: whole-sequence classification, residue-level prediction, retrieval, clustering, generation, or exploratory visualization.
3. Establish a task-matched baseline. Use `proteinbert` for the lightweight ProteinBERT architecture, `protbert` for ProtTrans BERT representations, or `prott5` when its larger encoder is justified. Use `esm3` when folding or generation must share the same model. Escalate to `xtrimopglm` only when its 100B capacity is materially needed; it normally requests four GPUs, so state that cost before submission.
4. Run with explicit model task and deterministic identifiers. Download embeddings rather than printing binary data to stdout.
5. Store a manifest mapping sequence IDs to job ID, model ID, model/version choice, task, parameters, embedding file, and preprocessing.
6. Evaluate embeddings on the downstream task with train/test separation. Do not infer utility from dimensionality or model size alone.

## Generation Rules

- Generated protein or nucleotide sequences must be syntax-checked, deduplicated, screened for forbidden motifs, and validated with task-appropriate models or experiments.
- `proteinbert`, `protbert`, and `prott5` are embedding-only in this Worker. The full ProtT5 checkpoint is mounted, but the online route uses its encoder and does not expose sequence generation.
- `genos` output is not a clinical interpretation.
- `esm3` and `xtrimopglm` generated proteins are not guaranteed to fold, express, remain stable, or function.
- Keep generation temperature/sampling choices with the artifact manifest.

## Common Pitfalls

| Symptom | Repair |
| --- | --- |
| Protein sequence is sent to Genos | Route by alphabet and biological task. |
| ProteinBERT and ProtBERT are treated as spelling variants | Keep their model IDs, architectures, checkpoints, and outputs distinct. |
| Four GPUs are spent on an unbenchmarked embedding need | Establish a `proteinbert`, `protbert`, `prott5`, or `esm3` baseline first. |
| Embeddings are compared after inconsistent truncation | Normalize preprocessing and record sequence coverage. |
| A cluster is interpreted as biological truth | Validate against labels, controls, and confounders. |

## Verification Checklist

- [ ] Alphabet and sequence IDs were validated.
- [ ] Model choice matches the downstream task and budget.
- [ ] Preprocessing and truncation are recorded.
- [ ] Binary artifacts and a manifest were retrieved.
- [ ] Downstream claims are supported by evaluation, not model size.
