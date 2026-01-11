/**
 * Tests for the import script parsing logic.
 */

import { describe, it, expect } from 'vitest';

// Greek letter to numeric value mappings for gematria
const GREEK_VALUES: Record<string, number> = {
  'α': 1, 'β': 2, 'γ': 3, 'δ': 4, 'ε': 5, 'ϛ': 6, 'ζ': 7, 'η': 8, 'θ': 9,
  'ι': 10, 'κ': 20, 'λ': 30, 'μ': 40, 'ν': 50, 'ξ': 60, 'ο': 70, 'π': 80, 'ϟ': 90,
  'ρ': 100, 'σ': 200, 'ς': 200, 'τ': 300, 'υ': 400, 'φ': 500, 'χ': 600, 'ψ': 700, 'ω': 800, 'ϡ': 900,
};

const GREEK_ORDINAL: Record<string, number> = {
  'α': 1, 'β': 2, 'γ': 3, 'δ': 4, 'ε': 5, 'ζ': 6, 'η': 7, 'θ': 8,
  'ι': 9, 'κ': 10, 'λ': 11, 'μ': 12, 'ν': 13, 'ξ': 14, 'ο': 15, 'π': 16,
  'ρ': 17, 'σ': 18, 'ς': 18, 'τ': 19, 'υ': 20, 'φ': 21, 'χ': 22, 'ψ': 23, 'ω': 24,
};

function normalizeGreek(text: string): string {
  // NFD decomposes characters, then we:
  // 1. Convert iota subscript (U+0345) to regular iota before stripping diacritics
  // 2. Strip remaining combining diacritical marks (accents, breathings)
  return text
    .normalize('NFD')
    .replace(/\u0345/g, 'ι')  // Preserve iota subscript as regular iota
    .replace(/[\u0300-\u036f]/g, '')  // Remove other combining marks
    .toLowerCase();
}

function computeGreek(text: string): Record<string, number> {
  const normalized = normalizeGreek(text);
  let standard = 0;
  let ordinal = 0;
  let reduced = 0;

  for (const char of normalized) {
    const stdVal = GREEK_VALUES[char];
    const ordVal = GREEK_ORDINAL[char];
    if (stdVal !== undefined) {
      standard += stdVal;
    }
    if (ordVal !== undefined) {
      ordinal += ordVal;
      let val = ordVal;
      while (val > 9) {
        let sum = 0;
        while (val > 0) {
          sum += val % 10;
          val = Math.floor(val / 10);
        }
        val = sum;
      }
      reduced += val;
    }
  }

  return { standard, ordinal, reduced };
}

