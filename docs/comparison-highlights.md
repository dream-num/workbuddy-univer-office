# Five-product comparison highlights

Verified on 2026-09-10 against Office SDK `1.0.0-insiders.20260907-70fc579`.

The review page opened from WorkBuddy keeps its file sidebar visible by default. A centered header control switches between 查看 (View) and 对比 (Compare). Comparison renders fixed before/after snapshots; green indicates insertion, red deletion, and yellow modification.

| Product | Visual targets | Screenshot |
| --- | --- | --- |
| Sheet | Cells, ranges, row/column targets | Sheet（本地验证截图：`screenshots/five-highlight-sheet.jpg`） |
| Doc | Paragraph text, including paragraphs inside table cells | Doc（本地验证截图：`screenshots/five-highlight-doc.jpg`） |
| Slide | Pages and drawing elements; initial canvas fits the pane | Slide（本地验证截图：`screenshots/five-highlight-slide.jpg`） |
| Base | Visible data regions matched to table, record, field and cell targets | Base（本地验证截图：`screenshots/five-highlight-base.jpg`） |
| Board | Drawing elements and connectors | Board（本地验证截图：`screenshots/five-highlight-board.jpg`） |

The integration uses public SDK range highlights, history canvas highlights, document range geometry, and Base hit regions. Doc and Base overlays refresh with the rendered layout. Highlighting does not mutate snapshot content or patch SDK packages. Metadata changes without a corresponding visual target remain available in the semantic change list.

Validation: `pnpm typecheck` and the targeted `pnpm build:viewer` passed. All five product fixtures were visually inspected. View → Compare → View → Compare was checked on Sheet. `node scripts/verify-five-product-highlight.mjs after` confirmed that all five saved product snapshots exactly matched the pre-validation baseline. The fixtures mainly cover insertions; these checks are not exhaustive coverage of every semantic change type or Base view layout.
