export const queryKeys = {
  backendAgents: () => ['backendAgents'] as const,
  backendAgentDefinitions: () => ['backendAgents', 'definitions'] as const,
  backendAgentCatalog: () => ['backendAgents', 'catalog'] as const,
  backendMainAgent: () => ['backendMainAgent'] as const,
  backendMainAgentMonitor: () => ['backendMainAgentMonitor'] as const,
  backendGoals: (filters: Record<string, unknown> = {}) => ['backendGoals', filters] as const,
  backendGoal: (goalId: string) => ['backendGoal', goalId] as const,
  backendGoalOperatorView: (filters: Record<string, unknown> = {}) =>
    ['backendGoalOperatorView', filters] as const,
  backendGoalOperatorDetail: (goalId: string) => ['backendGoalOperatorDetail', goalId] as const,
  backendAgentRuns: () => ['backendAgentRuns'] as const,
  backendOperators: (workspaceId: string) => ['backendOperators', workspaceId] as const,
  backendOperatorSummary: (workspaceId: string) =>
    ['backendOperators', workspaceId, 'summary'] as const,
  backendOperator: (workspaceId: string, operatorId: string) =>
    ['backendOperators', workspaceId, operatorId] as const,
  backendOperatorResource: (workspaceId: string, operatorId: string, resource: string) =>
    ['backendOperators', workspaceId, operatorId, resource] as const,
  backendWorkflowList: () => ['backendWorkflowList'] as const,
  backendWorkflow: (workflowId: string) => ['backendWorkflow', workflowId] as const,
  backendWorkflowVersions: (workflowId: string) => ['backendWorkflowVersions', workflowId] as const,
  backendWorkflowRuntimeGovernance: (workflowId: string) =>
    ['backendWorkflowRuntimeGovernance', workflowId] as const,
  backendWorkflowObservabilityMetrics: (workflowId: string) =>
    ['backendWorkflowObservabilityMetrics', workflowId] as const,
  backendWorkflowModelUsage: (workflowId: string) =>
    ['backendWorkflowModelUsage', workflowId] as const,
  backendAgentObservabilityMetrics: (agentId: string) =>
    ['backendAgentObservabilityMetrics', agentId] as const,
  backendWorkflowMonitoringEvents: (workflowId: string) =>
    ['backendWorkflowMonitoringEvents', workflowId] as const,
  backendWorkflowSharedMemory: (workflowId: string) =>
    ['backendWorkflowSharedMemory', workflowId] as const,
  backendWorkflowMemories: (workflowId: string) => ['backendWorkflowMemories', workflowId] as const,
  backendWorkflowMemoryLinks: (workflowId: string) =>
    ['backendWorkflowMemoryLinks', workflowId] as const,
  backendWorkflowPersonaVersionNotices: (workflowId: string) =>
    ['backendWorkflowPersonaVersionNotices', workflowId] as const,
  backendWorkflowRuns: (workflowId: string) => ['backendWorkflowRuns', workflowId] as const,
  backendWorkflowSchedules: (workflowId: string) => ['backendSchedules', workflowId] as const,
  backendRuntimeAdapters: () => ['backendRuntimeAdapters'] as const,
  backendBehaviorProfiles: () => ['backendBehaviorProfiles'] as const,
  backendMemories: () => ['backendMemories'] as const,
  backendMemoryCatalog: () => ['backendMemoryCatalog'] as const,
  backendPersonas: () => ['backendPersonas'] as const,
  backendPersonaGovernance: () => ['backendPersonaGovernance'] as const,
  backendPersonaItemTypes: () => ['backendPersonaItemTypes'] as const,
  backendPersonaRun: (runId: string) => ['backendPersonaRun', runId] as const,
  backendPersonaRuns: (personaId: string) => ['backendPersonaRuns', personaId] as const,
  backendPersonaRunItems: (runId: string, filters: Record<string, unknown> = {}) =>
    ['backendPersonaRunItems', runId, filters] as const,
  backendPersonaRunSourceMap: (runId: string) => ['backendPersonaRunSourceMap', runId] as const,
  backendPersonaRunSource: (runId: string, sourceKey: string) =>
    ['backendPersonaRunSource', runId, sourceKey] as const,
  backendPersonaVersions: (personaId: string) => ['backendPersonaVersions', personaId] as const,
  backendPersonaWorkflowUsages: (personaId: string) =>
    ['backendPersonaWorkflowUsages', personaId] as const,
  backendPersonaGraphContext: (personaId: string, query: string, preset?: string) =>
    ['backendPersonaGraphContext', personaId, query, preset] as const,
  backendPersonaSources: (personaId: string) => ['backendPersonaSources', personaId] as const,
  backendCapabilities: () => ['backendCapabilities'] as const,
  backendAgencyGraphStatus: () => ['backendAgencyGraphStatus'] as const,
  backendGraphRoot: (rootType: string, rootId: string) =>
    ['backendGraphRoot', rootType, rootId] as const,
  backendGraphNodeExpansion: (nodeId: string) => ['backendGraphNodeExpansion', nodeId] as const,
  backendExecutions: () => ['backendExecutions'] as const,
  backendCompactBackfill: () => ['backendCompactBackfill'] as const,
  backendIntegrations: () => ['backendIntegrations'] as const,
  backendPhysicalDevices: (filters: Record<string, unknown> = {}) =>
    ['backendPhysicalDevices', filters] as const,
  backendPhysicalDeviceState: (deviceId: string | null) =>
    ['backendPhysicalDeviceState', deviceId] as const,
  backendPhysicalDeviceCommands: (deviceId: string | null) =>
    ['backendPhysicalDeviceCommands', deviceId] as const,
  backendPhysicalDeviceEvents: (deviceId: string | null) =>
    ['backendPhysicalDeviceEvents', deviceId] as const,
  backendPhysicalDeviceAudit: () => ['backendPhysicalDeviceAudit'] as const,
  backendPhysicalEventBusHealth: () => ['backendPhysicalEventBusHealth'] as const,
  backendPhysicalDevicesAvailability: () => ['backendPhysicalDevicesAvailability'] as const,
  backendSmartHomeAvailability: () => ['backendSmartHomeAvailability'] as const,
  backendSmartHomeEntities: (filters: Record<string, unknown> = {}) =>
    ['backendSmartHomeEntities', filters] as const,
  backendCurrentUser: (userId: string) => ['backendCurrentUser', userId] as const,
  backendRun: (runId: string) => ['backendRun', runId] as const,
  backendRunSession: (runId: string) => ['backendRunSession', runId] as const,
  backendRunEvents: (runId: string) => ['backendRunEvents', runId] as const,
  backendRunGovernanceEvents: (runId: string) => ['backendRunGovernanceEvents', runId] as const,
  backendRunApprovals: (runId: string) => ['backendRunApprovals', runId] as const,
  backendRunWaits: (runId: string) => ['backendRunWaits', runId] as const,
  backendRunUsage: (runId: string) => ['backendRunUsage', runId] as const,
  backendRunContextUsage: (runId: string) => ['backendRunContextUsage', runId] as const,
  backendRunTimeline: (runId: string) => ['backendRunTimeline', runId] as const,
  backendRunLogs: (runId: string) => ['backendRunLogs', runId] as const,
  backendRunConversation: (runId: string) => ['backendRunConversation', runId] as const,
  backendActiveRunSessions: () => ['backendActiveRunSessions'] as const,
  toolContracts: () => ['toolContracts'] as const,
  toolContract: (toolName: string) => ['toolContract', toolName] as const,
  tools: () => ['tools'] as const,
} as const;
