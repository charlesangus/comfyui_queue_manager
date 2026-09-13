import { create } from 'zustand';

export const useSelectionStore = create((set) => ({
  selected: new Set(),
  anchor: null,

  select: (key) => set(() => ({
    selected: new Set([key]),
    anchor: key,
  })),

  toggle: (key) => set((state) => {
    const next = new Set(state.selected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    return { selected: next, anchor: key };
  }),

  selectRange: (orderedKeys, key) => set((state) => {
    const anchorIndex = state.anchor !== null ? orderedKeys.indexOf(state.anchor) : -1;
    const keyIndex = orderedKeys.indexOf(key);

    if (anchorIndex === -1 || keyIndex === -1) {
      return { selected: new Set([key]), anchor: key };
    }

    const start = Math.min(anchorIndex, keyIndex);
    const end = Math.max(anchorIndex, keyIndex);
    return { selected: new Set(orderedKeys.slice(start, end + 1)), anchor: state.anchor };
  }),

  selectAll: (orderedKeys) => set(() => ({
    selected: new Set(orderedKeys),
    anchor: orderedKeys.length > 0 ? orderedKeys[orderedKeys.length - 1] : null,
  })),

  clear: () => set(() => ({
    selected: new Set(),
    anchor: null,
  })),

  retain: (keys) => set((state) => {
    const validKeys = keys instanceof Set ? keys : new Set(keys);
    return {
      selected: new Set([...state.selected].filter((key) => validKeys.has(key))),
      anchor: state.anchor !== null && validKeys.has(state.anchor) ? state.anchor : null,
    };
  }),
}));
