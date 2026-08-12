import OperatorDetailWorkspace from '@/components/operators/OperatorDetailWorkspace';

interface OperatorDetailPageProps {
  params: Promise<{ operatorId: string }>;
}

export default async function OperatorDetailPage({ params }: OperatorDetailPageProps) {
  const { operatorId } = await params;
  return <OperatorDetailWorkspace operatorId={operatorId} />;
}
