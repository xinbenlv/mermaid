import type { CollapseState } from './types.js';
import type { ViewOverride } from './rewrite.js';

/**
 * Resolves what a subgraph's collapse state currently *is*, given
 * whatever the adapter had stored plus whatever the author wrote.
 *
 * This function exists as its own exported unit specifically because
 * it encodes SPEC.md §6's backward-compatibility guarantee, and a
 * guarantee that lives inline in an event handler is a guarantee
 * nobody can test:
 *
 *   stored state         -> use it
 *   no stored state      -> use the author's `@{ view: ... }`
 *   neither              -> EXPANDED, always. Never collapsed.
 *
 * That last line is the whole compatibility promise: a diagram that
 * says nothing about collapse must render exactly as it did before
 * this package existed.
 */
export function resolveCollapsed(
  stored: CollapseState | null,
  authoredViews: ReadonlyMap<string, ViewOverride>,
  subgraphId: string
): boolean {
  if (stored) return stored.collapsed;
  return authoredViews.get(subgraphId) === 'collapsed';
}
