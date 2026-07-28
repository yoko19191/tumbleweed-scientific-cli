# Worker 全模型端到端验收手册

> 基线日期：2026-07-27
> Worker：`http://10.39.13.209:9050`

这份手册用于重复验证“发现模型 → 获得有效输入 → 上传并提交 → 等待终态 → 拉回结果”的完整 CLI 链路。表中的参数刻意压低采样数量和迭代次数，只证明工程链路可运行，不代表可用于科研结论的推荐配置。

## 执行边界

提交任务会占用共享 GPU。先获得明确授权，再执行 `jobs submit`；模型发现、健康检查和示例下载不会创建任务。每次只提交一个模型，拉回结果并记录证据后再继续，避免 19 个任务同时争抢资源。

```bash
export TUMBLEWEED_WORKER_URL=http://10.39.13.209:9050
export RUN_ROOT=/tmp/tumbleweed-e2e-20260727

./dist/tumbleweed jobs health
./dist/tumbleweed jobs models
```

`jobs health` 必须同时满足：

- `health.status == "ok"`
- `ready.status == "ok"`
- `ready.checks` 中 registry、database、storage、ray 全部为 `ok`
- `ready.resources.gpus_available` 足以运行当前模型

## 输入与最小参数

除 `rfdiffusion_aa` 外，所有必填输入均应通过 `jobs example` 从当前 Worker 获取。文件名来自实时模型 schema；提交前仍需运行 `jobs models <model_id>`，防止部署更新后表格过期。

| 模型 | 必填示例输入 | 工程验收参数 | 默认 GPU | Schema 超时 |
|---|---|---|---:|---:|
| `af3` | `af_input=af_input_example.json` | `num_diffusion_samples=1 num_recycles=1` | 1 | 21600s |
| `autodock_vina` | `receptor=receptor_example.pdbqt ligand=ligand_example.pdbqt box_config=box_config_example.txt` | `exhaustiveness=1 num_modes=1 seed=42` | 1 | 7200s |
| `boltz2` | `input_yaml=input_example.yaml` | `recycling_steps=1 sampling_steps=2 diffusion_samples=1 max_parallel_samples=1 num_workers=0 preprocessing_threads=1 sampling_steps_affinity=2 diffusion_samples_affinity=1` | 1 | 21600s |
| `diffdock` | `protein=protein_example.pdb ligand=ligand_example.sdf` | `samples_per_complex=1 inference_steps=20 actual_steps=19 save_visualisation=false` | 1 | 7200s |
| `dynamicbind` | `protein=protein_example.pdb ligand_csv=ligand_example.sdf` | `samples_per_complex=1 savings_per_complex=1 inference_steps=1 batch_size=1 seed=42` | 1 | 10800s |
| `esm3` | `sequence=sequence_example.fasta` | `task=embed` | 1 | 3600s |
| `flowdock` | `receptor=receptor_example.pdb ligand=ligand_example.sdf` | `n_samples=1 chunk_size=1 num_steps=1 use_template=true seed=42` | 1 | 10800s |
| `genos` | `sequence=sequence_example.fasta` | `task=embed` | 2 | 7200s |
| `gnina` | `receptor=receptor_example.pdb ligand=ligand_example.sdf autobox_ligand=autobox_ligand_example.sdf` | `mode=dock cnn_scoring=rescore exhaustiveness=1 num_modes=1 seed=42` | 1 | 7200s |
| `pepmlm` | `target=target_example.fasta` | `peptide_length=8 top_k=1 num_binders=1 seed=42` | 1 | 3600s |
| `peptune` | `target=target_example.txt` | `mode=unconditional sequence_length=8 num_sequences=1 sampling_steps=1` | 1 | 7200s |
| `proteinbert` | `sequence=sequence_example.fasta` | `seq_len=16 batch_size=1` | 1 | 3600s |
| `protbert` | `sequence=sequence_example.fasta` | `task=both pooling=mean batch_size=1 max_sequence_length=1024 output_dtype=float32` | 1 | 3600s |
| `proteinmpnn` | `pdb=input_example.pdb` | `num_seq_per_target=1 batch_size=1 seed=42` | 1 | 3600s |
| `prott5` | `sequence=sequence_example.fasta` | `task=both pooling=mean batch_size=1 max_sequence_length=1000 output_dtype=float32` | 1 | 7200s |
| `rfdiffusion` | 无必填文件；无条件生成 | `contigs=[30-30] num_designs=1 t_steps=15 write_trajectory=false deterministic=true` | 1 | 7200s |
| `rfdiffusion_aa` | 见下一节 | `ligand=OQO contigs=150-150 num_designs=1 diffusion_steps=40 deterministic=true` | 1 | 21600s |
| `smina` | `receptor=receptor_example.pdb ligand=ligand_example.sdf autobox_ligand=autobox_ligand_example.sdf` | `mode=dock scoring=vina exhaustiveness=1 num_modes=1 seed=42` | 1 | 7200s |
| `xtrimopglm` | `sequence=sequence_example.fasta` | `task=embed` | 4 | 10800s |

