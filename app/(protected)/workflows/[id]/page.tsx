import WorkflowDetailWorkspace from '@/components/workflow/WorkflowDetailWorkspace';

interface WorkflowDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkflowDetailPage({ params }: WorkflowDetailPageProps) {
  const { id } = await params;
  return <WorkflowDetailWorkspace workflowId={id} />;
}
