import { stringifyGraphDocument } from './persistence';
import type { GraphDocument } from './types';

function graphExportFileName(document: GraphDocument) {
  const sourceName = document.title || document.id || 'graph';
  const safeName = sourceName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${safeName || 'graph'}.json`;
}

export function downloadGraphDocumentJson(
  document: GraphDocument,
  json = stringifyGraphDocument(document)
) {
  if (typeof window === 'undefined' || typeof globalThis.document === 'undefined') {
    return false;
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = globalThis.document.createElement('a');
  link.href = url;
  link.download = graphExportFileName(document);
  link.rel = 'noopener';
  globalThis.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return true;
}
