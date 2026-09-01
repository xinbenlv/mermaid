# mermaid-collapse-state

Click-to-collapse subgraphs for [Mermaid](https://mermaid.js.org/) flowcharts, with collapse state remembered per viewer — built entirely as a wrapper around mermaid's existing `id@{ view: collapsed }` syntax (shipped in mermaid `11.17.0`). No mermaid core changes required.

> Provisional package/project name — not affiliated with, or endorsed by, the Mermaid or Mermaid Chart projects. Naming is deliberately kept in the standard "plugin-for-X" pattern rather than anything that could read as an official product.

Read [SPEC.md](SPEC.md) first — it walks through a real example (plain flowchart → mermaid's own static `view: collapsed` → what clicking actually writes and re-renders), then extracts the state schema and event contract from that example, specifically so a future native (non-text-rewrite) implementation could be built against the same contract without breaking existing integrations.

## How it works, in one paragraph

Mermaid's `render()` is a one-shot "text in, SVG out" function — there's no live diagram object to mutate. So on every toggle, this library: looks up stored collapse state for the diagram → rewrites the *authored* source to inject/replace `id@{ view: collapsed|expanded }` lines for whichever subgraphs have stored overrides → calls `mermaid.render()` again with that derived text → swaps the container's contents. State (which subgraphs are collapsed) lives entirely outside the diagram text, in a pluggable storage adapter.

## Usage

```ts
import mermaid from 'mermaid';
import { renderCollapsible, createLocalStorageAdapter } from 'mermaid-collapse-state';

mermaid.initialize({ startOnLoad: false });

const authoredSource = `
flowchart TD
  subgraph mySub["Details"]
    A --> B
  end
  Start --> mySub --> End
`;

await renderCollapsible(document.getElementById('diagram')!, authoredSource, {
  mermaid,
  adapter: createLocalStorageAdapter(),
});
```

Clicking the rendered `mySub` subgraph toggles it between collapsed/expanded and remembers the choice in `localStorage` — reload the page and it comes back the way you left it. See [examples/basic.html](examples/basic.html) for a full runnable page.

## Status

v0.1, unpublished. Pure-logic pieces (`identity`, `rewrite`, storage adapters) are unit tested and have no DOM/mermaid dependency. The click-target resolution in `render.ts` is **explicitly flagged as unverified** against a live mermaid render — see the comment on `resolveClickedSubgraphId` and the Known risks section below before relying on this anywhere real.

## Known risks / things to verify before real use

1. **Click-target DOM matching is a heuristic.** ✅ Verified against mermaid `11.17.2` (loaded via the `mermaid@11` CDN tag, current latest as of this writing): a subgraph `mySub` renders as `<g class="cluster" id="{renderId}-mySub">`, and once collapsed the same subgraph re-renders as a plain node whose id also contains `mySub` — so the `.includes(known)` substring match in `resolveClickedSubgraphId` correctly catches clicks on both the expanded cluster and the collapsed stand-in node. Full click → collapse → click → expand round trip confirmed end to end via `examples/basic.html`, including that the collapsed state is written to and read back from `localStorage` correctly. ✅ Also verified for **2 levels of nested subgraphs** — see SPEC.md §5 for the four collapsed/expanded combinations tested, including the non-obvious finding that mermaid renders sibling subgraphs' `<g>` elements as DOM siblings rather than nesting them, which turns out not to matter for this heuristic. **Not yet confirmed:** older mermaid versions, or 3+ levels of nesting.
2. **Duplicate `id@{ view: ... }` statement handling is assumed, not confirmed.** `rewrite.ts` always replaces an existing metadata line for a given id rather than appending a second one, specifically to avoid finding out the hard way whether mermaid's parser errors on duplicate definitions. Worth confirming either way.
3. **No animation, no incremental layout.** Every toggle is a full reparse + relayout + redraw. Fine for small-to-medium diagrams; will visibly "flash" on very large ones. See SPEC.md's "Reference → text-rewrite vs native kernel" table for why that's a limitation of this approach, not a fundamental one.
4. **Flowchart only.** Sequence/state/mindmap diagrams have no analogous `view:` primitive upstream, so this doesn't apply to them.

## Development

```bash
npm install
npm run build       # tsc -> dist/
npm test            # build, then run node's built-in test runner
npm run typecheck
```

## License

MIT — see [LICENSE](LICENSE). Same license as mermaid itself; this package has no code-level relationship to mermaid's source (it only calls mermaid's public `render()` API), so there's no obligation tying the two, but MIT-on-MIT keeps things simple.
