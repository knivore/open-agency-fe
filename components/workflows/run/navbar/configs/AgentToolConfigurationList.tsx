import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { getWorkflowDetail } from '@/app/api/utils/workflows';
import { CheckCircle } from 'lucide-react';
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  createRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useWorkflowRunContext } from '../../WorkflowRunProvider';
import AgentToolConfigCard, { AgentToolConfigCardRef } from '@/components/workflows/run/navbar/configs/AgentToolConfigCard';
import type {
  WorkflowAgentFormData,
  WorkflowExecutionStartPayload,
  WorkflowWorkspaceDetail,
} from '@/types/workflows';
import { agentDefinitionToFormData } from '@/lib/workflows/builderForms';

export interface AgentToolConfigurationListRef {
  collectAllConfigs: () => NonNullable<WorkflowExecutionStartPayload['agentConfigs']>;
}

function normalizeLlmOverride(agent: WorkflowAgentFormData) {
  const override = agent.llm_override;
  if (!override || !override.model.trim()) {
    return null;
  }

  return {
    provider: override.provider,
    model: override.model.trim(),
    base_url: override.base_url?.trim() || null,
    api_key: override.api_key?.trim() || null,
  };
}

const AgentToolConfigurationList = forwardRef<AgentToolConfigurationListRef, {}>((props, ref) => {
  const { workflowId, setAreAgentsConfigured } = useWorkflowRunContext();

  const {
    data: workflow,
    isLoading,
    error,
  } = useQuery<WorkflowWorkspaceDetail>({
    queryKey: queryKeys.workflowDetail(workflowId),
    queryFn: () => getWorkflowDetail(workflowId),
  });

  const agents = useMemo(
    () =>
      workflow?.workflow
        ? (workflow.workflow.agent_definitions ?? []).map((agent) =>
            agentDefinitionToFormData(agent, workflow.workflow.tool_definitions ?? [])
          )
        : [],
    [workflow]
  );

  const [configStatus, setConfigStatus] = useState<{ [agentId: string]: boolean }>({});
  const configRefs = useRef<Record<string, React.RefObject<AgentToolConfigCardRef | null>>>({});

  const handleConfigChange = useCallback((agentId: string, configured: boolean) => {
    setConfigStatus((prev) => {
      if (prev[agentId] === configured) return prev;
      return { ...prev, [agentId]: configured };
    });
  }, []);

  const configurableAgents = useMemo(
    () => agents.filter((agent) => agent.id),
    [agents]
  );

  useEffect(() => {
    const noConfigRequired = configurableAgents.length === 0;
    const areAllAgentsConfigured =
      noConfigRequired ||
      configurableAgents.every((agent) => agent.id && configStatus[agent.id] === true);
    setAreAgentsConfigured(areAllAgentsConfigured);
  }, [configurableAgents, configStatus, setAreAgentsConfigured]);

  useEffect(() => {
    agents.forEach((agent) => {
      if (agent.id && !configRefs.current[agent.id]) {
        configRefs.current[agent.id] = createRef<AgentToolConfigCardRef>();
      }
    });
  }, [agents]);

  const collectAllConfigs = useCallback(() => {
    const configs: NonNullable<WorkflowExecutionStartPayload['agentConfigs']> = {};
    Object.entries(configRefs.current).forEach(([agentId, ref]) => {
      if (ref.current) {
        const agentConfig = ref.current.getConfig();
        configs[agentId] = {
          tool_configs: agentConfig.tool_configs,
          model_profile_id: agentConfig.model_profile_id ?? null,
          llm_override: normalizeLlmOverride(agentConfig),
        };
      }
    });
    return configs;
  }, []);

  useImperativeHandle(ref, () => ({
    collectAllConfigs,
  }));

  if (isLoading) {
    return (
      <div className="space-y-4 p-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-md"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        Failed to load agents. Please try refreshing the page.
      </div>
    );
  }

  if (configurableAgents.length === 0) {
    return (
      <div className="p-6 text-center border rounded-md bg-green-50">
        <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
        <p className="text-green-700 font-medium">All agents are ready!</p>
        <p className="text-sm text-muted-foreground mt-1">
          This workflow has no agent-level runtime configuration.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {configurableAgents.map((agent: WorkflowAgentFormData) =>
          <AgentToolConfigCard
            key={agent.id}
            agent={agent}
            ref={agent.id ? (configRefs.current[agent.id] as React.RefObject<AgentToolConfigCardRef>) : undefined}
            onConfigChange={(configured: boolean) =>
              agent.id ? handleConfigChange(agent.id, configured) : undefined
            }
            onSave={() => {
              if (agent.id) {
                handleConfigChange(agent.id, true);
              }
            }}
          />
      )}
    </div>
  );
});

AgentToolConfigurationList.displayName = 'AgentToolConfigurationList';

export default AgentToolConfigurationList;
