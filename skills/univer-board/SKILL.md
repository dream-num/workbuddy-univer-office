---
name: univer-board
description: Create and edit Board canvases, positioned elements and diagrams in WorkBuddy Univer Office.
---

Read [the shared Univer workflow](../univer/SKILL.md) for file resolution, editable worktrees, confirmed writes and human review. Use the available workbuddy-univer-office MCP tools.

Use the `board` binding. Discover public element, text, connector and layout APIs using `univer_api`; inspect existing element IDs and geometry before editing. Retain editable canvas objects where supported instead of replacing an existing board with a screenshot.

Choose a screenshot region covering the requested elements, including connectors and labels. Verify their placement and readability after a confirmed write. Use `univer_print_pdf` when PDF delivery is requested. Basic Board live preview has been verified; advanced elements and cross-Unit embeds require independent persistence and rendering checks.
