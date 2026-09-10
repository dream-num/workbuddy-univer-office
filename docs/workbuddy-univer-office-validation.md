# 实施验证记录

更新：2026-09-10。状态：本地开发原型，尚未完成最终规格。

## 已验证的范围

- SDK 运行依赖固定为 `1.0.0-insiders.20260907-70fc579`，按官方 manifest 使用独立版本的 native binding 和资源包。已安装、类型检查及分开构建服务、Viewer、Render Page。
- 五类 Unit（Sheet、Doc、Slide、Base、Board）的空内容创建与 SDK 检查。
- Sheet 草稿的值、样式、公式编辑；提交确认后重新加载，公式结果正确。
- 草稿提交审阅后冻结；Agent 无法直接合入；浏览器审阅操作可合入。过期审阅指纹被拒绝，主线写入被拒绝。
- SQLite 文件持久化，服务重启后读取已合入目录与 Unit。
- 本地 MCP stdio 的 15 个工具发现、API 搜索、创建文件、状态查询和官方资源目录查询。新增 `univer_preview` 关联标准 MCP Apps HTML 资源。
- SDK 对销售表生成 PNG、两页 PDF 和 XLSX。XLSX 已由 LibreOffice Calc 独立导入并转为两页 PDF，数据及样式可见；列宽导致季度合计和增长率位于第二页，尚不能视为打印布局通过。
- SDK 语义比较返回固定主线版本 1 与草稿版本 2 的 7 项单元格变化，包括公式结果变化。

2026-09-10 最近完整 `pnpm test`：10 项集成测试全部通过，0 失败，约 24.4 秒（本地记录 `/tmp/workbuddy-products-regression.log`）。新增 Doc 富文本/表格和 Board 文本持久化回读验证。`pnpm typecheck` 与 Viewer 构建通过。双栏快照已在浏览器目视验证，并点击 B4 差异完成定位；两侧预览使用独立页面，避免协作 Facade 的全局扩展影响静态快照。

这些结果不能推导出五类内容的所有复杂能力已经通过测试。实际截图见本目录 `screenshots/`。

## 尚未完成

1. WorkBuddy 插件安装、变量解析、MCP App 实时编辑器、旧回合重开及客户端显示模式验证。本机已安装 WorkBuddy 5.5.4，进程在运行，但 CUA 按完整应用路径读取窗口反复超时，尚未验证插件加载。已在官方 AppBridge 沙箱测试页验证快照卡片、刷新、深色主题、inline/fullscreen/pip 请求及指定草稿审阅跳转；这些截图不是 WorkBuddy 客户端。
2. 历史列表与历史恢复。所选发布批次的 `edit-history-viewer` 未找到匹配版本；未混装旧版或复制 DSH 产物。
3. 五类内容的复杂编辑、完整语义导航、跨 Unit 引用和嵌入资源、Base 视图导出及完整格式保真验收。
4. 多 Unit 部分合入后的恢复流程、持久操作恢复、服务租约和空闲退出。
5. 生产级任务权限及代码执行沙箱。当前内容执行在独立进程中运行，但不是操作系统安全沙箱，只适合可信代码的本地开发验证。
6. 插件完整打包安装与 Windows 验证、英文界面、全部规格验收条目。
7. Slide 的 SDK 比例输入框在自动化输入 `45%` 后显示 `400%`，其输入交互还需定位；新增的“适应页面”操作已通过公开 SDK 接口正常工作。

## 五类内容及独立文件验证补充

`scripts/verify-products.mjs` 创建 Doc、Slide、Base、Board 四类非空内容，逐个确认 commit、重新加载回读、检查结构并生成 SDK PNG。四个 Unit 均为已确认 revision 2，草稿已 ready。证据位于本地 `.data/products-evidence.json`；该文件名含“五类”，此次脚本实际只新增四类，Sheet 使用此前独立样例。

- Doc：中文富文本和 4×2 表格。修复空 Doc 初始段落/节 ID 不符合 SDK 合同的问题，改用公开 `createParagraphId` / `createSectionId`。SDK PNG 与真实 Viewer 可见内容。
- Slide：SVG 编译为可编辑原生元素，单页三段流程。三项文本布局规则覆盖该页，findings 为空；这不是六页完整演示验收。
- Base：表、四字段、三条记录已持久化并在 SDK 渲染图中可见；本轮已修复应用 Viewer 空白和画布高度塌缩，实际 Viewer 显示全部三条记录。
- Board：四个节点、三个连接线与说明文字，SDK PNG、PDF 和应用 Viewer 均目视可见。

LibreOffice 使用独立临时 profile，成功导入 DOCX/PPTX/XLSX 并导出验证 PDF（`.data/office-import-check.json`）。目视检查发现 DOCX 部分中文笔画不完整，表格边框缺失；来源可能涉及字体或 Exchange 格式映射，尚未定位，DOCX 保真不通过。PPTX 单页的标题、三栏布局和中文内容正常。XLSX 数据正常但存在上述横向分页问题。未完成 Microsoft Office/WPS 本体 UI 验证。

SDK PDF 的文本提取为空或仅换行，本批次属于图像型输出，不能宣称文字可搜索/复制。Board PDF 目视通过；其余 SDK PDF 页面仍需逐页核验。

新增真实截图：`screenshots/doc-review.png`、`board-review.png`；失败证据：`base-viewer-failure.png`、`slide-review-initial.png`；四类机器渲染为 `doc-sdk.png`、`slide-sdk.png`、`base-sdk.png`、`board-sdk.png`。截图均来自实际 SDK 或本地应用，不是 WorkBuddy 客户端截图。

## Viewer 修复与回归（2026-09-10）

本轮浏览器日志明确报告 `base-ui.attachment-io.service` 重复注册。协作 Viewer 的 Base UI 通过公开 `override` 合同跳过附件服务注册，由 Collaboration Client 提供；静态比较视图保留 Base UI 自身实现。修复后没有新增同类错误。

随后 DOM 检查发现 Base 画布仅 11px 高。应用全局 `main/header/aside` 等样式覆盖了 SDK 内部同名元素；已把布局、按钮和表单样式限制在应用外壳。修复后的 Base 页面显示四字段、三记录，编辑相关按钮为 disabled，搜索和表导航保持可用。

移除了审阅容器整体 `inert`，使用现有服务端权限与 SDK 权限控制编辑。Doc 已实际向下滚动并查看完整表格；Slide 点击新增/空白布局未新增页面，独立运行时回读仍为一页、零 mutation（`.data/slide-review-permission-check.json`）。回归测试增加五类 Unit 均允许 View、拒绝 Edit 的 ready 权限断言。

Slide 首次加载在 SDK `Steady` 生命周期后适配可见画布；“适应页面”按钮通过公开 `SetSlideZoomRatioOperation` 重新适配，不更改内容。实际重新打开后自动显示 45%，完整标题和三栏内容均可见。初始加载到 Steady 之间仍可能短暂显示 100%；未测首屏性能预算。

`pnpm typecheck`、Viewer 构建和 `pnpm test` 均通过；10 项集成测试，0 失败，24.6 秒，日志 `/tmp/workbuddy-review-tests.log`。这次修改未重跑 Office 导出保真测试，此前 DOCX 失败仍未解决。

成功证据：`screenshots/base-review.png`、`doc-review-scroll.png`、`slide-review-fit.png`、`slide-review-auto-fit.png`。旧失败截图保留用于对照，不代表当前 Base 仍空白。

## DOCX 字体、边框和列宽验证（2026-09-10）

对原始 revision 2 快照和 DOCX XML 的检查表明：原表格未设置实际边框，预览中的浅色网格不能作为导出边框依据；原字体未显式指定，LibreOffice PDF 中出现 `DFWaWaTC-W5` 等回退字体。显式 `PingFang SC` 在本机仍未解决显示问题；使用已安装的 `Arial Unicode MS` 后，中英文字符正常。Poppler 和 PDFium 对失败 PDF 的显示一致，问题不只是单一 PDF 截图工具。

新增 `scripts/verify-docx.mjs`：经应用 API 创建新 Doc 草稿，使用公共 Facade 设置字体、实际边框和初始总宽/列宽；确认 commit，重新加载后检查源数据，导出 DOCX 并生成 SDK PNG，最后提交 ready。字体可通过 `OFFICE_TEST_DOC_FONT` 指定，默认值仅用于本机验证，不代表可在所有平台获取，也不随插件重新分发该字体。插件 Skill 已增加显式字体、真实边框及独立阅读器检查要求。

发现并保留的 SDK 行为：连续 `setColumnWidth(0,200)`、`setColumnWidth(1,300)` 后，表格总宽仍为原来的 200；DOCX 的 `tblW=3000` 与 `gridCol=3000/4500` 不一致，LibreOffice 会压窄表格。失败源证据在 `.data/docx-diagnostic/column-resize-mismatch.json`。本轮没有修改 SDK 或对导出 XML 打补丁，此项仍未修复。

新建表格时同时设置 `width:500,columnWidths:[200,300]`，通过 SDK 导出的 `tblW=7500` 与列宽之和一致。最终样例 `1788973238320` 在 LibreOffice 独立导入后为一页，字符、边框及两列比例均目视通过；这仅证明该样例的指定样式，不替代图表、页眉页脚、复杂分页和任意字体验收。

完整本地证据 `.data/docx-verification.json`；实际 SDK 截图 `screenshots/docx-styled-sdk.png`；独立 DOCX 导入后的渲染截图 `screenshots/docx-export-readback.png`。本轮未更改应用运行源码，未重复运行已经通过的完整集成测试；新增验证脚本已实际执行且语法检查通过。

## 本机 WorkBuddy 插件清单校验（2026-09-10）

读取 WorkBuddy 5.5.4 安装包内的 `cli/dist/web-ui/docs/cn/cli/plugins-reference.md` 与内置 SheetAgent 清单，确认 `.workbuddy-plugin/plugin.json`、`${CODEBUDDY_PLUGIN_ROOT}`、`${CODEBUDDY_PROJECT_DIR}` 及内联 `mcpServers` 均有随版本发布的合同。来源是 `/Applications/WorkBuddy.app/Contents/Resources/app.asar` 及 `app.asar.unpacked`，未修改安装包。

使用随客户端发布的 CLI 实测：

```sh
/Applications/WorkBuddy.app/Contents/Resources/app.asar.unpacked/cli/bin/codebuddy plugin validate /absolute/path/to/workbuddy-univer-office
```

修改前后均返回 `Validation passed`、`valid:true`。但原根目录 `.mcp.json` 会被同目录启动的 CLI 当作 project MCP 配置发现，`mcp get univer-office` 返回 `Failed to connect`，参数中仍保留未展开的插件变量。因此已将服务配置内联到 `.workbuddy-plugin/plugin.json`，删除重复的根项目入口，保持服务名与变量不变。这与内置插件的组织方式一致。

读取新清单、在隔离临时工作区展开两个已知变量后，实际启动 stdio 入口并完成 MCP 握手及 15 个工具发现；关闭后释放该测试客户端。证据 `.data/plugin-manifest-check.json`。这是测试程序执行变量展开，不能冒充 WorkBuddy 宿主实测展开成功；桌面加载、审批、预览与卡片恢复仍未验收。

## 运行限制

当前环境未配置 Univer Pro license，预览及截图保留 SDK 的试用提示。运行使用单一开发服务及按需渲染运行时，构建按目标分别执行。应用不依赖 `dsh-univer-office` 包。

## 复现

在仓库根目录执行 `pnpm install --frozen-lockfile`，再依次执行 `pnpm typecheck`、`pnpm build:server`、`pnpm build:viewer`、`pnpm build:render`、`pnpm build:app`。使用 `pnpm test` 运行串行集成测试。

`node dist/server/main.js` 启动本地开发服务，默认数据目录为 `.data/workspace`。终端输出一次性入口地址；`.data/runtime.json` 包含开发凭据，不应提交或分享。MCP 入口为 `node dist/mcp/main.js`，必须设置 `WORKBUDDY_OFFICE_WORKSPACE` 为绝对工作区路径。

## MCP Apps 协议证据（2026-09-10）

