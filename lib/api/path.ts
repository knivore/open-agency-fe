export function encodePathSegment(value: string | number): string {
  const segment = String(value);

  // WHATWG URL parsing normalizes literal "." and ".." segments before fetch,
  // so dynamic backend destinations must fail closed before URL construction.
  if (!segment || segment === '.' || segment === '..') {
    throw new Error('Dynamic API path segments must be non-empty and cannot be dot segments.');
  }

  return encodeURIComponent(segment);
}
