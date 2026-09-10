import { createWorktreeCollaborationConfig } from '@univerjs-pro/collaboration-worktree-client';

/** Keep branch URL mapping in one place, using the SDK worktree protocol helper. */
export function collaborationUrls(origin: string, fileId: string, worktreeId?: string, requestPrefix='') {
  const base = `${origin}/universer-api`;
  const source = worktreeId
    ? createWorktreeCollaborationConfig({ origin, worktreeID: worktreeId })
    : { snapshotServerUrl: `${base}/snapshot`, collabSubmitChangesetUrl: `${base}/comb`,
        collabWebSocketUrl: `${base.replace(/^http/, 'ws')}/comb/connect`, wsSessionTicketUrl: `${base}/user/session-ticket` };
  const prefix = (value: string | undefined) => {
    const url = new URL(value!);
    url.pathname = `${requestPrefix}/files/${encodeURIComponent(fileId)}${url.pathname}`;
    return url.toString();
  };
  return { snapshotServerUrl: prefix(source.snapshotServerUrl), collabSubmitChangesetUrl: prefix(source.collabSubmitChangesetUrl),
    collabWebSocketUrl: prefix(source.collabWebSocketUrl), wsSessionTicketUrl: prefix(source.wsSessionTicketUrl) };
}
