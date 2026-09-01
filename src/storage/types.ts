import type { CollapseState } from '../types.js';

/**
 * SPEC.md §5. `subscribe` is optional — only adapters that support
 * live multi-viewer sync need implement it (none of the v0.1 shipped
 * adapters do; both are single-process).
 */
export interface CollapseStateAdapter {
  get(diagramId: string, subgraphId: string, viewerId?: string): Promise<CollapseState | null>;
  set(state: CollapseState): Promise<void>;
  list(diagramId: string, viewerId?: string): Promise<CollapseState[]>;
  subscribe?(diagramId: string, cb: (state: CollapseState) => void): () => void;
}

export function stateKey(diagramId: string, subgraphId: string, viewerId?: string | null): string {
  return [diagramId, subgraphId, viewerId ?? ''].join('::');
}
