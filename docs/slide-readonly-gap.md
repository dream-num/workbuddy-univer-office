# Slide readonly thumbnail button — local reproduction

Status: unresolved; no external issue filed.

Environment: WorkBuddy 5.5.4 on macOS, SDK cohort `1.0.0-insiders.20260907-70fc579`, browser collaboration Viewer inside an HTTP MCP App. Reproduction uses the retained two-page, ready Slide fixture.

## Observed behavior

The Slide thumbnail bar displays a blue, enabled-looking “+ 新增” button in a read-only preview. Native accessibility also reports a button without the disabled flag. Other edit controls are disabled. Navigation and zoom remain available. This report establishes an inconsistent editing affordance; it does not establish a successful unauthorized content write.

## Verified configuration attempts

1. Server authorization returns Edit=false. Existing server checks reject preview writes. The button remains visually enabled.
2. `IUniverSlidesUIConfig.editor.enabled=false` suppresses the entire editor in this composition, including navigation. That earlier experiment was reverted.
3. After `loadSlideAsync`, call `getActivePresentation()?.getPermission().setReadOnly()` in preview/non-draft states. Typecheck/build succeeded, and the editor rendered, but the thumbnail Add button remained enabled-looking. Navigation to page 1 worked. Complete snapshot and ready worktree readback before/after matched. This redundant configuration was reverted.

Screenshot: permission probe（本地验证截图：`screenshots/slide-permission-probe.jpg`）. Logs: `.data/slide-permission-before.log`, `.data/slide-permission-after.log`, `.data/slide-permission-preview-test.log`.

## Installed public contracts inspected

- slides-ui `IUniverSlidesUIConfig`: global editor switch; no thumbnail Add visibility option.
- slides-ui `SlideThumbnailBar()`: no props accepting read-only state.
- slides `FPresentationPermission`: `setReadOnly`, `setEditable`, `canEdit`.
- slides permission service: whole-unit Edit plus page/element ceilings.

## Remaining investigation and acceptance

Determine whether the installed ThumbnailBar subscribes to the same unit Edit permission as the collaboration client, and whether initial async permission loading is reflected in Add and drag/context-menu controls. A fix must disable or hide editing affordances while keeping page selection, scrolling, zoom and playback usable. Verify both read-only preview and ready review, then reopen a draft and confirm legitimate editing works. Compare the complete snapshot and revision after rejected editing attempts. Do not use a blank editor or pointer-events on the entire thumbnail panel as a passing result.
