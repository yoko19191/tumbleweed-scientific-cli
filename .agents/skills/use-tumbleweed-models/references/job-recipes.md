# Callable Model Recipes

These recipes cover the 19 models exposed by the Worker and verified end to end on 2026-07-27. They are starter invocations, not frozen schemas or scientifically optimal parameters.

## Contents

- [Rules](#rules)
- [Structure prediction](#structure-prediction)
- [Molecular docking](#molecular-docking)
- [Protein and peptide design](#protein-and-peptide-design)
- [Sequence foundation models](#sequence-foundation-models)

## Rules

Before using any recipe:

```bash
tumbleweed jobs health
tumbleweed jobs models <model_id>
```

Then download each declared example:

```bash
tumbleweed jobs example <model_id> <input_name> \
  --output inputs/<model_id>/<example_filename>
```

Add explicit recovery identifiers to every submission:

```text
--job-id <job_YYYYMMDD_HHMMSS_8hex>
--job-alias <meaningful_alias>
--idempotency-key <stable_key>
```

Use shell quoting for parameter values that contain brackets, spaces, or commas. After submission, follow `run-tumbleweed-jobs` through `wait`, `logs`, and `result --output-dir`. An upstream feature is not callable merely because it appears in a paper or repository.

## Structure Prediction

### `af3`

Use for multimolecular structure prediction without direct affinity output.

```bash
tumbleweed jobs submit \
  --model af3 \
  --input af_input=inputs/af3/af_input_example.json
```

- **Required input:** `af_input`, official AlphaFold 3 JSON.
- **Expected result:** sampled mmCIF structures plus confidence/PAE artifacts.
- **Handoff:** inspect confidence, then prepare selected complexes explicitly for docking or structural analysis.
- **Do not claim:** high confidence proves affinity, activity, or experimental correctness.

### `boltz2`

Use when joint complex structure and ligand affinity estimation are required.

```bash
tumbleweed jobs submit \
  --model boltz2 \
  --input input_yaml=inputs/boltz2/input_example.yaml \
  --param use_msa_server=false output_format=mmcif
```

- **Required input:** `input_yaml`, official Boltz YAML.
- **Expected result:** structure candidates, PAE/PDE, confidence metadata, and affinity JSON when the YAML requests affinity.
- **Handoff:** use affinity for prioritization; retain structures and confidence for cross-model review.
- **Do not claim:** an affinity estimate is an experimental measurement. With `use_msa_server=false`, provide `msa: empty` or a valid MSA as required by the YAML.

### `esm3` Folding

Use for single-protein sequence folding when the full multimolecular specification of AF3 or Boltz is unnecessary.

```bash
tumbleweed jobs submit \
  --model esm3 \
  --input sequence=inputs/esm3/sequence_example.fasta \
  --param task=fold num_steps=0
```

- **Required input:** `sequence`, protein FASTA or raw sequence.
- **Expected result:** folded PDB and task metadata.
- **Handoff:** use the PDB as a hypothesis for structural checks or prepared docking.
- **Do not claim:** this sequence-only Worker route exposes every upstream ESM-3 modality.

## Molecular Docking

### `autodock_vina`

Use for a known pocket, reproducible classical docking, or inexpensive screening.

```bash
tumbleweed jobs submit \
  --model autodock_vina \
  --input receptor=inputs/autodock_vina/receptor_example.pdbqt \
          ligand=inputs/autodock_vina/ligand_example.pdbqt \
          box_config=inputs/autodock_vina/box_config_example.txt \
  --param scoring=vina exhaustiveness=8 num_modes=9 seed=42
```

- **Required inputs:** receptor PDBQT, ligand PDBQT, and box center/size text.
- **Expected result:** docked PDBQT poses, scores, and logs.
- **Handoff:** convert selected poses with chemistry-aware tooling before a model requiring SDF or PDB.
- **Do not claim:** Vina score is absolute binding free energy.

### `smina`

Use for docking, score-only evaluation, minimization, or a customizable Vina-derived workflow.

```bash
tumbleweed jobs submit \
  --model smina \
  --input receptor=inputs/smina/receptor_example.pdb \
          ligand=inputs/smina/ligand_example.sdf \
          autobox_ligand=inputs/smina/autobox_ligand_example.sdf \
  --param mode=dock scoring=vina exhaustiveness=8 num_modes=9 seed=42
```

- **Required inputs:** receptor, candidate ligand, and reference ligand for autoboxing.
- **Expected result:** docked or minimized poses, empirical scores, and logs.
- **Handoff:** use `mode=score_only` or `mode=minimize` only when the uploaded pose already has a defensible coordinate frame.
- **Do not claim:** renaming a structure file changes its chemistry or format.

### `gnina`

Use for known-pocket docking or pose refinement with CNN scoring.

```bash
tumbleweed jobs submit \
  --model gnina \
  --input receptor=inputs/gnina/receptor_example.pdb \
          ligand=inputs/gnina/ligand_example.sdf \
          autobox_ligand=inputs/gnina/autobox_ligand_example.sdf \
  --param mode=dock cnn_scoring=rescore exhaustiveness=8 num_modes=9 seed=42
```

- **Required inputs:** receptor, candidate ligand, and reference ligand.
- **Expected result:** docked SDF poses, CNN scores or affinity estimates, and logs.
- **Handoff:** combine CNN ranking with an independent score or structural check.
- **Do not claim:** CNN affinity is measured affinity or immune to training-set similarity.

### `diffdock`

Use when the pocket is unknown and blind pose generation is needed.

```bash
tumbleweed jobs submit \
  --model diffdock \
  --input protein=inputs/diffdock/protein_example.pdb \
          ligand=inputs/diffdock/ligand_example.sdf \
  --param samples_per_complex=10 inference_steps=20 actual_steps=19
```

- **Required inputs:** protein PDB and ligand SDF/MOL2 or one-SMILES text.
- **Expected result:** ranked ligand poses and pose confidence.
- **Handoff:** define a pocket around selected poses before GNINA/smina rescoring.
- **Do not claim:** pose confidence is affinity; inspect clashes, bond orders, and pocket plausibility.

### `dynamicbind`

Use when ligand-induced receptor motion or a flexible pocket is central.

```bash
tumbleweed jobs submit \
  --model dynamicbind \
  --input protein=inputs/dynamicbind/protein_example.pdb \
          ligand_csv=inputs/dynamicbind/ligand_example.sdf \
  --param protein_dynamic=true samples_per_complex=10 savings_per_complex=1 seed=42
```

- **Required inputs:** protein PDB plus `ligand_csv`; despite the input key name, the current Worker recommends a paired ligand SDF. A CSV containing a `ligand` column or a single-SMILES text file is also accepted, and the Wrapper injects the current `protein_path`.
- **Expected result:** ligand-specific complexes and adjusted protein conformations.
- **Handoff:** validate predicted motion with physical checks, MD, another structure model, or experiment.
- **Do not claim:** generated conformational change is an MD trajectory or a sampled thermodynamic ensemble.

### `flowdock`

Use for template-guided flexible co-folding with confidence and affinity estimates.

```bash
tumbleweed jobs submit \
  --model flowdock \
  --input receptor=inputs/flowdock/receptor_example.pdb \
          ligand=inputs/flowdock/ligand_example.sdf \
  --param use_template=true n_samples=5 chunk_size=5 num_steps=40 seed=42
```

- **Required inputs:** receptor PDB or sequence text and ligand SDF or SMILES text.
- **Expected result:** protein-ligand poses, structural confidence, and affinity estimates.
- **Handoff:** prefer PDB template input on this offline deployment, then cross-check key candidates.
- **Do not claim:** the deployed sequence-only path is ready unless its required upstream assets are confirmed.

## Protein And Peptide Design

### `rfdiffusion`

Use for unconditional backbones, motif scaffolds, protein binders, symmetry, partial diffusion, or cyclic backbones.

```bash
tumbleweed jobs submit \
  --model rfdiffusion \
  --param 'contigs=[100-100]' num_designs=1 t_steps=50 \
          write_trajectory=false deterministic=true
```

- **Optional input:** `pdb`; omit it for unconditional generation and provide it for motif or binder design.
- **Expected result:** backbone PDB, optional trajectory, and metadata.
- **Handoff:** run `proteinmpnn`, then refold with ESM-3, AF3, or Boltz-2.
- **Do not claim:** a generated backbone is a finished, expressible protein.

### `rfdiffusion_aa`

Use to generate a ligand-aware pocket or backbone around a small molecule, metal, or cofactor.

```bash
tumbleweed jobs submit \
  --model rfdiffusion_aa \
  --input pdb=inputs/rfdiffusion_aa/7v11.pdb \
  --param ligand=OQO contigs=150-150 num_designs=1 \
          diffusion_steps=100 deterministic=true
```

- **Required input:** ligand-containing PDB; the `ligand` value must match its HETATM residue name.
- **Expected result:** idealized and unidealized ligand-aware backbone structures, trajectories, and metadata.
- **Handoff:** prefer LigandMPNN outside this Worker; ordinary ProteinMPNN does not explicitly use ligand atoms.
- **Do not claim:** a placeholder or protein-only PDB satisfies the ligand-aware contract.

### `proteinmpnn`

Use to design amino-acid sequences for a fixed backbone.

```bash
tumbleweed jobs submit \
  --model proteinmpnn \
  --input pdb=inputs/proteinmpnn/input_example.pdb \
  --param weight_set=vanilla model_name=v_48_020 \
          num_seq_per_target=4 sampling_temp=0.1 batch_size=1
```

- **Required input:** backbone PDB.
- **Expected result:** FASTA candidates and optional score/probability arrays.
- **Handoff:** refold every retained sequence and compare it with the design backbone.
- **Do not claim:** ProteinMPNN creates or validates the backbone, expression, stability, or function.

### `pepmlm`

Use to generate target-sequence-conditioned linear peptide candidates.

```bash
tumbleweed jobs submit \
  --model pepmlm \
  --input target=inputs/pepmlm/target_example.fasta \
  --param peptide_length=15 top_k=3 num_binders=4 seed=42
```

- **Required input:** target protein FASTA or raw sequence.
- **Expected result:** peptide FASTA/CSV and sequence-probability information.
- **Handoff:** predict complexes or dock candidates, then evaluate developability and binding experimentally.
- **Do not claim:** low perplexity or high sequence likelihood proves binding.

### `peptune`

Use for unconditional exploration of therapeutic-peptide chemical space on the current Worker.

```bash
tumbleweed jobs submit \
  --model peptune \
  --input target=inputs/peptune/target_example.txt \
  --param mode=unconditional sequence_length=12 \
          num_sequences=32 sampling_steps=128
```

- **Required input:** `target` placeholder; the deployed unconditional mode does not use its content.
- **Expected result:** generated peptide sequences.
- **Handoff:** apply external property filters, target-specific evaluation, structure prediction, and experiments.
- **Do not claim:** this deployment exposes the paper's MCTS-guided multi-objective optimization.

## Sequence Foundation Models

### `proteinbert`

Use for lightweight global and residue-level protein representations.

```bash
tumbleweed jobs submit \
  --model proteinbert \
  --input sequence=inputs/proteinbert/sequence_example.fasta \
  --param seq_len=512 batch_size=1
```

- **Required input:** protein FASTA or raw sequence.
- **Expected result:** global and local NumPy representations.
- **Handoff:** train or evaluate a downstream classifier, regressor, retrieval, or residue-level model.
- **Do not claim:** ProteinBERT is ProtBERT, or that its embeddings are direct function predictions.

### `protbert`

Use for ProtTrans ProtBERT base embeddings and downstream feature extraction.

```bash
tumbleweed jobs submit \
  --model protbert \
  --input sequence=inputs/protbert/sequence_example.fasta \
  --param task=both pooling=mean batch_size=1 \
          max_sequence_length=1024 output_dtype=float32
```

- **Required input:** one or more protein sequences in FASTA or raw form.
- **Expected result:** per-residue and pooled per-protein `.npy` arrays plus sequence/weight metadata.
- **Handoff:** use `task=per_protein` for sequence-level work and `task=per_residue` for site-level work.
- **Do not claim:** the base checkpoint includes a downstream classification or regression head.

### `prott5`

Use for ProtT5-XL-UniRef50 encoder embeddings when a larger ProtTrans representation is justified.

```bash
tumbleweed jobs submit \
  --model prott5 \
  --input sequence=inputs/prott5/sequence_example.fasta \
  --param task=both pooling=mean batch_size=1 \
          max_sequence_length=1000 output_dtype=float32
```

- **Required input:** one or more protein sequences in FASTA or raw form.
- **Expected result:** per-residue and pooled per-protein `.npy` arrays plus sequence/weight metadata.
- **Handoff:** benchmark against a cheaper representation on the actual downstream task.
- **Do not claim:** the online route provides sequence generation; it uses the full checkpoint's encoder only.

### `esm3` Embedding Or Generation

Use ESM-3 when one deployed model must span protein embedding, generation, and folding.

```bash
tumbleweed jobs submit \
  --model esm3 \
  --input sequence=inputs/esm3/sequence_example.fasta \
  --param task=embed
```

Switch to `task=generate` only when the input contains the intended masks or context, then choose `num_steps`, `temperature`, and `top_p` deliberately.

- **Expected result:** task-dependent embedding, generated sequence, or folded PDB.
- **Do not claim:** generated sequences are guaranteed to fold or function.

### `xtrimopglm`

Use only when the deployed 100B INT4 model is specifically justified.

```bash
tumbleweed jobs submit \
  --model xtrimopglm \
  --input sequence=inputs/xtrimopglm/sequence_example.fasta \
  --param task=embed device_map=auto
```

For generation, use `task=generate` and set `max_new_tokens` explicitly.

- **Required input:** protein FASTA or raw sequence.
- **Expected result:** embedding tensor or generated sequence.
- **Handoff:** compare downstream value against cheaper ESM-3, ProtT5, ProtBERT, or ProteinBERT baselines.
- **Do not claim:** model size alone proves better task performance; the default deployment normally requests four GPUs.

### `genos`

Use for genomic DNA/RNA representation or generation, not protein sequences.

```bash
tumbleweed jobs submit \
  --model genos \
  --input sequence=inputs/genos/sequence_example.fasta \
  --param task=embed model_id=BGI-HangzhouAI/Genos-10B-v2 \
          device_map=auto
```

For generation, use `task=generate` and set `max_new_tokens` explicitly.

- **Required input:** DNA/RNA FASTA or raw nucleotide sequence.
- **Expected result:** genomic embedding or generated sequence.
- **Handoff:** use a task-specific head and labeled evaluation data for biological inference.
- **Do not claim:** a base-model output is a clinical pathogenicity or diagnostic conclusion.
