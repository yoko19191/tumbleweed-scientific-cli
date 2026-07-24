---
name: dock-molecules-with-tumbleweed
description: Use when choosing or chaining AutoDock Vina, DiffDock, DynamicBind, FlowDock, GNINA, or smina on Tumbleweed for protein-ligand docking, pose generation, minimization, confidence, or rescoring.
---

# Dock Molecules With Tumbleweed

## Overview

Choose docking software from pocket knowledge and receptor flexibility, not from model novelty. Input preparation is part of the scientific method; an invalid protonation state or box can dominate model differences.

## Selection Matrix

| Situation | Start with | Optional next step |
| --- | --- | --- |
| Known pocket, cheap broad screening | `autodock_vina` | `gnina` CNN rescoring or `smina` minimization |
| Unknown pocket, blind docking | `diffdock` | `gnina`/physics rescoring after defining a pocket |
| Induced fit or flexible pocket | `dynamicbind` | MD or structural validation |
| Flexible co-folding plus confidence/affinity | `flowdock` | physics or experimental validation |
| Known pocket with CNN ranking | `gnina` | consensus with classical score |
| Score-only, minimize, or custom classical workflow | `smina` | downstream energy analysis |

Read file contracts and limitations in [the shared catalog](../use-tumbleweed-models/references/model-catalog.md). For a direct comparison of pocket requirements, flexibility, and cost, read [the comparison guide](../use-tumbleweed-models/references/comparison-guide.md); use [the official source index](../use-tumbleweed-models/references/source-index.md) for scientific claims and [the callable recipes](../use-tumbleweed-models/references/job-recipes.md) for starter submissions. Query the live model schema before launching.

## Workflow

1. Prepare receptor and ligand: resolve alternate locations, missing atoms, protonation, charge, tautomer, stereochemistry, residue naming, and file format.
2. Decide whether the pocket is known. For box-based methods, derive the box or autobox reference from defensible structural evidence.
3. Run a small wiring test, then choose production sampling settings. Keep seeds and preparation provenance.
4. Download poses and metadata. Check parseability, atom counts, bond orders, clashes, pocket occupancy, and whether the reference ligand was accidentally returned as the candidate.
5. Rank with at least two independent signals when the decision matters. Keep pose confidence, CNN score, empirical docking score, and affinity estimates distinct.

## Chaining Rules

- Convert formats deliberately; renaming `.pdb` to `.pdbqt` or `.sdf` is not conversion.
- `diffdock` output SDF may be fed to a prepared `gnina`/`smina` rescoring workflow only after a valid receptor and box/reference ligand exist.
- `af3` or `boltz2` complex structures can seed docking, but remove or retain ligands intentionally and prepare the receptor first.
- Use `dynamicbind`/`flowdock` when receptor motion is central; do not claim a classical rigid docking rerun validates that motion.

## Common Pitfalls

| Symptom | Repair |
| --- | --- |
| A high docking score is called binding affinity | Report it as a model score and validate separately. |
| Blind docking is run with a box-dependent tool | Use `diffdock` or establish a justified pocket first. |
| SDF/PDB/PDBQT are treated as interchangeable | Use a chemistry-aware conversion and inspect charges/bonds. |
| Default examples are used as scientific evidence | Use them only to verify wiring, then replace with task-specific prepared inputs. |

## Verification Checklist

- [ ] Pocket knowledge and receptor flexibility drove model choice.
- [ ] Receptor, ligand, and box/reference preparation are documented.
- [ ] Result files parse and contain plausible chemistry.
- [ ] Ranking signals are named accurately.
- [ ] Important poses receive orthogonal validation.
