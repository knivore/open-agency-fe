import { WorkflowAgentFormSchema } from '@/types/workflows';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { backendWorkflowsApi, workflowsApi } from '@/lib/api/backend';
import { rebuildWorkflowGraph, workflowAgentFormToDefinition } from '@/lib/workflows/workflowDefinitionMutations';
import { agentDefinitionToFormData } from '@/lib/workflows/builderForms';
import {
  getAuthenticatedUser,
  getInternalApiKey,
  proxyErrorResponse,
  syncCurrentBackendUser,
  unauthorizedResponse,
} from '@/app/api/backend-users/utils';

function normalizeAgentForm(body: unknown) {
  const parsedBody = WorkflowAgentFormSchema.parse(body);
  return {
    id: parsedBody.id ?? null,
    name: parsedBody.name,
    role: parsedBody.role,
    instructions: parsedBody.instructions,
    backstory: parsedBody.backstory,
    temperature: parsedBody.temperature ?? null,
    model_profile_id: parsedBody.model_profile_id ?? null,
    tool_ids: parsedBody.tool_ids ?? [],
    handoff_agent_ids: parsedBody.handoff_agent_ids ?? [],
    tool_configs: parsedBody.tool_configs ?? [],
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
    const parsedBody = normalizeAgentForm(body);

    const workflow = await workflowsApi.getWorkflow(id);
    const createdAgent = workflowAgentFormToDefinition(parsedBody, workflow.agent_definitions?.length ?? 0);
    const nextWorkflow = rebuildWorkflowGraph({
      ...workflow,
      agent_definitions: [...(workflow.agent_definitions ?? []), createdAgent],
    });
    await backendWorkflowsApi.updateWorkflow(
      id,
      nextWorkflow,
      user,
      getInternalApiKey()
    );
    return NextResponse.json({
      message: 'Agent created successfully',
      data: agentDefinitionToFormData(createdAgent, nextWorkflow.tool_definitions ?? []),
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
    console.error('Failed to create agent:', e);
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
    const parsedBody = normalizeAgentForm(body);
    if (!parsedBody.id) {
      return NextResponse.json({ message: 'Agent ID is required', status: 400 });
    }
    const workflow = await workflowsApi.getWorkflow(id);
    const nextAgents = (workflow.agent_definitions ?? []).map((agent, index) =>
      agent.id === parsedBody.id
        ? { ...workflowAgentFormToDefinition(parsedBody, index), id: parsedBody.id }
        : agent
    );
    await backendWorkflowsApi.updateWorkflow(
      id,
      rebuildWorkflowGraph({
        ...workflow,
        agent_definitions: nextAgents,
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
    console.error("Failed to update workflow's agents: ", e);
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
    const body = (await req.json()) as { agentId?: string };
    const agentId = body.agentId;
    if (!agentId) return NextResponse.json({ message: 'Agent ID is required', status: 400 });
    const workflow = await workflowsApi.getWorkflow(id);
    const nextTasks = (workflow.task_definitions ?? []).map((task) =>
      task.agent_id === agentId ? { ...task, agent_id: null } : task
    );
    await backendWorkflowsApi.updateWorkflow(
      id,
      rebuildWorkflowGraph({
        ...workflow,
        agent_definitions: (workflow.agent_definitions ?? []).filter((agent) => agent.id !== agentId),
        task_definitions: nextTasks,
      }),
      user,
      getInternalApiKey()
    );
    return NextResponse.json({ msg: 'success', status: 200 });
  } catch (e) {
    console.error('Failed to delete agent: ', e);
    return proxyErrorResponse(e);
  }
}
