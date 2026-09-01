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
