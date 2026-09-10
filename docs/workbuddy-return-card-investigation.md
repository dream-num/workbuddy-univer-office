# WorkBuddy 返回卡片复查

环境：WorkBuddy 5.5.4，本机 HTTP 开发连接器，既有 Slide ready 草稿；本轮没有修改内容、服务或客户端设置。

## 观察

1. 重新获取 WorkBuddy 应用后，AX 与截图均显示独立全屏预览、第二页、85% 缩放、已同步。
2. AX 点击“返回卡片”后，随后的截图仍显示相同预览。
3. 按该截图坐标 (262, 92) 点击后，AX 一度包含完整任务侧栏、输入区和多个历史 MCP 卡片，证明任务界面曾出现。
4. 下一次取 AX 时侧栏消失，又只显示全屏 Slide 卡片；之前侧栏元素 ID 已失效。不能以第3步的瞬时树证明稳定返回。
5. 原生窗口全屏快捷键未观察到稳定变化。本轮没有依据这些现象推断是 SDK、宿主或自动化焦点中的哪一层导致。

截图：复查时仍显示全屏（本地验证截图：`screenshots/workbuddy-return-card-recheck.jpg`）。完整复查 AX：`.data/workbuddy-return-card-recheck-ax.json`。

## 已读代码与缺少的证据

`src/mcp-app/main.ts` 在 `document.fullscreenEnabled` 时优先使用浏览器 `requestFullscreen`；返回时只要 `document.fullscreenElement` 存在就调用 `exitFullscreen`，否则才调用 MCP `requestDisplayMode({mode: inline})`。`fullscreenchange` 更新模式并恢复图片区滚动。代码中没有主动重新进入全屏的事件处理。

目前尚未获得同一次复现的 Fullscreen API 事件序列与宿主 context 序列，无法确定是否是两层全屏、焦点变化、宿主重新挂载或自动化观察问题。保持当前实现，未添加猜测性的重复退出/重试。下一步应在可控测试宿主记录模式事件，并在真实 WorkBuddy 对同样过程复核；正式宿主安装与 Skills 发现仍未通过。
