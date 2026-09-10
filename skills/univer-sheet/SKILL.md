---
name: univer-sheet
description: Create and edit spreadsheets, formulas, charts, validation and pivot tables in WorkBuddy Univer Office; import or export XLSX/CSV/TSV.
---

Read [the shared Univer workflow](../univer/SKILL.md) for file resolution, editable worktrees, confirmed writes and human review. Use the available workbuddy-univer-office MCP tools.

Use the `workbook` binding; select a worksheet explicitly. Discover installed methods with `univer_api` before constructing formulas, chart builders or pivot fields. Preserve existing styles and formulas outside the requested range.

Read numerical results with `getRawValues()` when formatting makes `getValues()` return strings. Compare calculated decimal values with an appropriate tolerance. Read after the confirmed write; do not repeat a committed edit because a result assertion failed.

For charts, verify the source range, categories, series and axis baseline against the intended comparison. For pivot tables, ordinary cell data can omit derived output: read public pivot configuration and verify the rendered aggregates against the source records. A config flag alone is not proof of rendering.

Use an explicit screenshot selector when charts or pivot results lie outside the ordinary used range: `{kind:"sheet-range", sheetName, range:"A1:L25", scale:1}`. Choose a range fitting the actual content. Export XLSX to a new file; verify advanced objects in a compatible reader when delivery fidelity matters. Current fixtures cover one column chart, a sum pivot, numeric conditional formatting and list validation; other cases still need validation.
