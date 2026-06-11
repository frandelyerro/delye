import { describe, expect, it } from 'vitest';
import { csvEscape } from '../exportReport';

describe('csvEscape', () => {
  it('passes through plain values unchanged', () => {
    expect(csvEscape('Marun Norte')).toBe('Marun Norte');
    expect(csvEscape(42)).toBe('42');
    expect(csvEscape(0)).toBe('0');
  });

  it('renders null/undefined as an empty string', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('quote-wraps values containing commas, quotes, or newlines', () => {
    expect(csvEscape('Neuquen, Argentina')).toBe('"Neuquen, Argentina"');
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralizes formula-injection values by prefixing a single quote', () => {
    expect(csvEscape('=cmd|/c calc!A1')).toBe("'=cmd|/c calc!A1");
    // A leading formula char AND a comma → prefixed and quote-wrapped.
    expect(csvEscape('=1,2')).toBe('"\'=1,2"');
    expect(csvEscape('+1234')).toBe("'+1234");
    expect(csvEscape('-2+3')).toBe("'-2+3");
    expect(csvEscape('@SUM(A1:A9)')).toBe("'@SUM(A1:A9)");
    expect(csvEscape('\tTAB')).toBe("'\tTAB");
  });

  it('does not prefix when the formula char is not leading', () => {
    expect(csvEscape('A=B')).toBe('A=B');
    expect(csvEscape('well-1')).toBe('well-1');
  });
});
