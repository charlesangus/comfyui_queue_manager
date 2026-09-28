import { create } from 'zustand';

export const useAppStore = create((set) => ({
  filters : null,
  route : "queue",
  shiftDown: false,
  setFilters : (filters) => set((state) => ({...state, filters: filters})),
  setRoute : (route) => set((state) => ({...state, route: route})),
  setShiftDown : (shiftDown) => set((state) => ({...state, shiftDown: shiftDown})),
}));