参考 [CodeBuddy 官方 MCP Apps 指南](https://www.codebuddy.cn/docs/cli/mcp-apps) 和 [官方 MCP Apps SDK](https://github.com/modelcontextprotocol/ext-apps)。指南证明 CodeBuddy Web UI 的协议支持，不证明本机 WorkBuddy 桌面版本。

App SDK 固定 `@modelcontextprotocol/ext-apps@1.7.4`，MCP SDK 升为匹配 peer 的 `1.29.0`，Univer cohort 未变。HTML 和 JS 本地打包，运行不请求 CDN；约 270 KB，超过官方指南的 256 KB 预取阈值，WorkBuddy 的资源回拉路径必须实测。

`univer_preview` 的模型可见结果含目标、状态及截图摘要。审阅入口和图片放在工具结果 `_meta.office`，普通文本/structuredContent 不含审阅 ticket。资源本身不含凭据。卡片不提供可由模型调用的合入工具。

测试宿主使用官方 `AppBridge`，把真实 stdio 工具结果发给 `sandbox="allow-scripts"` iframe；CSP 禁止联网和 unsafe-eval。已验证：握手、图片显示、刷新、宿主主题、全屏/浮窗/返回、打开指定草稿审阅页。宿主实现仅作协议测试，不包含 WorkBuddy 的授权弹窗逻辑，也不构成实际客户端通过的证据。

截图：`screenshots/mcp-app-inline.png`、`mcp-app-dark-fullscreen.png`、`mcp-app-pip.png`。

复现：先运行 `pnpm exec vite build --config vite.test-host.config.ts`，然后 `node scripts/verify-mcp-app.mjs <target.json>`；目标必须位于 `.data/workspace`，测试入口记录在 `.data/mcp-app-verification.json`。关闭旧开发服务后再运行，结束时 Ctrl-C 释放 MCP 与渲染进程。


## Base 表与视图导出（2026-09-10）

新增 `baseSelection: {tableId, viewId?}`。内容 Worker 在同一 Runtime 的确认版本读取原始 snapshot 和 SDK 视图投影，导出返回 revision、字段 ID 和记录数，不修改原 Base。缺少选择、无效表/视图、重复输出均失败。

当前 Exchange Base 直接导出要求保留 record-id 字段，且会把它输出为一列。因此保留合法内部结构完成原生 Base→XLSX 转换，再经 SDK Sheet 导入构造仅含选中列的交付工作簿，最后由 Exchange 输出 XLSX/CSV/TSV。最终工作簿不携带原 Base 资源/其他表元数据。复杂字段若需要额外工作表或未经验证的资源表示，明确报错；不能静默丢弃图片或关联数据。

`tests/integration/base-export.test.mjs` 使用两个表、隐藏字段、重排字段、过滤、降序和空视图，核对三个格式的值和顺序、完整表导出、无效选择、拒绝覆盖及原数据版本不变。基础测试通过；完整串行集成套件 11 项通过（36.4 秒）。另增复杂字段拒绝用例后单独重跑该测试，结果见本地日志 `/tmp/workbuddy-base-export-test.log`。

独立 OOXML 检查确认 `A1:C3`，`C2=7`、`C3=2` 是数值单元格，所有 XML 中没有 record-id、隐藏字段值、被筛除记录或其他表数据。LibreOffice 使用独立临时配置把实际 XLSX 转为 PDF，再由 Poppler 渲染并人工检查。截图为 导出回读局部（本地验证截图：`screenshots/base-export-readback-detail.png`），不是 WorkBuddy 客户端截图。产物和证据位于 `.data/base-export-readback/` 与 `.data/base-export-verification.json`。

完成范围仅证明文本/数值和基本表/视图语义。日期、选择项、关联、附件字段尚未支持；公式字段路径仍需独立 fixture，Base 导出整体验收未完成。WorkBuddy 桌面内的加载与调用也仍未验证。


## WorkBuddy 桌面登录门槛（2026-09-10）

本次通过 CUA 成功连接 `/Applications/WorkBuddy.app`，实际窗口显示“WorkBuddy，我帮你”和“登录”按钮。这更新了此前原生窗口读取超时的情况，不能再将其描述为客户端无法启动。

点击登录后客户端显示“登录中…”及“复制登录链接 / 重新发起登录”，Chrome 出现 WorkBuddy 官方 `/login/` 页面。未输入用户密码、验证码或代为接受服务条款。已请求用户完成登录；插件管理、加载、调用和内嵌预览尚未获得登录后的实际界面证据。

当前门槛截图：WorkBuddy 登录流程（本地验证截图：`screenshots/workbuddy-login-required.png`）。此图来自实际 WorkBuddy 原生窗口，不是插件预览成功截图。后续应从已打开的登录流程继续；不要仅因读取登录浏览器页面超时就重复发起登录或重启客户端。


## Viewer 导出对话框（2026-09-10）

新增浏览器 Viewer 的“导出”入口，显示当前内容名和草稿/主线身份，选择格式及工作区内新文件路径。Base 必须显式选表，可选择整表或具体视图。保存中禁用表单和关闭操作；成功显示产物路径、确认版本、记录/页数；已有文件返回可理解的错误，修改名称后可以重试。此入口是应用工具栏，不代表规格要求的主线 Ribbon 导入/导出已经完成。

实际 CUA 操作：在现有 ready Base 草稿中选“验证任务 / Grid / CSV”，保存成功，显示 revision 2、3 条记录；同名输出返回“该文件已存在，请换一个文件名”；更换名称后再次成功。直接回读两个 CSV 内容相同，共 4 行（含表头），不含内部 record-id 列；草稿仍为 ready。没有合入操作。

`pnpm typecheck`、Viewer 构建通过；修改共享发布错误码后，Base 导出集成测试重新通过（含 `OUTPUT_EXISTS` 断言）。没有重新运行与本次 UI 无关的完整渲染构建。

真实截图：导出成功（本地验证截图：`screenshots/viewer-base-export-success.png`）、已有文件提示（本地验证截图：`screenshots/viewer-export-existing-file.png`）。证据 `.data/viewer-delivery-evidence.json`。截图来自浏览器 Viewer，WorkBuddy 原生客户端仍显示登录中，不能据此声称桌面宿主通过。


## Base 公式导出（2026-09-10）

新增 `tests/integration/base-formula.test.mjs`：创建 Amount、Count、Status 字段及数值 Total、文本 Label、布尔 Small 公式，等待公开 `onCalculationResultApplied()` 后确认提交。视图隐藏所有输入字段，筛除一条记录，并按 Total 降序输出。XLSX/CSV/TSV 均得到 High→21→Total 21→FALSE、Low→8→Total 8→TRUE；导出前后整个确认 snapshot 相同。

针对尚未计算的导入/恢复 snapshot，新增缺失公式缓存检查：有选中记录缺少计算结果时返回 `BASE_FORMULA_RESULT_MISSING`，不能生成空结果并称成功；合法的 0 值不被误判。Base 选择与公式两项相关集成测试通过（16.6 秒），本次没有重复无关的 Viewer/Render 构建。

独立 OOXML 校验脚本 `scripts/verify-base-formula-xlsx.py` 不依赖 Univer：检查单一工作表、数值/布尔单元格类型、行顺序、文本结果、没有残留公式和隐藏输入值。可执行 `python3 scripts/verify-base-formula-xlsx.py <测试临时目录>/formula.xlsx`。实际产物亦经 LibreOffice 打开转 PDF，由 Poppler 渲染并人工检查：公式导出回读（本地验证截图：`screenshots/base-formula-export-readback.png`）。证据 `.data/base-formula-verification.json`。

本证据覆盖同一 Base 内的上述公式及视图导出，不覆盖跨 Unit 引用、所有公式函数、日期/附件/关联等字段。此前“公式尚未专项验证”的记录由本节更新，其他完整范围缺口仍保留。


## WorkBuddy 已登录与本地 MCP 启动诊断（2026-09-10）

实际 WorkBuddy 5.5.4 已登录，此前登录门槛已解除。通过“专家·技能·连接器 → 连接器 → 自定义连接器”确认配置路径为 `~/.workbuddy/mcp.json`。新增开发服务 `workbuddy-univer-office-dev`，使用独立 `.data/workbuddy-host` 测试数据目录；原配置备份于 `.data/workbuddy-mcp-before-office.json`。该接入证明的是开发连接器路径，不等于插件市场安装或 Skills 自动加载通过。

第一次任务的 MCP 初始化 60 秒超时，工具搜索未发现任何本服务工具；因此列表中的“已启用”不能作为成功连接证据。独立 stdio Client 在相同 cwd 可列出 15 个工具。宿主 Node 进程采样显示阻塞在同步文件 open，入口诊断日志尚未写出。随后通过 WorkBuddy 原生工作空间选择器选择本项目，再启动验证任务：诊断日志记录 PID 81167 于 18:06:01.987Z 开始，18:06:04.053Z 完成入口初始化，并监听 loopback 9081。这支持文件访问范围与首次阻塞有关，但没有直接读取或修改 macOS TCC 数据库，不能将其描述为已确认的系统权限错误码。

配置接受截图：开发 MCP 已启用（本地验证截图：`screenshots/workbuddy-mcp-connected.png`）。首次工具发现失败截图：真实任务未发现工具（本地验证截图：`screenshots/workbuddy-tool-discovery-failed.png`）。最终调用和预览结果以后续证据为准。开发启动诊断入口为 `.data/workbuddy-mcp-diagnostic.mjs`，不记录完整环境变量或凭据；正式安装仍需使用发布入口与宿主 workspace 绑定。


## 固定语义对比导航（2026-09-10）

对比页将五类内容的差异导航目标传给各自固定快照，并分别显示加载和定位结果。新增/删除导致某侧目标不存在时明确提示；旧请求的回复不能覆盖最新选择。Doc/Base/Board/Slide 使用 SDK 公开只读权限，保留滚动与选择；Sheet 当前仍使用 inert，完整交互验收尚未完成。

已有 CUA 证据：Doc 点击“导出与截图”段落后滚动并选中；Base 点击“白板与连接线 / 检查数”后选中值 3 的网格单元格，新增记录按钮经 DOM 确认为 disabled；Board 点击 roundRect 4 后聚焦“合入主线”，随后手动使用 SDK“缩放到选区”获得可辨认选区。白板静态快照曾因禁用 IImageIoService 而空白，已将该 override 限制为协作场景。

截图：Doc 段落定位（本地验证截图：`screenshots/doc-comparison-navigation.png`）、Base 单元格定位（本地验证截图：`screenshots/base-comparison-navigation.png`）、Board 元素定位（本地验证截图：`screenshots/board-comparison-navigation.png`）。四类原始确认 snapshot 在导航前后保持相同，revision 均为 2，证据 `.data/comparison-navigation-verification.json`。

Slide 仅实现页面或元素所在页面定位，尚未高亮元素；窄幅对比的缩略图侧栏挤占画布仍需解决。`editor.enabled:false` 的实验配置导致静态画布不挂载，已恢复默认 Slides UI 并重新完成 Viewer 构建（22.12 秒）和类型检查；该恢复不等于 Slide 对比视觉验收通过。


实际项目任务 `9327295c-2467-41f5-b9d2-5c2a1d4b2edb` 随后发现并调用 `mcp__workbuddy-univer-office-dev__univer_status`，工具返回 `[]`，无错误。截图：WorkBuddy 状态查询成功（本地验证截图：`screenshots/workbuddy-status-success.png`）。这是当前真实桌面工具调用证据。

首次自然语言创作尝试失败：模型为 `univer_new` 传入不存在目录下的绝对 `.xlsx` 路径，之后推测其他目录。未创建 Office 容器。已补充工具及 `file` 参数说明：新建 `.univer` 容器，优先传相对 MCP 存储目录的 basename；XLSX 由导出工具交付。服务端构建通过。宿主尝试中创建的空 `.keep` 文件已清理；后续使用明确相对 `.univer` 文件名继续验证。此失败不能被之前独立脚本的创建成功覆盖。


### 真实宿主销售表创作结果

在上述项目任务中，以相对文件名 `host-sales-verification-20260910-0212.univer` 成功创建文件、草稿和 Sheet；fileId `5eba5bca-ec33-46d3-a969-864472777da8`，worktreeId `a1de06d9-bee7-4f7c-b83d-f7ff81e940ed`，unitId `bd1be2a1-8082-42cf-8b13-15cf0269bdaa`。最终一次成功写入将默认工作表“数据”改名“销售验证”并写入 A1:D4，返回 `commit:confirmed, revision:2, mutations:2`。只读回读 D2:D4 为 60、20、80，mutations 为 0。

`univer_screenshot` 返回 704×192 PNG，宿主将图像保存在 blob 存储并由模型读取；模型正确报告两条金额和合计。`univer_worktree` ready 返回 `draftHeadRevision=readyDraftHeadRevision=2`。未执行合入/丢弃。模型另外使用宿主 Write 保存了任务记忆，因此不能把整个宿主过程描述为严格只发生 MCP 调用。该本地状态目录已加入 gitignore。

中途还出现执行入口名错误、把 Unit 名当作 worksheet 名等调用错误，均在成功写入前发生；最终通过公开 API 与只读回读修正。已在工具描述补充绑定变量及 Sheet Unit 与 worksheet 的区别，服务端重新构建通过。当前真实测试使用的是原连接实例，所以新的说明效果仍需下一次加载验证，不能声称已经消除这些模型调用错误。

`univer_preview` 返回 ready、revision 2、1 张图像；宿主诊断保留了 `ui/office` 元数据。然而实际界面仅显示 PNG 产物预览，没有 Office 审阅卡片。宿主 MCP Apps 日志显示 `catalogSize=0`、`acceptedCount=0`，并对 `DeferExecuteTool` 报 `openHostApp.unknownApp`。因此内嵌实时 Viewer、交互审阅和 MCP Apps 仍未通过，模型最终回复中的“预览卡片成功”不能当作挂载证据。

真实截图：WorkBuddy 表格结果（本地验证截图：`screenshots/workbuddy-sales-sheet-result.png`）、宿主工具生成的表格 PNG（本地验证截图：`screenshots/workbuddy-sales-sheet.png`）。结构化证据 `.data/workbuddy-host-verification.json`。下一步需继续核验宿主 App 发现与工具名称映射，保留本次 ready 草稿；不要通过合入它来绕过卡片验收。

## WorkBuddy HTTP MCP App 挂载与审阅入口（2026-09-10）

只读检查已安装 WorkBuddy 5.5.4 的 App 发现组装：远程协议连接器由 `McpAppsRemoteRuntime` 枚举；stdio 的发现源使用 `BuiltinLocalMcpAppDiscovery`，限定内置 marketplace。因此自定义 stdio 可被任务调用却没有进入 App 目录。未修改宿主源码、内置插件或信任检查。

新增 `src/mcp/server.ts` 共用 15 个工具与资源注册，保留 stdio 入口；`src/mcp/http.ts` 采用 MCP SDK 1.29.0 官方 stateless Streamable HTTP 组装，每请求独立协议对象、共享单个 Office Runtime。`/mcp` 仅接受独立 Bearer 凭据，继承 loopback Host/Origin 校验，不授予 Viewer 权限；凭据文件权限为 0600。开发连接器由 stdio 替换为 HTTP，先停掉旧实例，未并行运行同一工作区的两个服务。配置回退备份为 `.data/workbuddy-mcp-before-http.json`，含本地开发配置，不提交。

真实任务 `f61c966c-768f-4588-a1f2-42aa804e804f`（“验证 workbuddy-univer-office-dev MCP 预览”），调用 `call_d2a19e1292a64bd0b8a16810`：

- 宿主 App 目录 `acceptedCount=1`，包含 `workbuddy-univer-office-dev/univer_preview`。
- `resources/read` 返回 `text/html;profile=mcp-app`，宿主创建实际 App 实例；CUA 可见“销售验证”“等待你的审阅”、版本 2、60/20/80 表格图像及交互按钮。
- 激活卡片并点击刷新，宿主 `proxyAppToolCall.ok`，时间从 02:32:41 更新为 02:33:03，版本仍为 2。
- 点击“打开编辑与审阅”，默认 Chrome 打开相同 file/unit/worktree 的 Viewer，显示“已连接 · 只读审阅”，内容正确；本次没有合入、丢弃或修改。
- 切换到另一任务再返回，原调用卡片恢复为版本 2、02:32:41 的保存结果。本项只覆盖同一次客户端运行中的任务切换，不覆盖客户端/服务重启后的恢复。
- 全屏按钮未观察到可见切换；仍未通过。补充按照 SDK 返回的实际 mode 更新控件、宿主保留其他模式时提示原因的逻辑，已构建与类型检查；此新增提示尚未在重新加载的宿主资源中验证。浮窗、实时编辑器内嵌、完整任务隔离和正式分发仍待完成。

HTTP 集成测试覆盖未授权请求、伪造 Host/Origin、MCP 凭据不能访问后端 API、工具与 App 资源发现、两客户端共享持久状态和重复文件保护。与 stdio 三项测试合计 4 项通过（6.4 秒）；服务构建、类型检查和 App 定向构建通过。没有重建无关 Viewer/Render。

最终只读状态检查确认草稿仍为 ready，Unit 的 `draftHeadRevision=readyDraftHeadRevision=2`。证据 `.data/workbuddy-http-app-verification.json`。截图：真实 WorkBuddy Office 卡片（本地验证截图：`screenshots/workbuddy-office-card.png`）、由卡片打开的 SDK 审阅页（本地验证截图：`screenshots/workbuddy-card-review-page.png`）。旧节“卡片未挂载”描述的是 stdio 测试，由本节 HTTP 结果更新；完整规格未完成。


## 卡片全屏与资源升级诊断（2026-09-10）

读取 WorkBuddy 5.5.4 的已安装渲染器：虽然 `buildMcpAppHostContext` 声明 inline/fullscreen，实际 `requestDisplayMode` 处理器固定返回 inline。宿主双层 iframe 的权限允许原生 fullscreen。应用改为在用户点击时同步调用原生 `requestFullscreen()`，以 `fullscreenchange` 更新返回按钮，退出时恢复保存的滚动位置；不能使用原生全屏时仍遵守 MCP 返回的实际模式。公开行为依据 [Fullscreen API 文档](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen)。未修改宿主程序。

第一次升级后新调用仍使用旧 HTML：宿主日志明确为 `resolver.resolve.cacheHit`、旧 URI 和 `htmlLen=256393`。因此 MCP App 资源 URI 改为包含 HTML+脚本 SHA-256 前 16 位的构建标识，工具元数据与资源注册共享该标识。重连后 App 目录已接受 `ui://workbuddy-univer-office/preview/40d5fbfb15460a30`。服务、类型检查、App 定向构建和 4 项 HTTP/stdio 集成测试通过（5.25 秒）。

服务重启轮换凭据后，旧宿主任务出现工具索引失效；在连接器管理重新启用服务并用新任务验收。此问题继续作为正式安装/升级的生命周期缺口，不把手动重连视为自动恢复完成。原销售表未被修改。最终实际全屏结果见后续记录。

### 原生全屏真实验证结果

新任务“验收 workbuddy-univer-office-dev 新版全屏卡片”在宿主中读取版本化资源后，CUA 激活卡片、点击“全屏”：WorkBuddy 侧栏和任务界面隐藏，整屏显示销售表卡片，按钮变为“返回卡片”。点击返回恢复原任务；第二次进入全屏后按 Esc 也恢复原任务。两次均保留“销售验证”、版本 2 和 02:45:09 的原捕获时间，未重建 Unit 或触发内容写入。

截图：真实 WorkBuddy 原生全屏（本地验证截图：`screenshots/workbuddy-office-fullscreen.png`）、返回原卡片（本地验证截图：`screenshots/workbuddy-office-fullscreen-return.png`）。最终 MCP 只读回读金额仍为 60、20、80，草稿仍 ready，Unit 确认版本和 ready 版本均为 2。结构化证据 `.data/workbuddy-fullscreen-verification.json`。

本轮证明单 Sheet 截图卡片的全屏、按钮返回、Esc 返回和相同目标保持。多页滚动位置、多 Unit 选择保留及全屏实时编辑器尚未验收，不能将本项等同于 U04 和完整插件范围全部完成。旧节“全屏未观察到切换”描述的是旧资源/宿主模式请求，由本节原生全屏证据更新。


## 内嵌只读实时 Viewer（2026-09-10）

MCP App 现可通过仅供 UI 的 `_meta.office.previewUrl` 嵌入实际 Runtime SDK Viewer。预览能力限定到单个 file/unit/branch/worktree，8 小时过期；HTTP 路由、SDK 读取与 WebSocket 加入/提交分别检查范围，预览身份禁止写入。票据不出现在模型可见的 content/structuredContent 中。外部编辑与审阅仍使用独立入口，内嵌只读不代表完整审阅交互已完成。

实际 WorkBuddy 任务“验收 workbuddy-univer-office-dev 内嵌实时预览”显示全屏 SDK 网格、只读工具栏与同步状态。测试使用独立草稿，未修改此前 ready 的销售表。初始 B2=1、B3公式为 `=B2*10`，界面显示 1/10；在保持原卡片打开、不点击刷新或重载的情况下，Agent 提交 B2=2，确认 revision=3、mutations=1，随后原生 WorkBuddy 界面显示 2/20。独立只读回读为 `[[2],[20]]`、mutations=0。该观察证明此 fixture 自动同步，不提供延迟或 P95 性能结论。

嵌入时曾因过宽的 aside CSS 选择器隐藏 SDK 自身布局区域，使画布落入窄列；规则已限定到应用侧栏。最终实际 WorkBuddy 画布占满可用宽度，保留原 SDK 授权水印。

截图：更新前（本地验证截图：`screenshots/workbuddy-live-preview-before.png`）、自动更新后（本地验证截图：`screenshots/workbuddy-live-preview-after.png`）。提交与回读证据 `.data/live-preview-update.json`。本轮服务、类型检查、Viewer 和 App 定向构建通过；Office/Preview/HTTP MCP/stdio MCP 共 12 项集成测试通过（27.98 秒），追加能力票据断言后相关 4 项测试通过（2.78 秒）。

仍未验证：其余四类内容的宿主实时同步、断线/服务重启恢复、内嵌人工编辑与审阅、20 次性能采样。预览终态暂显示重新打开卡片提示，尚不满足 U10 的完整主线切换要求。上述结果不缩减规格 C01–C07、U01–U14。


### 实时预览进入待审阅（2026-09-10）

对上述独立实时同步草稿执行 ready：SDK 返回 `draftHeadRevision=readyDraftHeadRevision=3`。保持 WorkBuddy 原卡片打开、不刷新，界面自动从“正在编辑草稿”变为“等待你的审阅”，内容仍为 2/20，SDK 编辑工具禁用。点击卡片“打开编辑与审阅”后，浏览器进入同 file/unit/worktree，显示只读审阅及对比、继续修改、合入和丢弃入口。未执行合入或丢弃。

随后使用 Agent 写入工具尝试把 B2 改为 999，服务返回 `WORKTREE_FROZEN: Reopen the worktree before editing.`；只读回读仍为 `[[2],[20]]`、mutations=0。本节验证了实际运行服务的 ready 写入拒绝与宿主状态更新，未替代其余生命周期或五类内容验收。

截图：WorkBuddy 实时待审阅卡片（本地验证截图：`screenshots/workbuddy-live-preview-ready.png`）。结构化证据 `.data/live-preview-ready.json`。审阅页底部过时的“WorkBuddy 客户端待联调”文字改为“WorkBuddy · Office 编辑与审阅”。


## 终态预览解析与本地审阅登录隔离（2026-09-10）

新增只读 `/api/preview/resolve`，依据原预览身份和 SDK 当前草稿状态处理终态。合入/丢弃后，若原 Unit 有有效主线版本，则换发同一 file/unit 的主线只读能力，并保留“草稿已合入/丢弃 · 当前版本”状态；不扩展到文件内其他 Unit。丢弃从未合入的新内容时返回不可用，不选择其他 Unit 冒充结果。旧 token 本身仍保持原授权范围。

隔离的 9082 测试服务与独立文件经 CUA 实际浏览器审阅按钮合入，原只读预览未经手动刷新自动切换到主线，地址不再含 worktree，显示“草稿已合入 · 当前版本”，数值 7、公式结果 21 保持正确。截图 `screenshots/preview-merged-trunk.png`，结构化证据 `.data/terminal-preview-observed.json`。这是浏览器预览证据，尚不能声称 WorkBuddy 卡片的完整 U10 已验收。测试标签页和 9082 服务已关闭。

测试还发现原统一 `wb_office` Cookie 名跨本地端口互相覆盖，导致另一服务的审阅 API 401。Cookie 名现包含本服务端口；集成测试验证两个 cookie 共存时各自可读，只有另一服务 cookie 时返回 401。

服务构建、类型检查和 Viewer 定向构建通过（17.99 秒）。Preview、HTTP MCP、stdio MCP 共 7 项测试通过（5.87 秒），覆盖合入换发、丢弃已有/草稿专有内容、主线读取、拒绝审阅写入、旧能力范围和 cookie 隔离。WorkBuddy 本地 9081 服务已升级，原实时测试草稿仍为 ready、确认/冻结版本均为 3。服务升级仍需手动更新凭据与重新启用连接器，自动重启恢复尚未完成。

升级后重新启用开发连接器，宿主 `proxyAppToolCall.ok` 于 19:24:12Z 确认刷新调用成功。但原旧卡片的内嵌子页面在 AX 中尚未恢复可检查内容，画布截图不足以证明已连接新服务；该重新挂载问题保留为下一步诊断，不能据工具成功宣称客户端恢复完成。


## 新版卡片显式刷新与宿主资源缓存（2026-09-10）

当前服务的预览 HTML 和只读 resolve API 均返回 200。在同一 WorkBuddy 任务重新调用 `univer_preview(capture=false)` 后，新 iframe 成功加载 SDK、ready 状态和只读工具栏；表格仍为 2/20。说明升级后的服务与 Viewer 可用，旧卡片恢复路径仍需单独处理。

“刷新预览”现显式替换 iframe 并加载工具返回的受限 URL，使人工刷新能重建失效的浏览上下文；普通工具结果仍保留原编辑器与视图位置。App 构建、类型检查及 4 项 HTTP/stdio MCP 测试通过（4.70 秒）。未重建 Viewer 或重启服务。

一次新调用仍被宿主旧工具目录映射到资源 `f47dfcaa9633f309`，日志为 cacheHit；重新启用开发连接器后，实际 `resources/read` 成功读取新资源 `aae2b98b2a71ad71`、HTML 长度 257986。最新实例 `54157b0b-966c-41fe-8b63-46b741b2c1d8` 中点击刷新，宿主于 19:33:03.669Z 开始调用、19:33:05.997Z 返回成功；之后 AX 可见新 Viewer 的“等待你的审阅”“实时连接 · 只读预览”和禁用编辑控件，全屏截图可见 2/20。

截图：新版刷新后的真实 WorkBuddy（本地验证截图：`screenshots/workbuddy-preview-explicit-refresh.png`）；结构化证据 `.data/workbuddy-preview-remount-verification.json`。本轮验证新版卡片在当前服务中的人工刷新成功，不宣称旧资源自动升级或无人工操作的重启恢复完成。全量功能对齐仍按完整 spec 验收。


## WorkBuddy Doc 实时同步（2026-09-10）

在现有 9081 服务创建独立 `doc-live-*.univer` 文件与 Doc 草稿，target 记录于 `.data/doc-live-verification.json`。通过 MCP 写入中文标题、正文及字号/加粗/颜色，初始 confirmed revision=2。随后实际 WorkBuddy 调用 `univer_preview(capture=false)`，原生卡片挂载 Docs Runtime 并进入全屏；截图显示中文标题与绿色加粗样式，SDK 字数为 50。

保持同一卡片打开，不刷新或再次调用 preview，Agent 追加“实时同步结果：正文与样式已更新。”及三行两列表格，设置表格宽度、列宽与全边框。提交 confirmed revision=3、mutations=4；独立 read 模式回读包含新增段落与全部表格单元格，mutations=0。实际 WorkBuddy 自动显示新增段落、绿色加粗样式、表格内容和边框，字数更新为 98。

截图：Doc 更新前（本地验证截图：`screenshots/workbuddy-doc-live-before.png`）、Doc 自动更新后（本地验证截图：`screenshots/workbuddy-doc-live-after.png`）。本节证明该 Doc fixture 的正文、富文本和表格在宿主中同步，不覆盖图片、分页、页眉页脚、所有文档布局或性能 P95。没有重建/重启服务，未修改此前 Sheet 测试草稿。之后该 Doc 草稿已标记 ready，draftHeadRevision 与 readyDraftHeadRevision 均为 3；客户端待审阅状态以后续观察为准。

Doc ready 后未刷新卡片，实际 WorkBuddy 自动显示“等待你的审阅”，字数仍为 98，新增段落及三行两列表格均保留。截图：Doc 待审阅（本地验证截图：`screenshots/workbuddy-doc-live-ready.png`）。未合入或丢弃。


## WorkBuddy Base 实时同步（2026-09-10）

新增可分阶段复验的 `scripts/verify-base-live.mjs`：`create` 创建独立文件和两条记录，人工在 WorkBuddy 打开预览后运行 `update`，最后运行 `ready`。脚本使用当前 HTTP MCP 服务，不另起 writer；证据文件以排他方式创建，并在修改前记录尝试时间，防止无检查重复追加。目标与逐步结果位于 `.data/base-live-verification.json`。

实际 WorkBuddy 调用 `univer_preview(capture=false)` 并全屏显示 Base 网格。初始版本 2，两条记录分别为“文档实时同步 / 待检查 / 0”和“任务库实时同步 / 进行中 / 1”。原生 AX 显示添加记录、自定义字段、分组、筛选、排序、视图设置等修改控件禁用。

保持原卡片打开，不刷新或重开预览，Agent 将第一条改为“已通过 / 3”并新增“新增记录同步 / 已新增 / 2”。提交 confirmed revision=3、mutations=2。独立 read 模式验证记录数为 3、目标字段值正确、mutations=0；实际 WorkBuddy 自动显示相同变化，底部记录数从 2 变为 3。

截图：Base 更新前（本地验证截图：`screenshots/workbuddy-base-live-before.png`）、Base 自动更新后（本地验证截图：`screenshots/workbuddy-base-live-after.png`）。这证明该 Base fixture 的文本/数值更新和新增记录实时同步，不覆盖复杂字段、关联、跨 Unit 公式、所有视图或性能 P95。随后已标记 ready，确认与冻结版本均为 3；未合入或丢弃。

Base ready 后原卡片自动显示“等待你的审阅”，三条记录与字段值保持不变，“添加记录”仍禁用。截图：Base 待审阅（本地验证截图：`screenshots/workbuddy-base-live-ready.png`）。


## WorkBuddy Board 实时同步（2026-09-10）

新增分阶段脚本 `scripts/verify-board-live.mjs create|initialize|update|ready`，复用当前 HTTP MCP 服务，创建独立白板 fixture。首次初始化因把 `insertConnector()` 返回的 `IBoardPageElement` 当作 Shape handle 调用 `getId()` 而失败。核对安装版本公开类型后改为 `connector.id`；先独立回读确认元素数为 0，再在相同目标初始化。恢复入口拒绝对非空内容重跑，证据保存在 `.data/board-live-verification.json`。

初始化 confirmed revision=2、mutations=12，包含标题、两个节点和一条连接线，共 4 个元素。实际 WorkBuddy 调用 `univer_preview(capture=false)` 后显示 Board Runtime 的“查看”模式、初始节点与箭头。全屏保留初始缩放，图形可见；本轮没有证明“适应内容”点击改变了缩放。

保持原卡片打开、不刷新预览，Agent 将第二节点文字改为“检查通过”，填充改为绿色、文字改为白色，并新增“等待审阅”节点和第二条连接线。提交 confirmed revision=3、mutations=10。独立回读验证两段新文字与元素数从 4 到 6、mutations=0；实际 WorkBuddy 自动显示对应节点、颜色、文字和两条箭头。

截图：Board 更新前（本地验证截图：`screenshots/workbuddy-board-live-before.png`）、Board 自动更新后（本地验证截图：`screenshots/workbuddy-board-live-after.png`）。本节证明该 Board fixture 的基础图形、文本样式和连接线同步，不覆盖图片、原生图表、所有路由情形或性能 P95。随后标记 ready，确认与冻结版本均为 3，未合入或丢弃。

Board ready 后原卡片自动显示“等待你的审阅”，保留三个节点、两条连接线与更新样式，仍为“查看”模式。截图：Board 待审阅（本地验证截图：`screenshots/workbuddy-board-live-ready.png`）。状态切换重建 Viewer 后截图缩放从 55% 变为 100%；本轮不证明跨生命周期切换保留缩放位置。


## WorkBuddy Slide 实时同步与布局检查（2026-09-10）

新增分阶段脚本 `scripts/verify-slide-live.mjs create|update|lint|ready`，通过 MCP 的 SVG 编译工具创建原生 Slide。初始 confirmed revision=2、1 页，编译 warnings/lints 为空。实际 WorkBuddy 调用 `univer_preview(capture=false)` 后挂载 Slides Runtime；进入全屏后点击应用“适应页面”，缩放从 27% 变为 85%，正文完整可见。

保持原卡片打开、不刷新，Agent 替换第一页内容（confirmed revision=3、mutations=51），再追加第二页（confirmed revision=4、mutations=45）；两次编译 warnings 均为空。独立 read 模式回读为 2 页，包含两页新增文字，mutations=0。实际 WorkBuddy 缩略图列表自动从 1 页变为 2 页，并自动选中第二页显示“新增页面已同步”；点击第一页可见“实时同步已更新”及新正文，缩放仍为 85%。本项不证明远端新增页面时保持当前页选择——实际观察为切到新增页。

`univer_lint` 覆盖两页，执行 text-off-page、text-escapes-container、text-overlaps-text 三条规则，findings=[]。脚本 ready 阶段检查页数覆盖及空 findings 后才提交审阅；SDK 返回 ready，draftHeadRevision 与 readyDraftHeadRevision 均为 4。该 fixture 不覆盖图片、图表、转场、复杂元素定位或所有演示功能。

截图：初始页（本地验证截图：`screenshots/workbuddy-slide-live-before.png`）、更新后的第一页（本地验证截图：`screenshots/workbuddy-slide-live-page1.png`）、自动新增的第二页（本地验证截图：`screenshots/workbuddy-slide-live-page2.png`）。证据 `.data/slide-live-verification.json`。本轮未重建或重启服务，未合入或丢弃。

Slide ready 后实际 WorkBuddy 自动显示“等待你的审阅”，保留两张缩略图与 85% 缩放，显示第二页完整内容。截图：Slide 待审阅（本地验证截图：`screenshots/workbuddy-slide-live-ready.png`）。缩略图栏“+ 新增”在 AX 中未标为 disabled；本轮未点击该控件，不能据其他灰显工具声称全部 Slide 只读交互已验证。

至此，五类内容的基础内嵌实时显示均有宿主 fixture 证据。此结论不等于 C01–C07、U01–U14 全部完成；完整比较/历史、跨 Unit、安装恢复、只读交互边界及性能门槛仍按规格验收。

## Slide 只读新增入口负向验证（2026-09-10）

在上述 ready revision=4 的真实 WorkBuddy 全屏预览中，点击仍显示可用的“+ 新增”，再点击版式菜单“空白”。菜单打开后关闭，没有出现第三页。操作前后通过独立 MCP read 获取完整 `presentation.save()`，快照深度相等，页数均为 2；回读 mutations=0，草稿仍为 ready，确认与冻结版本均为 4。证据位于 `.data/slide-readonly-before.json` 和 `.data/slide-readonly-after.json`。

该结果证明本次新增页面尝试没有改变权威内容，不能据此推广为所有只读操作均已验证。“+ 新增”仍可打开无法执行的菜单，是未解决的交互一致性缺口。核对当前安装版本公开类型后，`SlideThumbnailBar()` 没有隐藏新增按钮的参数；Slides UI 的 `editor.enabled` 是全局编辑器开关，不能未经验证用它替代局部权限控制。尚未修改生产代码，不宣称该 UI 缺口已修复。

随后再次检查实际 WorkBuddy 正在显示同一只读 Slide，在第二张缩略图获得焦点后按 Delete。客户端仍显示两页；通过当前 MCP 服务独立回读，完整快照与新增入口测试后的快照深度相等，页数 2、read mutations=0。证据 `.data/slide-readonly-delete.json`，截图：删除键尝试后的真实 WorkBuddy（本地验证截图：`screenshots/workbuddy-slide-readonly-delete.png`）。本次只覆盖缩略图聚焦时的 Delete，不等于画布元素删除、剪切、粘贴或全部快捷键均已验证。

## 实际同步状态与服务无响应恢复（2026-09-10）

Viewer 原来在加载后固定显示“实时连接”，没有订阅协作状态。现使用当前 SDK 公开 `CollaborationStatusChanged` 事件和 `getCollaborationStatus(unitId)`，显示已同步、待发送、等待确认、补齐远端更改、冲突与离线状态。事件按 Unit 过滤，并在切换内容、进入比较、终态跳转和页面退出时解除订阅，避免旧实例覆盖当前状态。

状态读取增加 10 秒超时，定时轮询串行执行，防止服务停滞时堆积请求。无法确认服务状态时提示内容可能过期；成功恢复后重新读取 SDK 当前同步状态。写入请求不使用这个读取超时策略。

类型检查通过，最终 Viewer 定向构建通过（19.43 秒）。真实 WorkBuddy 刷新加载新版后显示“已同步 · 只读预览”。将现有开发服务暂停 35 秒（自动恢复同一进程，未重启或换发凭据），在暂停期间 AX 和截图确认“无法确认服务状态 · 内容可能不是最新版本 · 正在重试…”。服务恢复后，无需刷新，原卡片自动回到“已同步 · 只读预览”，两页内容保留。独立 MCP read 与此前完整快照深度相等，页数 2、mutations=0。

截图：服务无响应（本地验证截图：`screenshots/workbuddy-service-unavailable.png`）、自动恢复（本地验证截图：`screenshots/workbuddy-service-recovered.png`）。结构化证据 `.data/service-recovery-verification.json`。本次验证进程暂停/恢复和轮询超时路径；没有据此宣称网络切断、凭据过期、全部 SDK 状态转换或重启恢复均已通过。

## 首次编辑器加载失败后重试（2026-09-10）

发现 `refresh()` 在 `mount()` 成功前就记录 mounted key，同时缓存文件状态。若 `/api/config` 加载失败，后续相同状态被提前返回，编辑器保持空白。现仅在加载成功后记录 mounted key；失败时清除两项缓存并释放部分初始化实例及订阅，让下一轮重新尝试。

通过临时本地 9082 HTTP/WebSocket 诊断代理注入配置请求 503，实际 Chrome 打开同一只读目标。修复前代理只观察到一次配置请求，后续轮询仍是空白页。加载修复版本后再次注入 503，代理依次记录配置请求 2（失败）、3（成功），没有再次手动刷新；页面自动恢复两张缩略图、画布和“已同步 · 只读预览”。诊断只代理当前受限预览，不创建另一个数据库 writer。截图：修复前空白页（本地验证截图：`screenshots/preview-load-failure-before.png`）、自动重试成功（本地验证截图：`screenshots/preview-load-recovery-after.png`）。这部分为浏览器故障注入证据。

类型检查通过，Viewer 构建通过（18.68 秒）。随后真实 WorkBuddy 刷新加载同一版本，确认两页内容和“已同步”状态正常，截图：WorkBuddy 升级验证（本地验证截图：`screenshots/workbuddy-load-recovery-upgrade.png`）。诊断标签页已关闭，9082 代理进程已停止，9081 原服务保持运行。未合入或丢弃任何草稿；未宣称宿主首次加载故障或全部 SDK 加载异常均已覆盖。

## 主线历史 SDK 接入与首个查看验证（2026-09-10）

读取完整 Collaboration history 示例、SDK 根 README、History Service/Endpoint/SQLite README，并核对安装包类型。示例仍使用旧 `edit-history-loader` / `edit-history-viewer`；registry 证实二者不含当前 `1.0.0-insiders.20260907-70fc579`。没有混装旧版本。依据[当前官方历史指南](https://docs.univer.ai/guides/slides/features/edit-history)，安装同一精确版本的 `edit-history-ui` 与五类 `*-history-ui`，读取各包 README 和配置合同。旧包安装失败没有加入 manifest；本地发布证据 `.data/history-release-probe.json`。

新增 `src/viewer/history.ts`，组合通用历史服务、五类模型适配器、各产品 UI、中文 locale 与所需 CSS。只在独立主线审阅页注册，历史 URL 使用当前文件的 SDK Endpoint；草稿和受限 MCP 预览不注册主线历史插件。Sheet 使用公开 `ToggleEditHistoryOperation` 提供应用“历史版本”入口。其他四类已经组装，但尚未验收其菜单和 Viewer；历史恢复尚未完成。

扩展集成 fixture，在五类 Unit 合入后检查非空历史、Unit ID 和 revision 范围，并核对服务重启后完整列表深度相等。7 项相关集成测试通过（21.10 秒），日志 `.data/history-persistence-test.log`。这证明测试 fixture 的创建历史持久化，不代表多版本选择和恢复已验证。

类型检查通过，最终 Viewer 构建通过（23.75 秒）。隔离 9082 服务复用此前终态测试工作区的主线 Sheet；通过真实 Chrome 点击“历史版本”，SDK 历史面板显示 application 创建记录和当前版本，画布显示原值 7 与公式结果 21，“还原到此版本”在 AX 中禁用。截图：主线历史初次查看（本地验证截图：`screenshots/sheet-history-initial.png`）。这是浏览器证据，非 WorkBuddy 内嵌历史验收；本次没有合入、丢弃或恢复任何内容。诊断标签页关闭，9082 服务停止，原 9081 服务继续运行。

## Sheet 多版本切换与历史公式修复（2026-09-10）

新增 `scripts/verify-history-live.mjs create|serve|verify`。从已关闭、无 WAL 的独立终态测试数据库复制一份到 `.data/history-multiversion-workspace`，原文件和 9081 演示草稿保持不变。在副本中走草稿写入、ready、带当前 fingerprint 的测试合入，得到两个实际历史条目：旧值 7、公式结果 21；新值 42、公式结果 126。创建证据排他写入，避免重复执行；后续 `serve` 不重复写入。

Chrome 实际历史面板可以读取旧版本，但切回新版本时暴露公式缓存问题：B2 已为 42，B3 仍显示 21，而主线编辑器和 SDK 回读为 126。浏览器控制过程中发生过超时，重新检查原标签页后确认上述实际画布结果，没有把超时或选中条目当作内容验收。

按照安装版本 Sheets History UI 的 `workerURL` 合同，为历史 Viewer 增加 `UniverSheetsCoreWorkerPreset` 计算入口。配置传递构建后 URL，由 SDK 每次打开管理 Worker，不复用关闭后失效的 Worker 实例。Vite 默认 IIFE Worker 构建因动态分块失败，改为 Worker 内联动态导入后构建成功（26.98 秒）；类型检查通过。Worker 产物约 8.14 MB，体积与性能仍需后续验收。

修复后真实 Chrome 验证：当前历史版本显示 42/126，选择旧版本显示 7/21；退出历史返回当前主线 42/126，再次打开历史仍显示 42/126。“还原到此版本”始终禁用。截图：旧版本公式（本地验证截图：`screenshots/sheet-history-old-worker.png`）、重新打开新版本（本地验证截图：`screenshots/sheet-history-reopened-worker.png`）。本次为独立浏览器证据，尚未覆盖 WorkBuddy 内嵌历史、复杂公式、跨 Unit 计算、Worker 数量/内存门槛或版本恢复。

查看后关闭诊断标签页和服务，运行 `verify` 重新启动并独立只读回读，主线仍为 42/126、mutations=0，两个历史条目保留；验证进程随后关闭。证据 `.data/history-multiversion-evidence.json`。曾尝试用 viewer Cookie 调用内容程序，正确返回 `AGENT_ONLY`；最终回读使用应用测试进程的 Agent 通道，没有放宽权限。

## 历史插件按需加载（2026-09-10）

将历史模块及其中文 locale、CSS、命令入口改为动态加载。仅独立主线审阅页加载历史插件；草稿与 MCP 只读预览不走该分支。开启 Vite manifest 后遍历主入口静态依赖，确认历史 chunk 不在静态依赖集合。当前主入口 103,576 bytes，历史 chunk 7,154,361 bytes；此前主入口构建报告为 7,257.91 kB。共享产品编辑器仍是静态依赖，不能把主入口差值当作整体首屏传输或耗时改善。证据 `.data/history-lazy-evidence.json`。

类型检查通过，Viewer 构建通过（27.37 秒）。实际 WorkBuddy 刷新后保留两页 Slide、“等待你的审阅”和“已同步 · 只读预览”，截图：普通预览回归（本地验证截图：`screenshots/workbuddy-lazy-history-preview.png`）。独立主线测试服务重新打开既有多版本文件，点击“历史版本”成功加载两条历史，画布仍为 42/126，还原按钮禁用，截图：历史按需加载回归（本地验证截图：`screenshots/sheet-history-lazy-loaded.png`）。没有执行内容写入或恢复。

清理时发现上一轮原生关闭操作留下 Chrome 的“删除分组”提示，因此上一节“标签页关闭”的表述不准确；本轮取消提示后复用该测试标签页。结束时将该页导航到 `about:blank` 释放编辑器，保留浏览器分组，停止 9082 测试服务。9081 WorkBuddy 服务继续运行。


## 五类历史入口与读取权限验证（2026-09-10）

Viewer 主线历史入口扩展到 Doc、Slide、Base、Board，使用当前 SDK 包中核验的公开 command ID。独立脚本 `scripts/verify-history-products.mjs create|serve` 在 `.data/history-products-workspace` 创建并合入四类最小 fixture；不修改 WorkBuddy 原 ready 演示草稿。证据 `.data/history-products-evidence.json` 保留 Unit、写入确认、合并结果与非空历史列表。

首次打开 Doc 历史失败，浏览器诊断明确为 `The current user cannot view history for this document`。服务端权限批量查询现仅对主线、已认证 viewer 授予 `UnitAction.ViewHistory`；草稿和 Agent 不授予，`RecoverHistory` 仍拒绝。新增五类 Unit 的 viewer/Agent/草稿读取及恢复权限断言。7 项集成测试通过，耗时 21.44 秒，日志 `.data/history-permission-test.log`。本次仅重启独立 9082 历史测试服务加载后端修复；9081 WorkBuddy 服务尚未升级这项权限。

实际 Chrome 界面验证：Doc 显示标题、正文和一条当前版本记录；Base 显示“事项”字段、“历史记录保留”记录及历史列表；Board 显示文本元素和历史列表。三类“恢复此版本”均为 disabled。Slide 显示淡绿色历史页面和标题，AX 包含当前历史记录及 disabled 恢复按钮，但截图右侧版本列表区域为空，重复截图仍为空，因此 Slide 历史列表视觉验收未通过，不能以 AX 替代。

截图：Doc 历史（本地验证截图：`screenshots/doc-history-products.png`）、Base 历史（本地验证截图：`screenshots/base-history-products.png`）、Board 历史（本地验证截图：`screenshots/board-history-products.png`）、Slide 历史列表显示问题（本地验证截图：`screenshots/slide-history-products.png`）。这些是浏览器 Viewer 截图，非 WorkBuddy 原生卡片截图；仅证明最小单版本 fixture，尚不证明四类多版本切换、历史恢复或完整只读交互。


## 历史页面重开与 Doc 双版本验证（2026-09-10）

本轮以相同构建、同一独立测试文件新开 Chrome 标签，Slide 历史的标题、时间、版本记录均正常显示。DOM 测量显示列表位于视口内，命中测试未发现遮挡；再完成 Doc 历史→返回→Slide 历史流程，列表仍正常。截图 Slide 历史重开（本地验证截图：`screenshots/slide-history-reopened.png`）。没有修改应用样式，不能宣称上一轮空白问题已找到根因或修复。

`scripts/verify-history-products.mjs` 新增 `update` 阶段，为四类既有 Unit 创建一个专用草稿，分别追加 Doc 正文、Slide 第二页、Base 第二条记录、Board 第二个文本元素，确认提交后 ready 并通过测试审阅动作合入。更新尝试先落盘，重复执行被拒绝，防止无意重复追加。四类 `historyIds` 均为两条，结果持久化于 `.data/history-products-evidence.json`。此操作仅针对独立历史 fixture，未合入 WorkBuddy 原 ready 演示草稿。

Doc 实际 UI 从 04:55:05 新版本切到 04:42:45 旧版本，再切回新版本。页面截图旧版只含原始标题/正文，字数 21；新版出现“Doc 第二个版本新增正文”，字数 31，恢复按钮保持禁用。旧版本（本地验证截图：`screenshots/doc-history-two-old-tab.png`）、切回新版本（本地验证截图：`screenshots/doc-history-two-new-tab.png`）。原生窗口截图与同一时刻页面截图曾出现画布内容不一致，因此本项使用页面截图和版本选择状态作为证据，保留原生截图但不将其作为旧版通过证据。

此轮未证明查看历史后主线完整快照无变化，也未完成 Slide/Base/Board 的双版本切换或历史恢复。需要继续验证，不以两条服务端历史记录替代视觉验收。


## Slide / Base / Board 双版本与主线不变验证（2026-09-10）

在同一独立历史 fixture 完成三类实际页面的新→旧版本切换：Slide 新版两页，选中第二页显示“Slide 第二个版本”，旧版仅保留最初绿色一页；Base 新版两条记录，旧版一条；Board 新版两个文本元素，旧版一个。历史列表均包含 04:55:05 与 04:42:45 两条记录并显示所选旧版，截图逐张检查通过。恢复按钮未执行，Board 旧版明确检查为 disabled；本轮不证明历史恢复。

截图：Slide 新版（本地验证截图：`screenshots/slide-history-two-new.png`） / 旧版（本地验证截图：`screenshots/slide-history-two-old.png`）、Base 新版（本地验证截图：`screenshots/base-history-two-new.png`） / 旧版（本地验证截图：`screenshots/base-history-two-old.png`）、Board 新版（本地验证截图：`screenshots/board-history-two-new.png`） / 旧版（本地验证截图：`screenshots/board-history-two-old.png`）。均为浏览器页面截图，非 WorkBuddy 内嵌卡片截图。

验证脚本增加 `baseline` 与 `verify` 阶段，前者使用只读 Runtime 的 `exportUnitData` 保存 Doc、Slide、Base、Board 完整主线快照及确认 revision 至 `.data/history-products-view-baseline.json`（独占创建，防止覆盖基准）；后者重启服务，重新导出并逐项深度相等断言。查看上述历史后，verify 退出码 0，四类完整主线快照及 revision 均未变化，日志 `.data/history-products-view-verify.log`。这证明本轮历史查看没有修改主线；Doc 的前一轮查看发生于基准之前，不包含在本次无变更证明内。

本轮所有独立 9082 测试服务均已正常关闭。仍待历史恢复、复杂内容/引用历史、重复开关资源释放、WorkBuddy 原生历史流程及全量规格验收。


## SDK 历史恢复路径验证（2026-09-10）

读取当前 History Service / Edit History README、公开恢复命令/服务类型，并沿本地 Collaboration SDK 的 `UniverUnitRuntime._applyConfirmedChangeset`、`_restoreHistoricalRevision` 与官方 restore 测试核验协议。恢复使用单独的 `univer.mutation.revert-version` mutation，经 `service.submitChangeset()` 生成新的确认版本，不直接覆盖数据库。当前应用的主线 submit middleware 只允许 application，因此未放宽 viewer/Agent 权限，也未启用产品“恢复此版本”按钮。

新增独立脚本 `scripts/verify-history-restore.mjs create|verify|serve`。create 在原历史测试服务关闭且无 WAL sidecar 时，将其文件复制到独立 `.data/history-restore-workspace/history-restore.univer`，exclusive 创建避免覆盖。Doc、Slide、Base、Board 各从 revision 2 恢复至 revision 1 的内容，SDK 均 committed 为 revision 3；回读确认第二个版本的新增文本消失，仍保留初始历史内容。相同 sid/reqId 请求再次提交均 already-committed，完整回读快照及 revision 不变；四类历史列表至少三条。证据 `.data/history-restore-evidence.json`。仅最小文本/页面/记录 fixture，不证明复杂对象恢复完整性。

浏览器 Doc 主线显示旧正文、字数 21，历史列表保留两条旧记录并新增 05:04:21 当前版本，截图 恢复后 Doc（本地验证截图：`screenshots/doc-history-restored-probe.png`）。此截图证明程序化恢复后的显示，不是用户点击恢复按钮成功的证明。随后关闭测试服务并执行 verify，四类完整快照与恢复后基准深度相等，revision 均为 3，历史三条保留，退出码 0，日志 `.data/history-restore-verify.log`。所有本轮独立测试服务已关闭。

后续应用实现须将恢复绑定到用户选中的 unit/revision 与确认时的主线版本，使用持久操作 ID 和 SDK 幂等请求，拒绝 Agent/只读/草稿恢复；主线变化时重新审阅。仍未完成用户恢复入口、可信授权、并发与失败恢复、Sheet 恢复及五类复杂 fixture，不能宣称 U09 已完成。


## 应用层恢复审批与重试（2026-09-10）

新增 `src/application/history-restore.ts`，以及 `/api/files/:fileId/history/prepare`、`history/confirm` 两个应用接口。prepare 仅允许认证 viewer，解析主线 Unit、核验旧 revision，保存服务端生成的 operationId、目标/当前版本、15 分钟准备有效期和稳定 SDK sid/reqId；confirm 严格只接收 operationId，不接受客户端改写恢复目标。Agent 拒绝，受限 preview URL 在 allowlist 阶段拒绝。原 SDK 只读历史恢复按钮仍禁用，未直接放开主线 SDK 写入。

confirm 与其他应用写入共用 `Office.serial()`，在主线发生变化时拒绝旧审批；提交前持久记录 submitting，完成后记录确认 revision。若进程在 SDK 提交后、应用结果保存前退出，重试从已确认 changesets 找同 sid/reqId 的结果，补存完成状态，不重新执行恢复。已完成操作重试直接返回原结果。此并发保证限于现有单 Office 服务进程，不代表多 writer/多主机方案通过。

新增 `tests/integration/history-restore.test.mjs`，使用独立临时 Sheet fixture 验证 20→42→恢复20，主线变为 revision 3。覆盖 Agent 拒绝、preview 即使带 viewer cookie 仍拒绝、额外参数拒绝、准备不修改内容、重复确认、模拟结果记录丢失后的重启补偿、主线变为99后 stale 拒绝，以及过期拒绝。初次测试因误用 read 返回值的 revision 字段失败，改用 SDK `getUnitLoadData().targetRevision` 核验；最终恢复测试与 preview 回归共 4 项通过，9.58 秒，日志 `.data/history-restore-review-test.log`。服务 TypeScript 构建通过。

当前只完成应用接口与测试，尚未接入用户版本选择/确认 UI，不可宣称用户点击恢复成功；现有 9081 WorkBuddy 服务未重启加载本轮后端。后续仍需确认前预览、UI 防重复提交、失败重试提示、宿主联调和其他类型/复杂对象端到端验收。


## 用户恢复确认界面首次联调（2026-09-10）

新增 Viewer 应用级“恢复历史版本”入口与 `restore-dialog.ts`：从认证主线读取分页历史条目，选择 revision，先 prepare 再显示内容名称、当前/目标 revision，第二次明确点击才 confirm。请求进行中禁用操作，失败保留同一 operationId 重试；成功后重新挂载主线 Runtime。草稿和受限 MCP preview 不显示此入口，SDK 原生只读恢复按钮不放开。当前交互要求先在既有“历史版本”中查看内容，再在独立确认框选择 revision；尚未做到原生列表所选项直接联动。

服务构建、typecheck 通过，Viewer 定向构建 27.99 秒。列表接口测试最初错误假设每次提交独立成条，实测 SDK 将 60 秒内内容聚合为 endRevision=2 的一条历史；改为核验实际最新 revision 与 Unit 名称，恢复集成测试通过，日志 `.data/history-restore-ui-test.log`。

新增 `scripts/verify-history-restore-ui.mjs create|serve|verify`，在闭合数据库副本 `.data/history-restore-ui-workspace` 实际点击 Doc 恢复。确认框明确显示当前3→历史2，确认截图（本地验证截图：`screenshots/history-restore-ui-confirm.png`）。点击“恢复并生成新版本”后自动重载，新增正文出现、字数31、成功提示版本4；但同时出现 SDK“协同冲突”通知，结果与缺陷截图（本地验证截图：`screenshots/history-restore-ui-result.png`）。因此本次内容恢复通过，界面无误报验收未通过。下一步需在确认写入前处理旧编辑器连接/恢复广播，避免将计划中的版本恢复报告为用户编辑冲突。

关闭服务后 verify 重启回读，确认 Doc revision4 包含目标正文、恰好一个 completed 应用操作、targetRevision2，退出码0，日志 `.data/history-restore-ui-verify.log`。本轮独立服务均关闭；WorkBuddy9081仍未更新后端。仍待冲突提示修正、取消/失败/超时UI、宿主及其他类型用户恢复流程。


## 恢复前断开旧编辑器（2026-09-10）

修正恢复顺序：Viewer 在 confirm 请求发送前设置 busy、释放当前 SDK 编辑器及订阅，待请求结束后清空挂载/状态缓存并重读主线。恢复 dialog 保留原 operationId，未调整服务端写入权限；恢复后的重新加载由同一包装函数执行，避免旧模型接收计划中的版本替换并报告协同冲突。类型检查通过，Viewer 定向构建 27.69 秒。

在上一轮独立 UI fixture 实际选择历史 revision1，确认当前4→历史1，点击后主线成为 revision5。页面原始正文恢复，字数21，“已同步”和成功通知可见；截图及后续 DOM 检查未出现之前的协同冲突提示。修复后的恢复结果（本地验证截图：`screenshots/history-restore-disconnect-result.png`）。本证据仅覆盖当前 Doc 同步成功路径，不代表网络超时、服务端晚到确认和多客户端恢复均已验证。

新增 verifier `verify-disconnect` 分支，关闭服务后重启确认 revision5、原始正文、恰好两条完成的应用恢复操作（上一轮目标2、本轮目标1）；退出码0，日志 `.data/history-restore-disconnect-verify.log`，本轮独立服务已关闭。完整 WorkBuddy 宿主、其他类型恢复UI、失败/取消交互、版本列表联动等仍待验收。


## Slide / Base / Board 用户恢复界面（2026-09-10）

沿用独立 `history-restore-ui.univer`，依次在三类应用恢复框中选择历史 revision2，确认框逐项显示对应 Unit、当前3→历史2，实际点击“恢复并生成新版本”。Slide 重载后两页且第二页显示“Slide 第二个版本”；Base 显示两条记录；Board 显示初始和第二个版本的两个文本元素。三类页面均“已同步”，本次 DOM 与截图未发现协同冲突提示。

截图：Slide 恢复（本地验证截图：`screenshots/slide-restore-ui-result.png`）、Base 恢复（本地验证截图：`screenshots/base-restore-ui-result.png`）、Board 恢复（本地验证截图：`screenshots/board-restore-ui-result.png`）。这是实际浏览器按钮恢复流程，仍非 WorkBuddy 宿主内嵌流程，且仅覆盖小型 fixture。

扩展 `scripts/verify-history-restore-ui.mjs verify-products`。关闭页面及服务后重启读取，三类 revision 均为4且包含第二版本新增内容，每类恰好一个 completed 应用操作、targetRevision2；同文件 Doc 完整快照与此前 revision5 基准深度相等。验证退出码0，日志 `.data/history-restore-ui-products-verify.log`，本轮独立服务已关闭。没有改动产品源码，因此未重复构建。仍待 Sheet UI 恢复/公式、取消和失败交互、历史列表与恢复选择联动、宿主及复杂内容验收。


## Sheet 公式恢复与取消（2026-09-10）

新增 `scripts/verify-sheet-restore-ui.mjs create|serve|verify-cancel|verify`，从闭合的双版本 Sheet fixture 复制独立 `.data/sheet-restore-ui-workspace/sheet-restore-ui.univer`。初始 revision2、B2/B3=42/126。实际打开恢复框，选 revision1 并 prepare，随后点击“取消恢复”。关闭服务再运行 verify-cancel：完整主线快照、公式、数值与确认版本均与取消前深度相等；只留下一个未提交 prepared 意图。取消后截图（本地验证截图：`screenshots/sheet-restore-cancel.png`）。

重新打开同一副本，再选择历史 revision1，确认当前2→历史1，实际点击恢复。页面重载后显示7/21，已同步，截图及DOM未出现协同冲突。恢复结果（本地验证截图：`screenshots/sheet-restore-ui-result.png`）。最终关闭服务并运行 verify，重启确认主线revision3、B2/B3=7/21、B3公式与初始公式一致，两个准备意图中恰好一个 completed（目标revision1）；退出码0，日志 `.data/sheet-restore-ui-verify.log`。本轮所有独立服务已关闭。

至此五类基础 fixture 的浏览器应用恢复流程有实测，但不代表复杂公式/图表/跨Unit恢复、失败与超时、完整宿主审阅或全部U09合同通过。取消只关闭当前UI流程，prepared记录仍按有效期保留；如需持久撤销该意图，须另加显式取消状态并验证。

## 恢复意图持久取消（2026-09-10）

随后补充服务端 `cancelled` 状态与 Viewer 取消请求：尚未提交的恢复可持久取消，重复取消幂等；已提交或完成的操作不能被标记为取消。确认已取消 operationId 返回 `RESTORE_CANCELLED`。Viewer 等待取消确认后才关闭弹窗，失败保留对话框与原 operationId。

`tests/integration/history-restore.test.mjs` 验证 Agent 无取消权限、重复取消、取消后拒绝确认、已完成恢复拒绝取消，以及服务重启后取消状态仍生效；整项测试通过，日志 `.data/history-restore-cancel-test.log`。TypeScript 检查与定向 Viewer 构建退出码均为 0，构建日志 `.data/history-restore-cancel-viewer-build.log`。此次没有重启 WorkBuddy 的开发服务，也没有新增该取消流程的 UI 截图；前节截图记录的是旧取消语义，不能作为新流程的视觉证据。规格第 9.3 节同步补充取消与重试的验收合同。

### 持久取消的浏览器实测

随后扩展 `scripts/verify-sheet-restore-ui.mjs` 的 `baseline-persistent-cancel` / `verify-persistent-cancel` 两个阶段。在独立 Sheet 副本 revision3（7/21）保存完整基准，真实浏览器选择历史 revision2，点击确认所选版本，再点击取消恢复。弹窗正常关闭，页面仍为7/21且已同步。取消前确认（本地验证截图：`screenshots/sheet-persistent-cancel-confirm.png`）、取消后页面（本地验证截图：`screenshots/sheet-persistent-cancel-result.png`）。

关闭页面和独立服务后，重新启动 verifier：完整 snapshot、revision、数值和公式与基准深度相等，恰好新增一个 cancelled 意图，重启后确认原 operationId 返回 RESTORE_CANCELLED。验证退出码0，日志 `.data/sheet-persistent-cancel-verify.log`。两个阶段的服务均已关闭；原 WorkBuddy 开发服务未重启。证据证明该浏览器取消路径，仍不包含请求超时、原生宿主审批或复杂内容恢复。

## 恢复版本选择与空状态（2026-09-10）

修复恢复弹窗默认选中当前版本的问题。history/list 现在从 Core load data 返回 currentRevision；UI 标注并禁用当前及非历史版本，初始使用“请选择历史版本”占位且确认禁用，用户选择旧版本后才开放确认。没有可恢复版本时展示明确空状态；还有分页时提示加载更早版本。准备/确认阶段的服务端版本校验保持有效。

`pnpm build:server`、`pnpm typecheck`、历史恢复集成测试及定向 Viewer 构建全部退出码0；测试新增 currentRevision 回包断言。日志 `.data/history-selection-test.log` 和 `.data/history-selection-build.log`。

新增 `scripts/verify-history-selection-ui.mjs`，独立副本包含多版本 Sheet 与新建后仅一个版本的 Sheet。浏览器实测多版本初始选中占位、revision3标注当前并禁用、确认禁用，选择revision2后确认启用。初始选择截图（本地验证截图：`screenshots/history-selection-placeholder.png`）。单版本文件实测“暂无可恢复的历史版本”且确认禁用，空状态截图（本地验证截图：`screenshots/history-selection-empty.png`）。此次没有提交恢复操作。切换文件后 CDP 报 Debugger unattached，原生 Chrome AX 确认同一标签页已切换成功，后续通过原生操作完成空状态验证；没有因此重建 fixture 或重启服务。完成后释放页面并关闭独立服务。分页、窄屏及 WorkBuddy 内嵌恢复仍需分别验证。

## 全量现有集成回归与宿主复查（2026-09-10）

按 `pnpm test` 顺序执行服务构建、MCP App 构建及全部现有 integration 文件（test-concurrency=1）。17项测试全部通过，0失败，测试耗时49.655秒；日志 `.data/full-regression-20260910.log`。覆盖现有 Base 表/视图导出及公式、恢复权限/取消/重试/重启、MCP工具和HTTP鉴权、五类基础Unit、Doc/Board基础编辑、Sheet公式/无变更/冻结/合入与恢复、预览作用域及不同端口cookie隔离。该测试集未覆盖完整规格，不能将17项通过等同25项发布验收通过。

修正 MCP `office://status` 的过时说明：明确 WorkBuddy 5.5.4 HTTP 五类基础只读实时预览和全屏已有实测，并保留完整审阅、任务隔离及安装未完成的限制。修改后服务重新构建和 MCP 定向回归3项通过，日志 `.data/mcp-status-regression.log`；原9081运行进程未重新加载该服务端文字。

实际 WorkBuddy 中点击“刷新预览”，等待按钮恢复可用。原生AX确认仍为同一Slide/草稿、两页、等待审阅、85%缩放、已同步只读预览；实际截图显示第二页内容及两张缩略图。宿主当前画面（本地验证截图：`screenshots/workbuddy-full-regression-preview.png`）。此次只是重新挂载已有内容，未修改、合入或丢弃草稿。Slide“+新增”仍显示为可操作样式，先前数据不变验证不能替代这项只读UX缺口；完整验收继续保留。

## Slide SDK 全局只读配置探测（2026-09-10）

读取安装版本 slides-ui README、公开 `IUniverSlidesUIConfig` 和 ThumbnailBar 类型。`editor.enabled=false` 文档为关闭编辑器交互，因此在普通内嵌预览（isPreview）试接该配置；没有修改固定对比或可编辑草稿。Typecheck、定向 Viewer 构建通过。实际 WorkBuddy 刷新后，编辑器区域完全空白，AX不再出现画布、缩略图或翻页控件，外层仍显示已同步。失败诊断截图（本地验证截图：`screenshots/slide-editor-disabled-failed.png`）。这证明该配置在当前组合中不能直接实现保留导航的只读预览，不证明 SDK 所有组合均有相同问题。

撤回 productPreset / main 的这次配置改动，保留原权限控制；不能把空白画布当作解决了只读入口问题。“新增”视觉状态依然待解决，后续须核验更细粒度 UI/权限入口或 SDK 兼容性。新增 `scripts/verify-slide-readonly-ui.mjs before|after` 用于从正在运行的HTTP MCP读取完整Slide快照与ready worktree，验证界面操作前后内容不变；基准 `.data/slide-readonly-config-before.json` 已采集。

撤回后 typecheck 与定向 Viewer 构建通过（`.data/slide-readonly-editor-revert-build.log`）；实际 WorkBuddy 刷新恢复两页画布和85%缩放，点击第一页可正常切页。恢复后截图（本地验证截图：`screenshots/slide-editor-config-recovered.png`）。切页后通过原HTTP MCP再次回读，完整snapshot及ready worktree与新基准深度相等，验证退出码0，日志 `.data/slide-readonly-config-verify.log`。原服务和草稿均保留，未执行内容写入。

## Unit 移除审阅链路（2026-09-10）

核对 Office Worktree 文档、安装版本 Worktree Service README/公开类型及对应源码。SDK setUnitRemoved 只排除草稿内容合并，不删除trunk；应用沿用已存在的目录reconcile，将terminal removed结果投影为目录软移除，保留Core内容。

新增 Office.setUnitRemoved 和严格 removal HTTP端点；MCP univer_unit 支持 create（兼容默认）、remove及restore（撤销尚未合入的移除）。仅draft可改移除意图，ready必须先reopen。Viewer显示“待移除”目录项、撤销按钮和审阅说明，不挂载已移除草稿编辑器；ready保留合入/丢弃/继续修改。旧受限预览的 resolve 返回待移除不可用状态，撤销后可重新加载。修复待移除状态每次轮询重建按钮的问题，以及移除最后一个Unit后页脚残留待移除文字。

新增unit-removal集成测试覆盖五类基础Unit：重复标记/撤销、冻结拒绝、Agent合入pending-review、预览无移除权限、丢弃保留主线、合入目录软移除、底层完整load data不变、重启后status依据SDK结果补齐丢失的目录投影、新建后移除的Unit不进入trunk。与preview/MCP回归共7项通过（`.data/unit-removal-regression.log`）。另通过MCP调用remove/restore的3项定向测试（`.data/unit-removal-mcp-test.log`）。当前未声称删除后垃圾箱恢复入口、复杂跨Unit引用清理或多Unit部分失败全部完成；SDK原始内容保留不等于产品恢复界面已交付。

新增 `scripts/verify-unit-removal-ui.mjs create|verify`，独立工作区 `.data/unit-removal-ui-workspace`。浏览器真实执行标记→撤销（编辑器恢复）→再次标记→提交审阅→合入。待审阅状态显示移除说明，合入后目录中不再有该Unit。待审阅截图（本地验证截图：`screenshots/unit-removal-ready.png`）。后台标签页观察偶发超时，激活同一标签页后继续，没有重复创建fixture或把超时当作服务退出。

最终 Viewer typecheck/构建退出码0（`.data/unit-removal-empty-viewer-build.log`），刷新后页脚为“当前文件暂无内容”，无待移除残留。合入后截图（本地验证截图：`screenshots/unit-removal-merged.png`）。关闭页面和服务后运行verify：merged状态、removed目录和SDK原始内容/revision均核验通过，日志 `.data/unit-removal-ui-verify.log`。第一次验证因基准JSON把Uint8Array序列化成数字键对象而类型比较失败；将运行时load data按相同JSON表示规范化后比较全部字段/字节，未删减对比字段，验证通过。独立验证服务已关闭；原WorkBuddy 9081服务尚未重新加载新增端点。

## 打开文件前恢复移除目录（2026-09-10）

加强 unit-removal 集成测试：在模拟SDK已确认移除但目录投影丢失、服务重启后，不先调用status，直接resolveTarget五类原Unit。修改前失败（Missing expected rejection，`.data/unit-removal-startup-before.log`），证实目录修复只发生在status读取时，会留下提前访问窗口。

Office.open现在先读取文件的SDK worktree结果并reconcile目录，再将FileContext注册进可访问files集合；读取或恢复失败则关闭该context并抛出错误。目录修复不再依赖用户先打开文件列表。没有改动SDK表或删除原始内容。

服务构建和typecheck通过；unit-removal、office及preview共11项集成测试通过，0失败，23.150秒，日志 `.data/unit-removal-startup-after.log`。五类移除Unit在首次直接访问即被拒绝，同时保留原SDK内容/revision；正常文件创建、合入、重启、基础导出与预览权限回归通过。此轮只改服务启动恢复逻辑，没有新增UI截图，也未重启原WorkBuddy开发服务。目录垃圾箱恢复、并发writer及部分操作日志恢复仍待验收。

## 已移除内容恢复：界面与重启验收（2026-09-10）

新增 Viewer“已移除内容”入口，列出保留在主线存储中的软移除 Unit，用户点击恢复后重新加入目录。恢复要求 viewer 身份和当前移除记录指纹；目录更新与恢复收据在应用 catalog 的同一事务中提交。重复请求可返回已恢复结果；后续再次移除会产生新的指纹，旧恢复请求不能覆盖新移除意图。恢复不写入 SDK 内容或增加 revision，未曾进入主线的新建后移除草稿不在可恢复列表中。

真实浏览器在独立9082服务执行“已移除内容 → 恢复 待审阅的内容移除”，目录项和 Sheet 编辑器恢复，界面显示“内容已恢复到文件目录”和已同步只读审阅。恢复前（本地验证截图：`screenshots/unit-restore-before.jpg`）、恢复后（本地验证截图：`screenshots/unit-restore-after.jpg`）。该 fixture 原本就是空表，截图用于验证目录与编辑器恢复，不作为非空业务数据恢复的证明。首次验证链接因缺少配对 Unit 参数返回400，改用服务原生工作区启动入口后成功；没有放宽浏览器安全设置。

关闭测试页面及服务后，运行 `node scripts/verify-unit-restore-ui.mjs verify`，退出码0。重新打开文件后在调用 status 之前即可 resolveTarget；完整 SDK load data 经相同 JSON 规范化后与移除前基准深度相等，revision 保持1，viewer 恢复收据持久存在，可恢复列表为空。证据：`.data/unit-restore-ui-verify.log`、`.data/unit-restore-ui-evidence.json`。验证服务已正常退出。

重新运行 unit-removal 集成测试，1项综合测试通过（`.data/unit-directory-restore-final.log`），包含五类基本 Unit 恢复/重复请求/重启、Agent拒绝、过时指纹拒绝、注入目录写入失败时事务回滚、再次移除后的旧指纹失效。此前 typecheck、服务/Viewer构建和preview/MCP定向回归通过，日志 `.data/unit-directory-restore-viewer-build.log`、`.data/unit-directory-restore-regression.log`。复杂引用恢复、多 writer、完整宿主审阅及正式安装仍未通过验收；原9081 WorkBuddy开发进程尚未加载此新增服务端接口。

## 工作区服务互斥与进程退出（2026-09-10）

检查安装入口发现 stdio 和 HTTP 都直接创建独立 Office 服务，没有共享工作区互斥。新增 `src/storage/workspace-lease.ts`，在服务打开任何 Office 文件之前，对规范化真实工作区路径内独立的 `.workbuddy-office-lease.sqlite` 持有 SQLite EXCLUSIVE 事务。第二个服务返回 `WORKSPACE_IN_USE`；运行协调文件不与 SDK 内容数据库共用，也不在释放时 unlink，避免不同 inode 同时被持有。进程退出由操作系统释放锁，不依赖 PID 推断或删除过期锁文件。

`startServer` 现在在失败启动和正常关闭后释放租约，重复 close 共享同一个 Promise；启动过程中失败会关闭已创建的 Office/Visual 资源。README 已说明升级前停止旧服务、不要删除运行中租约文件，以及保护边界。

新增3项集成测试均通过（`.data/workspace-lease-test.log`）：跨 stdio 共用后端/HTTP 的重复启动拒绝、工作区符号链接别名拒绝、首个服务仍可响应；正常关闭后重开并读取同一文件 ID；非法监听端口启动失败后重开；独立子进程持锁期间拒绝第二个服务，并在 SIGKILL 后无需手工清理即可重开。仅按顺序运行一个所有者进程，竞争者在初始化内容 Runtime 前退出。

服务构建、typecheck 通过（`.data/workspace-lease-build.log`、`.data/workspace-lease-typecheck.log`）。office、preview、mcp-http、unit-removal 共12项回归通过，0失败，26.305秒（`.data/workspace-lease-regression.log`）。本轮没有UI变化，不产生新的界面截图。原WorkBuddy 9081进程 PID98786 实测仍存活，未重启，因此尚不具备新租约逻辑。此项只证明本机同一规范化工作区的互斥；跨工作区物理文件别名、其他OS、自动服务复用/配置及60秒租约空闲退出仍需实施和验收，不能据此宣称正式安装完成。

## 多 Unit 部分合并结果与重试（2026-09-10）

读取安装版本 Worktree Service README/公开结果类型和官方 merge-service 测试。发现 Viewer 忽略工具返回的逐项 mergeResult，仅显示笼统通知。新增逐项结果区，列出已合入/无变化/移除/冲突/失败/尚未完成及失败原因，明确已完成数量和已完成内容不会回滚；本轮合入成功切回主线后仍保留结果。merging 状态新增“重试合入未完成项”，ready 继续通过现有审阅合入入口重试。

新增 `partial-merge.test.mjs` 两项集成测试，全部通过（`.data/partial-merge-test.log`）：①按官方测试方式以 Core middleware 注入一项创建拒绝，另一项合入成功；服务重启保留逐项结果，旧 fingerprint 拒绝，重新审阅后仅补齐失败项，首项完整 load data 不变，两项均为 revision 1。②通过公开 Core createUnitFromData 预先创建相同 ID 的不同内容，实际返回 WORKTREE_CREATE_CONFLICT；重复审阅重试仍保留冲突主线原始内容，成功兄弟项不回滚、不增加版本。第二项不是伪造 mergeResult，也不是将权限失败当成 OT 冲突；它验证新建 Unit 的标识冲突，复杂 OT 冲突仍待测。

typecheck 和定向 Viewer 构建通过（`.data/partial-merge-typecheck.log`、`.data/partial-merge-viewer-build.log`）。真实浏览器在独立9082服务点击合入：先显示“1/2 项已完成”及 PERMISSION_DENIED 原因；再次点击合入后显示“2/2 项已完成”，自动返回主线，结果保留。首次部分成功（本地验证截图：`screenshots/partial-merge-result.jpg`）、重试完成（本地验证截图：`screenshots/partial-merge-retried.jpg`）。测试使用两个空 Sheet，验证的是生命周期与结果展示，不能代表复杂业务内容保真。

关闭测试页面及服务，运行 `node scripts/verify-partial-merge-ui.mjs verify` 退出码0；重启后 worktree merged、两项结果 merged、revision 各为1，操作记录先partial后completed（`.data/partial-merge-ui-verify.log`）。所有本轮验证服务已退出。终态结果的浏览器刷新/旧卡片恢复、复杂混合 Unit/OT 冲突、合并收据丢失后的应用 operation 恢复和 WorkBuddy 宿主完整审阅仍待验收，不能将上述2项测试等同全部多 Unit 合并合同完成。

## 合入结果入口恢复与刷新（2026-09-10）

Viewer 将最近审阅的 worktree ID 保存在 URL 的 review 参数中，从当前文件的真实 status 重新读取结果，不把结果 JSON 存入本地缓存。打开已 merged/discarded 的旧 worktree 入口时，切回主线前保留审阅 ID；切换到不包含该草稿的文件会清除无效 ID。受限内嵌预览不使用此参数扩大权限。认证 launch 支持 review 参数，并先通过当前文件的 reviewState 验证归属和存在性，再生成跳转地址。

服务构建、typecheck、定向 Viewer 构建通过（`.data/review-reopen-build.log`）。部分合并测试新增认证入口保留 review、无效 review 拒绝及读取不改变原始数据断言。第一次与 Viewer 产物替换同时运行的预览回归出现静态资源404；构建结束后重跑5项全部通过（`.data/review-reopen-test-final.log`），不能将第一次运行计为通过。后续构建与依赖其静态产物的测试应顺序执行。

复用已关闭的 partial-merge fixture，启动新服务，从原 worktree 入口重新打开；实际页面转为 file/unit/review 主线地址，显示2/2项已完成。浏览器再次刷新，仍显示相同文件、选中Sheet和两项版本1结果，编辑器已同步。刷新后截图（本地验证截图：`screenshots/review-reopened-after-refresh.jpg`）。关闭页面及服务后再次 verify 退出码0，两项revision仍为1，操作记录仍只有此前partial与completed，没有因打开/刷新而新增合并（`.data/review-reopen-verify.log`）。本轮未创建或修改Office内容。

已验证的是浏览器已合入草稿入口与刷新恢复；WorkBuddy旧卡片持久化/端口更新、丢弃后无主线对应Unit的入口、文件失效处理与完整任务隔离仍需继续验收。

## 文件移走/替换后的访问与界面（2026-09-10）

Catalog 记录打开文件时的设备号/inode，Office.file 每次访问核对路径、真实路径与文件身份。文件已移走或被另一物理文件替换时返回 FILE_UNAVAILABLE。Core/Worktree 的读取、提交、应用、提交落盘和创建入口增加相同检查，将仍持有旧连接的SDK调用拒绝为 PERMISSION_DENIED；恢复同一原文件后可继续访问。此检查不声称能防止最后一次检查与OS写入之间的所有竞争，跨平台文件身份及外部文件工具并发行为仍待验证。

Viewer 区分明确文件不可用与临时网络故障。前者释放编辑器/对比订阅、清空Unit导航及操作按钮、关闭打开的对话框，显示不可用说明；继续轮询，原文件恢复后重新挂载正确目标。不会为原文件自动选择其他文件。

新增file-unavailable集成测试：真实rename测试文件，确认HTTP404及原SDK读取/创建被拒绝；在原路径写入另一个物理文件仍被拒绝；放回原文件后完整草稿load data、Unit数和draft状态不变。服务构建和typecheck通过，Viewer定向构建通过（`.data/file-unavailable-viewer-build.log`）；与preview/partial-merge/unit-removal共7项回归全部通过（`.data/file-unavailable-regression.log`）。

浏览器复用已合入的独立partial-merge fixture，等编辑器已同步后通过文件系统临时移走原文件。实际页面显示文件不可用，旧编辑器与编辑/审阅/导出按钮均不再显示。不可用截图（本地验证截图：`screenshots/file-unavailable.jpg`）。随后立即放回原文件，页面自动恢复原Sheet、2/2结果及已同步状态。恢复截图（本地验证截图：`screenshots/file-available-again.jpg`）。验证仅移动自建测试文件，未触碰用户文件；没有删除测试数据库。

关闭页面和测试服务，再次verify退出码0，两项revision仍为1，操作记录仍只有原partial/completed（`.data/file-unavailable-ui-verify.log`）。本轮测试进程已退出。原9081 WorkBuddy服务未重启，尚未加载新的服务端检查；宿主旧卡片文件失效、失效票据、跨平台行为及完整功能仍待验收。

## 最近修改后的全量回归与 WorkBuddy 画面复核（2026-09-10）

执行 `pnpm test`，按脚本先构建 server 和 MCP App，再以 test-concurrency=1 顺序执行全部当前 integration 测试。24项全部通过，0失败，测试耗时56.421秒（`.data/full-regression-latest.log`）。此次包括最新工作区租约、文件失效、部分合并/新建冲突、移除恢复，以及此前Base导出/公式、历史恢复、五类型基础内容、MCP权限及预览测试。24项现有测试通过不等于规格25项发布验收全部通过。

实际检查原WorkBuddy服务PID98786仍存活，在WorkBuddy 5.5.4当前Slide全屏预览中点击“刷新预览”。AX显示两页、第二页选中、85%缩放、等待审阅、已同步只读预览；截图确认编辑器和第二页内容可见。当前宿主实际截图（本地验证截图：`screenshots/workbuddy-latest-regression.jpg`）。通过HTTP MCP在刷新前后分别回读完整Slide snapshot和ready worktree，深度比较相同，读取mutations为0（`.data/latest-host-before.log`、`.data/latest-host-after.log`）。未修改、合入或丢弃原演示文稿草稿。

这次宿主复核使用新静态Viewer和原9081服务；原服务未重启，因此不能将它作为最近新增服务端检查已部署到WorkBuddy的证据。Slide“+新增”仍显示可操作样式，自动安装/复用、可信任务身份、完整审阅与复杂内容/比较等缺口保留。

## Slide 单文稿只读权限探测（2026-09-10）

继续定位缩略图“+新增”视觉状态。读取安装版本slides-ui README、配置/ThumbnailBar公开类型，以及slides权限服务/FPresentationPermission类型。与之前全局editor.enabled=false不同，这次在loadSlideAsync完成后，对preview/non-draft调用单文稿setReadOnly。typecheck和Viewer构建通过，实际WorkBuddy刷新后保留两页画布与导航，但“+新增”仍显示蓝色可操作样式，AX无disabled标记。点击第一页可正常切页。探测截图（本地验证截图：`screenshots/slide-permission-probe.jpg`）。

通过原HTTP MCP读取完整snapshot及ready worktree，操作前后深度相同；预览3项回归通过（`.data/slide-permission-after.log`、`.data/slide-permission-preview-test.log`）。该试验不足以解决已确认的视觉问题，已撤回新增setReadOnly调用。撤回后typecheck/Viewer构建通过（`.data/slide-permission-revert-typecheck.log`、`.data/slide-permission-revert-build.log`），实际WorkBuddy再次刷新确认两页导航和已同步状态恢复正常。未修改内容、合入、丢弃或重启原服务。

新增[本地复现文档](slide-readonly-gap.md)，记录两种失败配置、公开合同、证据及后续验收条件。没有向外部仓库提交Issue。该UI缺口仍未解决，不能将内容未变化等同按钮状态正确；下一步应核验缩略图组件对unit Edit权限及异步权限更新的订阅。

## 宿主刷新开销与性能采样限制（2026-09-10）

进一步查看公开UI扩展合同：registerUIPart/setUIVisible支持整块UI，SlideThumbnailItem暴露预览/拖动属性，但现成SlideThumbnailBar没有单独控制新增按钮的参数。尚未以自定义缩略图替换原组件；拖动、嵌入及导航需要完整验证，不能当作小配置调整。

尝试从原生AX观察“刷新按钮进入忙碌 → 编辑器已同步”测量宿主刷新。首次15秒观察窗口内AX未返回内嵌编辑器子树，无法记录可靠结束时间；随后同一窗口截图清楚显示两页和已同步内容，原PID98786及health也正常。因此该记录是观测不可靠，不是产品15秒加载失败，不能纳入P95。截图保存在screenshots/host-refresh-timeout.jpg（文件名指观察超时）；没有采集到20次有效样本，性能预算尚未验收。

检查MCP App源码发现刷新固定capture=true，即使实时iframe显示、图片区域隐藏，也会额外调用Screenshot流程。修改刷新参数：实时iframe可见时capture=false；图片回退模式仍capture=true。重新申请预览地址和重建iframe的行为保持原流程。此改动减少隐藏截图生成，不改变模型显式请求截图的默认行为。

Typecheck与MCP App定向构建通过；mcp/mcp-http共4项回归通过（`.data/live-refresh-regression.log`），包括真实capture=false响应的目标、预览能力地址及权限边界。原WorkBuddy卡片的App脚本已加载在内存，这次没有重新创建卡片，因此本轮不能宣称新刷新分支已经在宿主执行或获得性能提升测量。下一步需在新加载卡片中验证该分支，并以可靠渲染完成信号采集性能样本。

## 新加载 WorkBuddy 卡片刷新复核（2026-09-10）

在现有专用WorkBuddy验收任务中，发送一次只读univer_preview请求（同一两页Slide，capture=false），生成新卡片以加载最新按内容哈希标识的App资源。宿主返回ready、revision/capturedAt为null、imageCount=0；实际卡片加载两页编辑器并已同步。没有新建Office文件、编辑或合入/丢弃原草稿。

激活新卡片后点击“刷新预览”，等待其编辑器重新显示已同步；随后打开全屏、点击适应页面并切到第二页，显示85%缩放与完整第二页内容。新卡片刷新后的宿主截图（本地验证截图：`screenshots/workbuddy-new-live-refresh.jpg`）。刷新前后HTTP MCP回读完整Slide snapshot与ready worktree深度相等（`.data/native-live-refresh-before.log`、`.data/native-live-refresh-after.log`）。此次覆盖新卡片实际刷新行为；不是通过旧内存App反复刷新来代替新版验证。

另通过同一HTTP MCP读取当前preview工具返回的resourceUri，验证其哈希等于本地最新index.html+app.js的SHA256前16位，并读取资源确认包含该构建脚本；capture=false返回ready和0图片。无凭据证据存于`.data/native-live-refresh-resource.json`。这证明当前服务提供新版资源及不捕获图片的工具合同；没有对宿主内部网络消息做抓包，因此不把此项描述成逐条宿主网络参数追踪。

新分支构建与4项MCP回归证据见上一节。仍未获得20次可靠渲染完成样本，不报告性能提升百分比或P95通过；浮窗、完整内嵌人工审阅、自动安装和只读新增按钮缺口保持未完成。

## 本地分发包与独立解包执行（2026-09-10）

复核[WorkBuddy开放平台连接器文档](https://open.workbuddy.cn/docs/connector)与[官方插件参考](https://www.codebuddy.cn/docs/cli/plugins-reference)：连接器声明可托管运行时，本地MCP可使用stdio；这些描述不证明当前桌面版本会自动启动本地HTTP服务或为其配置动态凭据。现有本地HTTP接入仍是开发路径，未据此伪造正式安装合同。

package.json新增文件白名单和pack:plugin命令，依次构建server/viewer/render/app，再运行scripts/package-plugin.mjs。最初npm pack dry-run明确发现pnpm-lock.yaml被npm排除；检查失败后改用显式tar归档。最终脚本递归核验白名单文件、拒绝symlink/越界路径/测试或私有文件，对实际tar清单再次深度比较，并写入SHA-512及完整条目。归档包含公开config/registry.npmrc和原锁文件，不包含node_modules、.data、日志、数据库、凭据或测试宿主。没有发布npm包或向远程上传。

产物`.data/packages/workbuddy-univer-office-0.1.0.tgz`：199文件，18,812,214字节；`.data/packages/package-audit.json`记录完整清单和integrity。四个目标构建成功，最终打包检查日志`.data/plugin-package-audit.log`。脚本调用tar，当前只在macOS验收，不宣称Windows打包可用。README新增解包及依赖准备说明。

独立解包到`.data/package-install-OKERgf`，复制包内公开registry配置，执行pnpm install --prod --frozen-lockfile --offline，2.5秒成功。只使用当前机器缓存，无devDependencies；protobufjs构建脚本被pnpm默认忽略，后续实际运行仍成功。此项是全新安装目录验证，不是无缓存干净机器或托管运行时安装验证。

新增scripts/verify-packaged-plugin.mjs：子进程cwd和入口都指向解包目录，验证SDK依赖真实路径属于该目录的node_modules。在独立测试工作区完成15工具发现、创建文件/草稿/Sheet、确认写入、公式回读230、XLSX导出、PNG截图、MCP App资源及Viewer入口HTTP200。带PNG渲染的最终执行退出码0（`.data/packaged-plugin-verification.log`），子进程和Runtime按close退出。JSON证据`.data/packaged-plugin-verification.json`记录工作区和target；[包内运行生成的截图](../.data/packages/packaged-sheet.png)清楚显示销售230、SUM合计230。验证仅覆盖基础Sheet及分发入口，不代表五类完整交付、Office应用保真或正式市场安装。

待完成：WorkBuddy正式包加载、Skills自动发现、HTTP自启动/凭据/租约复用、托管Node、跨平台native依赖、无缓存安装、升级卸载与完整功能验收。


## 分发包 XLSX 的桌面应用验证（2026-09-10）

通过 Finder 的“打开方式”在本机 LibreOffice 26.2.3.2 打开隔离分发包导出的 `packaged-check.xlsx`。实际 UI 显示中文表头、销售金额 230、合计 230；选择 B3 后公式栏为 `=SUM(B2:B2)`。未编辑或保存工作簿。CUA AX 与截图共同证明此基础 fixture 的内容和公式可被桌面兼容应用读取。

截图：LibreOffice 公式与结果（本地验证截图：`screenshots/packaged-xlsx-libreoffice.jpg`）。机器证据：`.data/packaged-xlsx-native-verification.json`、`.data/packaged-xlsx-calc-ax.txt`。Excel 的路径弹窗未成功进入工作簿，不能据此宣称 Excel 通过或文件损坏。此检查不覆盖复杂图表、透视表、格式保真及其他 Office 导出；第 13.1 节完整验收仍未完成。


## DOCX / PPTX 原生桌面验证（2026-09-10）

读取现有插件导出及其生成脚本后，通过 Finder 打开文件，使用 CUA 读取原生应用界面并截图。没有编辑或保存文件。

- Microsoft Word 16.109.1：`docx-verified-1788973238320.docx` 在兼容性模式打开；整页视图显示中文标题、正文及 4 行 2 列表格，内容未溢出页面。AX 验证关键文字及共 1 页，DOCX XML 验证 8 个表格单元格。截图：Word 原生显示（本地验证截图：`screenshots/docx-native-word.jpg`）。
- Microsoft PowerPoint 16.109.1：`verify-slide-1788971401239.pptx` 打开为 1 页；绿色标题区、三张流程卡片、页脚及中英文可见。PPTX XML 含 14 个原生 shape，不能将本次只读查看称为编辑测试。截图：PowerPoint 原生显示（本地验证截图：`screenshots/pptx-native-powerpoint.jpg`）。

证据：`.data/office-native-export-verification.json` 与两个原生 AX 文件，包含实际文件 SHA256。此轮增加基础内容在 Microsoft 应用中的验证；未覆盖六页 Slide、图表/表格、转场、Doc 页眉页脚和分页等完整 spec fixture。Excel 专项仍未通过，完整发布验收保持未完成。

## Sheet 条件格式与数据校验装配及实时验证（2026-09-10）

发现 Viewer 的 Sheet 分支仅注册 Core preset，补充同一精确 SDK cohort 的 `preset-sheets-conditional-formatting`、`preset-sheets-data-validation`，包含 Facade、中文 locale 和 CSS。共享 productPreset 同时供 live Viewer 与固定快照使用；本轮实际 UI 验证为可编辑草稿，固定快照交互还需独立验收。Headless 与机器 Render 使用 SDK 标准组装，本轮未更改。

执行 `scripts/verify-sheet-features-ui.mjs`：新建独立工作区和 Sheet 草稿，写入公式、数值条件格式及状态下拉；commit confirmed 后通过新 Runtime 回读规则、数据和数值结果；输出 SDK PNG 与 XLSX。初次断言把 getValues 的格式化字符串 4,800 当作数字，修正为安装版本公开 getRawValues 后重新在独立 fixture 执行通过。

实际 Chrome Viewer 验证：初始只有 1,600、2,400 两格变绿，800 不着色。用户侧下拉将 C4 从“待审阅”改为“已检查”，独立 Agent 读取确认持久化；随后 Agent 将 B4 改为 1,200，Viewer 实时将该格变绿，金额合计从 4,800 变为 5,200，含税合计从 5,280 变为 5,720。截图保留真实 Pro 水印：实时条件格式与下拉（本地验证截图：`screenshots/sheet-features-live.jpg`）。

证据：`.data/sheet-features-evidence.json`、`.data/sheet-features-interaction.json`、`.data/sheet-features-ui-ax.txt`。XLSX XML 含一个条件格式和一个数据校验规则，证据 `.data/sheet-features-xlsx-rules.json`；尚未验证此文件在桌面 Office 中的规则交互。

`pnpm typecheck`、定向 Viewer 构建及 preview 集成回归通过，日志 `.data/sheet-features-viewer-build.log`、`.data/sheet-features-preview-regression.log`。独立 9082 fixture 服务已正常退出，原 WorkBuddy 开发服务未重启。本轮没有重新打包，先前 tgz 不含此 Viewer 改动。图表、透视表及完整 Sheet fixture 仍未完成，不能将两项扩展测试推广为 C01 全量通过。

## Sheet 原生图表装配与数据更新（2026-09-10）

Viewer 的 Sheet 分支新增官方 Drawing preset（live collaboration=true，固定快照为 false）和 Pro Sheets Chart / Chart UI 插件，加载对应 Facade、中文 locale 与 CSS；继续使用应用现有 License 注册和 Collaboration SDK，不引入 Universer exchange/collaboration preset。版本保持 `1.0.0-insiders.20260907-70fc579`。参照官方 Charts 指南、安装包 README/exports/types 和 Drawing preset 完整组装代码，实际安装产物优先于文档中的版本描述。

`verify-sheet-chart-ui.mjs` 在已关闭的条件格式/校验 fixture 中创建一张引用 A3:B6 的原生柱状图，确认提交后重载得到同一个 chartId，同时保留条件格式与数据校验。机器截图和 XLSX 导出成功。Chrome 实际显示中文图表标题、分类与柱形。默认自动纵轴从数据最小值开始，验证样例已通过公开 builder 设置 `setYAxis({min:0})`，使柱长从零开始。

随后原图表通过 `toBuilder` / `update` 设置零基线，Agent 将 B4 从 1200 改为 3000；不刷新页面，图表变为 3000、1600、2400 三柱，表格合计 7000、含税 7700.00。第一次 raw 数值精确相等断言遇到 7700.000000000001；在确认写入已完成后只读恢复验证（误差 <1e-8），没有重跑写入。图表 ID 不变且数量仍为一。

证据：`.data/sheet-chart-evidence.json`、`.data/sheet-chart-live-update.json`、`.data/sheet-chart-ui-ax.txt`。截图：图表随数据实时更新（本地验证截图：`screenshots/sheet-chart-live.jpg`）。导出 XLSX 含单一 chart XML，引用原工作表范围，缓存为 3000/1600/2400，记录 `.data/sheet-chart-xlsx-evidence.json`；桌面 Office 图表交互尚未检查。

类型检查、定向 Viewer 构建、3 项预览回归通过。日志 `.data/sheet-chart-viewer-build.log`、`.data/sheet-chart-preview-regression.log`。独立 fixture 服务正常退出，原 WorkBuddy 开发服务未重启。旧 tgz 仍未重新生成。透视表、多系列/其他图表类型、图表编辑/删除/比较、正式宿主安装仍须继续验收，不能视作全部范围完成。

## Sheet 透视表装配及实时汇总（2026-09-10）

新增同一精确 SDK 版本的 Sheets Pivot / Pivot UI，注册 Facade、中文 locale 和 CSS，复用现有 License/Collaboration 及已装配的图表、Drawing、条件格式、数据校验。按官方透视表指南和安装包公开类型使用 `addPivotTable`、`addField`、`getPivotTableById`，没有直接修改内部透视模型。

`scripts/verify-sheet-pivot-ui.mjs` 复用已关闭的综合 Sheet fixture，在 A12:C18 写入六条地区/产品/金额数据，A20 创建按地区分行、金额求和的透视表。确认提交后新 Runtime 回读相同 pivotId、字段和源范围，图表与条件格式仍各一项。普通 getRawValues 读取透视输出区域为空，getConfig.isEmpty 为 true；这些字段不能证明透视汇总失败或成功，渲染派生结果另行验证。

实际 Chrome Viewer 首次显示东区600、西区1500、总计2100。Agent 将东区第一条金额100改为700，确认写入后不刷新页面，透视表自动显示东区1200、西区1500、总计2700；独立源数据求和作为期望值。随后刷新浏览器，相同源值及汇总重新出现，原图表、校验下拉、条件格式仍在。

截图：首次汇总（本地验证截图：`screenshots/sheet-pivot-before.jpg`）、实时更新（本地验证截图：`screenshots/sheet-pivot-live.jpg`）、刷新恢复（本地验证截图：`screenshots/sheet-pivot-reloaded.jpg`）。证据：`.data/sheet-pivot-evidence.json`、`.data/sheet-pivot-live-update.json`。XLSX 含透视表、cache definition/records 及关系文件，记录 `.data/sheet-pivot-xlsx-parts.json`；尚未验证桌面 Office 透视表显示/刷新，不能仅凭 ZIP 部件宣称保真通过。

类型检查、Viewer 定向构建和预览回归见 `.data/sheet-pivot-viewer-build.log`、`.data/sheet-pivot-preview-regression.log`。临时9082服务正常退出，原 WorkBuddy 服务保留。当前仍缺透视字段重排、筛选、钻取、复杂汇总、固定对比与真实宿主完整交互；旧分发 tgz 未更新，完整目标保持未完成。

## 综合 Sheet XLSX 桌面显示验证（2026-09-10）

通过 Finder 的“打开方式”在 LibreOffice 26.2.3.2 打开 `sheet-pivot-updated.xlsx`，使用 CUA 读取原生 AX 并截图。75% 视图完整显示三个柱形（协作3000、分析1600、文档2400，纵轴从0起）、三格绿色条件格式、金额合计7000与含税合计7700，以及透视汇总东区1200、西区1500、总计2700。透视表标题被桌面应用显示为英文 Sum of 金额 / Total Result，不能声称逐像素或完整本地化保真。没有修改或保存工作簿。

截图：综合表格在 LibreOffice 中的完整显示（本地验证截图：`screenshots/sheet-features-native-libreoffice-full.jpg`）。文件 SHA256 与具体检查边界记录于 `.data/sheet-features-native-verification.json`，AX 存于 `.data/sheet-features-native-libreoffice-ax.txt`。这补足综合导出的桌面显示证据；下拉规则交互、透视表刷新和图表编辑未验证。Excel 仍停留在此前路径弹窗，本轮不计为 Excel 通过，也不据此认定文件损坏。旧分发包仍未重建，完整 spec 验收保持未完成。

## 新版分发包重建与隔离运行（2026-09-10）

顺序重建 Server、Viewer、Render Page 与 MCP App 后打包，当前 `workbuddy-univer-office-0.1.0.tgz` 为 199 个文件、18,894,238 字节，已包含此前新增的 Sheet 条件格式、数据校验、图表和透视表 Viewer 装配。文件清单与 SHA512 在 `.data/packages/package-audit.json`，构建日志 `.data/package-rebuild-latest.log`。

解压到新的 `.data/package-install-yc1pdu0q`，复制随包 registry 配置，执行 `pnpm install --prod --frozen-lockfile --offline` 成功；解析路径验证运行依赖位于该解压目录自己的 node_modules。依赖使用本机缓存，不能作为无缓存新机器安装证据。

扩展 `scripts/verify-packaged-plugin.mjs`，通过解压产物的 stdio MCP 进程在独立工作区创建 Sheet，确认提交并跨 Runtime 回读公式230、同一 chartId/pivotId、一个条件格式和状态校验规则；15个工具、App资源、Viewer入口、PNG与XLSX导出通过。默认截图只覆盖普通数据 used range，改用公开 sheet-range selector A1:L18 后，实际 SDK 图像显示三柱1200/1500/600、两格绿色、状态下拉和透视总计3300。

截图：解压分发包的综合渲染（本地验证截图：`screenshots/packaged-sheet-features.png`）。`.data/packaged-plugin-verification.json` 记录包摘要、工作区、目标、规则及XLSX SHA256。ZIP检查确认导出保留图表、透视表及cache、条件格式、数据校验部件；没有据此宣称桌面编辑或宿主安装完成。MCP验证进程已正常关闭。本次完整集成回归日志为 `.data/package-full-regression-latest.log`。

正式 WorkBuddy 插件加载与8个 Skills发现、HTTP生命周期、无缓存跨平台安装，以及完整内容/审阅/性能验收仍待完成；本轮没有重新配置或重启原 WorkBuddy 开发服务。

本轮 `pnpm test` 完成：24/24 通过，0失败、0跳过，耗时59.42秒。这24项集成测试不等同于 spec 全部验收条目。

## 产品 Skills 补齐与分发检查（2026-09-10）

修正共享 univer Skill 中“仅截图/宿主未验证”的过时说明，准确区分 WorkBuddy 5.5.4 HTTP 的基础实时预览实测与仍未完成的正式安装/审阅验收。新增 Sheet、Doc、Slide、Base、Board、Embed、Cross-Unit Formula 七个专项 Skill，使用插件现有 MCP 工具与共享写入/审阅约束；跨 Unit 未验收能力明确要求先查公开 API、提交后回读与独立渲染，不以常量或截图替代用户要求的活引用。

八个 Skill 均通过 skill-creator 的 quick_validate。系统及应用 Python 均缺 PyYAML，改在 `.data/skill-validation-venv` 隔离安装校验依赖，没有修改全局 Python。打包脚本新增八个必需 Skill 文件断言；复用未修改的已构建运行产物重新打包，并逐个比较归档与源码内容。证据 `.data/plugin-skills-verification.json`。这仅证明包内容与结构，不能代替 WorkBuddy 自动发现实测。

本轮 CUA 检查中，既有原生 Slide 全屏预览点击“返回卡片”未观察到任务界面返回，需继续定位宿主状态/显示模式桥；后续截图工具返回 unavailable，不能声称已保存该问题的新截图。正式插件加载、Skills发现与返回交互均保持待验收。

## 返回卡片复查（2026-09-10）

本轮恢复了原生截图能力，实际坐标点击返回按钮后任务界面曾短暂出现在 AX 中，但下次观察又回到全屏 Slide。不能将瞬时返回计为通过；也没有足够证据认定插件代码故障。复现步骤、已读路径与缺少的事件证据见 [返回卡片调查](./workbuddy-return-card-investigation.md)，截图 复查状态（本地验证截图：`screenshots/workbuddy-return-card-recheck.jpg`）。未修改内容或重启原服务，完整目标保持未完成。

## Fullscreen API 拒绝后的 MCP 回退（2026-09-10）

扩展测试宿主以记录浏览器 fullscreenchange/error 和 MCP 显示模式请求/响应；允许测试场景显式传入现有 fixture 工作区及 `--native-fullscreen`，并按真实 preview 的 loopback origin 设置测试 iframe CSP。测试宿主的 sandbox 增加 allow-same-origin 以承载 SDK live Viewer，属于本地协议测试配置，不改变产品宿主的安全边界。

真实 Chrome CUA 点击原生全屏路径后出现 `TypeError: not granted`，原实现只显示错误，即便宿主已声明支持 fullscreen。修复 App：原生请求拒绝且宿主明确声明 fullscreen 时，转为 MCP requestDisplayMode；宿主不支持时继续报告原错误，不假装全屏。共享显示模式处理保留响应检查与失败提示。

重新构建 App、关闭旧测试进程并重新启动后，同一 UI 操作记录 MCP inline→fullscreen，随后“返回卡片”记录 fullscreen→inline；再次读取 AX 后仍为 inline，真实表格显示已同步。证据 `.data/display-mode-fixed-ax.json`，截图 回退后返回卡片（本地验证截图：`screenshots/display-mode-fallback-return.jpg`）。这验证浏览器拒绝场景的回退；没有证明 WorkBuddy 5.5.4 原生全屏返回问题已解决，也没有把测试宿主作为正式安装验收。

类型检查与 App 构建日志 `.data/display-mode-typecheck.log`、`.data/display-mode-app-build.log`；预览回归日志 `.data/display-mode-preview-regression.log`。两个本轮测试宿主及 MCP 子进程均正常关闭，测试标签页关闭，原 WorkBuddy 服务未重启。新版 App 已重新打入开发归档，但旧 WorkBuddy 卡片仍须通过新的资源版本重新验证。

## WorkBuddy 八个 Skills 实际导入（2026-09-10）

真实 WorkBuddy 5.5.4 已回到主界面，进入“专家·技能·连接器→技能→添加技能→上传技能”。纯八个并列目录 ZIP 被拒绝为根目录没有 SKILL.md。改用根 SKILL.md 加 references 下完整技能树后，宿主安全检测报告安全，正常继续安装成功。没有跳过检测，也没有重复导入其余包。

关键实测：宿主递归识别 references 中的 Skill，按名称显示八项；安装数量37→45，搜索 univer 后总入口及七个专项均显示启用。安装落在 `~/.workbuddy/skills/univer`，共9个SKILL.md（总入口根与引用中各一份）、8个唯一name；全部相对引用可解析。由此不需要八次导入。`scripts/package-workbuddy-skills.py` 已收敛为生成这一个经过实测的根入口导入包 `univer-workbuddy-skill.zip`。之前生成的其他单项包仅为探索产物，不是推荐安装入口。

截图：真实宿主的八个已安装 Skills（本地验证截图：`screenshots/workbuddy-eight-skills-installed.jpg`）。证据 `.data/workbuddy-skills-installation.json`、`.data/workbuddy-eight-skills-installed-ax.json`。这证明本地导入、递归发现、启用与引用完整性；尚未验证自然语言自动选中技能并完成任务，也不等于整个插件运行服务自动安装完成。运行工具继续依赖开发 HTTP 连接器。

## 自然语言预览与 ready 状态误读修复（2026-09-10）

在已有 WorkBuddy 验收任务提出仅查看本任务演示文稿、查询是否等待审阅并显示预览的自然语言请求。原生 setValue/paste 与实际编辑器状态不同步，发送一度禁用，粘贴发生 clipboard timeout；重置 CUA 会话并尝试键入后请求实际提交，宿主输入框随后报 removeChild DOM 错误。没有重复发送已启动请求。实际提交文本保留中文请求且出现意外尾缀，故这不是干净的首次自然语言触发样本。

WorkBuddy 19秒完成并呈现新的真实 Slide 卡片，显示“等待你的审阅/已同步”。然而正文把 ready 解释成可编辑且不在等待审阅，并从 revision:null 推断无待合入修订。记录截图 调用成功但状态误读（本地验证截图：`screenshots/workbuddy-natural-request-state-misread.jpg`），AX `.data/workbuddy-natural-request-ax.txt`。本次只证明自然语言到工具/预览链路可达，界面未提供明确 Skill 加载轨迹，不能证明已安装 Skill 被自动加载。

为减少实际观察到的歧义，univer_preview 描述与结果新增 previewAccess、worktreeEditable、awaitingHumanReview 和 revisionMeaning；ready 明确冻结等待人工审阅，null revision 仅表示没有图像捕获版本信息，不代表无修改。共享 Skill 同步补充解释。新增 MCP 回归：ready预览不可编辑、等待审阅、revision仍为null，同时实际write被拒绝；reopen后可编辑，但卡片仍只读。3项MCP测试通过。日志 `.data/preview-state-build.log`、`.data/preview-state-regression.log`。

源码及分发包更新，Skills ZIP重新生成且共享Skill校验通过；原9081开发服务未重启，已安装Skills尚未重新导入新版语义说明，真实宿主的修复后表现仍待复验。输入框错误也尚未修复，完整验收保持未完成。

## 开发服务升级与真实宿主状态纠正（2026-09-10）

确认9081原监听PID98786后，通过HTTP MCP保存目标Slide ready草稿的权威status与preview，正常SIGTERM旧服务并确认端口释放；同一 `.data/workbuddy-host` 工作区启动当前dist，新PID30678。仅刷新已有 workbuddy-univer-office-dev 连接器的本地凭据，没有增添连接器或扩大工作区权限。已安装 Office Skill 文件也从新版已校验ZIP更新，未触及其他Skills。

`scripts/verify-dev-http-update.mjs before/after` 对status做深相等，更新前后完全一致；新preview明确 read-only、worktreeEditable:false、awaitingHumanReview:true，capture:false时revision仍null。证据 `.data/dev-http-update-verification.json`、`.data/dev-http-before.json`、`.data/dev-http-after.json`。新开发服务持续保留供WorkBuddy使用，运行日志 `.data/dev-http-updated-service.log`，凭据不输出到报告。

点击宿主输入框自身“重试”恢复此前removeChild错误后，用typeText输入英文只读自然语言请求，正常发送。任务压缩上下文后2m2s完成，回答明确“等待人工审阅、只读、worktree不可编辑”，并报告capture:true捕获revision4、两页。截图 真实宿主正确解释ready（本地验证截图：`screenshots/workbuddy-ready-state-corrected.jpg`），AX `.data/workbuddy-ready-state-corrected-ax.txt`。随后再次直接HTTP回读，status仍与更新前完全一致。

本轮证明旧误读已在真实宿主新调用中得到纠正；没有根据模型正文自称“卡片已显示”推广为新资源卡片的视觉验证。新App资源的全屏返回、旧卡片失效恢复、Skill自动选择轨迹与正式自动安装/启动仍待验证，完整范围保持未完成。

## 旧卡片恢复后的原生全屏往返复验（2026-09-10）

重新检查真实 WorkBuddy 5.5.4 和端口监听，当前服务仍为 PID30678，没有重启或新增 Node 服务。07:50 旧回合的 Slide 卡片已显示“等待你的审阅”和“已同步 · 只读预览”。点击该卡片“刷新预览”后按钮恢复可用，内容可见；本次观察开始时连接已经恢复，因此不能据此断言本次点击解决了此前断连，也不能证明新的 App HTML 已替换旧回合资源。

从该卡片进入原生全屏，第二页仍选中，fileId/unitId/worktreeId 保持原目标。点击“返回卡片”后回到 WorkBuddy 主窗口；首次 AX 仍短暂显示“返回卡片”，后续读取已恢复“全屏”，没有重复触发全屏。主对话滚动位置跳到了较新的回答，需要向上滚动才能重新看到旧卡片；因此 U04 的位置保持仍未通过，不能将窗口退出成功等同于完整往返验收。

实测截图：全屏（本地验证截图：`screenshots/workbuddy-old-card-recovered-fullscreen.jpg`）、返回后的卡片（本地验证截图：`screenshots/workbuddy-old-card-recovered-inline.jpg`）。原始 AX 保存为 `.data/workbuddy-old-card-fullscreen-ax.txt` 和 `.data/workbuddy-old-card-return-ax.txt`。本次操作前后运行 `node scripts/verify-dev-http-update.mjs after` 均通过，完整 status 与升级前基线深相等，ready/只读/等待人工审阅字段正确。未修改、合入或丢弃文档。正式卡片持久化与服务重启的完整恢复流程仍需独立验证。

## 显示模式尺寸通知修复（2026-09-10）

读取安装的 MCP Apps 1.7.4 类型及实现后，确认自动 ResizeObserver 不区分显示模式。协议测试宿主增加可见尺寸事件记录，使用真实 Sheet fixture 复现：inline 高度793px，fullscreen 时继续发送1274px，返回后再发送793px。这证明全屏尺寸会进入宿主的卡片尺寸回调；尚不能将其认定为 WorkBuddy 对话跳动的唯一原因。

`src/mcp-app/main.ts` 关闭默认 autoResize，改为连接完成后观察尺寸，只在 inline 且非原生全屏时调用公开 `sendSizeChanged()`。返回 inline 后重新报告尺寸，重复尺寸去重；teardown 断开 observer 并取消待执行帧。未访问跨域父窗口或宿主内部状态。原生全屏及 MCP 显示模式共用此条件。

实际 Chrome + 官方 AppBridge 验证了 fullscreen→inline、pip→inline：非内嵌模式均没有尺寸通知，两次返回均报告原来的793px。该浏览器的原生全屏请求被拒后走既有 MCP fallback，因此本轮不构成原生成功路径或真实 WorkBuddy 修复后验收。基线与修复后事件分别为 `.data/display-size-baseline.txt`、`.data/display-size-fixed.txt`；实际协议测试截图（本地验证截图：`screenshots/display-size-fixed.png`） 同时展示事件和真实表格。WorkBuddy 外层对话滚动条不属于卡片可直接控制的 DOM，U04 仍保留待验收。

typecheck、定向 App 构建及3项preview集成测试通过，日志 `.data/inline-size-typecheck.log`、`.data/inline-size-app-build.log`、`.data/inline-size-preview-tests.log`。已更新开发打包产物。两次临时协议服务分别正常结束，浏览器测试页已关闭；原9081 WorkBuddy服务保持运行。

## 尺寸修复后的真实 WorkBuddy 复验（2026-09-10）

重新确认9081监听PID30678，HTTP MCP读取当前资源并断言其中包含当前dist App脚本。资源URI为 `ui://workbuddy-univer-office/preview/4b5ba5602df816d7`，脚本SHA256为 `4ff04d3fd87356a60bf70b82d225688e43979eb310780f73765583988d4c5470`，记录 `.data/inline-size-live-resource.json`。这是服务资源证据，不是直接读取宿主沙箱实际脚本的证据。

在现有WorkBuddy任务发送新的英文只读请求，明确只调用一次指定Slide的 `univer_preview(capture:false)`。新回合出现独立可激活卡片，并正确报告ready、awaitingHumanReview:true、worktreeEditable:false及null捕获版本的含义。激活后进入原生全屏，再返回卡片：模式按钮正确恢复“全屏”，第二页仍选中，目标和草稿状态不变。随后权威status与升级前基线深相等检查通过。

位置保持仍未通过：全屏前卡片标题和工具栏位于视口顶部，返回后宿主对话滚至回答末尾，卡片仅下半部分可见。截图：全屏前（本地验证截图：`screenshots/workbuddy-size-fix-before.jpg`）、全屏（本地验证截图：`screenshots/workbuddy-size-fix-fullscreen.jpg`）、返回后（本地验证截图：`screenshots/workbuddy-size-fix-return.jpg`），AX `.data/workbuddy-size-fix-return-ax.txt`。因此尺寸通知修复不能作为U04全量通过证据，也不能将此前跳动归因为尺寸通知的唯一影响。未通过注入宿主页面脚本规避沙箱边界，未修改任何文档内容。

## Sheet 筛选、排序和表格对象接入（2026-09-10）

检查Viewer组装发现缺少Sheets Filter/Sort/Table及对应UI。依据官方[筛选](https://docs.univer.ai/guides/sheets/features/filter)、[排序](https://docs.univer.ai/guides/sheets/features/sort)、[表格](https://docs.univer.ai/guides/sheets/features/table)文档及安装版本的六个包README、Facade类型补齐注册、locale、CSS和Facade。直接依赖仍为精确 `1.0.0-insiders.20260907-70fc579`。离线解析缺少registry元数据，改为正常pnpm安装后成功，未改变SDK版本。typecheck和定向Viewer构建通过。

新建独立fixture `.data/sheet-data-Q6LnRU`，脚本 `scripts/verify-sheet-data-ui.mjs` 通过应用API执行：A4:D7按销售额降序为1800/1200/900/500，A3:D7仅筛选华东，回读隐藏行索引[5,6]；F3:H6创建 `budget-table` 表格对象，重新加载Runtime仍读取到一个表格。编辑commit confirmed，XLSX和SDK截图生成成功。数据证据 `.data/sheet-data-evidence.json`，目标 `.data/sheet-data-target.json`。

真实Chrome Viewer显示华东1800/1200两行及粉色表格，重载后保持；实测截图（本地验证截图：`screenshots/sheet-filter-sort-table.png`）。Sheet筛选按整行隐藏，因此右侧表格同处第6行的“文档/陈/600”也暂时不可见，不能将其误认为数据丢失。点击数据菜单的表格入口，合并的A1:D1作为目标时正确提示“表格范围不能与合并单元格重叠”；已取消，无新增表格。排序和筛选面板的用户修改交互尚未验收。

导出XLSX结构检查包含autoFilter、tableParts及一个xl/tables/table1.xml，记录 `.data/sheet-data-xlsx-structure.json`；此结构检查不能替代桌面Office应用显示/交互验收，后者仍待完成。也未据此宣称跨任务、readonly筛选交互、复杂表格公式或所有C01能力通过。临时9082进程PID32209已正常关闭，测试页关闭，开发包已重打。

## Sheet 数据样例的原生导出差异（2026-09-10）

通过LibreOffice桌面文件选择器打开 `.data/sheet-data-Q6LnRU/sheet-data.xlsx`，未修改或保存文件。Calc能正常打开，数值、中文、四行销售额降序1800/1200/900/500和右侧三条预算记录正确；但打开后所有四行可见，未保持Viewer“仅显示华东”的初始可见状态，粉色表格底色也没有保留。桌面实测截图（本地验证截图：`screenshots/sheet-data-native-export-gap.jpg`），AX `.data/sheet-data-native-export-ax.txt`。

检查原始XLSX发现：autoFilter范围A3:D7及华东条件确实存在，然而没有任何row hidden标记。table1引用table-default-4，styles.xml虽有同名自定义tableStyle，却只含firstRowStripe→dxfId0，而dxfs[0]为空dxf，未携带Viewer中的实际填充。故“有autoFilter/tableParts”不足以证明保真；当前证据直接表明导出装配遗漏了用于初始显示的隐藏行和样式数据，不能仅归结为Calc主题兼容性。

文件SHA256 `1f28dbd3398bd2151345bab7876f14579caae8d28387dcadb1be162af6152f64`，结构及原生检查记录 `.data/sheet-data-native-export-evidence.json`，fullFidelityPassed:false。本轮没有声称修复，后续需在同一确认版本内取得SDK筛选派生结果及实际表格样式，以导出专用数据装配处理，且不得改变原草稿内容/版本或把自动筛选变成永久手动隐藏。C01/XLSX保真验收保持未通过。

## XLSX 筛选初始可见性修复（2026-09-10）

新增内部sheet-export任务，仅Sheet导出.xlsx使用。在同一已加载Runtime/确认revision中通过公开Facade读取每个工作表getFilter().getFilteredOutRows()，克隆exportUnitData结果后将这些行的rowData.hd设为TRUE，保留已有手动隐藏及autoFilter资源。无源内容写入或commit；版本变化时报错要求重读。截图/PDF、CSV/TSV和普通snapshot路径不改变。本次尚未处理表格内部独立筛选及其样式装配。

新增 `tests/integration/sheet-filter-export.test.mjs` 通过真实应用导出及Exchange重新导入，验证West行初始隐藏、原记录仍存在、手动隐藏保留、筛选条件保留、源snapshot/revision不变；清除源筛选再导出后West行不再隐藏，手动隐藏仍保留。1项测试通过，耗时约5.75秒，日志 `.data/sheet-filter-export-tests.log`；服务构建通过。

为已有表格样例生成 `sheet-data-filter-fixed.xlsx`。复杂样例的全snapshot深相等断言失败：两次headless重新加载生成不同的样式ID和rangeTheme规则ID，两侧revision均2。不能将此断言报告为通过；此前无表格的独立回归通过范围不扩大。首次临时验证脚本还因--input-type参数被子进程继承而失败，改为普通Node启动后完成导出，未重新执行创作程序。

LibreOffice桌面实际打开修复文件，已只显示华东1800/1200两条记录，行号从5跳到8，和Viewer一致；实际截图（本地验证截图：`screenshots/sheet-filter-export-fixed-native.jpg`）。试图打开筛选下拉时原生AX返回notImplemented，因此尚未完成“在桌面清除筛选”的交互验收。表格底色仍缺失，完整XLSX保真和C01仍未通过。临时应用服务已在finally正常关闭；现有WorkBuddy 9081服务未升级到本轮新server代码。

## 导出默认表格主题的装配（2026-09-10）

安装版本源码确认SheetRangeThemeModel.toJson只包含自定义主题，默认table-default-*主题由SheetsTableThemeController注册在运行时默认映射。新增只读FWorkbook应用Facade扩展 `getOfficeExportThemes`，采用SDK支持的extend和protected注入器访问公开SheetRangeThemeModel.getRangeThemeStyle().toJson()。只读取导出资源规则实际引用的主题，并补入导出副本的rangeThemeStyleMapJson；不复制默认配色，不注册或写回源主题。新增直接sheets依赖仍保持精确cohort。

`scripts/verify-sheet-theme-export.mjs` 生成 `sheet-data-theme-fixed-verified.xlsx`，导出前后revision均2、数值、筛选、表格语义和rowData相等。第一次完整表格信息比较因SDK重新加载生成不同columns[].id而失败；已将列ID稳定性独立列为未验证，后续语义比较显式不包含该字段，不能以语义相等声称列身份稳定。记录 `.data/sheet-theme-fixed-export.json`。

XLSX styles.xml从一个空dxf变为5个dxf，含headerRow、totalRow、lastColumn和双条纹定义；headerRow背景FFF17EBB，secondRowStripe背景FFFDF2F8。服务构建、typecheck及筛选导出回归通过。然而LibreOffice实际打开仍不显示这些表格底色，故只证明缺失主题定义已补入，未证明视觉保真问题已解决。原生复验截图（本地验证截图：`screenshots/sheet-theme-export-native-recheck.jpg`）。后续需继续核对Exchange样式表示和兼容应用处理，不以XML存在替代视觉验收。临时服务正常退出，开发包已重打，9081服务仍运行此前server版本。

## 原生 Excel 主题与筛选往返验证（2026-09-10）

通过 Microsoft Excel 原生文件选择器打开未经诊断改写的 `sheet-data-theme-fixed-verified.xlsx`。正常进入工作表，没有出现修复提示；实际显示仅华东1800/1200两条记录、行号5后跳到8，右侧粉色表头和淡粉隔行底色均可见。Excel 原件截图（本地验证截图：`screenshots/sheet-theme-export-native-excel.jpg`），AX `.data/sheet-theme-excel-ax.txt`。这项结果证明当前样例在 Excel 中的主题和初始筛选可见性已恢复，不能推广为所有表格样式保真。

在 Excel 数据选项卡点击“清除”，四条销售记录1800/1200/900/500全部显示，右侧此前随整行隐藏的“文档/陈/600”记录也恢复，排序保持。清除筛选截图（本地验证截图：`screenshots/sheet-export-excel-clear-filter.jpg`），AX `.data/sheet-excel-clear-filter-ax.txt`。随后关闭该工作簿并选择“不保存”，保留导出原件；文件8153字节，关闭后SHA256为 `243be5f08b7df9db9c2a80f62eaba0e7c1b4ae2af76fe2c65c8531b139399a47`。

另创建仅用于排查的 `sheet-data-style-diagnostic.xlsx`，把四处DXF填充改为显式solid/fgColor，LibreOffice仍未显示表格底色。该诊断副本没有进入正式导出逻辑。原件已在Excel显示正确，不能据此把原填充表示定性为错误；LibreOffice兼容差异及其根因仍待处理。未新增Node服务，未修改源草稿，本轮没有扩大完整C01或总体验收通过范围。

## 浏览器中的筛选清除与自定义排序（2026-09-10）

对既有 `.data/sheet-data-Q6LnRU` 样例启动一项临时服务，在真实浏览器加载编辑器。数据工具栏实际包含筛选、排序图标；其下拉触发器为带data-u-command的div，无障碍快照只列出两个button，不能由该列表认定菜单缺失。本轮通过可见DOM定位并点击，没有调用页面内部命令替代用户操作。

点击筛选下拉“清除筛选条件”，应用API只读回读确认hidden为空、criteria为null，四条原数据及顺序完全不变。筛选清除截图（本地验证截图：`screenshots/sheet-ui-filter-cleared.png`），证据 `.data/sheet-ui-before.json`、`.data/sheet-ui-filter-cleared.json`。

名称框选择A3:D7，排序菜单选择“自定义排序”，范围提醒保留所选范围，点击“标题不参与排序”文字后复选框正确勾选，排序范围显示A4:D7。选择销售额列、升序，确认后回读为500/900/1200/1800，表头保持，整行地区、产品、状态对应正确。最初setChecked自动操作超时而未改变复选状态，读取状态后改用可见文字点击成功，不计为产品交互失败。排序设置（本地验证截图：`screenshots/sheet-ui-custom-sort-dialog.png`）、页面重载后的结果（本地验证截图：`screenshots/sheet-ui-sort-reloaded.png`），数据 `.data/sheet-ui-sorted.json`。

完成取证后，通过应用API恢复原销售额降序及华东筛选，commit confirmed。独立回读的数值、顺序、隐藏行、条件与操作前深相等，记录 `.data/sheet-ui-restoration.json`、`.data/sheet-ui-restored-read.json`；恢复操作增加草稿版本，不声称revision不变。截图第9行是样例原说明文字，排序验收临时改变数据时未同步改写该说明。该验证属于浏览器编辑器，并非WorkBuddy只读内嵌卡片修改交互；筛选列值面板、多条件排序、表格独立筛选仍待验收。

## Doc 分页与图表组装及复杂样例缺陷（2026-09-10）

安装版本公开Facade合同要求Traditional文档才应用pageBreakBefore、keepNext等实体分页规则。新建Doc改为显式DocumentFlavor.TRADITIONAL；不改写已有文档。Viewer原本只用Docs Core preset，现补入Docs Drawing/Chart模型和UI、Facade、CSS、中文locale，协作场景沿用IImageIoService由Collaboration提供的配置。新增四项直接依赖维持原精确cohort。typecheck、server及Viewer定向构建通过，`tests/integration/office.test.mjs`七项通过（约20.7秒），日志 `.data/doc-complex-*.log`。没有以这些基础回归代替复杂Doc验收，也尚未重打分发包或升级9081服务。

`scripts/verify-doc-complex.mjs create|deliver|serve`创建独立 `.data/doc-complex-Pbmsg3`，目标持久记录在 `.data/doc-complex-evidence.json`。样例含中文富文本、月度销售120/180/240图表、三列计划表、页眉页脚，以及第二章强制分页。写入commit confirmed、revision2；SDK生成两页1588×2246 PNG和两页PDF，DOCX输出11645字节。这些产物存在不代表通过视觉与Office兼容验收。

实际检查暴露缺陷：SDK第一页（本地验证截图：`screenshots/doc-complex-sdk-page1-gap.png`）和第二页（本地验证截图：`screenshots/doc-complex-sdk-page2-gap.png`）均有重复页眉；第一段正文末尾“元。”落在内嵌图表下方，图表自动值轴从120起导致7月柱不可见，后续需要修正样例锚点与坐标轴设置。Viewer中图表能够显示，但console报告`Cannot set property clipBounds ... which has only a getter`，栈指向图表snapshot绘制。见浏览器截图（本地验证截图：`screenshots/doc-complex-viewer-gap.png`）、`.data/doc-complex-viewer-errors.json`。这两个渲染/排版问题均保留未通过。

页眉重复已定位为持久化前后不一致，并非纯绘图重影：最小程序ensurePageHeader/ensurePageFooter后各插入一次，execute返回HEADER和FOOTER各一份，重新加载却为HEADERHEADER及FOOTER。预先创建段落资源并单独提交仍复现；进一步把页眉与页脚写入拆成两次提交也复现。原始记录 `.data/doc-header-probe.json`、`.data/doc-header-separate-probe.json`。新增独立 `scripts/verify-doc-header-integrity.mjs` 比较execute值与重载值，预期在当前缺陷下失败；不可把失败隐去、截断重复文字后宣称SDK一致性已修复。SDK内部具体根因仍待查证。

本轮未提交ready、合入或发布复杂Doc。临时Viewer页面关闭，服务PID34842通过SIGTERM正常退出；原WorkBuddy服务保持运行。C02和验收第7条保持未通过，原生Word/DOCX、PDF逐页独立复验仍需完成。


## History restoration requires scoped editing (2026-09-10)

The restore prepare/confirm/cancel operations now check the same active, file-and-Unit-scoped
trunk edit grant used for human editing. A viewer cookie or Agent credential alone cannot
restore. Revoked tokens and tokens from before a server restart are rejected; a renewed grant
can resume the same durable operation without losing existing stale-head, expiry or crash-receipt
protection. History listing remains read-only for the viewer, and editor listing is scoped.

The toolbar exposes restoration only while editing. Opening it flushes pending collaboration
changes; confirming flushes again before disconnecting and loading the restored head. The modal
passes its captured edit token on every request. A browser check on the dedicated merge/edit fixture
verified 0 restore buttons before editing, the history selector during editing, and 0 restore buttons
after completing editing. No content was restored in that browser check.

`history-restore.test.mjs` and `merge-edit.test.mjs` passed all 3 tests, including actual restoration,
revocation, target mismatch, restart and partial-merge restrictions. Server/Viewer builds and
typecheck passed. Logs: `.data/restore-auth-tests.log`, `.data/restore-auth-types.log`,
`.data/restore-auth-build.log`, `.data/restore-auth-viewer.log`. This closes the restoration grant
gap; it does not complete the other release-readiness requirements.


## Explicit comparison source and refresh (2026-09-10)

Compare now has a source selector for saved content or another active same-file worktree containing
this Unit, and a 32px refresh icon. A read-only freshness endpoint checks the SDK source heads against
the persisted comparison revisions. Polling reports “有更新，刷新后查看” without changing either snapshot;
refresh or source selection explicitly creates a new fixed comparison. Closed/identical draft sources
are rejected. Failed refresh keeps the previous view.

`comparison-freshness.test.mjs` uses real committed Sheet edits to verify both-source updates,
pinned-record equality, explicit refresh, closed/identical draft rejection and restart persistence.
It passed. Full serial integration regression then passed **29/29**, no skips or failures (90.66s),
recorded in `.data/release-progress-regression.log`. Targeted Server/Viewer builds and typecheck
passed (`.data/compare-freshness-*.log`).

Browser evidence uses a dedicated `compare-controls-*.univer` fixture with trunk=100, left draft=120,
right draft=150. Selecting the other draft displayed 120→150. An Agent update to 160 produced the update
notice while both headings and the 120→150 row stayed pinned. Clicking refresh changed the row to
120→160 and the right fixed revision from 2 to 3. At 390px the two panes were each 390×276.75px, sidebar
hidden and document scroll width 390px. The viewport override was reset afterward.
Screenshots: `compare-source-selection.jpg`, `compare-update-notice.jpg`, `compare-controls-390.jpg`.
This does not claim the remaining Compare filters, formula display or grouping are implemented.

## Compare presentation and Tailwind shell controls (2026-09-10)

Added SDK-item content/style projection, scope grouping and search. Sheet Content uses a disposable
plain display snapshot; Formatting retains the original snapshot styles. Row/column dimensions,
formula definitions, shared-formula IDs, cached values, table identity/options and unrelated resources
remain intact. A snapshot-only Plugin uses the public FormulaDataModel and cell-content interceptor
for Show formulas, including SDK shared-formula resolution. No SDK source or authoritative file
mutation is used for these display controls. Changing display mode replaces the iframe windows so
messages from disposed panes cannot mark the new panes ready. Scope selection can navigate both
sides; current worksheet/page/table tracking uses public read-only Facades.

Two new integration tests exercise real SDK mixed value/style changes, stable locations and identity,
scope/search filtering, original-result equality, rich text flattening, table themes and retained data.
After the Server build completed they passed. The initial attempt started before build completion
and failed to import the not-yet-emitted module; this was a test invocation ordering error, not a pass.
Full serial integration regression: **31 passed, 0 failed, 0 skipped**, 102.81s, recorded in
`.data/compare-presentation-regression.log`. Typecheck and the targeted Viewer build passed.

The dedicated compare-controls fixture was extended with styled cells and shared formulas. SDK
readback returns F2/F3 formulas `=D2-E2` / `=D3-E3`, with left values 60/100 and right values 80/100.
Four new Units in the same dedicated draft provide the five-product Worktree icon fixture. Original
five-product highlight fixtures were not changed. Evidence: `.data/compare-presentation-fixture.json`.

Browser checks confirmed plain Content, styled Formatting, both shared formulas displayed in both
panes, scope selection and keyboard-focus tooltip. Worktree pending entries, expanded Unit rows and
merged destinations use the official five colored product icons, with horizontal icon/name layout.
Screenshots: `compare-content-tailwind.png`, `compare-formatting-tooltip.png`,
`compare-formulas-worktree-icons.png`. At 390px both compare panes measured 390×257.75, the changes
sidebar was hidden and document width was 390. That first narrow check also exposed a squeezed
source selector; the follow-up layout gives it a separate row with freshness and refresh controls.

Tailwind 4.3.3 and its official Vite plugin are installed. The shell imports theme/utilities, leaving
SDK-owned editor styles intact. New Worktree, Compare and tooltip styles use Tailwind utilities;
the remaining legacy shell styles have not yet been fully migrated. Icon tooltips support keyboard
focus, Escape and viewport positioning. A few preexisting network errors remain in the tab log,
including during editor teardown at 10:11:27; no claim of a clean console acceptance run is made.

Still required: complete Tailwind migration and overall CLI visual parity, scope-following validation
on populated Slide/Base fixtures, paging beyond 1000 changes, preference retention across explicit
comparison refresh, complex content, host integration and all remaining release gates. The goal remains active.

Final narrow follow-up: the two logical control groups now wrap as two rows. At 390×844 the source
selector is 226px wide and scope selector 186px; both canvases remain 390×257.75 with no document
horizontal overflow. Screenshot `compare-tailwind-390.png` supersedes the squeezed-selector checks.
Viewport override was reset. Selecting the right canvas's native “目标” worksheet tab while scope is
“当前工作表” changed the tree to only that worksheet's five inserted entities, including target 300;
selecting “数据” restored its changes. This verifies Sheet scope-following only.

Post-browser readback compared both drafts to their fixture baseline: formula definitions, cached
results and confirmed revisions are unchanged (`.data/compare-presentation-readback.json`). Final
typecheck and Viewer build passed after the control-group layout change.

## Consolidated Tailwind Viewer, theme and refresh preferences (2026-09-10)

Replaced the two legacy Viewer shell stylesheets with one Tailwind theme/utility stylesheet, covering
navigation, header, View/Compare, status/actions, empty/unavailable states, comparison tree, tooltips,
and application dialogs. Application dialogs now carry `office-dialog`; SDK dialogs are outside those
selectors. Draft state is separate from the ellipsized file name. File navigation also works when
entering through the initial home URL. The MCP host card stylesheet is not yet migrated.

Compare now retains Content/Formatting, formula visibility, scope and search during explicit refresh
or source changes. Browser evidence: Formatting + Show formulas + current worksheet + D2 search
remained after a fresh comparison was created at 10:31:54. Theme changes now propagate to both fixed
snapshot runtimes using `toggleDarkMode`; initial dark mode is passed when a pane is created. The
ordinary Viewer editor already had this theme wiring before this change. Sheet dark canvases were
visually verified, including shared formulas; this is not five-product theme acceptance.

The mobile file drawer has a backdrop, inert main surface, focus containment and Escape return focus.
The first focus test exposed hidden buttons under a collapsed merged-history details element in the
focus list. After excluding these buttons, Shift+Tab from Close focuses the visible history summary;
Tab returns to Close. Escape hides the backdrop, removes main inertness and focuses the file toggle.
Opening a new-file dialog from the drawer and cancelling with Escape leaves the drawer open; no file
was created. The confirm-ready dialog was also opened and cancelled, never submitted. Dialog buttons
measured 32px high. Screenshots: `tailwind-drawer-dark-390.png`, `tailwind-confirm-dark-390.png`.

Responsive results on the final Viewer build:
- 390×844: two 390×260.5 Compare panes; source selector 226px; document scroll width 390.
- 768×900: two 768×288.5 vertical panes; change tree hidden; document scroll width 768.
- 1440×900: two 481×686 horizontal panes at x=476/958, same y=190; tree visible; document width 1440.
  Compare was re-entered after a viewport change reset the observed view; these measurements verify
  each layout, not uninterrupted mode preservation during browser-tool viewport changes.
Screenshot: `tailwind-compare-dark-390.png`. The 1440px capture contained extra blank area from browser capture/viewport state and is retained only as `.data/tailwind-compare-light-1440-capture-anomaly.png`; it is not a delivery screenshot. The DOM dimensions above were observed directly. Viewport was reset.

Final typecheck and targeted Viewer build passed (`.data/tailwind-shell-types.log`,
`.data/tailwind-shell-build.log`). Post-browser readback again confirmed original formula definitions,
results and revisions unchanged. The last full integration result remains 31/31 from the preceding
milestone; no new full backend regression was needed for this Viewer-only work. No SDK patch or
release package was produced. Remaining gates and the broader goal remain active.

## Tailwind MCP card and real WorkBuddy verification (2026-09-10)

The MCP App card now uses Tailwind theme/utilities, shared keyboard/pointer tooltips and the official
five product icons. Controls are 32px with 16px utility icons; product icons are 20px in a 32px holder.
The MCP resource embeds compiled CSS and JavaScript, and its version hash includes the stylesheet.
Host theme messages reach the read-only preview through a parent-window-only presentation handler;
this does not grant editing rights. Tooltip listeners and React roots are disposed on App teardown.

The first live protocol run exposed `ReferenceError: process is not defined`: Vite library mode had
left React's NODE_ENV branch unresolved. The App build now explicitly selects the production runtime.
The resulting JavaScript decreased from 863.79 kB to 476.46 kB. A separate initial test failure matched
React's stylesheet string inside JavaScript; the resource-dependency assertion now examines HTML
outside script contents. Neither initial failure is counted as a pass.

Final targeted Server/App/Viewer builds and typecheck passed. MCP stdio and HTTP tests pass **4/4**,
including the self-contained stylesheet/CSP check and actual read-only preview authorization.
Logs: `.data/mcp-tailwind-app.log`, `.data/mcp-tailwind-viewer.log`, `.data/mcp-tailwind-types.log`,
`.data/mcp-tailwind-tests.log`. The last full integration run remains the preceding milestone's 31/31.

The official AppBridge protocol harness reused the existing HTTP runtime, avoiding another Office
workspace owner. At a 432px outer viewport its 384px card had scroll width 384 and all visible actions
were 32px high. Keyboard focus showed the refresh tooltip. Host dark theme propagated to both the
card and the Sheet canvas; explicit refresh retained the target and theme. PIP → inline and host
fullscreen → inline worked. The harness's sandbox does not enable native browser fullscreen in this
run; these are MCP display-mode checks. Screenshots: `mcp-card-tailwind-384.png` and
`mcp-card-tailwind-dark-fullscreen.png`. These are protocol screenshots, not WorkBuddy screenshots.

Five real tool results from the dedicated compare-controls file were selected in the same card:
Sheet 季度销售, Doc 项目说明, Slide 季度汇报, Base 客户清单, Board 协作白板. Each replaced the product
icon and accessible heading with its corresponding kind. Evidence: `.data/mcp-tailwind-products.json`.
The four additional Units are empty; this verifies card presentation, not complex five-product content.
Browser logs still contain SDK network errors during explicit iframe refresh/teardown; this run does
not establish clean-console acceptance.

In real WorkBuddy 5.5.4, an initial post-restart call returned the new Sheet target while the right pane
still showed an older Slide resource with an expired preview. Reconnecting the existing HTTP connector
and making one fresh read-only preview call loaded the new card. The real right panel now shows the
Sheet logo, compact icon actions and a live read-only Sheet with no Ribbon. Clicking refresh recovered
the same target and returned to “已同步 · 只读预览”. Keyboard focus on “返回卡片” exposed its tooltip in
accessibility output. `workbuddy-card-tailwind-panel.png` is the verified actual host screenshot.
The attempted tooltip screenshot did not capture the tooltip, so it is kept only as
`.data/workbuddy-card-tailwind-refresh.png`, not presented as visual tooltip evidence.

The WorkBuddy installed-Skills list visibly contains univer, univer-base, univer-board,
univer-cross-unit-formula, univer-doc, univer-embed, univer-sheet and univer-slide. This is evidence
of discovery in this existing installation, not a clean candidate-install test. Connector reconnection
was still manual; automatic startup/update and full in-host review/edit remain open.

Post-browser SDK readback again verified unchanged formula definitions, cached values and confirmed
revisions in the original compare-controls draft pair. No content was edited or merged for these UI
checks. No SDK source was patched and no release candidate was packaged. Remaining release gates
and the active goal remain open.

## Complete comparison paging and large Sheet navigation — 2026-09-10

Comparison presentation now drains both public SDK item pages and Doc paragraph-alignment pages
from the persisted fixed snapshots. The authenticated paging endpoint survives restart and does not
refresh live heads implicitly. Loading reports progress and can be cancelled when leaving Compare.
Incomplete, duplicate or mismatched pages fail instead of displaying a misleading complete total.

Pagination/freshness/presentation tests passed 7/7. The real browser fixture contains 2205 modified
Sheet cells and exposed two additional defects: a large worker IPC response was cut off by immediate
disconnect, and thousands of individual highlight controls stalled the renderer. The worker now
waits for Node's send callback before disconnecting; a 2 MB response regression failed before and
passed after this fix. Same-color adjacent rectangular highlight ranges are compacted without filling
holes or changing the independently searchable semantic items. Range coverage tests passed 1/1.

The first successful rendered page still showed row 1 after clicking A2205 although the status said
it was located. Selection alone did not scroll. The integration now calls the public Sheet UI
`scrollToCell` API as well as selecting the target. Final screenshots visually verify A2205 and its
yellow highlight on both sides, with `before-2204` versus `after-2204`. Search returns 1/2205 and
survives explicit refresh. At 390×844 the changes sidebar is hidden, each comparison iframe is
390×260.5, and document scroll width is 390. Temporary viewport override was reset.

Evidence: `screenshots/compare-paging-2205-desktop.png` and
`screenshots/compare-paging-2205-narrow.png`. These show the external Viewer, not the WorkBuddy host.
The license-required watermark is still visible and remains a deployment acceptance gap.

The latest full serial integration run passed 36/36 in 89.15 seconds after the IPC fix
(`.data/comparison-pages-regression.log`); the later compact-range test passed separately.
Final typecheck and targeted Viewer build passed after the scrolling change
(`.data/comparison-pages-types.log`, `.data/comparison-pages-viewer.log`). No SDK internals were
modified, no archive was generated, and the complete release goal remains active. One large Sheet
fixture does not prove complex five-product navigation or P95 performance.

Post-browser readback checked all 2205 values on trunk and draft and explicitly read the draft
snapshot revision, which remains 2 (`.data/comparison-pages-readback.json`). The initial readback
script incorrectly expected `execute` to include a revision and failed; the final script uses the
snapshot response for that assertion. The separate original comparison fixture still retains its
formula definitions and cached values.

## Populated Slide/Base scope navigation — 2026-09-10

A dedicated file now contains two populated slides and two populated Base tables, with changes in
both scopes and fixed saved/draft sources. The initial browser run reproduced a mismatch: navigating
the left Slide thumbnail to page 1 changed the list while the right pane remained on page 2.
The parent comparison now synchronizes native scope changes, initializes Slide/Base comparison to
the first comparison scope and remembers the scope of a clicked change. Explicit scope selection
updates the same state. Snapshot panes suppress scope echoes caused by programmatic navigation.

Browser evidence verifies Base native switching from either pane and cell navigation; both panes
show the selected table and its before/after values with yellow highlights. Slide native switching
now displays the same page on both sides. Screenshots: `compare-base-scope-sync.png` and
`compare-slide-scope-sync.png` in `screenshots/`. These are external Viewer screenshots, not host
screenshots. Readback checks both products' source contents and revisions, with no content changes
from navigation (`.data/compare-scope-readback.json`). These fixtures cover existing scopes, not
deleted/inserted scopes or every Base view type.

This run also exposed remaining Slide presentation problems: the read-only canvas still shows
the thumbnail “新增” button and empty-layout editing prompts. The public `editor.enabled:false`
configuration caused an SDK dependency-injection error followed by preview timeout. Separate public
`showPlaceholder:false` and reading-scene configuration did not remove the prompts in the tested
integration. These experimental settings were reverted. Permission read-only remains enforced;
the unwanted editor affordances are not marked fixed. No SDK implementation was patched.

Final typecheck and targeted Viewer build passed (`.data/compare-scope-types.log`,
`.data/compare-scope-viewer.log`; build 40.78 seconds). On the final bundle, the browser checked
all changes → select page-2 change → current page, native right-side return to page 1, and explicit
refresh retaining page 1 in both panes. No full integration-suite rerun or candidate archive is
claimed for these UI changes. The goal and the remaining release gates stay open.

## Readable five-product comparison descriptions — 2026-09-10

The change list now uses a shared presentation formatter over the SDK's existing change objects.
It translates content/formula, formatting, geometry and document-layout attributes; deduplicates
duplicate text projections; and omits generated paragraph/section/object identifiers from mixed
content summaries. Identifier-only changes remain visible. Original items, counts, locations and
SDK changes are not modified. Displayed descriptions also participate in search.

Doc entity names now read as 文字格式, 分节, 表格范围, 页面格式 and 文档设置. Entries without a
human-readable name receive their stable original change-list number; cell addresses remain visible
even when the SDK omits `displayName`. A real Sheet run found that missing-name regression during
implementation, and the fallback was corrected and covered by a test. Sheet data types use the
public SDK `CellValueType` enum; BooleanNumber display conversion is limited to known boolean fields.

Board summaries prioritize text, connection endpoints and geometry. Connector endpoint IDs are
described as 起点连接/终点连接. Long values remain distinct in the formatter, while the compact row
shows up to three descriptions with an additional-count indicator; the native title contains all
formatted descriptions. This is not a complete replacement for a dedicated expanded details view.

Browser evidence: Slide text reduced from nested paths and duplicate projections to one readable
before/after line; searching 文本 retained the same item and two-sided navigation. Base shows
内容：待处理 → 已联系. Doc searching 文字格式 returns 13 of the unchanged 39 items. Board searching
起点连接 returns its two connector changes; navigation reports absent on the empty left source and
located on the right source. These are external Viewer checks, not WorkBuddy-host evidence.

Screenshots in `screenshots/`: `comparison-description-before.png`, `comparison-description-after.png`,
`comparison-description-base.png`, `comparison-description-doc.png`, `comparison-description-board.png`.
The before/after pair uses the same 268×420 crop of the actual Slide change list.

Targeted description/presentation tests pass 8/8; server build and typecheck passed. Logs:
`.data/comparison-description-server.log`, `.data/comparison-description-types.log`,
`.data/comparison-description-tests.log`, `.data/comparison-description-viewer.log`.
Readback verified all five original snapshots unchanged and the populated Slide/Base fixed sources
and revisions unchanged (`.data/comparison-description-readback.log`). No SDK implementation changed,
no package was produced, and neither full five-product acceptance nor release readiness is claimed.

Final Viewer build passed in 35.33 seconds. The final Sheet browser check searched 公式 and returned
D2, D3 and D4 with formulas, cached values and 数据类型：数字; cell addresses are retained and D2
remains navigable. Screenshot: `screenshots/comparison-description-sheet.png`. A final Sheet snapshot
read matched the original baseline with zero mutations (`.data/comparison-description-sheet-readback.json`).

## Release decision re-audit — 2026-09-10

Rechecked current source, the agreed DSH checkout and existing validation records. Host locale now
reaches the MCP card and live preview through public SDK APIs; full review/Compare/history/dialog
localization remains incomplete. This audit did not perform a fresh browser or actual-host UI run.

Fresh typecheck and server build passed, followed by all integration tests with concurrency 1:
45 passed, 0 failed, 0 skipped, 110.04 seconds. Logs: `.data/release-audit-types.log`,
`.data/release-audit-server.log`, `.data/release-audit-tests.log`. No Viewer or MCP card rebuild was
performed in this audit; the existing archive was not the regression subject.

Read-only inspection of the existing archive confirmed that its package manifest, Viewer HTML and
MCP card HTML differ from current files; its manifest lacks a direct icons dependency. No replacement
candidate was produced. Formal release remains blocked by the host installation/review path, known
Slide and complex Doc gaps, incomplete language/preferences and outstanding candidate/platform,
complex-content/export, lifecycle, license and performance acceptance. See `release-readiness.md`.

## Supplied Univer Office brand logo — 2026-09-10

Copied the user's PNG unchanged to `assets/univer-office.png` (SHA-256:
`74433b49d071064d47537c10f2def1901a497c6016d66da14d140c9110428b23`). It replaces the
Viewer sidebar U badge, empty-state symbol and MCP card's initial brand placeholder. Viewer/card
favicons and the README use the same asset; MCP server implementation metadata declares it as the
Office icon through the public protocol. The package file list includes assets. Five product icons
continue to represent content types; the card swaps its initial brand placeholder to the target's
product icon when a result arrives.

The original black transparent image is displayed with CSS inversion in dark application themes;
the asset itself is not recolored or regenerated. External Viewer browser checks verified loaded
36px sidebar images in both themes, then restored the original light theme. Screenshots:
`screenshots/office-logo-light.png` and `screenshots/office-logo-dark.png`.

Typecheck, server build, MCP card build and targeted Viewer build passed. Existing MCP/HTTP tests
passed 4/4 (`.data/logo-mcp-tests.log`). Build inspection verified that both MCP HTML data images
decode to the exact supplied PNG, with no unresolved placeholders. This run did not reconnect the
actual WorkBuddy host to verify its cached MCP resource or server-icon display. No release archive
was produced and no SDK source changed.
