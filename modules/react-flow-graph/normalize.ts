import type { GraphJsonObject } from './types';
import { createGraphDedupeKey } from './ids';

export function normalizeGraphLabel(value: unknown, fallback = 'Untitled') {
  const label = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  return label || fallback;
}

export function isGraphJsonObject(value: unknown): value is GraphJsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeGraphMetadata(value: unknown): GraphJsonObject {
  return isGraphJsonObject(value) ? value : {};
}

export function normalizeGraphDedupeKey(...parts: unknown[]) {
  return createGraphDedupeKey(...parts);
}
