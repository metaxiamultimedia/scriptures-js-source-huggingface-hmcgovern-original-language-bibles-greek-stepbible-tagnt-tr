# @metaxia/scriptures-source-huggingface-hmcgovern-original-language-bibles-greek-stepbible-tagnt-tr

Textus Receptus (Greek) data for [@metaxia/scriptures](https://github.com/metaxiamultimedia/scriptures-js).

## Source

This package extracts **Textus Receptus readings only** from the [STEPBible TAGNT](https://www.stepbible.org) dataset, filtered via the `manuscript_source` field (rows containing `K`).

- **HuggingFace Dataset:** [hmcgovern/original-language-bibles-greek](https://huggingface.co/datasets/hmcgovern/original-language-bibles-greek)
- **Upstream Data:** [STEPBible-Data](https://github.com/STEPBible/STEPBible-Data)
- **Original Creators:** Tyndale House, Cambridge

## Installation

```bash
npm install @metaxia/scriptures @metaxia/scriptures-source-huggingface-hmcgovern-original-language-bibles-greek-stepbible-tagnt-tr
```

## Usage

### Auto-Registration

```typescript
import '@metaxia/scriptures-source-huggingface-hmcgovern-original-language-bibles-greek-stepbible-tagnt-tr';
import { getVerse } from '@metaxia/scriptures';

const verse = await getVerse('John', 1, 1, { edition: 'hf-hmcgovern-olb-greek-stepbible-tagnt-tr' });
console.log(verse.text);
// "Ἐν ἀρχῇ ἦν ὁ λόγος, καὶ ὁ λόγος ἦν πρὸς τὸν θεόν, καὶ θεὸς ἦν ὁ λόγος."
```

### Lazy Loading

```typescript
import '@metaxia/scriptures-source-huggingface-hmcgovern-original-language-bibles-greek-stepbible-tagnt-tr/register';
import { getVerse } from '@metaxia/scriptures';

const verse = await getVerse('John', 1, 1, { edition: 'hf-hmcgovern-olb-greek-stepbible-tagnt-tr' });
```

## Contents

- **Edition**: hf-hmcgovern-olb-greek-stepbible-tagnt-tr
- **Language**: Greek (with full diacritics, accents, and iota subscripts)
- **Books**: 27 (Matthew-Revelation)
- **Features**:
  - Robinson morphological tagging
  - Strong's concordance numbers
  - Word-level English glosses
  - Gematria values (standard, ordinal, reduced)

## Data Format

```json
{
  "text": "Ἐν ἀρχῇ ἦν ὁ λόγος...",
  "words": [
    {
      "position": 1,
      "text": "Ἐν",
      "lemma": ["G1722"],
      "strongs": "G1722",
      "morph": "robinson:PREP",
      "translation": "In",
      "gematria": { "standard": 55, "ordinal": 12, "reduced": 3 }
    }
  ],
  "gematria": { "standard": 3627, "ordinal": 287, "reduced": 44 }
}
```

## Why TR Only?

The full TAGNT dataset includes words from multiple editions:
- **N** = Nestle-Aland (NA27/28) - Copyrighted
- **K** = Textus Receptus - **Public Domain**
- **O** = Other editions (mixed, includes copyrighted THGNT)

This package filters to `K` only to ensure all Greek text is **public domain**, while still benefiting from STEPBible's excellent morphological tagging (CC BY 4.0).

## License

- **Code**: MIT License
- **Greek Text (TR)**: Public Domain (Scrivener 1894)
- **Morphological Tagging**: CC BY 4.0 (STEPBible / Tyndale House)

### Attribution

- STEP Bible: https://www.stepbible.org
- Tyndale House, Cambridge (original data)
- Hope McGovern (HuggingFace dataset curator)
