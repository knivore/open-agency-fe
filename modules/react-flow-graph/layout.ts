import type { GraphDocument } from './types';

export interface LayoutGraphDocumentGridOptions {
  columns?: number;
  startX?: number;
  startY?: number;
  gapX?: number;
  gapY?: number;
}

export function layoutGraphDocumentGrid<TDocument extends GraphDocument>(
  document: TDocument,
  options: LayoutGraphDocumentGridOptions = {}
): TDocument {
  const columns = Math.max(1, options.columns ?? Math.ceil(Math.sqrt(document.nodes.length || 1)));
  const startX = options.startX ?? 80;
  const startY = options.startY ?? 80;
  const gapX = options.gapX ?? 280;
  const gapY = options.gapY ?? 160;

  return {
    ...document,
    nodes: document.nodes.map((node, index) => ({
      ...node,
      position: {
        x: startX + (index % columns) * gapX,
        y: startY + Math.floor(index / columns) * gapY,
      },
    })),
  };
}
