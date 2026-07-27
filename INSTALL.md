# Tumbleweed CLI 安装说明（供 AI Agent 阅读）

本文档面向 AI Agent。请在用户的本机终端中安装并校验 Tumbleweed CLI 及其配套 Skills。

CLI 的 npm 包名是 `tumbleweed-scientific-cli`，可执行命令是
`tumbleweed`。配套 Skills 从 GitHub 仓库
`yoko19191/tumbleweed-scientific-cli` 安装。用户通常不需要克隆源码，
也不需要进入本仓库。

不要臆造版本号、安装路径或 Worker 状态。每一步都应以本机命令的退出码和实际输出为准。

## 1. 安装前检查

先确认 Node.js、npm 和网络可用：

```bash
node --version
npm --version
npm view tumbleweed-scientific-cli version
```

Node.js 必须为 **22.18.0 或更高版本**。如果 Node.js 或 npm 尚未安装，
或版本不满足要求，Agent 应根据用户的操作系统使用可靠方式完成安装或升级；
需要管理员权限或会改变系统级配置时，先取得用户同意。

安装过程需要访问两个来源：

- npm Registry，用于安装 CLI；
- GitHub，用于获取配套 Skills。

网络失败时，应先检查代理、DNS 和 npm registry 配置，再重试。不要因为
用户安装了 pnpm、Yarn 或 Bun 就改用其他命令；本项目的标准分发链路是 npm。

## 2. 安装 CLI

执行：

```bash
npm install --global tumbleweed-scientific-cli@latest
```

安装后验证命令、版本和路径：

```bash
tumbleweed --version
command -v tumbleweed
```

Windows PowerShell 使用：

```powershell
tumbleweed --version
where.exe tumbleweed
```

如果 npm 报告安装成功，但系统找不到 `tumbleweed`，执行
`npm prefix -g` 检查全局安装前缀，并确认对应的可执行文件目录已经加入
`PATH`。不要通过重复安装掩盖 `PATH` 问题。

## 3. 安装配套 Skills

CLI 可用后，使用 `skills` CLI 从 GitHub 安装全部配套 Skills：

```bash
npx --yes skills add \
  yoko19191/tumbleweed-scientific-cli \
  --skill '*' \
  -g -y
```

`--skill '*'` 会选择 `.agents/skills` 中的全部公开 Skills。内部开发 Skill
`build-better-agent-first-cli` 单独保存在 `.agents/internal-skills`，不属于
公开发现目录，因此不会出现在安装结果中。

安装前可以先执行无副作用的发现命令：

```bash
npx --yes skills add \
  yoko19191/tumbleweed-scientific-cli \
  --list
```

输出必须恰好包含以下 6 个公开 Skills：

- `use-tumbleweed-models`：根据研究目标选择模型或模型链；
- `run-tumbleweed-jobs`：发现模型参数、提交任务、跟踪状态并取回结果；
- `predict-structures-with-tumbleweed`：完成结构预测；
- `design-proteins-with-tumbleweed`：设计蛋白质或多肽；
- `dock-molecules-with-tumbleweed`：完成蛋白质—配体对接；
- `embed-sequences-with-tumbleweed`：生成蛋白质或基因组序列表示。

`skills` 会自动识别当前 Agent。如果识别结果不正确，使用
`--agent codex`、`--agent claude-code` 或当前工具对应的 Agent ID
重新执行。不要使用 `--all`；它会把公开 Skills 安装到所有受支持的 Agent，
而不是只安装到当前 Agent。

安装完成后执行：

```bash
npx --yes skills list -g
```

检查输出中是否包含上述 6 个 Skills，并确认
`build-better-agent-first-cli` 没有出现。不要只根据 `npx` 的下载提示判断
安装成功。

## 4. 检查配置并连接 Worker

先读取当前配置以及每个值的来源：

```bash
tumbleweed jobs config show
```

默认 Worker 地址是 `http://10.39.13.209:9050`。如果用户提供了另一个 Worker 地址，使用 CLI 持久化配置：

```bash
tumbleweed jobs config set worker_url http://your-worker:9050
```

也可以在当前进程中通过环境变量覆盖：

```bash
export TUMBLEWEED_WORKER_URL="http://your-worker:9050"
```

Windows PowerShell 使用：

```powershell
$env:TUMBLEWEED_WORKER_URL = "http://your-worker:9050"
```

除非用户明确给出了归属标识，否则不要猜测或擅自填写 `job_owner`。

## 5. 完成端到端校验

先检查 Worker 的健康状态，再读取实时模型目录：

```bash
tumbleweed jobs health
tumbleweed jobs models
```

默认输出是 JSON。Agent 应检查退出码，并解析 `health`、`ready` 或错误对象，不要依靠终端文字猜测结果。

CLI 安装成功与 Worker 连通是两个独立结论。如果 `tumbleweed --version`
正常，而 `jobs health` 因超时或网络错误失败，应保留已完成的 CLI 和
Skills 安装，继续检查 Worker 地址、内网连接、VPN/Tailscale 或服务状态；
不要反复重装 npm 包。

只有在用户要求运行真实计算，并且已经明确模型、输入文件和可能产生的计算成本后，才提交任务。不要为了验证安装而创建远端 Job。

## 6. 更新

将 CLI 更新到 npm 的最新版本：

```bash
npm install --global tumbleweed-scientific-cli@latest
tumbleweed --version
```

更新已经全局安装的配套 Skills：

```bash
npx --yes skills update \
  use-tumbleweed-models \
  run-tumbleweed-jobs \
  predict-structures-with-tumbleweed \
  design-proteins-with-tumbleweed \
  dock-molecules-with-tumbleweed \
  embed-sequences-with-tumbleweed \
  -g -y
```

更新后重新执行 `npx --yes skills list -g`、
`tumbleweed jobs config show` 和 `tumbleweed jobs health`。

## 7. 常见问题

| 现象 | 可能原因 | Agent 应采取的动作 |
| --- | --- | --- |
| `EBADENGINE` | Node.js 版本过低 | 升级 Node.js 后重装 CLI |
| 找不到 `tumbleweed` | npm 全局目录不在 `PATH` | 检查全局前缀和 `PATH` |
| `npx skills` 找不到仓库 | GitHub 网络异常 | 检查代理和仓库地址后重试 |
| 发现内部开发 Skill | 安装来源或仓库结构不正确 | 确认来源为本仓库且开发 Skill 位于 `internal-skills` |
| Skills 没有加载 | Agent 尚未刷新 | 检查安装位置并重启会话 |
| `jobs health` 超时 | Worker 网络或服务异常 | 检查配置、内网和 Worker |
| `jobs models` 未就绪 | 模型服务仍在启动 | 保留安装并报告 readiness |

## 8. 向用户汇报

安装结束时，向用户简要说明：

1. 实际安装的 CLI 版本与可执行文件路径；
2. 已发现并安装的 Skills；
3. 当前 Worker 地址及其配置来源；
4. Worker 是否健康、是否就绪；
5. 如果有未完成项，给出准确错误和下一步动作。

不要声称未执行的检查已经通过，也不要在汇报中暴露代理、Token、凭据或其他敏感环境信息。
