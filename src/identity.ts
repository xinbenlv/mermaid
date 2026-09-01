/**
 * Diagram identity — SPEC.md §4's "diagramId computed pre-rewrite" rule,
 * detailed in "Reference → Diagram identity".
 *
 * Rule this file exists to enforce: diagramId must be derived from the
 * *authored* source only, and must be stable across toggles. Callers
 * should compute it once per authored source and treat it as opaque.
 */

const FRONTMATTER_ID_RE = /^---\s*[\r\n]([\s\S]*?)[\r\n]---/;
const YAML_ID_FIELD_RE = /^\s*id\s*:\s*(.+?)\s*$/m;

/**
 * FNV-1a, 32-bit. Not cryptographic — collision resistance isn't a
 * security requirement here (see SPEC.md "Reference → Open questions"), only stability across
 * calls with the same input.
 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Unsigned, base36 for a shorter, still-stable string.
  return (hash >>> 0).toString(36);
}

function extractFrontmatterId(source: string): string | null {
  const fm = FRONTMATTER_ID_RE.exec(source);
  if (!fm) return null;
  const idField = YAML_ID_FIELD_RE.exec(fm[1]);
  return idField ? idField[1].trim() : null;
}

/**
 * Returns a stable diagramId for `authoredSource`.
 *
 * Priority:
 *  1. explicit `id:` in YAML frontmatter, if present
 *  2. content hash of the authored source
 *
 * @param authoredSource - the diagram text exactly as received, before
 *   this library has injected/rewritten any `@{ view: ... }` lines.
 */
export function computeDiagramId(authoredSource: string): string {
  const explicit = extractFrontmatterId(authoredSource);
  if (explicit) return explicit;
  return `hash:${fnv1a(authoredSource.trim())}`;
}
