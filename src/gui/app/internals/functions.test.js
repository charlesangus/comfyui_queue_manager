import { describe, it, expect } from 'vitest';
import { compareVersions, formatCardTime } from './functions';

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

describe('formatCardTime', () => {
  const now = new Date(2026, 9, 4, 18, 30);

  it('returns null for missing or unparseable values', () => {
    expect(formatCardTime(null, now)).toBeNull();
    expect(formatCardTime(undefined, now)).toBeNull();
    expect(formatCardTime('', now)).toBeNull();
    expect(formatCardTime('not a date', now)).toBeNull();
  });

  it('reads database timestamps as UTC', () => {
    const local = new Date(2026, 9, 4, 9, 5);
    const utc = local.toISOString().slice(0, 19).replace('T', ' ');
    expect(formatCardTime(utc, now).title).toBe(local.toLocaleString());
  });

  it('shows only the time for today', () => {
    const local = new Date(2026, 9, 4, 9, 5);
    const utc = local.toISOString().slice(0, 19).replace('T', ' ');
    expect(formatCardTime(utc, now).label).toBe(local.toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' }));
  });

  it('adds the date for other days this year', () => {
    const local = new Date(2026, 8, 30, 23, 59);
    const utc = local.toISOString().slice(0, 19).replace('T', ' ');
    expect(formatCardTime(utc, now).label).toBe(
      local.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    );
  });

  it('shows only the date for earlier years', () => {
    const local = new Date(2025, 11, 31, 12, 0);
    const utc = local.toISOString().slice(0, 19).replace('T', ' ');
    expect(formatCardTime(utc, now).label).toBe(
      local.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    );
  });
});
