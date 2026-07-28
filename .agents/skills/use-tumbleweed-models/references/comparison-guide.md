# Tumbleweed 模型横向比较

这份参考把项目提供的两张模型对比图转换为 Agent 可执行的路由规则，并用 2026-07-27 全模型 E2E 对应的 Worker schema 校正部署差异。图中的星级是定性经验，不是统一数据集上的可复现实验；不要将星级写入科学结论。

## 蛋白、多肽与序列模型

| Worker 模型 | 主要角色 | 生成序列 | 结构预测 | 当前部署的条件控制 | 默认 GPU | 不该用它做什么 |
|---|---|---:|---:|---|---:|---|
| `af3` | 多组分全原子结构预测 | 否 | 是 | 通过 AF3 JSON、模板时间、采样与循环参数间接控制 | 1 | 不把结构置信度当亲和力，不做序列生成 |
| `esm3` | 蛋白折叠、生成、embedding | 是 | 是 | 当前只暴露序列输入及 `fold/generate/embed` 参数，不是上游完整多模态接口 | 1 | 不声称已支持自然语言或完整功能条件 |
| `xtrimopglm` | 100B 蛋白 embedding / 生成 | 是 | 否 | `task`、生成长度和设备映射 | 4 | 不用弱结构能力代替结构模型；简单 embedding 不优先用它 |
| `proteinbert` | 轻量全局与逐残基 embedding | 否 | 否 | 序列长度与 batch | 1 | 不做序列生成或结构预测 |
| `protbert` | ProtTrans BERT embedding | 否 | 否 | 输出层级、池化、batch、长度与精度 | 1 | 不把基础 embedding 当作下游分类结论 |
| `prott5` | ProtTrans T5 encoder embedding | 否 | 否 | 输出层级、池化、batch、长度与精度 | 1 | 当前在线入口不做序列生成 |
| `pepmlm` | 靶标序列条件的候选结合肽生成 | 是 | 否 | 目标蛋白序列、肽长度、候选数与采样参数 | 1 | 不把序列概率当结合、亲和力或细胞活性 |
| `peptune` | 治疗肽化学空间的无条件生成 | 是 | 否 | **当前部署仅为 unconditional**；`target` 文件是占位输入 | 1 | 不声称当前服务已实现图中所示毒性、稳定性或活性条件优化 |
| `genos` | 基因组 DNA/RNA embedding / 生成 | 是 | 否 | `embed/generate`、模型规模与生成长度 | 2 | 不用于蛋白或多肽任务，不输出临床诊断 |

### 图表名称边界

- 图中的 `SimPep` 不在当前 Worker `/models` 中，只能作为外部对照，不能生成 CLI 调用。
- `proteinbert`、`protbert` 与 `prott5` 是三个独立 Worker ID。前者是 ProteinBERT，后两者属于 ProtTrans；不能因名称相似而互换。
- 当前 `prott5` 挂载完整 ProtT5-XL-UniRef50 encoder-decoder checkpoint，但在线任务只暴露 encoder embedding，不提供论文或上游可能涉及的生成接口。
- “ESM-3 支持条件控制”描述的是模型上游能力上限；当前 Worker 只保证实时 schema 中暴露的控制面。
- “PepTune 可做多目标性质优化”描述的是论文/上游方向；当前 Worker 卡片明确说明只接入无条件生成。

## 分子对接与结合预测

| Worker 模型 | 范式 | 是否需要已知口袋 | 受体柔性 | 相对计算成本 | 最适合的入口 |
|---|---|---:|---|---|---|
| `autodock_vina` | 经验打分 + 搜索 | 是，需要 box | 低 | 低 | 已知口袋的大批量传统基线 |
| `smina` | Vina 分支、最小化与可定制打分 | 是，需要 autobox 参考 | 低 | 低 | score-only、局部最小化、可定制经典流程 |
| `gnina` | Vina 采样 + 3D CNN 重评分 | 是，需要 autobox 参考 | 低 | 中 | 已知口袋的 CNN pose ranking |
| `diffdock` | SE(3) 扩散生成式盲对接 | 否 | 有限，蛋白主体近似固定 | 中 | 结合位点未知时生成多样 pose |
| `dynamicbind` | 生成式动态结合预测 | 否 | 高于刚性 docking，面向 induced fit | 高 | 柔性口袋、apo-to-holo 变化 |
| `flowdock` | Flow matching 柔性共折叠 | 否 | 中等，联合生成复合物 | 中高 | 同时需要 pose、结构置信度与亲和力估计 |
| `boltz2` | 端到端复合物结构与亲和力模型 | 否 | 通过联合结构预测表达 | 高 | 多组分结构 + 配体亲和力联合任务 |
| `af3` | 多组分结构预测 | 否 | 通过联合结构预测表达 | 高 | 复合物结构验证与机制研究，不直接输出实验亲和力 |

### 选择顺序

1. 已知可靠口袋且候选很多：`autodock_vina` 初筛，再用 `gnina` 或 `smina` 重评分/最小化。
2. 不知道口袋：先用 `diffdock`；不要给 Vina 系工具编造 docking box。
3. 受体构象变化决定结果：选 `dynamicbind`；需要联合 pose、置信度和亲和力时考虑 `flowdock`。
4. 任务本质是全复合物结构而不只是 docking pose：选 `af3`；需要亲和力估计时考虑 `boltz2`。
5. 关键候选至少保留两种独立证据。经验分数、CNN 分数、pose confidence、结构 confidence 和 affinity estimate 必须分开报告。

## 如何使用图中的“速度/精度”

- 速度应以当前输入规模、采样参数、GPU 数和实际任务时长衡量，而不是沿用星级。
- 精度必须绑定具体 benchmark、pose/affinity 指标、数据切分和模型版本。
- “SOTA”“最强”“更稳定”只可作为待验证假设；没有当前部署的对照实验时，不写成结论。
- 图表适合做第一轮路由，不足以替代模型卡、论文、真实 schema 和端到端结果。
