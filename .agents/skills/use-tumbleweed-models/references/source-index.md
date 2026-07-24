# Official Model Sources

Use this index when a routing decision or scientific claim needs upstream evidence. Use the live Worker schema for what can actually be called:

```bash
tumbleweed jobs models <model_id>
```

The precedence is deliberate:

1. **Live Worker schema** governs callable input names, parameter choices, GPU count, timeout, and collected outputs.
2. **Worker model card** identifies the deployed checkpoint or wrapper and records deployment-specific limitations.
3. **Official repository** governs upstream installation, supported modes, examples, and implementation details.
4. **Paper** supports scientific capability and benchmark claims.

Never import a paper or repository feature into a CLI command unless the live schema exposes it.

## Structure And Docking

| Worker ID | Model | Official repository | Version-matched paper | Deployment note |
|---|---|---|---|---|
| `af3` | AlphaFold 3 | [google-deepmind/alphafold3](https://github.com/google-deepmind/alphafold3) | [Accurate structure prediction of biomolecular interactions with AlphaFold 3](https://www.nature.com/articles/s41586-024-07487-w) | The Worker accepts official AF3 JSON. Confidence is not affinity; code and model-weight terms differ. |
| `boltz2` | Boltz-2 | [jwohlwend/boltz](https://github.com/jwohlwend/boltz) | [Boltz-2: Towards Accurate and Efficient Binding Affinity Prediction](https://www.biorxiv.org/content/10.1101/2025.06.14.659707v1) | The Worker accepts Boltz YAML and defaults to offline MSA handling. Affinity remains a model estimate. |
| `autodock_vina` | AutoDock Vina | [ccsb-scripps/AutoDock-Vina](https://github.com/ccsb-scripps/AutoDock-Vina) | [AutoDock Vina 1.2.0](https://pubs.acs.org/doi/10.1021/acs.jcim.1c00203) | The Worker requires receptor and ligand PDBQT plus an explicit box configuration. |
| `smina` | smina | [mwojcikowski/smina](https://github.com/mwojcikowski/smina) | [Lessons Learned in Empirical Scoring with smina](https://pubs.acs.org/doi/10.1021/ci300604z) | The linked GitHub mirror describes scoring, minimization, autobox, and custom scoring; its README points to the original project homepage. |
| `gnina` | GNINA | [gnina/gnina](https://github.com/gnina/gnina) | [GNINA 1.3](https://jcheminf.biomedcentral.com/articles/10.1186/s13321-025-00973-x) | The Worker exposes Vina-style search plus CNN scoring and requires a reference ligand for autoboxing. |
| `diffdock` | DiffDock / DiffDock-L | [gcorso/DiffDock](https://github.com/gcorso/DiffDock) | [Deep Confident Steps to New Pockets](https://openreview.net/forum?id=R2fFBeWx3P) | The Worker exposes blind pose generation; confidence is pose confidence, not binding affinity. |
| `dynamicbind` | DynamicBind | [luwei0917/DynamicBind](https://github.com/luwei0917/DynamicBind) | [DynamicBind](https://www.nature.com/articles/s41467-024-45461-2) | The Worker exposes ligand-conditioned complex generation with optional protein dynamics, not an MD trajectory. |
| `flowdock` | FlowDock | [BioinfoMachineLearning/FlowDock](https://github.com/BioinfoMachineLearning/FlowDock) | [FlowDock](https://academic.oup.com/bioinformatics/article/41/Supplement_1/i198/8199366) | The offline Worker path is most reliable with a receptor PDB template; sequence-only upstream paths may need absent assets. |

## Protein And Peptide Design

| Worker ID | Model | Official repository | Version-matched paper | Deployment note |
|---|---|---|---|---|
| `rfdiffusion` | RFdiffusion | [RosettaCommons/RFdiffusion](https://github.com/RosettaCommons/RFdiffusion) | [De novo design of protein structure and function with RFdiffusion](https://www.nature.com/articles/s41586-023-06415-8) | The Worker generates backbones and optional trajectories; a finished amino-acid sequence still requires sequence design. |
| `rfdiffusion_aa` | RFdiffusion All-Atom | [baker-laboratory/rf_diffusion_all_atom](https://github.com/baker-laboratory/rf_diffusion_all_atom) | [Generalized biomolecular modeling and design with RoseTTAFold All-Atom](https://www.science.org/doi/10.1126/science.adl2528) | The Worker requires a ligand-containing PDB and exact ligand residue name. Ligand-aware sequence design is not deployed. |
| `proteinmpnn` | ProteinMPNN | [dauparas/ProteinMPNN](https://github.com/dauparas/ProteinMPNN) | [Robust deep learning-based protein sequence design using ProteinMPNN](https://www.science.org/doi/10.1126/science.add2187) | The Worker designs sequences for a supplied backbone; it does not generate or validate that backbone. |
| `pepmlm` | PepMLM | [programmablebio/pepmlm](https://github.com/programmablebio/pepmlm) | [Target sequence-conditioned design of peptide binders](https://www.nature.com/articles/s41587-025-02761-2) | The Worker conditions on target protein sequence. Sequence likelihood is not binding evidence. |
| `peptune` | PepTune | [programmablebio/peptune](https://github.com/programmablebio/peptune) | [PepTune](https://proceedings.mlr.press/v267/tang25n.html) | The paper and repository include multi-objective MCTS guidance; the Worker currently exposes unconditional generation only. |

## Sequence Foundation Models

| Worker ID | Model | Official repository | Version-matched paper | Deployment note |
|---|---|---|---|---|
| `esm3` | ESM-3 | [Biohub/esm](https://github.com/Biohub/esm) | [Simulating 500 million years of evolution with a language model](https://www.science.org/doi/10.1126/science.ads0018) | The upstream model is multimodal; the Worker exposes sequence input with `fold`, `generate`, and `embed`. |
| `xtrimopglm` | xTrimoPGLM | [ONERAI/xTrimoPGLM](https://github.com/ONERAI/xTrimoPGLM) | [xTrimoPGLM](https://www.nature.com/articles/s41592-025-02636-z) | The Worker pins the 100B INT4 checkpoint and normally requests four GPUs for embedding or generation. |
| `proteinbert` | ProteinBERT | [nadavbra/protein_bert](https://github.com/nadavbra/protein_bert) | [ProteinBERT](https://academic.oup.com/bioinformatics/article/38/8/2102/6502274) | This is ProteinBERT, not ProtTrans ProtBERT. The Worker emits global and residue-level representations. |
| `protbert` | ProtBERT | [agemagician/ProtTrans](https://github.com/agemagician/ProtTrans) | [ProtTrans](https://doi.org/10.1109/TPAMI.2021.3095381) | The Worker pins `Rostlab/prot_bert` and exposes base per-protein/per-residue embeddings without task heads. |
| `prott5` | ProtT5-XL-UniRef50 | [agemagician/ProtTrans](https://github.com/agemagician/ProtTrans) | [ProtTrans](https://doi.org/10.1109/TPAMI.2021.3095381) | The full encoder-decoder checkpoint is mounted, but the online task uses only its encoder for embeddings; generation is not exposed. |
| `genos` | Genos | [BGI-HangzhouAI/Genos](https://github.com/BGI-HangzhouAI/Genos) | [Genos](https://academic.oup.com/gigascience/article/doi/10.1093/gigascience/giaf132/8296738) | The Worker defaults to Genos-10B-v2 for genomic embedding or generation. It is not a clinical interpretation tool. |
