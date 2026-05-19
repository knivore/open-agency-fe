import { NextResponse } from 'next/server';
import { WorkflowTaskFormSchema } from '@/types/workflows';
import { ZodError } from 'zod';
import { backendWorkflowsApi, workflowsApi } from '@/lib/api/backend';
import { rebuildWorkflowGraph, workflowTaskFormToDefinition } from '@/lib/workflows/workflowDefinitionMutations';
import { taskDefinitionToFormData } from '@/lib/workflows/builderForms';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

function normalizeTaskForm(body: unknown) {
  const parsedBody = WorkflowTaskFormSchema.parse(body);
  return {
    id: parsedBody.id ?? null,
    name: parsedBody.name,
    description: parsedBody.description,
    expected_output: parsedBody.expected_output,
    agent_id: parsedBody.agent_id ?? null,
    depends_on_task_ids: parsedBody.depends_on_task_ids ?? [],
    human_approval_required: parsedBody.human_approval_required ?? false,
    includeTask: parsedBody.includeTask ?? true,
  };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id } = await params;
    const body = await req.json();
    const parsedBody = normalizeTaskForm(body);

    const workflow = await workflowsApi.getWorkflow(id);
    const createdTask = workflowTaskFormToDefinition(parsedBody, workflow.task_definitions?.length ?? 0);
    const nextWorkflow = rebuildWorkflowGraph({
      ...workflow,
      task_definitions: [...(workflow.task_definitions ?? []), createdTask],
    });
    await backendWorkflowsApi.updateWorkflow(id, nextWorkflow, user, getInternalApiKey());
    return NextResponse.json({
      message: 'Task created successfully',
      data: taskDefinitionToFormData(createdTask),
      status: 201,
    });
  } catch (e) {
    if (e instanceof ZodError) {
      console.error('Validation error:', e.issues);
      return NextResponse.json({
        message: `Invalid request body: ${e.issues}`,
        status: 400,
      });
    }
    console.error('Failed to create task:', e);
    return proxyErrorResponse(e);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id } = await params;
    const body = await req.json();
    const parsedBody = normalizeTaskForm(body);

    if (parsedBody.depends_on_task_ids?.includes(parsedBody.id ?? '')) {
      return NextResponse.json({ error: 'Task cannot reference itself in context' }, { status: 400 });
    }

    if (parsedBody.agent_id === '') {
      parsedBody.agent_id = null;
    }
    if (!parsedBody.id) {
      return NextResponse.json({ message: 'Task ID is required', status: 400 });
    }
    const workflow = await workflowsApi.getWorkflow(id);
    const nextTasks = (workflow.task_definitions ?? []).map((task, index) =>
      task.id === parsedBody.id
        ? {
            ...workflowTaskFormToDefinition(parsedBody, index),
            id: parsedBody.id,
            depends_on_task_ids: (parsedBody.depends_on_task_ids ?? []).filter(Boolean),
          }
        : task
    );
    await backendWorkflowsApi.updateWorkflow(
      id,
      rebuildWorkflowGraph({
        ...workflow,
        task_definitions: nextTasks,
      }),
      user,
      getInternalApiKey()
    );
    return NextResponse.json({ msg: 'success', status: 200 });
  } catch (e) {
    if (e instanceof ZodError) {
      console.error('Zod error: ', e.issues);
      return NextResponse.json({ message: `Invalid request body: ${e.issues}`, status: 400 });
    }
    console.error("Failed to update workflow's tasks: ", e);
    return proxyErrorResponse(e);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return unauthorizedResponse();
    }
    await syncCurrentBackendUser(user);
    const { id } = await params;
    const body = await req.json();
    const taskId = body.taskId;
    if (!taskId) return NextResponse.json({ message: 'Task ID is required', status: 400 });
    const workflow = await workflowsApi.getWorkflow(id);
    const nextTasks = (workflow.task_definitions ?? [])
      .filter((task) => task.id !== taskId)
      .map((task) => ({
        ...task,
        depends_on_task_ids: (task.depends_on_task_ids ?? []).filter((dependencyId) => dependencyId !== taskId),
      }));
    await backendWorkflowsApi.updateWorkflow(
      id,
      rebuildWorkflowGraph({
        ...workflow,
        task_definitions: nextTasks,
      }),
      user,
      getInternalApiKey()
    );
    return NextResponse.json({ msg: 'Task deleted successfully', status: 200 });
  } catch (e) {
    console.error('Failed to delete task: ', e);
    return proxyErrorResponse(e);
  }
}
