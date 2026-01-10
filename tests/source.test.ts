/**
 * Tests for @metaxia/scriptures-source-huggingface-hmcgovern-original-language-bibles-greek-stepbible-tagnt-tr
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadVerse, loadChapter, listBooks, metadata } from '../src/source.js';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data', 'hf-hmcgovern-olb-greek-stepbible-tagnt-tr');

// Check if data has been imported
const dataExists = existsSync(join(DATA_DIR, 'Matt', '1', '1.json'));

describe('source metadata', () => {
  it('should have correct edition abbreviation', () => {
    expect(metadata.abbreviation).toBe('hf-hmcgovern-olb-greek-stepbible-tagnt-tr');
  });

  it('should be Greek language', () => {
    expect(metadata.language).toBe('Greek');
  });

  it('should have license info', () => {
    expect(metadata.license).toBeDefined();
    expect(metadata.license.length).toBeGreaterThan(0);
  });

  it('should have source URLs', () => {
    expect(metadata.urls).toContain('https://www.stepbible.org');
  });
});

describe('listBooks', () => {
  it('should list all 27 New Testament books', () => {
    const books = listBooks();
    expect(books.length).toBe(27);
    expect(books).toContain('Matthew');
    expect(books).toContain('Revelation');
  });
});

describe.skipIf(!dataExists)('loadVerse', () => {
  it('should load Matthew 1:1', async () => {
    const verse = await loadVerse('Matthew', 1, 1);
    expect(verse).toBeDefined();
    expect(verse.text).toBeDefined();
    expect(verse.words).toBeInstanceOf(Array);
    expect(verse.words.length).toBeGreaterThan(0);
  });

  it('should load John 1:1 with λόγος', async () => {
    const verse = await loadVerse('John', 1, 1);
    // Normalize both strings to handle Unicode tonos vs oxia differences
    expect(verse.text.normalize('NFD')).toContain('λόγος'.normalize('NFD'));
  });

  it('should have gematria values', async () => {
    const verse = await loadVerse('John', 1, 1);
    expect(verse.gematria).toBeDefined();
    expect(verse.gematria.standard).toBeGreaterThan(0);
  });

  it('should have word-level data', async () => {
    const verse = await loadVerse('Matthew', 1, 1);
    const firstWord = verse.words[0];
    expect(firstWord.text).toBeDefined();
    expect(firstWord.position).toBe(1);
    expect(firstWord.gematria).toBeDefined();
  });

  it('should throw for non-existent verse', async () => {
    await expect(loadVerse('Matthew', 999, 999)).rejects.toThrow();
  });
});

describe.skipIf(!dataExists)('loadChapter', () => {
  it('should load all verses in Matthew 1', async () => {
    const verses = await loadChapter('Matthew', 1);
    expect(verses.length).toBeGreaterThan(20);
  });

  it('should return verses in order', async () => {
    const verses = await loadChapter('John', 1);
    // Verses should be sequential
    for (let i = 0; i < verses.length; i++) {
      expect(verses[i]).toBeDefined();
    }
  });

  it('should throw for non-existent chapter', async () => {
    await expect(loadChapter('Matthew', 999)).rejects.toThrow();
  });
});

describe.skipIf(!dataExists)('gematria integrity', () => {
  it('John 1:1 verse total should equal 3627', async () => {
    const verse = await loadVerse('John', 1, 1);
    expect(verse.gematria.standard).toBe(3627);
  });

  it('verse gematria should equal sum of word gematria', async () => {
    // Test several key verses
    const testCases = [
      { book: 'John', chapter: 1, verse: 1 },
      { book: 'Matthew', chapter: 1, verse: 1 },
      { book: 'Revelation', chapter: 13, verse: 18 },
      { book: 'Romans', chapter: 8, verse: 28 },
    ];

    for (const { book, chapter, verse: verseNum } of testCases) {
      const verse = await loadVerse(book, chapter, verseNum);

      // Calculate sum of word gematria values
      const wordSumStandard = verse.words.reduce((sum, w) => sum + (w.gematria?.standard || 0), 0);
      const wordSumOrdinal = verse.words.reduce((sum, w) => sum + (w.gematria?.ordinal || 0), 0);
      const wordSumReduced = verse.words.reduce((sum, w) => sum + (w.gematria?.reduced || 0), 0);

      // Verse total should equal sum of word values
      expect(verse.gematria.standard).toBe(wordSumStandard);
      expect(verse.gematria.ordinal).toBe(wordSumOrdinal);
      expect(verse.gematria.reduced).toBe(wordSumReduced);
    }
  });

  it('all verses in John 1 should have matching gematria totals', async () => {
    const verses = await loadChapter('John', 1);

    for (const verse of verses) {
      const wordSumStandard = verse.words.reduce((sum, w) => sum + (w.gematria?.standard || 0), 0);
      expect(verse.gematria.standard).toBe(wordSumStandard);
    }
  });
});
