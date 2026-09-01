/**
 * Core data types shared across this package. Mirrors SPEC.md's worked
 * example in §3 and "Reference → State object schema" —
 * keep the two in sync; SPEC.md is the source of truth for *why* the
 * shape looks like this.
 */

export const SPEC_VERSION = '0.1' as const;

export type CollapseSource = 'user' | 'default';

export interface CollapseState {
  specVersion: typeof SPEC_VERSION;
  diagramId: string;
  subgraphId: string;
  collapsed: boolean;
  /** ISO 8601 timestamp. Caller supplies it (see note in render.ts) since
   * this package avoids calling Date.now() internally to stay easy to test. */
  updatedAt: string;
  /** null/undefined = shared/global state, not tied to a particular viewer. */
  viewerId?: string | null;
  source: CollapseSource;
}

/** Convenience constructor so callers don't hand-roll the specVersion field. */
export function makeCollapseState(
  input: Omit<CollapseState, 'specVersion'>
): CollapseState {
  return { specVersion: SPEC_VERSION, ...input };
}
