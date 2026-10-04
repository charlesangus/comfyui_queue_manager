import { describe, it, expect } from 'vitest';
import { QueueCard } from './QueueCard';

// QueueCard is wrapped in React.memo(Component, comparator) — the comparator
// is exposed as QueueCard.compare, and is plain-function testable without
// rendering. This locks in the fix for the bug where card/error were
// compared by reference even though the backend re-parses them from JSON on
// every fetch, which defeated the memo on every single refetch.
const sharedOnSelect = () => {};

function makeProps(overrides = {}) {
  return {
    item: [0, 'prompt-1', {}, { db_id: 1, priority: 0, ...overrides.item3 }],
    loader: false,
    index: 0,
    mode: 'normal',
    info: { page: 0, page_size: 100 },
    filters: null,
    isSelected: false,
    onSelect: sharedOnSelect,
    itemKey: 1,
    ...overrides,
  };
}

describe('QueueCard memo comparator', () => {
  it('treats a freshly-parsed but content-identical card as equal', () => {
    const prev = makeProps({ item3: { card: [{ index: 0, label: 'a', kind: 'text', value: 'x' }] } });
    const next = makeProps({ item3: { card: [{ index: 0, label: 'a', kind: 'text', value: 'x' }] } });

    // Same content, but a brand-new array/object reference each time —
    // exactly what json.loads() on the backend produces on every fetch.
    expect(prev.item[3].card).not.toBe(next.item[3].card);
    expect(QueueCard.compare(prev, next)).toBe(true);
  });

  it('detects an actual change in card content', () => {
    const prev = makeProps({ item3: { card: [{ index: 0, label: 'a', kind: 'text', value: 'x' }] } });
    const next = makeProps({ item3: { card: [{ index: 0, label: 'a', kind: 'text', value: 'y' }] } });

    expect(QueueCard.compare(prev, next)).toBe(false);
  });

  it('detects a status change even when card is unchanged', () => {
    const prev = makeProps({ item3: { status: 0 } });
    const next = makeProps({ item3: { status: -1 } });

    expect(QueueCard.compare(prev, next)).toBe(false);
  });

  it('detects an error change that is a freshly-parsed but different object', () => {
    const prev = makeProps({ item3: { error: null } });
    const next = makeProps({ item3: { error: { kind: 'interrupted', message: 'stopped' } } });

    expect(QueueCard.compare(prev, next)).toBe(false);
  });

  it('treats a freshly-parsed but content-identical error as equal', () => {
    const prev = makeProps({ item3: { error: { kind: 'interrupted', message: 'stopped' } } });
    const next = makeProps({ item3: { error: { kind: 'interrupted', message: 'stopped' } } });

    expect(prev.item[3].error).not.toBe(next.item[3].error);
    expect(QueueCard.compare(prev, next)).toBe(true);
  });

  it('still bails out early on a db_id change', () => {
    const prev = makeProps({ item3: { db_id: 1 } });
    const next = makeProps({ item3: { db_id: 2 } });

    expect(QueueCard.compare(prev, next)).toBe(false);
  });
});
