/**
 * Layer 7 (v0.1 flavor) — SPEC.md §7-8.
 *
 * Turns (authoredSource, overrides) into an "effective source" mermaid
 * can render, by injecting/replacing `id@{ view: ... }` statements.
 * Never mutates authoredSource; always derives a fresh string.
 *
 * Known risk (see SPEC.md §10): this assumes mermaid's parser is fine
 * with us *replacing* an existing `id@{ view: ... }` line rather than
 * appending a second, duplicate statement for the same id. Replacing
 * is the safer choice regardless of how mermaid actually handles
 * duplicates, so that's what this does — but the assumption that a
 * single override line per id is sufficient hasn't been verified
 * against a live mermaid render yet. Verify against your installed
 * mermaid version before relying on this in production.
 */

export type ViewOverride = 'collapsed' | 'expanded';

const METADATA_LINE_RE =
  /^(\s*)([A-Za-z_][\w-]*)\s*@\{\s*view\s*:\s*(collapsed|expanded)\s*\}\s*;?\s*$/;

function buildMetadataStatement(id: string, view: ViewOverride): string {
  return `${id}@{ view: ${view} }`;
}

/**
 * @param authoredSource the pristine diagram text (see identity.ts's
 *   contract — this must be the same string identity was computed from)
 * @param overrides map of subgraphId -> desired view state. Subgraphs
 *   not present in the map fall back to whatever the authored source
 *   says (or mermaid's own default, `expanded`, if it says nothing).
 */
export function applyOverrides(
  authoredSource: string,
  overrides: Map<string, ViewOverride>
): string {
  if (overrides.size === 0) return authoredSource;

  const remaining = new Map(overrides);
  const lines = authoredSource.split('\n');

  const rewritten = lines.map((line) => {
    const match = METADATA_LINE_RE.exec(line);
    if (!match) return line;
    const id = match[2];
    const desired = remaining.get(id);
    if (desired === undefined) return line;
    remaining.delete(id);
    return buildMetadataStatement(id, desired);
  });

  // Overrides that had no pre-existing metadata line to replace get
  // appended at the end. Appending (rather than inserting near the
  // subgraph block) sidesteps having to parse nested subgraph/end
  // blocks at all — these are independent statements in flowchart
  // syntax, so position within the body shouldn't matter.
  for (const [id, view] of remaining) {
    rewritten.push(buildMetadataStatement(id, view));
  }

  return rewritten.join('\n');
}

/**
 * Reads the authored, author-set default for each subgraph that has an
 * explicit `@{ view: ... }` line, without applying any overrides. Useful
 * for building "reset to author default" UI (see CollapseSource in
 * types.ts) or for tests.
 */
export function readAuthoredViews(authoredSource: string): Map<string, ViewOverride> {
  const result = new Map<string, ViewOverride>();
  for (const line of authoredSource.split('\n')) {
    const match = METADATA_LINE_RE.exec(line);
    if (match) result.set(match[2], match[3] as ViewOverride);
  }
  return result;
}
