export const kinds = ['sheet', 'doc', 'slide', 'base', 'board'] as const;
export type UnitKind = typeof kinds[number];
export interface UnitRecord { unitId: string; kind: UnitKind; name: string; worktreeId?: string; removed?: boolean }
export interface Target { fileId: string; unitId: string; branch: 'trunk' | 'worktree'; worktreeId?: string }
export class OfficeError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export function requireValue(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new OfficeError(code, message);
}