describe('reference parsing', () => {
  function parseReference(ref: string) {
    const match = ref.match(/^(\w+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (!match) return null;
    const [, book, chapter, verse, position] = match;
    return { book, chapter: parseInt(chapter), verse: parseInt(verse), position: parseInt(position) };
  }

  it('should parse standard reference format', () => {
    const result = parseReference('Mat.1.1.01');
    expect(result).toEqual({ book: 'Mat', chapter: 1, verse: 1, position: 1 });
  });

  it('should parse multi-digit values', () => {
    const result = parseReference('Rev.22.21.15');
    expect(result).toEqual({ book: 'Rev', chapter: 22, verse: 21, position: 15 });
  });

  it('should return null for invalid format', () => {
    expect(parseReference('invalid')).toBeNull();
    expect(parseReference('Mat.1.1')).toBeNull();
  });
});

describe('dStrongs parsing', () => {
  function parseDStrongs(dStrongs: string) {
    // Match optional sense suffix letter (A-Z) after the Strong's number
    const match = dStrongs.match(/^G(\d+)[A-Z]?=(.+)$/);
    if (!match) return null;
    const [, num, morph] = match;
    return { strongs: `G${parseInt(num)}`, morph: `robinson:${morph}` };
  }

  it('should parse Strong\'s number and morphology', () => {
    const result = parseDStrongs('G0976=N-NSF');
    expect(result).toEqual({ strongs: 'G976', morph: 'robinson:N-NSF' });
  });

  it('should normalize leading zeros', () => {
    const result = parseDStrongs('G00001=CONJ');
    expect(result).toEqual({ strongs: 'G1', morph: 'robinson:CONJ' });
  });

  it('should handle verb morphology', () => {
    const result = parseDStrongs('G2532=V-AAI-3S');
    expect(result).toEqual({ strongs: 'G2532', morph: 'robinson:V-AAI-3S' });
  });

  it('should handle sense suffix G (Jesus)', () => {
    // G2424G indicates a sense variant of Strong's G2424 (Ἰησοῦς/Jesus)
    const result = parseDStrongs('G2424G=N-NSM-P');
    expect(result).toEqual({ strongs: 'G2424', morph: 'robinson:N-NSM-P' });
  });

  it('should handle sense suffix H (ὅτι)', () => {
    // G3754H indicates a sense variant of Strong's G3754 (ὅτι/that)
    const result = parseDStrongs('G3754H=CONJ');
    expect(result).toEqual({ strongs: 'G3754', morph: 'robinson:CONJ' });
  });

  it('should handle sense suffix for other words', () => {
    // Various sense suffixes: G, H, I, J, K, L, M, N, O
    expect(parseDStrongs('G1487G=COND')).toEqual({ strongs: 'G1487', morph: 'robinson:COND' });
    expect(parseDStrongs('G3004G=V-PAI-3S')).toEqual({ strongs: 'G3004', morph: 'robinson:V-PAI-3S' });
    expect(parseDStrongs('G2962G=N-GSM-T')).toEqual({ strongs: 'G2962', morph: 'robinson:N-GSM-T' });
    expect(parseDStrongs('G4613O=N-NSM-P')).toEqual({ strongs: 'G4613', morph: 'robinson:N-NSM-P' });
  });
});

describe('manuscript_source filtering', () => {
  it('should include rows with K', () => {
    const sources = ['NKO', 'K', 'NK', 'KO', 'nKo'];
    for (const src of sources) {
      expect(src.includes('K')).toBe(true);
    }
  });

  it('should exclude rows without K', () => {
    const sources = ['NO', 'N', 'O', 'no'];
    for (const src of sources) {
      expect(src.includes('K')).toBe(false);
    }
  });
});

describe('gematria with diacritics', () => {
  it('should calculate gematria for accented Greek', () => {
    const result = computeGreek('λόγος');
    expect(result.standard).toBe(373);  // λ=30, ο=70, γ=3, ο=70, σ=200
  });

  it('should handle iota subscript', () => {
    // τῷ = tau + omega with iota subscript
    // τ=300, ω=800, ι=10 (subscript) = 1110
    const result = computeGreek('τῷ');
    // This test verifies iota subscript is INCLUDED in calculation
    expect(result.standard).toBe(1110);  // 300 + 800 + 10
  });

  it('should include iota subscript in gematria (ᾳ, ῃ, ῳ)', () => {
    // ἀρχῇ has eta with iota subscript: α=1, ρ=100, χ=600, η=8, ι=10 = 719
    const result = computeGreek('ἀρχῇ');
    expect(result.standard).toBe(719);  // With iota subscript

    // Without iota subscript would be 709
    const withoutSubscript = computeGreek('ἀρχη');
    expect(withoutSubscript.standard).toBe(709);

    // Difference should be exactly iota value (10)
    expect(result.standard - withoutSubscript.standard).toBe(10);
  });

  it('should match accented and unaccented', () => {
    const withAccent = computeGreek('λόγος');
    const without = computeGreek('λογος');
    expect(withAccent.standard).toBe(without.standard);
  });

  it('should calculate ordinal values', () => {
    const result = computeGreek('λόγος');
    expect(result.ordinal).toBeGreaterThan(0);
  });

  it('should calculate reduced values', () => {
    const result = computeGreek('λόγος');
    expect(result.reduced).toBeGreaterThan(0);
  });
});
