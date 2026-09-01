import type { CollapseState } from '../types.js';
import { type CollapseStateAdapter, stateKey } from './types.js';

/**
 * Process-local, in-memory adapter. Useful for tests and SSR contexts
 * where there's no `localStorage` — state does not persist across
 * process restarts or across tabs.
 */
export function createMemoryAdapter(): CollapseStateAdapter {
  const store = new Map<string, CollapseState>();

  return {
    async get(diagramId, subgraphId, viewerId) {
      return store.get(stateKey(diagramId, subgraphId, viewerId)) ?? null;
    },
    async set(state) {
      store.set(stateKey(state.diagramId, state.subgraphId, state.viewerId), state);
    },
    async list(diagramId, viewerId) {
      return [...store.values()].filter(
        (s) => s.diagramId === diagramId && (viewerId === undefined || (s.viewerId ?? undefined) === viewerId)
      );
    },
  };
}
