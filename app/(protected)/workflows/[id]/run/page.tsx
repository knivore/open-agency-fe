import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { getWorkflowInputs, getWorkflowPreview } from '@/app/api/utils/workflows';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { WorkflowRunProvider } from '@/components/workflows/run/WorkflowRunProvider';
import WorkflowRunContent from '@/components/workflows/run/WorkflowRunContent';

interface PageParams {
  params: Promise<{
    id: string;
  }>;
}

export default async function WorkflowRunPage({ params }: PageParams) {
  const { id } = await params;
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.workflowPreview(id),
    queryFn: () => getWorkflowPreview(id),
  });
  await queryClient.prefetchQuery({
    queryKey: queryKeys.workflowInputs(id),
    queryFn: () => getWorkflowInputs(id),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <WorkflowRunProvider workflowId={id}>
        <div className="flex flex-col flex-1 h-auto md:h-[calc(100vh-76px)] overflow-auto">
          <WorkflowRunContent />
        </div>
      </WorkflowRunProvider>
    </HydrationBoundary>
  );
}
