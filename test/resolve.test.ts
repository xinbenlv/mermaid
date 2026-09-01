import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCollapsed } from '../src/resolve.js';
import { applyOverrides, readAuthoredViews } from '../src/rewrite.js';
import { makeCollapseState } from '../src/types.js';
import type { ViewOverride } from '../src/rewrite.js';

const noViews = new Map<string, ViewOverride>();

// SPEC.md §6 — the backward-compatibility guarantee. These tests exist
// to make the guarantee break loudly if anyone ever "improves" the
// default.

test('BACKWARD COMPAT: a subgraph nobody has said anything about is EXPANDED', () => {
  assert.equal(resolveCollapsed(null, noViews, 'mySub'), false);
});

test('BACKWARD COMPAT: an empty diagram gains no collapse behavior at all', () => {
  // No stored state anywhere -> no overrides -> source must come out byte-identical,
  // so mermaid renders it exactly as it would have without this package.
  const src = 'flowchart TD\n  subgraph mySub["Details"]\n    A --> B\n  end\n  Start --> mySub';
  assert.equal(applyOverrides(src, new Map()), src);
});

test('BACKWARD COMPAT: an 11.17.0 diagram authored `view: collapsed` still starts collapsed', () => {
  const src = 'flowchart TD\n  subgraph mySub\n    A --> B\n  end\nmySub@{ view: collapsed }';
  const views = readAuthoredViews(src);
  assert.equal(resolveCollapsed(null, views, 'mySub'), true);
});

test('BACKWARD COMPAT: an 11.17.0 diagram authored `view: expanded` still starts expanded', () => {
  const src = 'flowchart TD\n  subgraph mySub\n    A --> B\n  end\nmySub@{ view: expanded }';
  const views = readAuthoredViews(src);
  assert.equal(resolveCollapsed(null, views, 'mySub'), false);
});

test('stored state wins over the authored default, in both directions', () => {
  const views = new Map<string, ViewOverride>([['mySub', 'collapsed']]);
  const storedExpanded = makeCollapseState({
    diagramId: 'd',
    subgraphId: 'mySub',
    collapsed: false,
    updatedAt: 'x',
    source: 'user',
  });
  assert.equal(resolveCollapsed(storedExpanded, views, 'mySub'), false);

  const storedCollapsed = makeCollapseState({
    diagramId: 'd',
    subgraphId: 'mySub',
    collapsed: true,
    updatedAt: 'x',
    source: 'user',
  });
  assert.equal(resolveCollapsed(storedCollapsed, new Map(), 'mySub'), true);
});

test('an unrelated subgraph in the authored views does not leak into another id', () => {
  const views = new Map<string, ViewOverride>([['other', 'collapsed']]);
  assert.equal(resolveCollapsed(null, views, 'mySub'), false);
});

test('BACKWARD COMPAT: generated output is plain 11.17.0 syntax, no dialect of our own', () => {
  const src = 'flowchart TD\n  subgraph mySub\n    A --> B\n  end';
  const out = applyOverrides(src, new Map([['mySub', 'collapsed']]));
  // The only thing added is upstream's own metadata statement form.
  const added = out.slice(src.length).trim();
  assert.equal(added, 'mySub@{ view: collapsed }');
});
