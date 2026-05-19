import { RunDetailWorkspace } from '@/components/runs';

interface RunDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { id } = await params;
  return <RunDetailWorkspace runId={id} />;
}
