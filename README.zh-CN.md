# workbuddy-univer-office

[English](README.md)

**当前为开发预览版，尚未完成正式发布或 WorkBuddy 市场上架验收。** 详见[发布评估](docs/release-readiness.md)。

<img src="assets/univer-office.png" alt="Univer Office" width="64" height="64">

基于 Univer Office SDK 的 WorkBuddy Office 插件开发原型。DSH 仅作为交互参考，不是实现依赖。

- [产品与技术规格](docs/workbuddy-univer-office-spec.md)
- [验证记录、运行方式与未完成项](docs/workbuddy-univer-office-validation.md)
- [SDK 发布证据](docs/office-sdk-release-evidence.json)

当前已在 WorkBuddy 5.5.4 验证销售表创建、公式回读、截图、ready，以及 HTTP MCP App 卡片挂载、刷新、原生全屏/返回和打开浏览器审阅页。单 Sheet 内嵌只读 Viewer 已验证自动同步数值与公式结果；Doc 已验证正文、富文本与表格自动同步；Base 已验证文本/数值更新及新增记录同步；Board 已验证节点文字、颜色与连接线同步；Slide 已验证页面更新、新增页与两页布局检查。内嵌人工编辑与审阅、其他内容的实时同步、多页/多 Unit 全屏状态保留、浮窗、完整插件安装和功能对齐仍按验证记录逐项验收。不要将开发配置视为生产安装包。

开发接入时，在 WorkBuddy 中先选择本项目为工作空间，再配置本地 MCP 入口。测试中未选择项目时，宿主 Node 在读取 Documents 下的入口文件处阻塞，随后握手超时；通过原生文件夹选择器选择项目后，入口约 2 秒完成初始化。MCP 列表“已启用”只表示配置状态，仍需实际调用工具验证。

开发环境的 MCP App 使用本机 Streamable HTTP 入口。先完成服务、Viewer、Render 和 App 的定向构建，再运行：

```sh
WORKBUDDY_OFFICE_WORKSPACE=/absolute/path/to/authorized-workspace node dist/mcp/http.js
```

进程仅监听 `127.0.0.1`，默认从 9080 选择可用端口。凭据写入权限为 `0600` 的 `.data/http-mcp-runtime.json`；在 WorkBuddy 自定义 MCP 配置中，为服务配置 `type: "http"` 并使用文件中的 `url`、`headers`。启动进程需保持运行，重启后更新配置中的端口与凭据。不要将凭据提交到仓库。

WorkBuddy 5.5.4 的 App 发现已实测接受此入口；自定义 stdio 可调用工具，但本次宿主的 App 发现来源不包含它。同一工作区只运行一个 Office 服务，切换传输前停掉旧实例并替换原连接器，避免同时启动 stdio 与 HTTP。正式分发的服务启动、复用和自动配置仍待完成。

当前源码会在打开 Office 文件前取得工作区独占租约；重复启动返回 `WORKSPACE_IN_USE`。正常退出或进程崩溃后租约自动释放，不需要手动删锁。工作区中的 `.workbuddy-office-lease.sqlite` 是独立的运行协调文件，运行期间不要删除或替换它。工作区路径别名会先解析为真实路径；不同工作区通过硬链接等方式指向同一物理 Office 文件的情况仍待验证。升级这项保护前，先停止旧版服务，旧进程不会自动获得新保护。

本地开发分发包可用 `pnpm pack:plugin` 生成，位置为 `.data/packages/workbuddy-univer-office-0.1.0.tgz`，同目录 `package-audit.json` 记录完整条目和 SHA-512。该命令按顺序构建四个运行目标，排除测试、工作区文件、凭据和 node_modules；归档从插件根目录开始，包含清单、Skills、编译产物、锁文件和公开 registry 配置。

这不是已通过 WorkBuddy 市场安装验收的包。解压到独立目录后，使用 Node ≥22.12 和 pnpm 10.33.4 准备运行依赖：

```sh
cp config/registry.npmrc .npmrc
pnpm install --prod --frozen-lockfile
```

依赖安装完成后可使用上文 HTTP 开发接入命令。运行时托管、自动启动与凭据配置、市场安装以及其他操作系统仍需验收；包中不包含 Pro license。

应用源码采用 [Apache-2.0](LICENSE) 许可；SDK 等依赖保留各自许可要求，不随本仓库授予 Pro 许可或商标权。当前仍包含八个 Skill，统一为单个 `univer-office` 入口尚未实施。

验证文档引用的 `.data/` 产物与 `docs/screenshots/` 截图保留在开发机器，不包含在公开仓库中。
