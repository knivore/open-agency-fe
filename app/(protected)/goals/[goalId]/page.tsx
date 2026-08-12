import GoalDetailWorkspace from '@/components/goals/GoalDetailWorkspace';

interface GoalDetailPageProps {
  params: Promise<{ goalId: string }>;
}

export default async function GoalDetailPage({ params }: GoalDetailPageProps) {
  const { goalId } = await params;
  return <GoalDetailWorkspace goalId={goalId} />;
}
