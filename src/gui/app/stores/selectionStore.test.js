import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from './selectionStore';

describe('selectionStore', () => {
  beforeEach(() => {
    useSelectionStore.setState({
      selected: new Set(),
      anchor: null,
    });
  });

  describe('select', () => {
    it('replaces selection with just the given key and sets anchor', () => {
      useSelectionStore.getState().select('a');

      const state = useSelectionStore.getState();
      expect(state.selected).toEqual(new Set(['a']));
      expect(state.anchor).toBe('a');
    });

    it('replaces a previous multi-key selection', () => {
      useSelectionStore.setState({ selected: new Set(['a', 'b']), anchor: 'b' });
      useSelectionStore.getState().select('c');

      const state = useSelectionStore.getState();
      expect(state.selected).toEqual(new Set(['c']));
      expect(state.anchor).toBe('c');
    });
  });

  describe('toggle', () => {
    it('adds a key that is not selected and sets anchor', () => {
      useSelectionStore.getState().toggle('a');

      const state = useSelectionStore.getState();
      expect(state.selected).toEqual(new Set(['a']));
      expect(state.anchor).toBe('a');
    });

    it('removes a key that is already selected and sets anchor', () => {
      useSelectionStore.setState({ selected: new Set(['a', 'b']), anchor: 'a' });
      useSelectionStore.getState().toggle('a');

      const state = useSelectionStore.getState();
      expect(state.selected).toEqual(new Set(['b']));
      expect(state.anchor).toBe('a');
    });
  });

  describe('selectRange', () => {
    const orderedKeys = ['a', 'b', 'c', 'd', 'e'];

    it('selects from anchor forward to a later key, inclusive', () => {
      useSelectionStore.setState({ selected: new Set(['b']), anchor: 'b' });
      useSelectionStore.getState().selectRange(orderedKeys, 'd');

      const state = useSelectionStore.getState();
      expect(state.selected).toEqual(new Set(['b', 'c', 'd']));
      expect(state.anchor).toBe('b');
    });

    it('selects from anchor backward to an earlier key, inclusive', () => {
      useSelectionStore.setState({ selected: new Set(['d']), anchor: 'd' });
      useSelectionStore.getState().selectRange(orderedKeys, 'b');

      const state = useSelectionStore.getState();
      expect(state.selected).toEqual(new Set(['b', 'c', 'd']));
      expect(state.anchor).toBe('d');
    });

    it('falls back to select(key) when anchor is null', () => {
      useSelectionStore.getState().selectRange(orderedKeys, 'c');

      const state = useSelectionStore.getState();
      expect(state.selected).toEqual(new Set(['c']));
      expect(state.anchor).toBe('c');
    });

    it('falls back to select(key) when anchor is not found in orderedKeys', () => {
      useSelectionStore.setState({ selected: new Set(['z']), anchor: 'z' });
      useSelectionStore.getState().selectRange(orderedKeys, 'c');

      const state = useSelectionStore.getState();
      expect(state.selected).toEqual(new Set(['c']));
      expect(state.anchor).toBe('c');
    });
  });

  describe('selectAll', () => {
    it('selects every key and anchors on the last one', () => {
      useSelectionStore.getState().selectAll(['a', 'b', 'c']);

      const state = useSelectionStore.getState();
      expect(state.selected).toEqual(new Set(['a', 'b', 'c']));
      expect(state.anchor).toBe('c');
    });

    it('selects nothing and clears anchor when given an empty array', () => {
      useSelectionStore.setState({ selected: new Set(['a']), anchor: 'a' });
      useSelectionStore.getState().selectAll([]);

      const state = useSelectionStore.getState();
      expect(state.selected).toEqual(new Set());
      expect(state.anchor).toBeNull();
    });
  });

  describe('clear', () => {
    it('empties the selection and resets anchor', () => {
      useSelectionStore.setState({ selected: new Set(['a', 'b']), anchor: 'b' });
      useSelectionStore.getState().clear();

      const state = useSelectionStore.getState();
      expect(state.selected).toEqual(new Set());
      expect(state.anchor).toBeNull();
    });
  });

  describe('retain', () => {
    it('drops keys that are no longer valid, keeping a still-valid anchor', () => {
      useSelectionStore.setState({ selected: new Set(['a', 'b', 'c']), anchor: 'b' });
      useSelectionStore.getState().retain(['a', 'b']);

      const state = useSelectionStore.getState();
      expect(state.selected).toEqual(new Set(['a', 'b']));
      expect(state.anchor).toBe('b');
    });

    it('resets anchor when it is no longer valid', () => {
      useSelectionStore.setState({ selected: new Set(['a', 'b', 'c']), anchor: 'c' });
      useSelectionStore.getState().retain(['a', 'b']);

      const state = useSelectionStore.getState();
      expect(state.selected).toEqual(new Set(['a', 'b']));
      expect(state.anchor).toBeNull();
    });

    it('accepts a Set of valid keys', () => {
      useSelectionStore.setState({ selected: new Set(['a', 'b', 'c']), anchor: 'a' });
      useSelectionStore.getState().retain(new Set(['a']));

      const state = useSelectionStore.getState();
      expect(state.selected).toEqual(new Set(['a']));
      expect(state.anchor).toBe('a');
    });

    it('is a no-op when every selected key is still valid', () => {
      useSelectionStore.setState({ selected: new Set(['a', 'b']), anchor: 'a' });
      useSelectionStore.getState().retain(['a', 'b', 'c']);

      const state = useSelectionStore.getState();
      expect(state.selected).toEqual(new Set(['a', 'b']));
      expect(state.anchor).toBe('a');
    });
  });
});
