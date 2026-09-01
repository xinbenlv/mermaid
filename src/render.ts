import { computeDiagramId } from './identity.js';
import { applyOverrides, readAuthoredViews, type ViewOverride } from './rewrite.js';
import { makeCollapseState } from './types.js';
import type { CollapseStateAdapter } from './storage/types.js';
import { dispatchToggle, dispatchChange } from './events.js';

/**
 * The subset of mermaid's real API this file needs. The actual
 * `mermaid` singleton satisfies this structurally — it's injected
 * (rather than imported globally) so this package has no hard
 * dependency on a specific mermaid build and stays unit-testable
 * without a DOM/mermaid runtime.
 */
export interface MermaidLike {
  render(id: string, text: string): Promise<{ svg: string; bindFunctions?: (el: Element) => void }>;
}

export interface RenderOptions {
  mermaid: MermaidLike;
  adapter: CollapseStateAdapter;
  /** omit for shared/global collapse state; set for per-viewer state */
  viewerId?: string;
  /** id passed through to mermaid.render — auto-derived from diagramId if omitted */
  renderId?: string;
  onError?: (err: unknown) => void;
}

interface ContainerState {
  authoredSource: string;
  options: RenderOptions;
}

const containerState = new WeakMap<HTMLElement, ContainerState>();
const wiredContainers = new WeakSet<HTMLElement>();

const SUBGRAPH_DECL_RE = /^\s*subgraph\s+([A-Za-z_][\w-]*)\b/gm;

function extractSubgraphIds(authoredSource: string): Set<string> {
  const ids = new Set<string>();
  for (const match of authoredSource.matchAll(SUBGRAPH_DECL_RE)) {
    ids.add(match[1]);
  }
  return ids;
}

/**
 * Heuristic — the single most likely thing in this package to break
 * across mermaid versions. Verified against mermaid 11.17.2: a
 * subgraph `mySub` renders as `<g class="cluster" id="{renderId}-mySub">`,
 * and its collapsed stand-in node's id also contains `mySub`, so the
 * substring match below catches both cases (see README's "Known
 * risks" section for the full round-trip test). Not yet verified on
 * other mermaid versions or with nested subgraphs — if you hit a
 * mismatch, inspect the rendered SVG's ids and tighten `.includes()`
 * to whatever prefix/suffix pattern your version actually uses.
 */
function resolveClickedSubgraphId(
  start: Element,
  knownIds: ReadonlySet<string>,
  root: HTMLElement
): string | null {
  let el: Element | null = start;
  let hops = 0;
  const MAX_HOPS = 8;
  while (el && hops < MAX_HOPS) {
    const id = el.id;
    if (id) {
      for (const known of knownIds) {
        if (id === known || id.includes(known)) return known;
      }
    }
    if (el === root) break;
    el = el.parentElement;
    hops++;
  }
  return null;
}

function toOverride(collapsed: boolean): ViewOverride {
  return collapsed ? 'collapsed' : 'expanded';
}

/**
 * Renders `authoredSource` into `container`, applying any stored
 * collapse state, and (on first call for a given container) wires up
 * click-to-toggle. Safe to call again on the same container with the
 * same or updated `authoredSource` — e.g. after the source changes
 * upstream, or internally after a toggle.
 */
export async function renderCollapsible(
  container: HTMLElement,
  authoredSource: string,
  options: RenderOptions
): Promise<{ diagramId: string }> {
  containerState.set(container, { authoredSource, options });

  const diagramId = computeDiagramId(authoredSource);
  const stored = await options.adapter.list(diagramId, options.viewerId);
  const overrides = new Map(stored.map((s) => [s.subgraphId, toOverride(s.collapsed)] as const));
  const effectiveSource = applyOverrides(authoredSource, overrides);

  const renderId = options.renderId ?? `mermaid-collapse-${diagramId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const { svg, bindFunctions } = await options.mermaid.render(renderId, effectiveSource);

  container.innerHTML = svg;
  bindFunctions?.(container);
  ensureClickHandler(container);

  return { diagramId };
}

function ensureClickHandler(container: HTMLElement): void {
  if (wiredContainers.has(container)) return;
  wiredContainers.add(container);
  container.addEventListener('click', (event) => {
    handleClick(container, event).catch((err) => {
      containerState.get(container)?.options.onError?.(err);
    });
  });
}

async function handleClick(container: HTMLElement, event: Event): Promise<void> {
  const state = containerState.get(container);
  if (!state) return;
  const { authoredSource, options } = state;

  if (!(event.target instanceof Element)) return;
  const knownIds = extractSubgraphIds(authoredSource);
  if (knownIds.size === 0) return;

  const subgraphId = resolveClickedSubgraphId(event.target, knownIds, container);
  if (!subgraphId) return;

  const diagramId = computeDiagramId(authoredSource);
  const existing = await options.adapter.get(diagramId, subgraphId, options.viewerId);
  const authoredViews = readAuthoredViews(authoredSource);
  const currentlyCollapsed = existing ? existing.collapsed : authoredViews.get(subgraphId) === 'collapsed';
  const nextCollapsed = !currentlyCollapsed;

  dispatchToggle(container, { diagramId, subgraphId, nextCollapsed });

  await options.adapter.set(
    makeCollapseState({
      diagramId,
      subgraphId,
      collapsed: nextCollapsed,
      updatedAt: new Date().toISOString(),
      viewerId: options.viewerId ?? null,
      source: 'user',
    })
  );

  await renderCollapsible(container, authoredSource, options);
  dispatchChange(container, { diagramId, subgraphId, collapsed: nextCollapsed });
}
