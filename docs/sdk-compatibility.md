# Office SDK 接入核对

更新：2026-09-10。本文区分应用组装缺口、已观察现象与尚未证明的SDK原因。

## 当前边界

本项目是SDK使用方。所有修改位于应用源码、配置、依赖声明及验证程序；没有修改安装的SDK实现。包的公开类型、README与官方示例用于核对调用合同；不能由压缩产物中的异常栈推定上游根因。

实际WorkBuddy已有只读实时卡片和全屏。编辑与审阅仍通过外部Viewer，完整宿主内交互尚未完成。独立浏览器/隔离数据目录只作诊断，不作为WorkBuddy验收替代。

## 组装证据

- 官方CLI `04-worktree`（本地基线 `bfbb4c7af3fc4d450ff8cc59e2380275643fcc39`）的Web仅注册Sheet/Doc Core及基础Slide；不能作为所有内容能力完整注册的证明。
- 官方CLI SDK Render Page（基线 `632e88d25f10c9c8e246405faef542ff52aeaaa2`）的 `src/preset/create-preset-univer.ts` 分别注册基础绘图、Doc、Sheet、Slide、Base、Board及Embed功能，基础Drawing早于Docs模型和UI。
- 本应用Worker使用 `createStandardHeadlessUniverFactory`，Render Page使用 `createPresetRenderUniver`；Viewer使用自有 `productPreset`。因此三端默认能力不相同。
- [官方Doc安装说明](https://docs.univer.ai/guides/docs/getting-started/installation)要求检查preset已包含的插件，避免重复注册，并核对插件和样式顺序。在线文档标注beta.2；实际调用仍以安装的精确Insiders cohort类型为准。

## 已确认的应用注册差异

| 产品 | Viewer现状 | 仍需按本项目内容范围补齐和验证 |
|---|---|---|
| Doc | 基础文本；已加Drawing/Chart模型与UI；本轮调整Drawing早于Docs | List/Table等扩展、完整绘图与打印相关配置；不能认为基础表格可见就覆盖所有表格功能 |
| Sheet | 公式、条件格式、校验、绘图、图表、透视、筛选、排序、表格 | Sparkline及其UI；其他能力依内容范围逐项核对 |
| Slide | 基础Slide模型/UI | Chart/Table模型与UI、所需打印能力 |
| Base | Base模型/UI与Pro公式 | 跨Unit引用与资源提供器，复杂字段和视图投影 |
| Board | 基础Board模型/UI | Chart及其UI、打印与连接线完整操作 |
| 跨Unit | Viewer尚未完整组装 | Embed模型/UI、引用提供器、同分支资源解析 |

这是源码注册差异表，不是所有缺失包都是当前异常根因的结论。不可盲目把完整Render Page的所有插件复制进协作Viewer：图片IO、公式运行方式、导入导出服务及协作依赖的配置仍需逐项核对。

## 未归因现象

1. Doc页眉在execute返回与提交后重载之间发生重复。当前复现经过本应用的Worker、Transport、Worktree和SQLite组装，尚未在版本匹配的官方完整应用中完成独立对照，因此归因保持未定。
2. Doc Viewer图表snapshot路径报告只读clipBounds属性赋值异常。图表可见不等于该路径正常；先检查注册与配置，再比较官方组装。
3. XLSX主题在Excel可见、LibreOffice不可见。保留兼容性差异，不据此改写SDK内部序列化。

完整验收及截图证据见 [实施验证记录](./workbuddy-univer-office-validation.md)。本次核对未改变Spec范围或将任何未完成门槛标记为通过。

本轮Doc改用显式插件列表，把Render/UI和Drawing置于Docs模型/UI之前，保留原有公式引擎及协作图片IO配置。typecheck和定向Viewer构建通过；真实浏览器加载原样例显示已同步，但clipBounds异常仍存在，记录 `.data/doc-registration-order-errors.json`。该调整只对齐已核对的基础顺序，不宣称修复异常，也未修改页眉数据或SDK包。
