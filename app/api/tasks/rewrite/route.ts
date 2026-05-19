import { NextRequest, NextResponse } from 'next/server';
import { workflowBuilderApi } from '@/lib/api/backend';
import { rewriteTaskResponseToFormData, taskFormToRewritePayload } from '@/lib/workflows/builderForms';
import { WorkflowTaskFormSchema } from '@/types/workflows';

function normalizeTaskRewritePayload(task: unknown) {
  const parsedTask = WorkflowTaskFormSchema.partial({
    id: true,
    agent_id: true,
    depends_on_task_ids: true,
    human_approval_required: true,
    includeTask: true,
  }).parse(task);

  return {
    name: parsedTask.name ?? '',
    description: parsedTask.description ?? '',
    expected_output: parsedTask.expected_output ?? '',
    agent_id: parsedTask.agent_id ?? null,
    depends_on_task_ids: parsedTask.depends_on_task_ids ?? [],
    human_approval_required: parsedTask.human_approval_required ?? false,
    includeTask: parsedTask.includeTask ?? true,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { task } = body;

    if (!task) {
      return NextResponse.json(
        { message: 'Task data is required' },
        { status: 400 }
      );
    }

    const parsedTask = normalizeTaskRewritePayload(task);
    const response = await workflowBuilderApi.rewriteTask(taskFormToRewritePayload(parsedTask));
    return NextResponse.json({
      ...response,
      data: rewriteTaskResponseToFormData(response.data),
    });
  } catch (error) {
    console.error('Error rewriting task fields:', error);
    return NextResponse.json(
      { message: 'Failed to rewrite task fields' },
      { status: 500 }
    );
  }
} 