2026-07-27 回归确认：Boltz-2 的 `sampling_steps` / `sampling_steps_affinity` 下限为 `2 / 2`，DiffDock 的 `inference_steps` / `actual_steps` 下限为 `20 / 19`。CLI 会依据实时 schema 在上传和创建任务前拒绝更低的值。DynamicBind 的输入键仍叫 `ligand_csv`，当前 Worker 示例则是 `ligand_example.sdf`；Wrapper 也支持包含 `ligand` 列的 CSV 或单条 SMILES 文本。

低迭代配置可能降低结构或采样质量。验收结果只能标记为“CLI 与 Worker 工程链路通过”，不能据此比较模型精度。

## RFdiffusion All-Atom 输入

当前部署的 `rfdiffusion_aa` 必须上传含目标配体的 PDB，却没有声明可下载示例。上游官方仓库使用 `input/7v11.pdb`、配体残基名 `OQO` 和 `150-150` contig 演示小分子 binder 设计：

- 仓库说明：<https://github.com/baker-laboratory/rf_diffusion_all_atom#small-molecule-binder-design>
- 官方输入：<https://raw.githubusercontent.com/baker-laboratory/rf_diffusion_all_atom/main/input/7v11.pdb>
- SHA-256：`ba1e3014bd83f044d7c0d82bfd3d2218427a11e337dab41d00b724db50294cb7`

```bash
mkdir -p "$RUN_ROOT/rfdiffusion_aa"
curl -L \
  https://raw.githubusercontent.com/baker-laboratory/rf_diffusion_all_atom/main/input/7v11.pdb \
  -o "$RUN_ROOT/rfdiffusion_aa/7v11.pdb"
shasum -a 256 "$RUN_ROOT/rfdiffusion_aa/7v11.pdb"
grep '^HETATM.* OQO ' "$RUN_ROOT/rfdiffusion_aa/7v11.pdb" | head
```

校验和必须一致，且 PDB 中必须存在 `OQO` 的 `HETATM`。不要用空 PDB、只含蛋白的 PDB，或与 `--param ligand=...` 不一致的残基名代替。

## 单模型闭环

以下以 `af3` 为例。其他模型只需按表格替换输入名、文件名和参数；每个参数都使用独立的 `name=value` 项。

```bash
MODEL=af3
MODEL_DIR="$RUN_ROOT/$MODEL"
mkdir -p "$MODEL_DIR/input" "$MODEL_DIR/result"

./dist/tumbleweed jobs models "$MODEL"
./dist/tumbleweed jobs example "$MODEL" af_input \
  --output "$MODEL_DIR/input/af_input_example.json"

./dist/tumbleweed jobs submit \
  --model "$MODEL" \
  --input "af_input=$MODEL_DIR/input/af_input_example.json" \
  --param num_diffusion_samples=1 num_recycles=1 \
  --job-alias "e2e-20260727-$MODEL" \
  --idempotency-key "e2e-20260727-$MODEL"
```

从提交输出读取 `id`，然后完成终态与结果验证：

```bash
JOB_ID=job_...

./dist/tumbleweed jobs wait "$JOB_ID" --interval 5 --timeout 21900
./dist/tumbleweed jobs logs "$JOB_ID"
./dist/tumbleweed jobs result "$JOB_ID" --output-dir "$MODEL_DIR/result"
find "$MODEL_DIR/result" -type f -size +0
```

验收记录至少保存模型 ID、任务 ID、提交参数、终态、结果文件路径、大小与 SHA-256。任务为 `FAILED` 或 `CANCELED`、下载文件为空、只有预签名 URL 而未实际下载，均不能记为通过。

## 结果判定

每个模型必须同时满足：

- 提交返回新任务 ID，且 Worker 保存了模型 ID、输入对象键和参数。
- `jobs wait` 返回 `SUCCEEDED`；只看到 `QUEUED` 或 `RUNNING` 不算完成。
- `jobs result --output-dir` 通过编译后的 `dist/tumbleweed` 把非空文件写到本地。
- 二进制 embedding、结构文件与文本结果都能在进程退出前完整落盘。
- 验证证据写入 [端到端验证矩阵](E2E_MODEL_MATRIX.md)，并明确区分新任务和历史任务。
