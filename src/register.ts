/**
 * Lazy registration entry point.
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
