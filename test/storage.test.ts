import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryAdapter } from '../src/storage/memoryAdapter.js';
import { makeCollapseState } from '../src/types.js';

test('memory adapter round-trips a single state', async () => {
  const adapter = createMemoryAdapter();
  const state = makeCollapseState({
    diagramId: 'd1',
    subgraphId: 'sub1',
    collapsed: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    viewerId: null,
    source: 'user',
  });
  await adapter.set(state);
  const got = await adapter.get('d1', 'sub1');
  assert.deepEqual(got, state);
});

test('memory adapter returns null for unknown keys', async () => {
  const adapter = createMemoryAdapter();
  assert.equal(await adapter.get('nope', 'nope'), null);
});

test('list scopes to diagramId', async () => {
  const adapter = createMemoryAdapter();
  await adapter.set(
    makeCollapseState({
      diagramId: 'd1',
      subgraphId: 'a',
      collapsed: true,
      updatedAt: 'x',
      source: 'user',
    })
  );
  await adapter.set(
    makeCollapseState({
      diagramId: 'd2',
      subgraphId: 'a',
      collapsed: false,
      updatedAt: 'x',
      source: 'user',
    })
  );
  const list = await adapter.list('d1');
  assert.equal(list.length, 1);
  assert.equal(list[0].diagramId, 'd1');
});

test('viewerId partitions state for the same (diagramId, subgraphId)', async () => {
  const adapter = createMemoryAdapter();
  await adapter.set(
    makeCollapseState({
      diagramId: 'd1',
      subgraphId: 'a',
      collapsed: true,
      updatedAt: 'x',
      viewerId: 'alice',
      source: 'user',
    })
  );
  await adapter.set(
    makeCollapseState({
      diagramId: 'd1',
      subgraphId: 'a',
      collapsed: false,
      updatedAt: 'x',
      viewerId: 'bob',
      source: 'user',
    })
  );
  assert.equal((await adapter.get('d1', 'a', 'alice'))?.collapsed, true);
  assert.equal((await adapter.get('d1', 'a', 'bob'))?.collapsed, false);
});
