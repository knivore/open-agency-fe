import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../lib/integrations/setupGuides.ts', import.meta.url),
  'utf8'
);
const urls = [
  ...new Set(
    [...source.matchAll(/url:\s*'([^']+)'/g)].map((match) => match[1])
  ),
];

if (urls.length === 0) {
  throw new Error('No integration guide resource links were found.');
}

async function checkUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'Open Agency integration guide link checker' },
    });
    // The checker needs only the status; cancelling prevents unread response
    // bodies from keeping CI's HTTP connections alive after the report prints.
    await response.body?.cancel();
    if (!response.ok) return `${url} returned HTTP ${response.status}`;
    return null;
  } catch (error) {
    return `${url} failed: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    clearTimeout(timeout);
  }
}

const failures = [];
for (let index = 0; index < urls.length; index += 8) {
  const batch = await Promise.all(urls.slice(index, index + 8).map(checkUrl));
  failures.push(...batch.filter(Boolean));
}

if (failures.length > 0) {
  console.error(
    `Integration guide link check failed (${failures.length}/${urls.length}):`
  );
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Checked ${urls.length} integration guide links successfully.`);
}
