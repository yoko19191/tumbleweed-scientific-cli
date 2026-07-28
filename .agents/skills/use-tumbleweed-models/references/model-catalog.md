# Tumbleweed Model Catalog

This catalog records routing semantics observed from the Worker and verified end to end on 2026-07-27. Always run `tumbleweed jobs models <model_id>` before submission for the current schema, defaults, limits, examples, links, GPU count, timeout, and primary output. Use [the official source index](source-index.md) for upstream evidence and [the callable recipes](job-recipes.md) for launch templates.

## Structure Prediction

### `af3` — AlphaFold 3

- **Choose when:** predicting protein, nucleic-acid, ligand, ion, or modified-residue complexes without direct affinity estimation.
- **Input:** required `af_input`, an official AF3 JSON file describing chains and components.
- **Output:** mmCIF structures, confidence/PAE data, and sampled candidates.
- **Limits:** confidence is not affinity; expensive databases and GPU inference make it unsuitable for broad virtual screening.

### `boltz2` — Boltz-2

- **Choose when:** co-predicting multimolecular structure and ligand affinity, or when an open Boltz workflow is preferred.
- **Input:** required `input_yaml`, official Boltz YAML. Use `msa: empty` for offline protein chains unless the public MSA service is deliberately enabled.
- **Output:** mmCIF/PDB, PAE/PDE confidence data, candidate structures, and affinity JSON when requested by the YAML.
- **Limits:** affinity is a ranking aid, not an experimental measurement; offline empty-MSA mode can reduce accuracy.

## Molecular Docking

### `autodock_vina` — AutoDock Vina

- **Choose when:** the binding box is known and a fast, reproducible classical baseline or broad screen is needed.
- **Inputs:** required `receptor` PDBQT, `ligand` PDBQT, and `box_config` with center and size coordinates.
- **Output:** docked PDBQT poses and Vina scores/logs.
- **Limits:** receptor flexibility is limited; scores are relative heuristics and depend strongly on PDBQT and box preparation.

### `diffdock` — DiffDock

- **Choose when:** the binding site is unknown and blind generative docking is needed.
- **Inputs:** required `protein` PDB and `ligand` SDF/MOL2 or one-SMILES text.
- **Output:** ranked SDF poses and pose confidence.
- **Limits:** confidence is not affinity; the protein is mostly fixed and generated poses require clash and chemistry checks.

### `dynamicbind` — DynamicBind

- **Choose when:** induced fit, flexible pockets, or a likely apo-to-holo conformational change matters.
- **Inputs:** required `protein` PDB and `ligand_csv`; the current example and recommended path use a paired ligand SDF. The Wrapper also accepts a CSV containing a `ligand` column or a single-SMILES text file.
- **Output:** ligand-specific complex candidates and adjusted protein conformations.
- **Limits:** predicted motion is not a molecular-dynamics trajectory; large rearrangements and out-of-distribution ligands require validation.

### `flowdock` — FlowDock

- **Choose when:** flexible apo-to-holo co-folding, multiple poses, confidence, and affinity estimates are needed together.
- **Inputs:** required `receptor` PDB or sequence text and `ligand` SDF or SMILES text. The deployed offline path is most reliable with PDB template input.
- **Output:** complex poses, structural confidence, and affinity estimates.
- **Limits:** estimates are not experimental; sequence-only mode may require assets absent from an offline deployment.

### `gnina` — GNINA

- **Choose when:** a known pocket needs docking or pose refinement with CNN rescoring.
- **Inputs:** required `receptor` PDB/PDBQT, `ligand` SDF/MOL2/PDBQT, and `autobox_ligand` reference ligand.
- **Output:** docked SDF poses, CNN scores/affinity estimates, and logs.
- **Limits:** needs a pocket reference; CNN scores can reflect training-set similarity and are not measured affinity.

### `smina` — smina

- **Choose when:** docking, local minimization, score-only evaluation, or a classical customizable Vina workflow is needed.
- **Inputs:** required `receptor` PDB/PDBQT, `ligand` SDF/MOL2/PDBQT, and `autobox_ligand`.
- **Output:** docked or minimized poses, empirical scores, and logs.
- **Limits:** limited receptor flexibility; scores and output quality depend on structure preparation.

## Protein And Peptide Design

### `rfdiffusion` — RFdiffusion

- **Choose when:** generating a new protein backbone, motif scaffold, protein binder, symmetric design, or cyclic peptide backbone.
- **Input:** optional `pdb`; omit it for unconditional generation and provide it for motif or binder design.
- **Output:** backbone PDB files, optional diffusion trajectories, and metadata.
- **Limits:** output is not a finished sequence. Follow with `proteinmpnn`, refolding, filtering, and experiments.

### `rfdiffusion_aa` — RFdiffusion All-Atom

