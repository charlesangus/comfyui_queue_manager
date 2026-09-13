import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './appStore';

describe('appStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      filters: null,
      route: 'queue',
      clientId: null,
      shiftDown: false,
    });
  });

  describe('setFilters', () => {
    it('updates filters and leaves other state unchanged', () => {
      const testFilters = { status: 'active' };
      useAppStore.getState().setFilters(testFilters);

      const state = useAppStore.getState();
      expect(state.filters).toEqual(testFilters);
      expect(state.route).toBe('queue');
      expect(state.clientId).toBeNull();
      expect(state.shiftDown).toBe(false);
    });

    it('replaces previous filters', () => {
      useAppStore.getState().setFilters({ status: 'active' });
      const newFilters = { status: 'completed' };
      useAppStore.getState().setFilters(newFilters);

      expect(useAppStore.getState().filters).toEqual(newFilters);
    });
  });

  describe('setRoute', () => {
    it('updates route and leaves other state unchanged', () => {
      useAppStore.getState().setRoute('history');

      const state = useAppStore.getState();
      expect(state.route).toBe('history');
      expect(state.filters).toBeNull();
      expect(state.clientId).toBeNull();
      expect(state.shiftDown).toBe(false);
    });

    it('replaces previous route', () => {
      useAppStore.getState().setRoute('history');
      useAppStore.getState().setRoute('settings');

      expect(useAppStore.getState().route).toBe('settings');
    });
  });

  describe('setClientId', () => {
    it('updates clientId and leaves other state unchanged', () => {
      useAppStore.getState().setClientId('client-123');

      const state = useAppStore.getState();
      expect(state.clientId).toBe('client-123');
      expect(state.filters).toBeNull();
      expect(state.route).toBe('queue');
      expect(state.shiftDown).toBe(false);
    });

    it('can set clientId to null', () => {
      useAppStore.getState().setClientId('client-123');
      useAppStore.getState().setClientId(null);

      expect(useAppStore.getState().clientId).toBeNull();
    });
  });

  describe('setShiftDown', () => {
    it('updates shiftDown to true and leaves other state unchanged', () => {
      useAppStore.getState().setShiftDown(true);

      const state = useAppStore.getState();
      expect(state.shiftDown).toBe(true);
      expect(state.filters).toBeNull();
      expect(state.route).toBe('queue');
      expect(state.clientId).toBeNull();
    });

    it('updates shiftDown to false', () => {
      useAppStore.getState().setShiftDown(true);
      useAppStore.getState().setShiftDown(false);

      expect(useAppStore.getState().shiftDown).toBe(false);
    });
  });

  describe('multiple state updates', () => {
    it('allows setting multiple state properties independently', () => {
      const state = useAppStore.getState();
      state.setRoute('history');
      state.setClientId('client-456');
      state.setShiftDown(true);
      state.setFilters({ type: 'input' });

      const updatedState = useAppStore.getState();
      expect(updatedState.route).toBe('history');
      expect(updatedState.clientId).toBe('client-456');
      expect(updatedState.shiftDown).toBe(true);
      expect(updatedState.filters).toEqual({ type: 'input' });
    });
  });
});
