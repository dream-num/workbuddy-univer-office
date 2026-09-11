# Univer Office 办公专家

一个专家、一个 `univer-office` Skill、一个本地 MCP 服务。支持通过 Office SDK 操作表格、文档、幻灯片、Base 和 Board，并预览、对比和审阅修改。

这是用于开放平台创建和预览验证的开发包，尚未通过平台解析、安装或发布审核。本包包含专家配置、统一技能、Logo 和编译后的 Office 运行文件。**当前需要人工启动本地服务；安装专家不会自动安装 Node、依赖或启动服务。**

## 创建专家

上传完整 ZIP；根目录含 `.codebuddy-plugin/plugin.json`，不要单独上传 Agent Markdown 或技能 ZIP。通过平台解析后核对名称、头像、分类和提示词，再进入预览验证。作者邮箱由打包者明确提供，包内不含真实连接凭据。

## 本地预览准备

先解压到固定目录，准备 Node.js >=22.12.0 和 pnpm 10.33.4。在解压目录中执行：

```sh
cd runtime
cp config/registry.npmrc .npmrc
pnpm install --prod --frozen-lockfile
```

在 WorkBuddy 中选择允许访问的工作目录；在同一个终端中将以下路径替换为实际获授权的文件夹，再启动服务：

```sh
WORKBUDDY_OFFICE_WORKSPACE=/absolute/path/to/authorized-workspace PORT=9080 node dist/mcp/http.js
```

保持服务运行。专家的 `.mcp.json` 默认连接 `http://127.0.0.1:9080/mcp`。启动信息会显示实际地址；如果端口被占用，服务会选择其他端口，需同步修改 `.mcp.json` 的 URL 后重新打包或更新本地自定义连接器。不要停止其他应用来抢占端口。

服务将配置写入 `runtime/.data/http-mcp-runtime.json`，仅在自己电脑上打开它，取 `headers.Authorization` 中 `Bearer ` 后面的令牌，填入专家连接引导的「Office 连接令牌」密码框。不包含 `Bearer ` 前缀，不要把令牌发送到聊天或上传平台。服务重启后令牌会变化，需要更新自定义连接器。该配置文件不能包含在再次上传的 ZIP 中。

同一个工作区只运行一个 Office 服务。已有服务时直接复用其实际地址与令牌；不要再启动一个 stdio 或 HTTP 实例。

## 预览验收

召唤专家并完成 MCP 连接后，先检查状态，再创建一份测试内容并预览。检查 WorkBuddy MCP App 是否出现；完整查看、对比和确认合入当前通过外部审阅页完成。Worktree 的 View 和 Compare 始终只读；完整确认合入后才允许人工编辑主版本。

服务独立运行时的 HTTP MCP App 已有开发验证，但本次专家包的依赖引导、平台安装和 MCP App 发现仍须在专家预览流程中验证。Base PDF、Board 文件导出尚不支持；复杂内容和导出保真度仍需专项验收。

## Source and license

Source: https://github.com/dream-num/workbuddy-univer-office

Application source is Apache-2.0. Bundled SDK dependencies retain their own licensing requirements; no Pro license is included. The runtime excludes node_modules, user files, credentials, test data and local development configuration.
