/**
 * @metaxia/scriptures-source-huggingface-hmcgovern-original-language-bibles-greek-stepbible-tagnt-tr
 *
 * Textus Receptus (STEPBible) data for @metaxia/scriptures.
 * Auto-registers with the scriptures library when imported.
 */

import { registerSource } from '@metaxia/scriptures-core';
import { sourceInfo, loadVerse, loadChapter, loadCache, listBooks } from './source.js';

registerSource({
  edition: sourceInfo.edition,
  metadata: sourceInfo.metadata,
  loadVerse,
  loadChapter,
  loadCache,
  listBooks,
});

export { sourceInfo, loadVerse, loadChapter, loadCache, listBooks };
export { metadata } from './source.js';