- **Choose when:** designing a protein pocket or backbone around a small molecule, metal, or cofactor represented atomically.
- **Input:** required `pdb` containing the target ligand and optional protein motif; `ligand` must match the PDB HETATM residue name.
- **Output:** ligand-aware backbone PDB files, unidealized structures, trajectories, and metadata.
- **Limits:** still requires sequence design, ideally LigandMPNN when ligand-aware sequence design is needed. The deployed model currently declares no downloadable example for this required input; the upstream repository's `input/7v11.pdb` with ligand `OQO` is the verified engineering-test fixture recorded in the repository E2E runbook.

### `proteinmpnn` — ProteinMPNN

- **Choose when:** assigning candidate amino-acid sequences to an existing fixed backbone or redesigning selected chains.
- **Input:** required `pdb` backbone structure.
- **Output:** candidate FASTA sequences and optional scores/probabilities.
- **Limits:** does not generate or validate a backbone; scores do not prove folding, expression, stability, or function.

### `pepmlm` — PepMLM

- **Choose when:** generating target-conditioned linear peptide binders without requiring a target structure.
- **Input:** required `target` protein FASTA or raw sequence.
- **Output:** peptide candidates in CSV/FASTA with sequence-probability information.
- **Limits:** sequence likelihood is not binding affinity, pose, stability, or cellular activity.

### `peptune` — PepTune

- **Choose when:** exploring unconditional therapeutic-peptide chemical space before downstream property and target screening.
- **Input:** required `target` placeholder text; the deployed unconditional mode does not use its content.
- **Output:** generated peptide sequences.
- **Limits:** the deployment does not expose the paper's full multi-objective conditioning; candidates need chemistry, developability, structure, and experimental checks.

## Sequence Models

### `esm3` — ESM-3

- **Choose when:** one protein model should fold a sequence, generate/complete a sequence, or emit embeddings.
- **Input:** required `sequence` FASTA or raw protein sequence.
- **Output:** task-dependent PDB, generated sequence, or embedding.
- **Limits:** the deployment is sequence-centric and does not expose all upstream multimodal controls; generated candidates need downstream validation.

### `proteinbert` — ProteinBERT

- **Choose when:** low-cost bulk global and residue-level protein embeddings are sufficient.
- **Input:** required `sequence` FASTA or raw protein sequence.
- **Output:** global and local NumPy representations.
- **Limits:** not ProtTrans ProtBERT and not a structure or sequence generator; evaluate the representations on the downstream task.

### `protbert` — ProtBERT

- **Choose when:** a ProtTrans BERT baseline is needed for pooled per-protein or per-residue feature extraction.
- **Input:** required `sequence`, one or more protein sequences in FASTA or raw form.
- **Output:** pooled per-protein and/or per-residue NumPy embeddings plus sequence and weight metadata.
- **Limits:** the deployed `Rostlab/prot_bert` base checkpoint has no task-specific head; inputs longer than the selected limit fail instead of being silently truncated.

### `prott5` — ProtT5-XL-UniRef50

- **Choose when:** the larger ProtTrans T5 representation is justified for per-protein or per-residue downstream features.
- **Input:** required `sequence`, one or more protein sequences in FASTA or raw form.
- **Output:** encoder-derived pooled per-protein and/or per-residue NumPy embeddings plus metadata.
- **Limits:** the full encoder-decoder checkpoint is mounted, but the online route uses only its encoder and exposes no sequence generation; benchmark its added cost against smaller baselines.

### `xtrimopglm` — xTrimoPGLM

- **Choose when:** a 100B protein language model is specifically justified for embedding or generation.
- **Input:** required `sequence` FASTA or raw protein sequence.
- **Output:** embedding tensor or generated sequence.
- **Limits:** the deployed INT4 model normally requests four GPUs; it is slow and expensive, and generated sequences have no folding or function guarantee.

### `genos` — Genos

- **Choose when:** embedding or generating genomic DNA/RNA rather than protein sequences.
- **Input:** required `sequence` DNA/RNA FASTA or raw nucleotide sequence.
- **Output:** genomic embeddings or generated sequence.
- **Limits:** advanced biological tasks require downstream heads and labeled data; output is not a clinical pathogenicity or diagnostic conclusion.

## Canonical Chains

- **Backbone-to-sequence design:** `rfdiffusion` → `proteinmpnn` → `esm3` fold or `af3`/`boltz2` validation.
- **Ligand-aware protein design:** `rfdiffusion_aa` → ligand-aware sequence design outside the current Worker, or `proteinmpnn` with an explicit caveat → `af3`/`boltz2` → docking/physics/experiment.
- **Targeted peptide discovery:** `pepmlm` → `af3`/`boltz2` complex prediction → `diffdock`/`gnina` or physical rescoring → experiment.
- **Unconditional peptide exploration:** `peptune` → property filters outside the Worker → structure/target evaluation.
- **Docking funnel:** `autodock_vina` for cheap screening → `gnina`/`smina` rescoring; use `diffdock` when no box exists and `dynamicbind`/`flowdock` when receptor flexibility matters.
- **Embedding workflows:** `proteinbert` for a lightweight architecture; `protbert` for a ProtTrans BERT baseline; `prott5` for a larger ProtTrans encoder; `esm3` for multimode protein work; `xtrimopglm` for justified 100B capacity; `genos` for nucleotide sequences.
