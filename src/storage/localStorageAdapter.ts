import type { CollapseState } from '../types.js';
import { type CollapseStateAdapter, stateKey } from './types.js';

const PREFIX = 'mermaid-collapse-state:v0.1:';

function storageKey(diagramId: string, subgraphId: string, viewerId?: string | null): string {
  return PREFIX + stateKey(diagramId, subgraphId, viewerId);
}

/**
 * Per-browser, per-viewer-by-construction (there's only ever "the one
 * viewer" for a given localStorage). No cross-tab live sync — reload
 * to pick up state written by another tab. That's fine for v0.1;
 * `subscribe` is deliberately left unimplemented rather than faked.
 */
export function createLocalStorageAdapter(): CollapseStateAdapter {
  if (typeof localStorage === 'undefined') {
    throw new Error(
      'createLocalStorageAdapter(): no `localStorage` in this environment ' +
        '(SSR / non-browser?). Use createMemoryAdapter() instead, or bring ' +
        'your own CollapseStateAdapter.'
    );
  }

  return {
    async get(diagramId, subgraphId, viewerId) {
      const raw = localStorage.getItem(storageKey(diagramId, subgraphId, viewerId));
      return raw ? (JSON.parse(raw) as CollapseState) : null;
    },
    async set(state) {
      localStorage.setItem(
        storageKey(state.diagramId, state.subgraphId, state.viewerId),
        JSON.stringify(state)
      );
    },
    async list(diagramId, viewerId) {
      const results: CollapseState[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(PREFIX)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        try {
          const state = JSON.parse(raw) as CollapseState;
          if (state.diagramId !== diagramId) continue;
          if (viewerId !== undefined && (state.viewerId ?? undefined) !== viewerId) continue;
          results.push(state);
        } catch {
          // Ignore entries that aren't ours / got corrupted — don't let
          // one bad record break listing everything else.
        }
      }
      return results;
    },
  };
}
