# Worker 模型端到端验证矩阵

> 更新时间：2026-07-27
> Worker：`http://10.39.13.209:9050`
> 结论：19 / 19 个启用模型均由新任务完成提交、等待终态和 canonical result 下载。

这份矩阵记录 2026-07-27 的全模型验收，并使用 Worker 修复后的五模型回归结果覆盖 AF3、AutoDock Vina、Boltz-2、DiffDock 与 DynamicBind 的旧结果。每条记录都来自独立任务，终态均为 `SUCCEEDED`，拉回文件也经过非空与 SHA-256 复核。

| 模型 | 新任务 ID | canonical result | 证据 |
|---|---|---|---|
| `af3` | `job_20260727_091953_28035f89` | `example_fold_model.cif` | Worker 修复回归 |
| `autodock_vina` | `job_20260727_091953_bdbbb46a` | `vina_docked.pdbqt` | Worker 修复回归 |
| `boltz2` | `job_20260727_092428_ab70d6b6` | `input_example_model_0.cif` | Worker 修复回归 |
| `diffdock` | `job_20260727_092428_e44ecd1d` | `rank1.sdf` | Worker 修复回归 |
| `dynamicbind` | `job_20260727_091953_2110c921` | `rank1_ligand_lddt0.41_affinity6.52.sdf` | Worker 修复回归 |
| `esm3` | `job_20260727_062614_d54f8497` | `example_protein_ubiquitin_76_aa_embed_meta.json` | 全模型验收 |
| `flowdock` | `job_20260727_062614_2036a3fb` | `metadata.json` | 全模型验收 |
| `genos` | `job_20260727_062614_8838151a` | `embeddings.pt` | 全模型验收 |
| `gnina` | `job_20260727_062614_e2f2ec00` | `gnina.log` | 全模型验收 |
| `pepmlm` | `job_20260727_062614_a3925051` | `metadata.json` | 全模型验收 |
| `peptune` | `job_20260727_062614_6dcc6bae` | `metadata.json` | 全模型验收 |
| `proteinbert` | `job_20260727_062614_26ea5734` | `global_representations.npy` | 全模型验收 |
| `protbert` | `job_20260727_062614_3c3fa62b` | `metadata.json` | 全模型验收 |
| `proteinmpnn` | `job_20260727_062614_1cb43bff` | `input_example.fa` | 全模型验收 |
| `prott5` | `job_20260727_062614_b62e07d6` | `metadata.json` | 全模型验收 |
| `rfdiffusion` | `job_20260727_062614_2a355cec` | `design_0.pdb` | 全模型验收 |
| `rfdiffusion_aa` | `job_20260727_070520_8d0f332d` | `design_0.pdb` | 全模型验收 |
| `smina` | `job_20260727_062614_ca73e31d` | `metadata.json` | 全模型验收 |
| `xtrimopglm` | `job_20260727_062614_e737c30e` | `embeddings.pt` | 全模型验收 |

## 五模型修复回归

Worker 修复后，五个模型重新使用当前公开示例完成任务。AF3 示例显式提供空 MSA 与模板，Vina 示例改为有效 PDBQT 与 box，Boltz-2 和 DiffDock 在 schema 中声明稳定的最小步数，DynamicBind 改用配对的受体 PDB 与配体 SDF。canonical result 也从说明或元数据文件收敛到真正的结构或 docking 结果。

低于 Boltz-2 `2 / 2`、DiffDock `20 / 19` 下限的参数会由 CLI 根据实时 schema 在任务创建前拒绝。DynamicBind 的输入键保持为 `ligand_csv`，但当前示例是 `ligand_example.sdf`，Wrapper 负责将其转换为内部表格。

## 验收边界

这里的通过只证明“模型发现 → 输入获取 → 上传 → 创建任务 → 等待终态 → canonical result 下载”的工程闭环。低成本参数不能用于比较模型精度，模型分数也不能替代实验验证。

`jobs result` 当前下载 Worker 选定的一个 canonical object，不等同于递归下载整个输出目录。原始命令、stdout、stderr、日志、输入哈希和结果哈希保存在本地 `e2e/jobs/20260727T142236-all-models/` 与 `e2e/jobs/20260727T171857-worker-fix-retest-five/`；这些运行证据继续遵循仓库现有忽略策略。
