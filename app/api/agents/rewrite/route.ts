import { NextRequest, NextResponse } from 'next/server';
import { workflowBuilderApi } from '@/lib/api/backend';
import {
  agentFormToRewritePayload,
  rewriteAgentResponseToFormData,
} from '@/lib/workflows/builderForms';
import { WorkflowAgentFormSchema } from '@/types/workflows';

function normalizeAgentRewritePayload(agent: unknown) {
  const parsedAgent = WorkflowAgentFormSchema.partial({
    id: true,
    temperature: true,
    model_profile_id: true,
    tool_ids: true,
    handoff_agent_ids: true,
    tool_configs: true,
  }).parse(agent);

  return {
    name: parsedAgent.name ?? '',
    role: parsedAgent.role ?? '',
    instructions: parsedAgent.instructions ?? '',
    backstory: parsedAgent.backstory ?? '',
    temperature: parsedAgent.temperature ?? null,
    model_profile_id: parsedAgent.model_profile_id ?? null,
    tool_ids: parsedAgent.tool_ids ?? [],
    handoff_agent_ids: parsedAgent.handoff_agent_ids ?? [],
    tool_configs: parsedAgent.tool_configs ?? [],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agent } = body;

    if (!agent) {
      return NextResponse.json(
        { message: 'Agent data is required' },
        { status: 400 }
      );
    }

    const parsedAgent = normalizeAgentRewritePayload(agent);
    const response = await workflowBuilderApi.rewriteAgent(agentFormToRewritePayload(parsedAgent));
    return NextResponse.json({
      ...response,
      data: rewriteAgentResponseToFormData(response.data),
    });
  } catch (error) {
    console.error('Error rewriting agent fields:', error);
    return NextResponse.json(
      { message: 'Failed to rewrite agent fields' },
      { status: 500 }
    );
  }
} 
