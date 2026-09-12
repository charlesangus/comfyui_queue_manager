import { create } from 'zustand';

export const useOptionsStore = create((set) => ({
  Basic:{},
  Completed:{
    ListOrder: "Newest first",
  },

  /**
   * Set a single option within a category
   */
  setOption: (category, key, value) => set((state) => ({
    ...state,
    [category]: {
      ...state[category],
      [key]: value,
    },
  })),

  /**
   * Set all options within a category
   */
  setOptionsCategory: (category, options) => set((state) => ({
    ...state,
    [category]: options,
  })),

  /**
   * Set all options
   */
  setAllOptions: (allOptions) => set(() => ({
    ...allOptions,
  })),

  /**
   * Set a single option directly on the root state
   */
  setDirectOption: (key, value) => set((state) => ({
    ...state,
    [key]: value,
  })),
}))
