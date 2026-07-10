export interface CreateGraphIdOptions {
  prefix?: string;
  fallback?: string;
  maxLength?: number;
}

export interface CreateGraphEdgeIdInput {
  source: string;
  target: string;
  type?: string;
  sourceHandle?: string;
  targetHandle?: string;
}

const defaultMaxIdLength = 96;
const minGraphIdBaseLength = 16;

export function normalizeGraphIdPart(value: unknown, fallback = 'item') {
  const normalized = String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

export function createGraphId(value: unknown, options: CreateGraphIdOptions = {}) {
  const maxLength = options.maxLength ?? defaultMaxIdLength;
  const fallback = options.fallback ?? 'item';
  const valuePart = normalizeGraphIdPart(value, fallback);
  const prefix = options.prefix ? normalizeGraphIdPart(options.prefix, '') : '';
  const id = prefix ? `${prefix}-${valuePart}` : valuePart;

  return id.slice(0, maxLength).replace(/-+$/g, '') || fallback;
}

export function createGraphDedupeKey(...parts: unknown[]) {
  return parts.map((part) => normalizeGraphIdPart(part, 'unknown')).join(':');
}

function createGraphIdHash(value: string) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

export function createGraphEdgeId(input: CreateGraphEdgeIdInput) {
  const dedupeKey = createGraphDedupeKey(
    input.type ?? 'edge',
    input.source,
    input.sourceHandle ?? '',
    input.target,
    input.targetHandle ?? ''
  );
  const hash = createGraphIdHash(dedupeKey);
  const baseMaxLength = Math.max(minGraphIdBaseLength, defaultMaxIdLength - hash.length - 1);
  const base = createGraphId(dedupeKey, {
    prefix: 'edge',
    maxLength: baseMaxLength,
  });

  return `${base}-${hash}`;
}
