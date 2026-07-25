# tumbleweed-scientific-cli

`tumbleweed` 是面向 AI Agent 与开发者的科学计算命令行入口。第一版能力集中在 `tumbleweed jobs`：从远端 Tumbleweed Scientific Worker 动态发现模型、上传输入、提交任务、观察状态并获取结果。

CLI 默认向 stdout 输出 JSON，进度与错误写入 stderr。模型 ID、输入和参数规格来自 Worker 的 `/models`，不会写死在 CLI 中。

## 安装

### 预编译二进制

从 GitHub Releases 下载当前平台的 `tumbleweed-*` 文件，然后放入 `PATH`：

```bash
chmod +x tumbleweed-darwin-arm64
mv tumbleweed-darwin-arm64 ~/.local/bin/tumbleweed
```

### 源码运行

```bash
bun install
bun run dev -- --help
```

## Worker 地址

默认 Worker 地址是 `http://100.120.104.69:9050/`。需要切换实例时，可通过环境变量 `TUMBLEWEED_WORKER_URL` 或项目目录下的 `.env` 文件设置：

```bash
export TUMBLEWEED_WORKER_URL="http://100.120.104.69:9050/"
```

```bash
# .env
TUMBLEWEED_WORKER_URL=http://100.120.104.69:9050/
```

也可以持久化到 `~/.config/tumbleweed/config.json`：

```bash
tumbleweed jobs config set worker_url http://100.120.104.69:9050/
tumbleweed jobs config set job_owner liangzhu-lab
tumbleweed jobs config show
```

解析顺序为：环境变量 > `.env` 文件 > 配置文件 > 默认值。旧的 `TW_API_URL` 和 `api_url` 已移除。

仓库提供 `.env.example`，复制为 `.env` 后即可使用默认 Worker 地址。
Worker 的元数据与任务控制请求会在 30 秒后超时并返回系统错误；文件上传与结果下载不受这个控制请求时限影响。

## 命令

### 发现模型

```bash
tumbleweed jobs models
tumbleweed jobs models esm3
```

不带参数时返回所有可用模型；指定模型 ID 时返回它的输入、参数、资源和输出规格。
模型详情也会保留 Worker 提供的模型卡、官方链接和示例文件声明。存在示例时，可以下载到明确的本地路径：

```bash
tumbleweed jobs example af3 af_input --output ./af_input_example.json
```

### 提交任务

`submit` 会先获取模型 schema，在本地验证输入和参数，然后依次完成 presign、文件上传和任务创建：

```bash
tumbleweed jobs submit \
  --model esm3 \
  --input sequence=./input.fa \
  --param task=fold \
  --job-id job_20260723_120000_a1b2c3d4 \
  --job-alias esm3-fold-demo \
  --idempotency-key esm3-fold-demo-v1
```

多个输入或参数可以连续传入。已经拥有 MinIO object key 时，可以跳过本地上传：

```bash
tumbleweed jobs submit \
  --model esm3 \
  --input-key sequence=jobs/example/input/sequence/input.fa \
  --param task=fold
```

参数按照 Worker schema 解析，而不是根据字符串外观猜测类型。`str` 参数中的 `0.1` 会保留为字符串，`int`、`float`、`bool` 和 `enum` 则分别校验。
Agent 应显式提供稳定的 `--job-id` 与 `--idempotency-key`。若提交请求超时，先按原 Job ID 查询；不要换一组标识直接重试，以免重复消耗算力。

### 查看任务

```bash
tumbleweed jobs list
tumbleweed jobs list --owner liangzhu-lab --limit 20
tumbleweed jobs show <job_id>
tumbleweed jobs wait <job_id> --timeout 600 --interval 5
tumbleweed jobs logs <job_id>
```

`wait` 会轮询到 `SUCCEEDED`、`FAILED` 或 `CANCELED`。JSON 模式下，轮询进度以 `{"progress":"..."}` 写入 stderr，不会污染最终 stdout；任务失败或取消时仍输出最终 Job JSON，但命令以退出码 `1` 结束。

### 获取结果与取消任务

```bash
tumbleweed jobs result <job_id>
tumbleweed jobs result <job_id> --output-dir ./results
tumbleweed jobs cancel <job_id>
```

不指定目录时，`result` 返回 presigned 下载信息；指定目录后直接把产物流式写入本地文件。

### 检查 Worker

```bash
tumbleweed jobs health
```

该命令同时检查 `/healthz` 与 `/readyz`，并返回实际 Worker 地址以及 registry、database、storage 的就绪状态；Ray 后端启用时还会保留 Ray 检查结果与 GPU 总量、可用量。

## 输出与退出码

默认模式保证命令结果是 JSON。使用 `--human` 可以为任务和模型列表启用更适合终端阅读的输出：

```bash
tumbleweed --human jobs list
```

| 退出码 | 含义 |
|---|---|
| `0` | 命令成功 |
| `1` | 参数、模型、任务或其他业务错误 |
| `2` | Worker 连接、服务端、配置或响应契约错误 |

## Agent Skills

仓库内置一组按需加载的 Agent Skills：

| Skill | 用途 |
|---|---|
| `use-tumbleweed-models` | 在当前 19 个模型间做场景、输入输出、算力和局限性路由 |
| `run-tumbleweed-jobs` | 完成发现、示例下载、幂等提交、轮询、日志与结果拉回 |
| `design-proteins-with-tumbleweed` | 串联蛋白骨架、序列、肽设计与验证 |
| `predict-structures-with-tumbleweed` | 选择 AF3、Boltz-2 或 ESM-3 折叠 |
| `dock-molecules-with-tumbleweed` | 选择并串联六类分子对接与重评分工具 |
| `embed-sequences-with-tumbleweed` | 选择蛋白或基因组 embedding / 生成模型 |

Skills 位于 [`.agents/skills`](.agents/skills)。模型目录保留每个模型的选择时机、精确输入名、输出语义、局限和典型串联方式，同时要求 Agent 在提交前以实时 `jobs models <model_id>` 为准。科学依据可追溯到 [官方仓库与论文索引](.agents/skills/use-tumbleweed-models/references/source-index.md)，实际发起任务可从 [19 模型任务配方](.agents/skills/use-tumbleweed-models/references/job-recipes.md) 起步；跨模型的定性比较与部署边界见 [模型横向比较](.agents/skills/use-tumbleweed-models/references/comparison-guide.md)，当前端到端证据见 [Worker 模型验证矩阵](docs/E2E_MODEL_MATRIX.md)。

## 开发与验证

```bash
bun run dev -- jobs --help
bun run test:coverage
bun run lint
bun run typecheck
bun run format:check
bun run build
bun run check
```

`bun run check` 是完整质量门禁：测试覆盖率不低于 95%、Biome lint、TypeScript 类型检查、格式检查以及当前平台单二进制构建。多平台二进制使用 `bun run build:all` 构建。

技术选型与边界说明见 [docs/STACKS.md](docs/STACKS.md)。
