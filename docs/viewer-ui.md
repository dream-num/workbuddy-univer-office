# Viewer UI conventions

The application Viewer shell is styled by `src/viewer/shell-tailwind.css`, compiled with
Tailwind 4.3.3 through the official Vite plugin. `styles.css` and `review-layout.css` were removed;
new shell work should not add another override stylesheet. Tailwind theme/utility imports omit
Preflight because Office SDK workbenches own their styles. `product-responsive.css` only constrains
the SDK's public thumbnail container inside a narrow product surface.

- Shell actions use 32px controls, 16px utility icons, rounded-md corners and visible keyboard focus.
  Product icons are the five official colored `@univerjs/icons` MultiIcon components at 18px.
- File and draft names truncate. Draft state badges remain visible outside the truncated name.
  Expanded draft contents and merged destinations retain product icons and full accessible names.
- `setToolbarIcon` assigns a label and tooltip. The shared tooltip supports focus/pointer activation,
  Escape and viewport edges. Do not render utility actions as unlabeled characters or text-only icons.
- Application dialogs use `office-dialog`. This keeps their Tailwind styling separate from SDK dialogs.
  Buttons share the shell's sizing. Confirmation dialogs focus Cancel before destructive/data actions.
- Above 1100px of available main-pane width, Compare shows its change tree and side-by-side panes.
  Below that width, the tree is hidden and both panes remain equally sized vertically. Source/refresh
  and display controls become two rows. The centered View/Compare switch fills its own header row.
- Below 1100px viewport width, file navigation starts closed. Its drawer has a backdrop, an inert main
  surface and a focus cycle through visible items. Escape restores focus to the toggle, except while
  an application dialog is open. Hidden merged-detail children do not participate in the focus cycle.
- The user's theme selection applies to the shell, existing editor and both fixed comparison panes
  through the SDK's public theme Facade. Theme/display changes do not change file data.
- Explicit comparison refresh/source changes retain display mode, formula visibility, scope and
  search. Scope IDs no longer available in a refreshed result fall back to a valid default.

This document describes the current Viewer conventions, not a claim of complete CLI/DSH parity.
The MCP host card uses its own Tailwind stylesheet with the same 32px actions, 16px utility icons,
official product icons and shared tooltips. Its resource includes compiled CSS and JavaScript, without
external stylesheet requests. The IIFE build explicitly selects React's production runtime.
WorkBuddy 5.5.4's right panel has been visually verified after reconnecting the existing HTTP connector.
The protocol harness separately verifies 384px layout, host theme propagation and display-mode switching.
Full five-product theme/navigation acceptance and the other spec/release gates remain required.
