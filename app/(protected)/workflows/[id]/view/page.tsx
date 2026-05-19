import { redirect } from 'next/navigation';

interface PageParams {
  params: Promise<{
    id: string;
  }>;
}

export default async function WorkflowViewPage({ params }: PageParams) {
  const { id } = await params;
  redirect(`/workflows/${id}`);
}
