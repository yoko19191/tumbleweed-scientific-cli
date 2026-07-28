# 技术栈选型

本文档记录 `tumbleweed-scientific-cli` 的技术栈选型决策。

## 定位

为 `tumbleweed-scientific-worker`（FastAPI 异步批处理平台）提供命令行客户端。

- **主要用户**：AI Agent（自动化调用）
- **次要用户**：开发者（调试、运维）
- **核心工作流**：发现模型 → 校验并上传输入 → 提交任务 → 轮询状态 → 拉取结果
- **命令边界**：Worker 相关能力全部收束在 `tumbleweed jobs`；未来能力使用新的顶层命名空间

## 选型总览

| 层级 | 选型 | 版本策略 | 理由 |
|------|------|----------|------|
| Runtime | **Node.js** | >= 22.18 | npm 用户无需额外运行时，内置 fetch、Web Streams 与稳定的 `fs.openAsBlob` |
| 命令框架 | **Commander.js** | ^13 | API 稳定，子命令结构对 Agent 友好，生态最成熟 |
| 输出着色 | **picocolors** | ^1 | 零依赖、体积极小（< 1 KB），仅在 `--human` 模式启用 |
| Schema 校验 | **Zod** | ^3 | 校验 API 响应、CLI 参数，TypeScript 类型推断一流 |
| HTTP | **Node.js 内置 fetch** | — | 零额外依赖 |
| 配置 | 环境变量 + dotenv + JSON | `dotenv` | `TUMBLEWEED_WORKER_URL` 优先，其次是 `.env` 文件、配置文件与默认 Worker 地址 |
| npm 构建 | **esbuild** | ^0.28 | 将 TypeScript 打包为 Node.js 可执行的 CommonJS 入口 |
| 二进制打包 | **@yao-pkg/pkg** | ^6 | 从同一份 npm 构建产物生成四平台独立可执行文件 |
| 多平台 CI | **GitHub Actions matrix** | — | macOS arm64/x64 + Linux x64/arm64 交叉编译 |
| 测试 | **Vitest + V8 Coverage** | ^4 | 保留黑盒命令测试，覆盖率门禁不低于 95% |
| Lint / Format | **Biome** | ^2 | 一套工具完成 TypeScript lint、import 整理与格式化 |

## 未选方案及理由

| 库 / 方案 | 不选理由 |
|-----------|----------|
| @clack/prompts / Inquirer.js | 主用户是 Agent，不需要交互式 prompt |
| ora / boxen / cli-table3 | Agent 不消费 spinner 和装饰框 |
| Oclif | 太重，当前命令规模不需要插件系统 |
| axios / got | Node.js 内置 fetch 完全覆盖需求 |
| Yargs | Commander.js 在子命令结构和 TypeScript 支持上更优 |
| Citty | 生态较新，Agent 场景下 Commander.js 更稳妥 |
| cosmiconfig | 配置面非常简单（仅 API URL），不需要多格式配置发现 |
| openapi-typescript | API 面较小（< 10 endpoint），手写 Zod schema 更灵活；后续按需引入 |

## 输出策略

- **默认输出 JSON**：命令结果 stdout 输出合法 JSON，方便 Agent 直接 `JSON.parse()`
- **`--human` 全局 flag**：启用彩色、表格等人类可读格式
- **错误和进度输出到 stderr**：进度使用 `progress` 事件，不伪装成错误
- **退出码**：0 = 成功，1 = 业务错误，2 = 网络/配置错误

## 分发策略

- **主要渠道：npm 包**。`npm install -g tumbleweed-scientific-cli` 安装，`npm update -g tumbleweed-scientific-cli` 更新，只需要 Node.js 22.18 或更高版本。
- **补充渠道：预编译二进制**。GitHub Release 附带多平台独立文件，Agent 或服务器环境可以在不安装 Node.js 的情况下直接使用。
  - `tumbleweed-darwin-arm64`
  - `tumbleweed-darwin-x64`
  - `tumbleweed-linux-x64`
  - `tumbleweed-linux-arm64`

版本标签必须与 `package.json` 中的版本一致。发布流水线在四平台二进制构建通过后，先通过 npm Trusted Publishing 发布 npm 包，再创建附带二进制与 SHA-256 校验文件的 GitHub Release。

第一次发布需要维护者在本地登录 npm，手动完成一次 `npm publish`，随后在 npm 包设置中把本仓库的 `.github/workflows/release.yml` 配置为 Trusted Publisher。完成这次引导后，后续版本只需更新 `package.json` 版本并推送对应标签，不再保存长期 npm Token。

## 动态模型发现

模型 ID、参数 schema、输入规格与模型卡全部从 `GET /models` API 动态获取，CLI 代码中不写死任何模型信息。输入声明包含示例文件时，CLI 通过 `GET /models/{model_id}/examples/{input_name}` 将它下载到用户指定的路径。
Worker 侧在现有公共 schema 内新增模型、修改示例或调整参数约束时，只需更新配置并重启，CLI 会在运行时获取变化。若 Worker 新增公共契约字段，CLI 仍需同步 Zod schema 与契约测试，否则未知字段会被过滤；容器、挂载和启动命令等内部执行字段不属于 CLI 公共协议。

`tumbleweed jobs submit` 会根据动态 schema 解析参数类型、检查必填输入，随后完成 presigned PUT 和 `POST /jobs`。CLI 只负责命令协议与本地文件传输；调度、任务状态、模型执行和结果存储仍由 Worker 负责。
