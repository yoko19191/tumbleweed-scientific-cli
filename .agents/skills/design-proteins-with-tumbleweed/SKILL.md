---
name: design-proteins-with-tumbleweed
description: Use when designing protein or peptide candidates with Tumbleweed models such as RFdiffusion, RFdiffusion All-Atom, ProteinMPNN, ESM-3, PepMLM, or PepTune, including multi-model handoffs and validation.
---

# Design Proteins With Tumbleweed

## Overview

Choose a design path by the constraint being supplied: geometry, ligand atoms, target sequence, or no condition. A generated candidate is the beginning of a validation funnel, not a finished biological result.

## Workflow

1. Query live schemas for every intended model and read the relevant entries in [the shared catalog](../use-tumbleweed-models/references/model-catalog.md). Use [the official source index](../use-tumbleweed-models/references/source-index.md) when explaining capabilities, and [the callable recipes](../use-tumbleweed-models/references/job-recipes.md) when constructing submissions.
2. Select the design origin:
   - geometric backbone or motif constraint: `rfdiffusion`;
   - ligand/cofactor-aware pocket: `rfdiffusion_aa`;
   - fixed backbone to sequence: `proteinmpnn`;
   - protein sequence fold/generation/embedding: `esm3`;
   - target-sequence-conditioned peptide: `pepmlm`;
   - unconditional peptide exploration: `peptune`.
3. Define the validation chain before generation. Record the candidate count at each stage so filtering is auditable.
4. Run each stage with `run-tumbleweed-jobs`, download the artifact, inspect its format, and prepare the next input explicitly.
5. Report model scores as model scores. Keep folding confidence, docking confidence, affinity estimates, developability, and experimental function separate.

## Canonical Pipelines

### Backbone Design

`rfdiffusion` PDB backbone → `proteinmpnn` FASTA candidates → `esm3` fold or `af3`/`boltz2` refold → structural comparison and experimental screening.

### Small-Molecule Pocket Design

`rfdiffusion_aa` ligand-containing PDB → ligand-aware sequence design outside the current Worker when possible → structure prediction → docking/physics → experiment. Plain `proteinmpnn` does not explicitly model ligand atoms; state this limitation if it is used.

### Targeted Peptide Discovery

`pepmlm` target FASTA → peptide FASTA/CSV → complex prediction or docking → developability filters → experiment.

### Unconditional Peptide Exploration

`peptune` generated peptides → deduplication and chemistry checks → property/target screens → structure validation. Do not describe the placeholder `target` file as conditioning.

## Stop Conditions

Stop before submission when a required ligand PDB, motif definition, chain selection, or target sequence is missing. Stop a handoff when the upstream output lacks the coordinates, sequence, residue naming, or chemical preparation the downstream model requires.

## Common Pitfalls

| Symptom | Repair |
| --- | --- |
| RFdiffusion PDB is presented as a designed protein | Add sequence design, refolding, filtering, and experimental validation. |
| RFdiffusion AA ligand name does not match HETATM | Inspect the PDB residue name and pass the exact `ligand` value. |
| PepTune output is called target-specific | Label it unconditional in the deployed Worker. |
| ESM-3 deployment is assumed to expose every upstream modality | Use only the live `task` and input schema. |

## Verification Checklist

- [ ] The initial constraint matches the selected generator.
- [ ] Every stage has compatible file inputs and outputs.
- [ ] Candidate counts and filters are recorded.
- [ ] Sequence, structure, affinity, and function claims remain distinct.
- [ ] All terminal jobs succeeded and their result files were retrieved.
