import { describe, expect, it } from 'vitest';
import {
  COMMON_REQUEST_HEADERS,
  HTTP_METHODS,
  METHOD_COLORS,
  METHOD_LABEL_WIDTH,
  formatSize,
  formatTime,
  getStatusClasses,
} from './http';

describe('getStatusClasses', () => {
  it('returns emerald for 2xx', () => {
    expect(getStatusClasses(200)).toContain('emerald');
    expect(getStatusClasses(201)).toContain('emerald');
    expect(getStatusClasses(204)).toContain('emerald');
    expect(getStatusClasses(299)).toContain('emerald');
  });

  it('returns blue for 3xx', () => {
    expect(getStatusClasses(301)).toContain('blue');
    expect(getStatusClasses(304)).toContain('blue');
    expect(getStatusClasses(399)).toContain('blue');
  });

  it('returns orange for 4xx', () => {
    expect(getStatusClasses(400)).toContain('orange');
    expect(getStatusClasses(401)).toContain('orange');
    expect(getStatusClasses(404)).toContain('orange');
    expect(getStatusClasses(499)).toContain('orange');
  });

  it('returns rose for 5xx', () => {
    expect(getStatusClasses(500)).toContain('rose');
    expect(getStatusClasses(502)).toContain('rose');
    expect(getStatusClasses(599)).toContain('rose');
  });

  it('returns muted for unknown status codes', () => {
    expect(getStatusClasses(0)).toContain('muted');
    expect(getStatusClasses(100)).toContain('muted');
    expect(getStatusClasses(199)).toContain('muted');
  });
});

describe('formatSize', () => {
  it('formats 0 bytes', () => {
    expect(formatSize(0)).toBe('0 B');
  });

  it('formats bytes under 1KB', () => {
    expect(formatSize(1)).toBe('1 B');
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(1023)).toBe('1023 B');
  });

  it('formats KB with one decimal', () => {
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1536)).toBe('1.5 KB');
    expect(formatSize(10240)).toBe('10.0 KB');
  });

  it('formats MB with one decimal', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });
});

describe('formatTime', () => {
  it('formats milliseconds under 1s', () => {
    expect(formatTime(0)).toBe('0 ms');
    expect(formatTime(42)).toBe('42 ms');
    expect(formatTime(999)).toBe('999 ms');
  });

  it('formats seconds with two decimals at and above 1000ms', () => {
    expect(formatTime(1000)).toBe('1.00 s');
    expect(formatTime(1500)).toBe('1.50 s');
    expect(formatTime(60000)).toBe('60.00 s');
  });
});

describe('HTTP_METHODS', () => {
  it('contains the standard 7 methods', () => {
    expect(HTTP_METHODS).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);
  });
});

describe('METHOD_COLORS', () => {
  it('has a color entry for every method', () => {
    for (const method of HTTP_METHODS) {
      expect(METHOD_COLORS[method]).toBeDefined();
      expect(METHOD_COLORS[method].text).toBeTruthy();
      expect(METHOD_COLORS[method].dark).toBeTruthy();
    }
  });
});

describe('METHOD_LABEL_WIDTH', () => {
  it('has a width for every method', () => {
    for (const method of HTTP_METHODS) {
      expect(METHOD_LABEL_WIDTH[method]).toBeTruthy();
    }
  });
});

describe('COMMON_REQUEST_HEADERS', () => {
  it('includes Authorization and Content-Type', () => {
    expect(COMMON_REQUEST_HEADERS).toContain('Authorization');
    expect(COMMON_REQUEST_HEADERS).toContain('Content-Type');
  });

  it('has at least 40 entries', () => {
    expect(COMMON_REQUEST_HEADERS.length).toBeGreaterThanOrEqual(40);
  });
});
