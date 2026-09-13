import { describe, it, expect } from 'vitest';
import { compareVersions } from './functions';

describe('compareVersions', () => {
  describe('equal versions', () => {
    it('returns 0 for identical versions', () => {
      expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    });

    it('returns 0 for versions with different segment counts but same value', () => {
      expect(compareVersions('1.2.0', '1.2')).toBe(0);
      expect(compareVersions('1.0.0', '1')).toBe(0);
      expect(compareVersions('1.2', '1.2.0')).toBe(0);
    });

    it('returns 0 for versions with trailing zeros', () => {
      expect(compareVersions('1.0.0.0', '1.0')).toBe(0);
    });
  });

  describe('a greater than b', () => {
    it('returns 1 when first segment of a is greater', () => {
      expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    });

    it('returns 1 when second segment of a is greater', () => {
      expect(compareVersions('1.3.0', '1.2.9')).toBe(1);
    });

    it('returns 1 when third segment of a is greater', () => {
      expect(compareVersions('1.2.5', '1.2.3')).toBe(1);
    });

    it('returns 1 when a has more segments with non-zero value', () => {
      expect(compareVersions('1.2.1', '1.2')).toBe(1);
    });
  });

  describe('a less than b', () => {
    it('returns -1 when first segment of a is less', () => {
      expect(compareVersions('1.9.9', '2.0.0')).toBe(-1);
    });

    it('returns -1 when second segment of a is less', () => {
      expect(compareVersions('1.2.9', '1.3.0')).toBe(-1);
    });

    it('returns -1 when third segment of a is less', () => {
      expect(compareVersions('1.2.3', '1.2.5')).toBe(-1);
    });

    it('returns -1 when a has fewer segments', () => {
      expect(compareVersions('1.2', '1.2.1')).toBe(-1);
    });
  });

  describe('differing segment counts', () => {
    it('treats missing segments as 0', () => {
      expect(compareVersions('1.2', '1.2.0')).toBe(0);
      expect(compareVersions('1', '1.0.0')).toBe(0);
      expect(compareVersions('2.1', '2.1.0.0')).toBe(0);
    });

    it('correctly compares versions with different lengths', () => {
      expect(compareVersions('1.2.3.4.5', '1.2.3')).toBe(1);
      expect(compareVersions('1.2.3.4', '1.2.3')).toBe(1);
      expect(compareVersions('1.2', '1.2.3.4')).toBe(-1);
    });
  });

  describe('non-numeric segments', () => {
    it('treats non-numeric segments as 0', () => {
      expect(compareVersions('1.a.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.x.5', '1.0.5')).toBe(0);
    });

    it('handles alpha-numeric segments', () => {
      expect(compareVersions('1.2.3', '1.2.b')).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('handles single segment versions', () => {
      expect(compareVersions('1', '1')).toBe(0);
      expect(compareVersions('2', '1')).toBe(1);
      expect(compareVersions('1', '2')).toBe(-1);
    });

    it('handles versions with empty strings in numeric conversion', () => {
      expect(compareVersions('1..0', '1.0.0')).toBe(0);
    });
  });
});
