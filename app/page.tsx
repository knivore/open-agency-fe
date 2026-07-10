import { redirect } from 'next/navigation';
import { getAgencyApiBaseUrl } from '@/lib/api/config';

async function nextPathFromBackend() {
  const baseUrl = getAgencyApiBaseUrl();
  if (!baseUrl) {
    return '/setup';
  }

  try {
    const response = await fetch(`${baseUrl}/setup/status`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return '/setup';
    }
    const payload = (await response.json()) as { next_path?: unknown };
    const nextPath = typeof payload.next_path === 'string' ? payload.next_path : '/setup';
    return nextPath.startsWith('/') ? nextPath : '/setup';
  } catch {
    return '/setup';
  }
}

export default async function RootPage() {
  redirect(await nextPathFromBackend());
}
