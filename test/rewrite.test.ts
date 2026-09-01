import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOverrides, readAuthoredViews } from '../src/rewrite.js';

test('no overrides -> source is returned untouched', () => {
  const src = 'flowchart TD\nA-->B';
  assert.equal(applyOverrides(src, new Map()), src);
});

test('appends a new metadata line for a subgraph with no existing override', () => {
  const src = 'flowchart TD\nsubgraph mySub\nA-->B\nend';
  const out = applyOverrides(src, new Map([['mySub', 'collapsed']]));
  assert.match(out, /mySub@\{ view: collapsed \}/);
  // original body untouched
  assert.match(out, /subgraph mySub/);
});

test('replaces an existing metadata line rather than duplicating it', () => {
  const src = 'flowchart TD\nsubgraph mySub\nA-->B\nend\nmySub@{ view: expanded }';
  const out = applyOverrides(src, new Map([['mySub', 'collapsed']]));
  const occurrences = out.match(/mySub@\{ view:/g) ?? [];
  assert.equal(occurrences.length, 1, 'expected exactly one metadata statement for mySub');
  assert.match(out, /mySub@\{ view: collapsed \}/);
});

test('leaves subgraphs not mentioned in overrides alone', () => {
  const src = 'flowchart TD\nsubgraph a\nX-->Y\nend\nsubgraph b\nP-->Q\nend\na@{ view: collapsed }';
  const out = applyOverrides(src, new Map([['b', 'collapsed']]));
  assert.match(out, /a@\{ view: collapsed \}/); // untouched
  assert.match(out, /b@\{ view: collapsed \}/); // newly appended
});

test('readAuthoredViews reads existing metadata without mutating anything', () => {
  const src = 'flowchart TD\na@{ view: collapsed }\nb@{ view: expanded }';
  const views = readAuthoredViews(src);
  assert.equal(views.get('a'), 'collapsed');
  assert.equal(views.get('b'), 'expanded');
  assert.equal(views.size, 2);
});

// Regression coverage for SPEC.md §5 (Nested subgraphs). Overrides for a
// subgraph and something nested inside it are independent statements as
// far as this module is concerned — the composition rule (outermost
// collapsed ancestor wins) is mermaid's job at render time, not ours.
// Verified live against mermaid 11.17.2 in SPEC.md; this test only
// guards that applyOverrides doesn't cross-contaminate the two ids.
test('nested subgraph ids each get their own independent metadata line', () => {
  const src =
    'flowchart TD\nsubgraph outer\nsubgraph inner\nA-->B\nend\ninner-->C\nend\nStart-->outer-->End';
  const out = applyOverrides(
    src,
    new Map([
      ['outer', 'collapsed'],
      ['inner', 'expanded'],
    ])
  );
  assert.match(out, /outer@\{ view: collapsed \}/);
  assert.match(out, /inner@\{ view: expanded \}/);
  // and toggling only one of them leaves the other's existing line alone
  const secondSrc = out; // "outer" now has an authored line from the previous call
  const out2 = applyOverrides(secondSrc, new Map([['inner', 'collapsed']]));
  const outerOccurrences = out2.match(/outer@\{ view:/g) ?? [];
  assert.equal(outerOccurrences.length, 1, 'outer line should be untouched, not duplicated');
  assert.match(out2, /outer@\{ view: collapsed \}/); // still collapsed, from before
  assert.match(out2, /inner@\{ view: collapsed \}/); // now updated
});
