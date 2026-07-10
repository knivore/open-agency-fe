export const backendRoutes = {
  root: () => '/',
  capabilities: () => '/capabilities',
  health: {
    root: () => '/health',
    db: () => '/health/db',
  },
  agents: {
    list: () => '/agents',
    create: () => '/agents',
    byId: (agentId: string) => `/agents/${agentId}`,
    executions: (agentId: string) => `/agents/${agentId}/executions`,
    importFormats: () => '/agents/import/formats',
    importPreview: () => '/agents/import/preview',
    importCommit: () => '/agents/import/commit',
    importBatchPreview: () => '/agents/import/batch-preview',
    importBatchCommit: () => '/agents/import/batch-commit',
  },
  conversations: {
    list: () => '/conversations',
    create: () => '/conversations',
    resolveChannel: (channelType: string) =>
      `/integrations/conversations/channels/${encodeURIComponent(channelType)}/resolve`,
    deliverChannelConversation: (conversationId: string) =>
      `/integrations/conversations/channels/${encodeURIComponent(conversationId)}/deliver`,
    channelIdentityMappings: () => '/integrations/conversations/channel-identity-mappings',
    mainAgent: () => '/conversations/main-agent-profile',
    updateMainAgent: () => '/conversations/main-agent-profile',
    byId: (conversationId: string) => `/conversations/${conversationId}`,
    messages: (conversationId: string) => `/conversations/${conversationId}/messages`,
    contextUsage: (conversationId: string) => `/conversations/${conversationId}/context-usage`,
    compact: (conversationId: string) => `/conversations/${conversationId}/compact`,
    compactPacks: (conversationId: string) => `/conversations/${conversationId}/compact-packs`,
    stream: (conversationId: string) => `/conversations/${conversationId}/stream`,
    approvalRequests: (conversationId: string) =>
      `/conversations/${conversationId}/approval-requests`,
    approveApprovalRequest: (approvalRequestId: string) =>
      `/conversations/approval-requests/${approvalRequestId}/approve`,
    rejectApprovalRequest: (approvalRequestId: string) =>
      `/conversations/approval-requests/${approvalRequestId}/reject`,
    requestChangesToApprovalRequest: (approvalRequestId: string) =>
      `/conversations/approval-requests/${approvalRequestId}/request-changes`,
    splitApprovalRequest: (approvalRequestId: string) =>
      `/conversations/approval-requests/${approvalRequestId}/split`,
  },
  mainAgentMonitor: {
    commandCenter: () => '/main-agent/monitor',
    routes: () => '/main-agent/monitor/routes',
  },
  goals: {
    list: () => '/goals',
    create: () => '/goals',
    operatorView: () => '/goals/operator-view',
    byId: (goalId: string) => `/goals/${encodeURIComponent(goalId)}`,
    operatorDetail: (goalId: string) => `/goals/${encodeURIComponent(goalId)}/operator-detail`,
    operatorActions: (goalId: string) => `/goals/${encodeURIComponent(goalId)}/operator-actions`,
    evidence: (goalId: string) => `/goals/${encodeURIComponent(goalId)}/evidence`,
    evaluate: (goalId: string) => `/goals/${encodeURIComponent(goalId)}/evaluate`,
    plan: (goalId: string) => `/goals/${encodeURIComponent(goalId)}/plan`,
    replan: (goalId: string) => `/goals/${encodeURIComponent(goalId)}/replan`,
    supervisorFindings: (goalId: string) =>
      `/goals/${encodeURIComponent(goalId)}/supervisor-findings`,
    supervisorDecisions: (goalId: string) =>
      `/goals/${encodeURIComponent(goalId)}/supervisor-decisions`,
    memorySummary: (goalId: string) => `/goals/${encodeURIComponent(goalId)}/memory-summary`,
    pause: (goalId: string) => `/goals/${encodeURIComponent(goalId)}/pause`,
    resume: (goalId: string) => `/goals/${encodeURIComponent(goalId)}/resume`,
    cancel: (goalId: string) => `/goals/${encodeURIComponent(goalId)}/cancel`,
    complete: (goalId: string) => `/goals/${encodeURIComponent(goalId)}/complete`,
  },
  tools: {
    list: () => '/tools',
    create: () => '/tools',
    byId: (toolId: string) => `/tools/${toolId}`,
    generatedPackages: () => '/tools/generated/packages',
    generatedPackageById: (packageId: string) =>
      `/tools/generated/packages/${encodeURIComponent(packageId)}`,
    generatedPackageScaffold: () => '/tools/generated/packages/scaffold',
    generatedPackagePublish: () => '/tools/generated/packages/publish',
    validate: () => '/tools/validate',
    test: (toolId: string) => `/tools/${toolId}/test`,
    contracts: () => '/tools/contracts',
    contractByName: (toolName: string) => `/tools/contracts/${toolName}`,
    run: (toolName: string) => `/tools/${toolName}/run`,
  },
  modelProviders: {
    list: () => '/model-providers',
    create: () => '/model-providers',
    byId: (providerId: string) => `/model-providers/${providerId}`,
    health: (providerId: string) => `/model-providers/${providerId}/health`,
    test: (providerId: string) => `/model-providers/${providerId}/test`,
    models: (providerId: string) => `/model-providers/${providerId}/models`,
    authorize: (providerId: string) => `/model-providers/${providerId}/authorize`,
    callbackComplete: (providerId: string) => `/model-providers/${providerId}/callback-complete`,
    deviceAuthorize: (providerId: string) => `/model-providers/${providerId}/device-authorize`,
    deviceComplete: (providerId: string) => `/model-providers/${providerId}/device-complete`,
  },
  modelProfiles: {
    list: () => '/model-profiles',
    create: () => '/model-profiles',
    byId: (profileId: string) => `/model-profiles/${profileId}`,
    health: (profileId: string) => `/model-profiles/${profileId}/health`,
    test: (profileId: string) => `/model-profiles/${profileId}/test`,
  },
  memories: {
    list: () => '/memories',
    catalog: () => '/memories/catalog',
    exclusions: () => '/memories/exclusions',
    create: () => '/memories',
    backfillEmbeddings: () => '/memories/embeddings/backfill',
    runDailySummaries: () => '/memories/daily-summaries/run',
    backfillDailySummaries: () => '/memories/daily-summaries/backfill',
    backfillCompactPacks: () => '/memories/compact/backfill',
    exclusionById: (memoryId: string, exclusionId: string) =>
      `/memories/${memoryId}/exclusions/${exclusionId}`,
    exclusionsByMemoryId: (memoryId: string) => `/memories/${memoryId}/exclusions`,
    documentById: (documentId: string) => `/memories/documents/${documentId}`,
    byId: (memoryId: string) => `/memories/${memoryId}`,
  },
  documents: {
    list: () => '/documents',
    byId: (documentId: string) => `/documents/${documentId}`,
    ingest: () => '/documents/ingest',
    intelligence: () => '/documents/intelligence',
  },
  personas: {
    list: () => '/persona',
    create: () => '/persona',
    byId: (personaId: string) => `/persona/${personaId}`,
    versions: (personaId: string) => `/persona/${personaId}/versions`,
    workflowUsages: (personaId: string) => `/persona/${personaId}/workflow-usages`,
    graphContext: (personaId: string) => `/persona/${personaId}/graph-context`,
    rollbackVersion: (personaId: string, versionId: string) =>
      `/persona/${personaId}/versions/${versionId}/rollback`,
    sources: (personaId: string) => `/persona/${personaId}/sources`,
    export: (personaId: string) => `/persona/${personaId}/export`,
    governanceLabels: () => '/persona-factory/governance-labels',
    itemTypes: () => '/persona-factory/item-types',
    distill: () => '/persona-factory/distill',
    feedback: () => '/persona-factory/feedback',
    runs: () => '/persona-factory/runs',
    runById: (runId: string) => `/persona-factory/runs/${runId}`,
    runItems: (runId: string) => `/persona-factory/runs/${runId}/items`,
    runSourceMap: (runId: string) => `/persona-factory/runs/${runId}/source-map`,
    runSource: (runId: string, sourceKey: string) =>
      `/persona-factory/runs/${runId}/sources/${encodeURIComponent(sourceKey)}`,
    runSourceClassification: (runId: string, sourceKey: string) =>
      `/persona-factory/runs/${runId}/sources/${encodeURIComponent(sourceKey)}/classification`,
    redistillRunSource: (runId: string, sourceKey: string) =>
      `/persona-factory/runs/${runId}/sources/${encodeURIComponent(sourceKey)}/redistill`,
    item: (itemId: string) => `/persona-factory/items/${itemId}`,
    approveItem: (itemId: string) => `/persona-factory/items/${itemId}/approve`,
    rejectItem: (itemId: string) => `/persona-factory/items/${itemId}/reject`,
    bulkReviewItems: () => '/persona-factory/items/bulk-review',
    bulkReviewRunItems: (runId: string) => `/persona-factory/runs/${runId}/items/bulk-review`,
    previewBulkReviewRunItems: (runId: string) =>
      `/persona-factory/runs/${runId}/items/bulk-review/preview`,
    normalizeRun: (runId: string) => `/persona-factory/runs/${runId}/normalize`,
    synthesizeRun: (runId: string) => `/persona-factory/runs/${runId}/synthesize-package`,
    runPackage: (runId: string) => `/persona-factory/runs/${runId}/package`,
    approveRun: (runId: string) => `/persona-factory/runs/${runId}/approve`,
    publishRun: (runId: string) => `/persona-factory/runs/${runId}/publish`,
  },
  mcpServers: {
    list: () => '/mcp-servers',
    create: () => '/mcp-servers',
    byId: (serverId: string) => `/mcp-servers/${serverId}`,
    discover: () => '/mcp-servers/discover',
  },
  runtimeAdapters: {
    list: () => '/runtime-adapters',
    create: () => '/runtime-adapters',
    byId: (adapterId: string) => `/runtime-adapters/${adapterId}`,
  },
  connectorRegistry: {
    categories: () => '/integrations/categories',
    capabilities: () => '/integrations/connectors/capabilities',
  },
  smartHome: {
    entities: () => '/api/smart-home/entities',
  },
  physicalDevices: {
    list: () => '/api/devices',
    audit: () => '/api/devices/audit',
    eventBusHealth: () => '/api/physical/events/health',
    state: (deviceId: string) => `/api/devices/${encodeURIComponent(deviceId)}/state`,
    commands: (deviceId: string) => `/api/devices/${encodeURIComponent(deviceId)}/commands`,
    events: (deviceId: string) => `/api/devices/${encodeURIComponent(deviceId)}/events`,
  },
  connectors: {
    aggregateHistory: () => '/integrations/connectors/history',
    createSetupSession: (providerKey: string) =>
      `/integrations/connectors/${providerKey}/setup-sessions`,
    installations: () => '/integrations/connectors/installations',
    installationById: (installationId: string) =>
      `/integrations/connectors/installations/${installationId}`,
    completeInstallation: (installationId: string) =>
      `/integrations/connectors/installations/${installationId}/complete`,
    rotateInstallation: (installationId: string) =>
      `/integrations/connectors/installations/${installationId}/rotate`,
    health: (credentialId: string) => `/integrations/connectors/${credentialId}/health`,
    test: (credentialId: string) => `/integrations/connectors/${credentialId}/test`,
    history: (credentialId: string) => `/integrations/connectors/${credentialId}/history`,
  },
  users: {
    me: () => '/me',
    sync: () => '/users/sync',
    list: () => '/users',
    byId: (userId: string) => `/users/${userId}`,
  },
  workflows: {
    list: () => '/workflows',
    create: () => '/workflows',
    byId: (workflowId: string) => `/workflows/${workflowId}`,
    sharedMemory: (workflowId: string) => `/workflows/${workflowId}/shared-memory`,
    memoryLinks: (workflowId: string) => `/workflows/${workflowId}/memory-links`,
    memoryLinkById: (workflowId: string, linkId: string) =>
      `/workflows/${workflowId}/memory-links/${linkId}`,
    monitoring: (workflowId: string) => `/workflows/${workflowId}/monitoring`,
    monitoringEvents: (workflowId: string) => `/workflows/${workflowId}/monitoring/events`,
    monitoringProposalDispatch: (workflowId: string, proposalEventId: string) =>
      `/workflows/${workflowId}/monitoring/proposals/${proposalEventId}/dispatch`,
    steeringApprovals: (workflowId: string) => `/workflows/${workflowId}/steering-approvals`,
    governanceReviewQueue: (workflowId: string) =>
      `/workflows/${workflowId}/governance/review-queue`,
    governanceDocumentSuggest: (workflowId: string) =>
      `/workflows/${workflowId}/governance/document-suggest`,
    governanceBundle: (workflowId: string, recordKind: string, recordId: string) =>
      `/workflows/${workflowId}/governance/bundle/${encodeURIComponent(recordKind)}/${encodeURIComponent(recordId)}`,
    governanceActionAttachEvidence: (workflowId: string, recordKind: string, recordId: string) =>
      `/workflows/${workflowId}/governance/action/${encodeURIComponent(recordKind)}/${encodeURIComponent(recordId)}/attach-evidence`,
    governanceActionRequestApproval: (workflowId: string, recordKind: string, recordId: string) =>
      `/workflows/${workflowId}/governance/action/${encodeURIComponent(recordKind)}/${encodeURIComponent(recordId)}/request-approval`,
    governanceActionResolve: (workflowId: string, recordKind: string, recordId: string) =>
      `/workflows/${workflowId}/governance/action/${encodeURIComponent(recordKind)}/${encodeURIComponent(recordId)}/resolve`,
    governanceActionDismiss: (workflowId: string, recordKind: string, recordId: string) =>
      `/workflows/${workflowId}/governance/action/${encodeURIComponent(recordKind)}/${encodeURIComponent(recordId)}/dismiss`,
    governanceActionReopen: (workflowId: string, recordKind: string, recordId: string) =>
      `/workflows/${workflowId}/governance/action/${encodeURIComponent(recordKind)}/${encodeURIComponent(recordId)}/reopen`,
    runtimeGovernance: (workflowId: string) => `/workflows/${workflowId}/runtime-governance`,
    personaVersionNotices: (workflowId: string) =>
      `/workflows/${workflowId}/persona-version-notices`,
    personaAgentUseLatest: (workflowId: string, agentId: string) =>
      `/workflows/${workflowId}/persona-agents/${agentId}/use-latest`,
    personaAgentKeepCurrent: (workflowId: string, agentId: string) =>
      `/workflows/${workflowId}/persona-agents/${agentId}/keep-current`,
    agentPromote: (workflowId: string, agentId: string) =>
      `/workflows/${workflowId}/agents/${agentId}/promote`,
    executions: (workflowId: string) => `/workflows/${workflowId}/executions`,
    startExecution: (workflowId: string) => `/workflows/${workflowId}/executions/start`,
    versions: (workflowId: string) => `/workflows/${workflowId}/versions`,
    version: (workflowId: string, revision: number) =>
      `/workflows/${workflowId}/versions/${revision}`,
    clone: (workflowId: string) => `/workflows/${workflowId}/clone`,
    validate: () => '/workflows/validate',
  },
  executions: {
    list: () => '/executions',
    active: () => '/executions/active',
    runtimeRevisions: () => '/executions/runtime/revisions',
    runtimeRevisionById: (revisionId: string) => `/executions/runtime/revisions/${revisionId}`,
    runtimeContainers: () => '/executions/runtime/containers',
    runtimeMetrics: () => '/executions/runtime/metrics',
    runtimeContainerLogs: (containerId: string) =>
      `/executions/runtime/containers/${containerId}/logs`,
    runtimeReconcile: () => '/executions/runtime/reconcile',
    create: () => '/executions',
    byId: (executionId: string) => `/executions/${executionId}`,
    start: (executionId: string) => `/executions/${executionId}/start`,
    pause: (executionId: string) => `/executions/${executionId}/pause`,
    resume: (executionId: string) => `/executions/${executionId}/resume`,
    retryTask: (executionId: string, taskId: string) =>
      `/executions/${executionId}/tasks/${taskId}/retry`,
    resumeFromCheckpoint: (executionId: string) =>
      `/executions/${executionId}/resume-from-checkpoint`,
    cancel: (executionId: string) => `/executions/${executionId}/cancel`,
    approve: (executionId: string) => `/executions/${executionId}/approve`,
    reject: (executionId: string) => `/executions/${executionId}/reject`,
    events: (executionId: string) => `/executions/${executionId}/events`,
    usage: (executionId: string) => `/executions/${executionId}/usage`,
    contextUsage: (executionId: string) => `/executions/${executionId}/context-usage`,
    approvals: (executionId: string) => `/executions/${executionId}/approvals`,
    artifacts: (executionId: string) => `/executions/${executionId}/artifacts`,
    artifactImagesStream: (executionId: string) =>
      `/executions/${executionId}/artifacts/images/stream`,
    hitlStream: (executionId: string) => `/executions/${executionId}/hitl/stream`,
    hitlReply: (executionId: string) => `/executions/${executionId}/hitl/reply`,
    runtimeLogs: (executionId: string) => `/executions/${executionId}/runtime/logs`,
    stream: (executionId: string) => `/executions/${executionId}/stream`,
  },
  storage: {
    presigned: () => '/storage/presigned',
  },
  schedules: {
    list: () => '/schedules',
    create: () => '/schedules',
    byId: (scheduleId: string) => `/schedules/${scheduleId}`,
    enable: (scheduleId: string) => `/schedules/${scheduleId}/enable`,
    disable: (scheduleId: string) => `/schedules/${scheduleId}/disable`,
    triggerNow: (scheduleId: string) => `/schedules/${scheduleId}/trigger-now`,
  },
  observability: {
    executionTimeline: (executionId: string) => `/observability/executions/${executionId}/timeline`,
    executionGraph: (executionId: string) => `/observability/executions/${executionId}/graph`,
    agentMetrics: (agentId: string) => `/observability/agents/${agentId}/metrics`,
    workflowMetrics: (workflowId: string) => `/observability/workflows/${workflowId}/metrics`,
    workflowGraph: (workflowId: string) => `/observability/workflows/${workflowId}/graph`,
    modelUsage: () => '/observability/models/usage',
    apiTokenActivity: () => '/observability/api-tokens/activity',
  },
  graphRead: {
    status: () => '/graph/read/status',
    node: (nodeId: string) => `/graph/read/nodes/${nodeId}`,
    neighborhood: (nodeId: string) => `/graph/read/nodes/${nodeId}/neighborhood`,
    expand: (nodeId: string) => `/graph/read/nodes/${nodeId}/expand`,
    search: () => '/graph/read/search',
    workflowNeighborhood: (workflowId: string) =>
      `/graph/read/workflows/${workflowId}/neighborhood`,
    workflowLineage: (workflowId: string) => `/graph/read/workflows/${workflowId}/lineage`,
    runNeighborhood: (runId: string) => `/graph/read/runs/${runId}/neighborhood`,
    agentNeighborhood: (agentId: string) => `/graph/read/agents/${agentId}/neighborhood`,
    toolNeighborhood: (toolId: string) => `/graph/read/tools/${toolId}/neighborhood`,
    memoryNeighborhood: (memoryId: string) => `/graph/read/memories/${memoryId}/neighborhood`,
    entityNeighborhood: (entityId: string) => `/graph/read/entities/${entityId}/neighborhood`,
    taskNeighborhood: (taskId: string) => `/graph/read/tasks/${taskId}/neighborhood`,
  },
  graphStream: {
    deltas: () => '/graph/stream/deltas',
  },
  profile: {
    apiTokens: () => '/api-tokens',
    apiTokenScopes: () => '/api-tokens/scopes',
    revokeApiToken: (tokenId: string) => `/api-tokens/${tokenId}/revoke`,
    credentials: () => '/credentials',
    connectorCredentialSchema: (providerKey: string) =>
      `/credentials/connectors/${providerKey}/schema`,
    resolveConnectorCredential: () => '/credentials/connectors/resolve',
    validateConnectorCredential: (providerKey: string) =>
      `/credentials/connectors/${providerKey}/validate`,
    createConnectorCredential: (providerKey: string) => `/credentials/connectors/${providerKey}`,
    credentialById: (credentialId: string) => `/credentials/${credentialId}`,
    updateConnectorCredential: (credentialId: string) => `/credentials/${credentialId}/connector`,
    revokeCredential: (credentialId: string) => `/credentials/${credentialId}/revoke`,
    rotateCredential: (credentialId: string) => `/credentials/${credentialId}/rotate`,
  },
  a2a: {
    agentCard: () => '/.well-known/agent-card.json',
    createTask: () => '/a2a/tasks',
    taskById: (taskId: string) => `/a2a/tasks/${taskId}`,
    taskMessages: (taskId: string) => `/a2a/tasks/${taskId}/messages`,
    taskArtifacts: (taskId: string) => `/a2a/tasks/${taskId}/artifacts`,
  },
} as const;
