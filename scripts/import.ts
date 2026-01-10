/**
 * Import script for STEPBible Textus Receptus data.
 *
 * Downloads the TAGNT dataset from HuggingFace, filters to TR-only readings,
 * and converts to JSON format.
 *
 * Usage: npx tsx scripts/import.ts
 */

import { mkdir, writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const PARQUET_URL = 'https://huggingface.co/datasets/hmcgovern/original-language-bibles-greek/resolve/main/data/train-00000-of-00001.parquet';
const SOURCE_DIR = join(ROOT_DIR, 'source');
const DATA_DIR = join(ROOT_DIR, 'data', 'hf-hmcgovern-olb-greek-stepbible-tagnt-tr');

// Book abbreviation mapping from HuggingFace TAGNT format to OSIS
// Source abbreviations: 1Co, 1Jn, 1Pe, 1Th, 1Ti, 2Co, 2Jn, 2Pe, 2Th, 2Ti,
//                       3Jn, Act, Col, Eph, Gal, Heb, Jas, Jhn, Jud, Luk,
//                       Mat, Mrk, Phm, Php, Rev, Rom, Tit
const BOOK_MAP: Record<string, string> = {
  'Mat': 'Matt', 'Mrk': 'Mark', 'Luk': 'Luke', 'Jhn': 'John',
  'Act': 'Acts', 'Rom': 'Rom', '1Co': '1Cor', '2Co': '2Cor',
  'Gal': 'Gal', 'Eph': 'Eph', 'Php': 'Phil', 'Col': 'Col',
  '1Th': '1Thess', '2Th': '2Thess', '1Ti': '1Tim', '2Ti': '2Tim',
  'Tit': 'Titus', 'Phm': 'Phlm', 'Heb': 'Heb',
  'Jas': 'Jas', '1Pe': '1Pet', '2Pe': '2Pet',
  '1Jn': '1John', '2Jn': '2John', '3Jn': '3John',
  'Jud': 'Jude', 'Rev': 'Rev',
};

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

interface WordEntry {
  position: number;
  text: string;
  lemma?: string[] | null;
  morph?: string | null;
  strongs?: string;
  translation?: string;
  metadata: Record<string, unknown>;
  gematria: Record<string, number>;
}

interface VerseData {
  text: string;
  words: WordEntry[];
  gematria: Record<string, number>;
}

interface RawRow {
  reference: string;
  text: string;
  transliteration: string;
  translation: string;
  dStrongs: string;
  manuscript_source: string;
}

/**
 * Normalize Greek text by removing diacritics for gematria calculation.
 * Preserves iota subscript (U+0345) as regular iota for proper gematria.
 */
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

/**
 * Calculate gematria values for Greek text.
 */
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
      // Reduced: sum digits of ordinal value
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

/**
 * Download the Parquet file from HuggingFace.
 */
async function downloadParquet(): Promise<string> {
  const parquetPath = join(SOURCE_DIR, 'tagnt.parquet');

  if (existsSync(parquetPath)) {
    console.log('  → Using cached Parquet file');
    return parquetPath;
  }

  await mkdir(SOURCE_DIR, { recursive: true });

  console.log('  → Downloading TAGNT Parquet from HuggingFace...');
  const response = await fetch(PARQUET_URL, {
    headers: { 'User-Agent': 'scriptures-js-importer/1.0' }
  });

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await writeFile(parquetPath, Buffer.from(buffer));
  console.log('  ✓ Downloaded Parquet file');

  return parquetPath;
}

/**
 * Read and parse the Parquet file.
 * Uses parquet-wasm for Node.js compatibility.
 */
async function readParquet(parquetPath: string): Promise<RawRow[]> {
  console.log('  → Reading Parquet file...');

  // Dynamic import for parquet-wasm
  const parquet = await import('parquet-wasm');

  const fileBuffer = await readFile(parquetPath);
  const arrowTable = parquet.readParquet(fileBuffer);

  // Debug: inspect available methods/properties
  console.log(`  → Table keys: ${Object.keys(arrowTable).join(', ')}`);
  console.log(`  → Table methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(arrowTable)).join(', ')}`);

  // parquet-wasm returns an Arrow IPC stream, need to convert to usable format
  // Try using intoIPCStream or toArray methods
  let rows: RawRow[] = [];

  // Check if it has a toArray method
  if (typeof arrowTable.toArray === 'function') {
    const data = arrowTable.toArray();
    console.log(`  → toArray returned ${data.length} items`);
    rows = data.map((row: Record<string, unknown>) => ({
      reference: String(row.reference || ''),
      text: String(row.text || ''),
      transliteration: String(row.transliteration || ''),
      translation: String(row.translation || ''),
      dStrongs: String(row.dStrongs || ''),
      manuscript_source: String(row.manuscript_source || ''),
    }));
  } else if (typeof arrowTable[Symbol.iterator] === 'function') {
    // It might be iterable
    console.log(`  → Table is iterable`);
    for (const row of arrowTable) {
      rows.push({
        reference: String(row.reference || ''),
        text: String(row.text || ''),
        transliteration: String(row.transliteration || ''),
        translation: String(row.translation || ''),
        dStrongs: String(row.dStrongs || ''),
        manuscript_source: String(row.manuscript_source || ''),
      });
    }
  } else {
    // Try to use Arrow JS to read the IPC data
    console.log(`  → Attempting Arrow IPC conversion...`);
    const arrowJS = await import('apache-arrow');
    const ipcData = arrowTable.intoIPCStream();
    const table = arrowJS.tableFromIPC(ipcData);

    console.log(`  → Arrow table has ${table.numRows} rows`);

    for (let i = 0; i < table.numRows; i++) {
      const row = table.get(i);
      rows.push({
        reference: String(row?.reference || ''),
        text: String(row?.text || ''),
        transliteration: String(row?.transliteration || ''),
        translation: String(row?.translation || ''),
        dStrongs: String(row?.dStrongs || ''),
        manuscript_source: String(row?.manuscript_source || ''),
      });
    }
  }

  if (rows.length > 0) {
    console.log(`  → Sample row: ${JSON.stringify(rows[0])}`);
  }

  console.log(`  ✓ Read ${rows.length} total rows`);
  return rows;
}

/**
 * Filter to Textus Receptus readings only.
 * TR is indicated by 'K' in the manuscript_source field.
 */
function filterToTR(rows: RawRow[]): RawRow[] {
  const filtered = rows.filter(row => row.manuscript_source.includes('K'));
  console.log(`  → Filtered to ${filtered.length} TR readings (${((filtered.length / rows.length) * 100).toFixed(1)}%)`);
  return filtered;
}

/**
 * Parse reference string into components.
 * Format: "Mat.1.1.01" -> { book: "Matt", chapter: 1, verse: 1, position: 1 }
 */
function parseReference(ref: string): { book: string; chapter: number; verse: number; position: number } | null {
  const match = ref.match(/^(\w+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;

  const [, bookAbbr, chapter, verse, position] = match;
  const book = BOOK_MAP[bookAbbr] || bookAbbr;

  return {
    book,
    chapter: parseInt(chapter, 10),
    verse: parseInt(verse, 10),
    position: parseInt(position, 10),
  };
}

/**
 * Parse dStrongs field into Strong's number and morphology.
 * Format: "G0976=N-NSF" -> { strongs: "G976", morph: "robinson:N-NSF" }
 */
function parseDStrongs(dStrongs: string): { strongs: string; morph: string } | null {
  const match = dStrongs.match(/^G(\d+)=(.+)$/);
  if (!match) return null;

  const [, num, morph] = match;
  // Normalize Strong's: remove leading zeros
  const normalizedNum = parseInt(num, 10);

  return {
    strongs: `G${normalizedNum}`,
    morph: `robinson:${morph}`,
  };
}

/**
 * Group rows by verse and build verse data structures.
 */
function groupByVerse(rows: RawRow[]): Map<string, { book: string; chapter: number; verse: number; words: WordEntry[] }> {
  const verses = new Map<string, { book: string; chapter: number; verse: number; words: WordEntry[] }>();

  for (const row of rows) {
    const ref = parseReference(row.reference);
    if (!ref) continue;

    const verseKey = `${ref.book}.${ref.chapter}.${ref.verse}`;

    if (!verses.has(verseKey)) {
      verses.set(verseKey, {
        book: ref.book,
        chapter: ref.chapter,
        verse: ref.verse,
        words: [],
      });
    }

    const parsed = parseDStrongs(row.dStrongs);

    const entry: WordEntry = {
      position: ref.position,
      text: row.text,
      lemma: parsed ? [parsed.strongs] : null,
      strongs: parsed?.strongs,
      morph: parsed?.morph || null,
      translation: row.translation,
      metadata: {},
      gematria: computeGreek(row.text),
    };

    verses.get(verseKey)!.words.push(entry);
  }

  // Sort words within each verse by position
  for (const verse of verses.values()) {
    verse.words.sort((a, b) => a.position - b.position);
    // Renumber positions to be sequential (1-based)
    verse.words.forEach((w, i) => { w.position = i + 1; });
  }

  return verses;
}

/**
 * Save a verse to JSON file.
 */
async function saveVerse(book: string, chapter: number, verse: number, words: WordEntry[]): Promise<void> {
  const verseDir = join(DATA_DIR, book, String(chapter));
  await mkdir(verseDir, { recursive: true });

  // Build verse text
  let text = words.map(w => w.text).join(' ');
  // Clean up punctuation spacing
  text = text.replace(/\s+([,.;:!?·])/g, '$1');

  // Calculate total gematria
  const totals: Record<string, number> = {};
  for (const word of words) {
    for (const [k, v] of Object.entries(word.gematria)) {
      totals[k] = (totals[k] || 0) + v;
    }
  }

  const data: VerseData = {
    text,
    words,
    gematria: totals,
  };

  const filePath = join(verseDir, `${verse}.json`);
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Save metadata file.
 */
async function saveMetadata(): Promise<void> {
  const metadata = {
    abbreviation: 'TR',
    name: 'Textus Receptus (STEPBible)',
    language: 'Greek',
    license: 'CC BY 4.0',
    source: 'STEPBible',
    urls: [
      'https://www.stepbible.org',
      'https://huggingface.co/datasets/hmcgovern/original-language-bibles-greek',
      'https://github.com/STEPBible/STEPBible-Data',
    ],
    attribution: {
      source: 'STEP Bible / Tyndale House Cambridge - CC BY 4.0',
      huggingface_curator: 'Hope McGovern',
    },
    filter: 'manuscript_source contains K (Textus Receptus only)',
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    join(DATA_DIR, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  );
}

/**
 * Main import function.
 */
async function main(): Promise<void> {
  console.log('STEPBible Textus Receptus Importer');
  console.log('===================================\n');

  try {
    // Download Parquet
    const parquetPath = await downloadParquet();

    // Read and parse
    const allRows = await readParquet(parquetPath);

    // Filter to TR only
    const trRows = filterToTR(allRows);

    // Group by verse
    console.log('  → Grouping by verse...');
    const verses = groupByVerse(trRows);
    console.log(`  ✓ Found ${verses.size} verses`);

    // Save verses
    console.log('  → Saving verses...');
    let count = 0;
    for (const [, verse] of verses) {
      await saveVerse(verse.book, verse.chapter, verse.verse, verse.words);
      count++;
      if (count % 1000 === 0) {
        console.log(`    Saved ${count}/${verses.size} verses...`);
      }
    }

    // Save metadata
    await saveMetadata();

    console.log(`\n✓ Successfully imported ${count} verses to ${DATA_DIR}`);
    console.log('  Only Textus Receptus readings were included (manuscript_source contains K)');
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

main();
