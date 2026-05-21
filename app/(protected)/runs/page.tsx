import { RunsWorkspace } from '@/components/runs';
import { Suspense } from 'react';

export default function RunsPage() {
  return (
    <Suspense fallback={null}>
      <RunsWorkspace />
    </Suspense>
  );
}
