# Mermaid Subgraph Collapse — Interop State Spec

**Status:** draft v0.1
**Scope:** flowchart diagrams only (`flowchart` / `graph`), subgraph-level collapse
**Depends on:** mermaid `>=11.17.0` (ships the `id@{ view: collapsed | expanded }` metadata syntax — see [Flowcharts Syntax](https://mermaid.js.org/syntax/flowchart.html) and [PR #7785](https://github.com/mermaid-js/mermaid/pull/7785))

## 1. Why this exists

Mermaid core (as of 11.17.x) can render a subgraph as collapsed if you author `subgraphId@{ view: collapsed }` in the diagram source. It has no notion of:

- a *viewer* clicking to toggle that state at runtime,
- *remembering* what a viewer last chose, across reloads or across viewers.

Those two things are currently owned by whatever wraps mermaid (a plugin today; conceivably a native kernel later). This spec defines the **contract** between "the thing that stores/toggles state" and "the thing that renders a diagram given that state" so that:

- a v0.1 plugin (text-rewrite + full re-render, see [README.md](README.md)) and
- a hypothetical future native implementation (incremental re-layout, no text rewriting)

can both be built against the same schema, and diagrams / stored state are portable between them. Nothing here requires changes to mermaid core — it's a layer *around* the existing `view:` syntax.

## 2. Terminology

| Term | Meaning |
|---|---|
| **Authored source** | The flowchart text as written by a human/CMS, *before* any collapse override is applied. Treated as immutable input for a given render call. |
| **Subgraph id** | The explicit id a subgraph is given (`subgraph mySub["Title"]`). Required — collapse state cannot target an unnamed subgraph. |
| **Diagram id** | A stable identifier for "this diagram", independent of collapse state. See §3. |
| **Collapse state** | A per-(diagramId, subgraphId) boolean, owned by a storage adapter, not by the diagram text. |
| **Viewer** | Whoever is looking at the rendered diagram. State may be global (shared) or per-viewer — the schema supports both; which one you use is a product decision, not a spec decision. |

## 3. Diagram identity

State is keyed by `(diagramId, subgraphId)`. `diagramId` MUST be stable across renders of "the same diagram" and MUST NOT change just because collapse state changed.

Two ways to get one, in priority order:

1. **Explicit id** — if the diagram has YAML frontmatter with an `id` field, use it verbatim:
   ```
   ---
   id: onboarding-flow
   ---
   flowchart TD
   ...
   ```
2. **Content hash** — otherwise, hash the *authored source* (the string as received by `render()`, before this library injects anything). v0.1 uses a non-cryptographic hash (see `src/identity.ts`) — collision resistance is not a security requirement here, only stability.

**Rule:** implementations MUST hash/derive the id from the authored source only, never from a source string this library has already rewritten. This is why "authored source" is defined as immutable input — see §5.

## 4. State object schema

```jsonc
{
  "specVersion": "0.1",
  "diagramId": "onboarding-flow",       // see §3
  "subgraphId": "mySub",                 // matches the subgraph's declared id
  "collapsed": true,
  "updatedAt": "2026-08-31T12:00:00.000Z", // ISO 8601
  "viewerId": null,                      // optional — null/omitted = shared/global state
  "source": "user"                       // "user" (explicit toggle) | "default" (author-set initial state)
}
```

- One object per `(diagramId, subgraphId[, viewerId])` tuple.
- `source: "default"` records let a renderer distinguish "nobody has touched this yet, falling back to what the author wrote in `view:`" from "a viewer explicitly expanded/collapsed it" — useful if you ever want a "reset to author default" action.
- Absence of a record for a given subgraph means: **use whatever the authored source says** (`view: expanded` if unspecified, `view: collapsed` if the author wrote it).

## 5. Storage adapter interface

```ts
interface CollapseStateAdapter {
  get(diagramId: string, subgraphId: string, viewerId?: string): Promise<CollapseState | null>;
  set(state: CollapseState): Promise<void>;
  list(diagramId: string, viewerId?: string): Promise<CollapseState[]>;
  subscribe?(diagramId: string, cb: (state: CollapseState) => void): () => void; // optional, for live multi-viewer sync
}
```

v0.1 ships a `localStorageAdapter` (per-browser, per-viewer by construction) and a `memoryAdapter` (tests / SSR). A server-backed adapter (shared state across viewers) is a v0.2 concern — the interface is already shaped for it (`viewerId` optional, `subscribe` optional) so it's additive, not a breaking change.

## 6. Event contract

The renderer dispatches a `CustomEvent` on the container element whenever a viewer requests a toggle, **before** state is written — this lets a host app veto or intercept:

```ts
container.dispatchEvent(new CustomEvent('mermaid-collapse:toggle', {
  bubbles: true,
  composed: true,
  detail: { diagramId, subgraphId, nextCollapsed } // nextCollapsed = the state it's about to become
}))
```

and again **after** re-render completes:

```ts
container.dispatchEvent(new CustomEvent('mermaid-collapse:change', {
  bubbles: true,
  composed: true,
  detail: { diagramId, subgraphId, collapsed }
}))
```

Event names are namespaced (`mermaid-collapse:*`) specifically so a future native implementation can emit the *same* events and existing host-app listeners keep working unchanged.

## 7. Render contract (how the pieces compose)

```
authoredSource ──┐
                 ├─► effectiveSource = applyOverrides(authoredSource, overrides)
overrides ───────┘        │
 (from adapter.list())    ▼
                    mermaid.render(id, effectiveSource) ──► SVG
```

`applyOverrides` never mutates `authoredSource`; it derives a fresh string every call. See §8 for what a v0.1 (text-rewrite) implementation of `applyOverrides` looks like, and why a native kernel wouldn't need this step at all.

## 8. Two conforming implementations

| | v0.1 plugin (this repo) | hypothetical native kernel |
|---|---|---|
| Layers 3–6 (identity, schema, storage, events) | implemented as-is | implemented as-is, **unchanged** |
| Layer 7 `applyOverrides` | string rewrite of `id@{ view: ... }` lines, then a full `mermaid.render()` pass | mutates an internal graph object directly, re-lays-out only the affected subtree |
| Perf on toggle | full reparse + layout + redraw | incremental — no reparse |
| Animation | none (v0.1) | possible, since node positions are known before/after |

Both are "correct" per this spec as long as layers 3–6 match. A diagram + its stored state should look and behave identically whichever one renders it.

## 9. Non-goals for v0.1

- Diagram types other than flowchart (sequence/state/mindmap have no analogous `view:` primitive upstream yet).
- Nested subgraph partial-state resolution beyond mermaid core's own rule ("collapse resolves to the outermost collapsed ancestor" — see [Discussion #6377](https://github.com/orgs/mermaid-js/discussions/6377)).
- Animated transitions between states.
- Multi-viewer live sync (the `subscribe` hook exists for this later, unimplemented in v0.1's shipped adapters).

## 10. Open questions before calling this v1.0

- Does mermaid's parser accept two `id@{...}` statements for the same id (later wins) or error on duplicate definition? v0.1's rewrite logic sidesteps this by always replacing the existing line rather than appending a duplicate — but this should be confirmed against real mermaid output rather than assumed. Track in [README.md](README.md) known-risks.
- Should `diagramId` collisions across totally unrelated diagrams (hash collision) matter enough to warrant a cryptographic hash instead of a fast one? Leaning no for v0.1 given the failure mode is cosmetic (wrong remembered collapse state), not a security issue — revisit if that changes.
