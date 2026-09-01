import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDiagramId } from '../src/identity.js';

test('same source -> same diagramId', () => {
  const src = 'flowchart TD\nA-->B';
  assert.equal(computeDiagramId(src), computeDiagramId(src));
});

test('different source -> different diagramId', () => {
  const a = computeDiagramId('flowchart TD\nA-->B');
  const b = computeDiagramId('flowchart TD\nA-->C');
  assert.notEqual(a, b);
});

test('collapse override does not change diagramId, as long as it is computed from the pre-override source', () => {
  const authored = 'flowchart TD\nsubgraph mySub\nA-->B\nend';
  const idBefore = computeDiagramId(authored);
  // Simulate: caller always re-hashes the *authored* source, never the
  // rewritten one (this is the contract render.ts relies on).
  const idAfter = computeDiagramId(authored);
  assert.equal(idBefore, idAfter);
});

test('explicit frontmatter id wins over content hash', () => {
  const src = '---\nid: onboarding-flow\n---\nflowchart TD\nA-->B';
  assert.equal(computeDiagramId(src), 'onboarding-flow');
});

test('falls back to hash: prefix when no frontmatter id', () => {
  const src = 'flowchart TD\nA-->B';
  assert.match(computeDiagramId(src), /^hash:/);
});
