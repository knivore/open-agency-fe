import { encodePathSegment } from '@/lib/api/path';

export const backendRoutes = {
  root: () => '/',
  capabilities: () => '/capabilities',
  health: {
    root: () => '/health',
    db: () => '/health/db',
  },
  auth: {
    credentials: () => '/auth/me/credentials',
  },
  agents: {
    list: () => '/agents',
    create: () => '/agents',
    byId: (agentId: string) => `/agents/${encodePathSegment(agentId)}`,
    executions: (agentId: string) => `/agents/${encodePathSegment(agentId)}/executions`,
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
      `/integrations/conversations/channels/${encodePathSegment(channelType)}/resolve`,
    deliverChannelConversation: (conversationId: string) =>
      `/integrations/conversations/channels/${encodePathSegment(conversationId)}/deliver`,
    channelIdentityMappings: () => '/integrations/conversations/channel-identity-mappings',
    mainAgent: () => '/conversations/main-agent-profile',
    updateMainAgent: () => '/conversations/main-agent-profile',
    byId: (conversationId: string) => `/conversations/${encodePathSegment(conversationId)}`,
    messages: (conversationId: string) =>
      `/conversations/${encodePathSegment(conversationId)}/messages`,
    contextUsage: (conversationId: string) =>
      `/conversations/${encodePathSegment(conversationId)}/context-usage`,
    compact: (conversationId: string) =>
      `/conversations/${encodePathSegment(conversationId)}/compact`,
    compactPacks: (conversationId: string) =>
      `/conversations/${encodePathSegment(conversationId)}/compact-packs`,
    stream: (conversationId: string) =>
      `/conversations/${encodePathSegment(conversationId)}/stream`,
    approvalRequests: (conversationId: string) =>
      `/conversations/${encodePathSegment(conversationId)}/approval-requests`,
    approveApprovalRequest: (approvalRequestId: string) =>
      `/conversations/approval-requests/${encodePathSegment(approvalRequestId)}/approve`,
    rejectApprovalRequest: (approvalRequestId: string) =>
      `/conversations/approval-requests/${encodePathSegment(approvalRequestId)}/reject`,
    requestChangesToApprovalRequest: (approvalRequestId: string) =>
      `/conversations/approval-requests/${encodePathSegment(approvalRequestId)}/request-changes`,
    splitApprovalRequest: (approvalRequestId: string) =>
      `/conversations/approval-requests/${encodePathSegment(approvalRequestId)}/split`,
  },
  mainAgentMonitor: {
    commandCenter: () => '/main-agent/monitor',
    routes: () => '/main-agent/monitor/routes',
  },
  goals: {
    list: () => '/goals',
    create: () => '/goals',
    operatorView: () => '/goals/operator-view',
    byId: (goalId: string) => `/goals/${encodePathSegment(goalId)}`,
    operatorDetail: (goalId: string) => `/goals/${encodePathSegment(goalId)}/operator-detail`,
    operatorActions: (goalId: string) => `/goals/${encodePathSegment(goalId)}/operator-actions`,
    evidence: (goalId: string) => `/goals/${encodePathSegment(goalId)}/evidence`,
    evaluate: (goalId: string) => `/goals/${encodePathSegment(goalId)}/evaluate`,
    plan: (goalId: string) => `/goals/${encodePathSegment(goalId)}/plan`,
    replan: (goalId: string) => `/goals/${encodePathSegment(goalId)}/replan`,
    supervisorFindings: (goalId: string) =>
      `/goals/${encodePathSegment(goalId)}/supervisor-findings`,
    supervisorDecisions: (goalId: string) =>
      `/goals/${encodePathSegment(goalId)}/supervisor-decisions`,
    memorySummary: (goalId: string) => `/goals/${encodePathSegment(goalId)}/memory-summary`,
    pause: (goalId: string) => `/goals/${encodePathSegment(goalId)}/pause`,
    resume: (goalId: string) => `/goals/${encodePathSegment(goalId)}/resume`,
    cancel: (goalId: string) => `/goals/${encodePathSegment(goalId)}/cancel`,
    complete: (goalId: string) => `/goals/${encodePathSegment(goalId)}/complete`,
  },
  operators: {
    list: () => '/operators',
    create: () => '/operators',
    summary: () => '/operators/summary',
    proposeFromResponsibility: () => '/operators/proposals/from-responsibility',
    emergencyStop: () => '/operators/emergency-stop',
    byId: (operatorId: string) => `/operators/${encodePathSegment(operatorId)}`,
    standingOrders: (operatorId: string) =>
      `/operators/${encodePathSegment(operatorId)}/standing-orders`,
    resourceBindings: (operatorId: string) =>
      `/operators/${encodePathSegment(operatorId)}/resource-bindings`,
    triggers: (operatorId: string) => `/operators/${encodePathSegment(operatorId)}/triggers`,
    signals: (operatorId: string) => `/operators/${encodePathSegment(operatorId)}/signals`,
    evaluations: (operatorId: string) => `/operators/${encodePathSegment(operatorId)}/evaluations`,
    goals: (operatorId: string) => `/operators/${encodePathSegment(operatorId)}/goals`,
    notifications: (operatorId: string) =>
      `/operators/${encodePathSegment(operatorId)}/notifications`,
    commitments: (operatorId: string) => `/operators/${encodePathSegment(operatorId)}/commitments`,
    allowedWorkflows: (operatorId: string) =>
      `/operators/${encodePathSegment(operatorId)}/allowed-workflows`,
    capabilities: (operatorId: string) =>
      `/operators/${encodePathSegment(operatorId)}/capabilities`,
    simulate: (operatorId: string) => `/operators/${encodePathSegment(operatorId)}/simulate`,
    activate: (operatorId: string) => `/operators/${encodePathSegment(operatorId)}/activate`,
    pause: (operatorId: string) => `/operators/${encodePathSegment(operatorId)}/pause`,
    resume: (operatorId: string) => `/operators/${encodePathSegment(operatorId)}/resume`,
    stop: (operatorId: string) => `/operators/${encodePathSegment(operatorId)}/stop`,
    wake: (operatorId: string) => `/operators/${encodePathSegment(operatorId)}/wake`,
  },
  tools: {
    list: () => '/tools',
    create: () => '/tools',
    byId: (toolId: string) => `/tools/${encodePathSegment(toolId)}`,
    generatedPackages: () => '/tools/generated/packages',
    generatedPackageById: (packageId: string) =>
      `/tools/generated/packages/${encodePathSegment(packageId)}`,
    generatedPackageScaffold: () => '/tools/generated/packages/scaffold',
    generatedPackagePublish: () => '/tools/generated/packages/publish',
    validate: () => '/tools/validate',
    test: (toolId: string) => `/tools/${encodePathSegment(toolId)}/test`,
    contracts: () => '/tools/contracts',
    contractByName: (toolName: string) => `/tools/contracts/${encodePathSegment(toolName)}`,
    run: (toolName: string) => `/tools/${encodePathSegment(toolName)}/run`,
  },
  modelProviders: {
    list: () => '/model-providers',
    create: () => '/model-providers',
    byId: (providerId: string) => `/model-providers/${encodePathSegment(providerId)}`,
    health: (providerId: string) => `/model-providers/${encodePathSegment(providerId)}/health`,
    test: (providerId: string) => `/model-providers/${encodePathSegment(providerId)}/test`,
    models: (providerId: string) => `/model-providers/${encodePathSegment(providerId)}/models`,
    authorize: (providerId: string) =>
      `/model-providers/${encodePathSegment(providerId)}/authorize`,
    callbackComplete: (providerId: string) =>
      `/model-providers/${encodePathSegment(providerId)}/callback-complete`,
    deviceAuthorize: (providerId: string) =>
      `/model-providers/${encodePathSegment(providerId)}/device-authorize`,
    deviceComplete: (providerId: string) =>
      `/model-providers/${encodePathSegment(providerId)}/device-complete`,
  },
  modelProfiles: {
    list: () => '/model-profiles',
    create: () => '/model-profiles',
    byId: (profileId: string) => `/model-profiles/${encodePathSegment(profileId)}`,
    health: (profileId: string) => `/model-profiles/${encodePathSegment(profileId)}/health`,
    test: (profileId: string) => `/model-profiles/${encodePathSegment(profileId)}/test`,
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
      `/memories/${encodePathSegment(memoryId)}/exclusions/${encodePathSegment(exclusionId)}`,
    exclusionsByMemoryId: (memoryId: string) =>
      `/memories/${encodePathSegment(memoryId)}/exclusions`,
    documentById: (documentId: string) => `/memories/documents/${encodePathSegment(documentId)}`,
    byId: (memoryId: string) => `/memories/${encodePathSegment(memoryId)}`,
  },
  documents: {
    list: () => '/documents',
    byId: (documentId: string) => `/documents/${encodePathSegment(documentId)}`,
    ingest: () => '/documents/ingest',
    intelligence: () => '/documents/intelligence',
  },
  personas: {
    list: () => '/persona',
    create: () => '/persona',
    byId: (personaId: string) => `/persona/${encodePathSegment(personaId)}`,
    versions: (personaId: string) => `/persona/${encodePathSegment(personaId)}/versions`,
    workflowUsages: (personaId: string) =>
      `/persona/${encodePathSegment(personaId)}/workflow-usages`,
    graphContext: (personaId: string) => `/persona/${encodePathSegment(personaId)}/graph-context`,
    rollbackVersion: (personaId: string, versionId: string) =>
      `/persona/${encodePathSegment(personaId)}/versions/${encodePathSegment(versionId)}/rollback`,
    sources: (personaId: string) => `/persona/${encodePathSegment(personaId)}/sources`,
    export: (personaId: string) => `/persona/${encodePathSegment(personaId)}/export`,
    governanceLabels: () => '/persona-factory/governance-labels',
    itemTypes: () => '/persona-factory/item-types',
    distill: () => '/persona-factory/distill',
    feedback: () => '/persona-factory/feedback',
    runs: () => '/persona-factory/runs',
    runById: (runId: string) => `/persona-factory/runs/${encodePathSegment(runId)}`,
    runItems: (runId: string) => `/persona-factory/runs/${encodePathSegment(runId)}/items`,
    runSourceMap: (runId: string) => `/persona-factory/runs/${encodePathSegment(runId)}/source-map`,
    runSource: (runId: string, sourceKey: string) =>
      `/persona-factory/runs/${encodePathSegment(runId)}/sources/${encodePathSegment(sourceKey)}`,
    runSourceClassification: (runId: string, sourceKey: string) =>
      `/persona-factory/runs/${encodePathSegment(runId)}/sources/${encodePathSegment(sourceKey)}/classification`,
    redistillRunSource: (runId: string, sourceKey: string) =>
      `/persona-factory/runs/${encodePathSegment(runId)}/sources/${encodePathSegment(sourceKey)}/redistill`,
    item: (itemId: string) => `/persona-factory/items/${encodePathSegment(itemId)}`,
    approveItem: (itemId: string) => `/persona-factory/items/${encodePathSegment(itemId)}/approve`,
    rejectItem: (itemId: string) => `/persona-factory/items/${encodePathSegment(itemId)}/reject`,
    bulkReviewItems: () => '/persona-factory/items/bulk-review',
    bulkReviewRunItems: (runId: string) =>
      `/persona-factory/runs/${encodePathSegment(runId)}/items/bulk-review`,
    previewBulkReviewRunItems: (runId: string) =>
      `/persona-factory/runs/${encodePathSegment(runId)}/items/bulk-review/preview`,
    normalizeRun: (runId: string) => `/persona-factory/runs/${encodePathSegment(runId)}/normalize`,
    synthesizeRun: (runId: string) =>
      `/persona-factory/runs/${encodePathSegment(runId)}/synthesize-package`,
    runPackage: (runId: string) => `/persona-factory/runs/${encodePathSegment(runId)}/package`,
    approveRun: (runId: string) => `/persona-factory/runs/${encodePathSegment(runId)}/approve`,
    publishRun: (runId: string) => `/persona-factory/runs/${encodePathSegment(runId)}/publish`,
  },
  mcpServers: {
    list: () => '/mcp-servers',
    create: () => '/mcp-servers',
    byId: (serverId: string) => `/mcp-servers/${encodePathSegment(serverId)}`,
    discover: () => '/mcp-servers/discover',
  },
  runtimeAdapters: {
    list: () => '/runtime-adapters',
    create: () => '/runtime-adapters',
    byId: (adapterId: string) => `/runtime-adapters/${encodePathSegment(adapterId)}`,
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
    state: (deviceId: string) => `/api/devices/${encodePathSegment(deviceId)}/state`,
    commands: (deviceId: string) => `/api/devices/${encodePathSegment(deviceId)}/commands`,
    events: (deviceId: string) => `/api/devices/${encodePathSegment(deviceId)}/events`,
  },
  connectors: {
    aggregateHistory: () => '/integrations/connectors/history',
    createSetupSession: (providerKey: string) =>
      `/integrations/connectors/${encodePathSegment(providerKey)}/setup-sessions`,
    installations: () => '/integrations/connectors/installations',
    installationById: (installationId: string) =>
      `/integrations/connectors/installations/${encodePathSegment(installationId)}`,
    setupSessionByInstallationId: (installationId: string) =>
      `/integrations/connectors/installations/${encodePathSegment(installationId)}/setup-session`,
    completeInstallation: (installationId: string) =>
      `/integrations/connectors/installations/${encodePathSegment(installationId)}/complete`,
    rotateInstallation: (installationId: string) =>
      `/integrations/connectors/installations/${encodePathSegment(installationId)}/rotate`,
    health: (credentialId: string) =>
      `/integrations/connectors/${encodePathSegment(credentialId)}/health`,
    test: (credentialId: string) =>
      `/integrations/connectors/${encodePathSegment(credentialId)}/test`,
    history: (credentialId: string) =>
      `/integrations/connectors/${encodePathSegment(credentialId)}/history`,
  },
  users: {
    me: () => '/me',
    profile: () => '/me/profile',
    sync: () => '/users/sync',
    list: () => '/users',
    byId: (userId: string) => `/users/${encodePathSegment(userId)}`,
  },
  workflows: {
    list: () => '/workflows',
    create: () => '/workflows',
    byId: (workflowId: string) => `/workflows/${encodePathSegment(workflowId)}`,
    sharedMemory: (workflowId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/shared-memory`,
    memoryLinks: (workflowId: string) => `/workflows/${encodePathSegment(workflowId)}/memory-links`,
    memoryLinkById: (workflowId: string, linkId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/memory-links/${encodePathSegment(linkId)}`,
    monitoring: (workflowId: string) => `/workflows/${encodePathSegment(workflowId)}/monitoring`,
    monitoringEvents: (workflowId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/monitoring/events`,
    monitoringProposalDispatch: (workflowId: string, proposalEventId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/monitoring/proposals/${encodePathSegment(proposalEventId)}/dispatch`,
    steeringApprovals: (workflowId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/steering-approvals`,
    governanceReviewQueue: (workflowId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/governance/review-queue`,
    governanceDocumentSuggest: (workflowId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/governance/document-suggest`,
    governanceBundle: (workflowId: string, recordKind: string, recordId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/governance/bundle/${encodePathSegment(recordKind)}/${encodePathSegment(recordId)}`,
    governanceActionAttachEvidence: (workflowId: string, recordKind: string, recordId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/governance/action/${encodePathSegment(recordKind)}/${encodePathSegment(recordId)}/attach-evidence`,
    governanceActionRequestApproval: (workflowId: string, recordKind: string, recordId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/governance/action/${encodePathSegment(recordKind)}/${encodePathSegment(recordId)}/request-approval`,
    governanceActionResolve: (workflowId: string, recordKind: string, recordId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/governance/action/${encodePathSegment(recordKind)}/${encodePathSegment(recordId)}/resolve`,
    governanceActionDismiss: (workflowId: string, recordKind: string, recordId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/governance/action/${encodePathSegment(recordKind)}/${encodePathSegment(recordId)}/dismiss`,
    governanceActionReopen: (workflowId: string, recordKind: string, recordId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/governance/action/${encodePathSegment(recordKind)}/${encodePathSegment(recordId)}/reopen`,
    runtimeGovernance: (workflowId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/runtime-governance`,
    personaVersionNotices: (workflowId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/persona-version-notices`,
    personaAgentUseLatest: (workflowId: string, agentId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/persona-agents/${encodePathSegment(agentId)}/use-latest`,
    personaAgentKeepCurrent: (workflowId: string, agentId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/persona-agents/${encodePathSegment(agentId)}/keep-current`,
    agentPromote: (workflowId: string, agentId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/agents/${encodePathSegment(agentId)}/promote`,
    executions: (workflowId: string) => `/workflows/${encodePathSegment(workflowId)}/executions`,
    startExecution: (workflowId: string) =>
      `/workflows/${encodePathSegment(workflowId)}/executions/start`,
    versions: (workflowId: string) => `/workflows/${encodePathSegment(workflowId)}/versions`,
    version: (workflowId: string, revision: number) =>
      `/workflows/${encodePathSegment(workflowId)}/versions/${encodePathSegment(revision)}`,
    clone: (workflowId: string) => `/workflows/${encodePathSegment(workflowId)}/clone`,
    validate: () => '/workflows/validate',
  },
  executions: {
    list: () => '/executions',
    active: () => '/executions/active',
    runtimeRevisions: () => '/executions/runtime/revisions',
    runtimeRevisionById: (revisionId: string) =>
      `/executions/runtime/revisions/${encodePathSegment(revisionId)}`,
    runtimeContainers: () => '/executions/runtime/containers',
    runtimeMetrics: () => '/executions/runtime/metrics',
    runtimeContainerLogs: (containerId: string) =>
      `/executions/runtime/containers/${encodePathSegment(containerId)}/logs`,
    runtimeReconcile: () => '/executions/runtime/reconcile',
    create: () => '/executions',
    byId: (executionId: string) => `/executions/${encodePathSegment(executionId)}`,
    start: (executionId: string) => `/executions/${encodePathSegment(executionId)}/start`,
    pause: (executionId: string) => `/executions/${encodePathSegment(executionId)}/pause`,
    resume: (executionId: string) => `/executions/${encodePathSegment(executionId)}/resume`,
    retryTask: (executionId: string, taskId: string) =>
      `/executions/${encodePathSegment(executionId)}/tasks/${encodePathSegment(taskId)}/retry`,
    resumeFromCheckpoint: (executionId: string) =>
      `/executions/${encodePathSegment(executionId)}/resume-from-checkpoint`,
    cancel: (executionId: string) => `/executions/${encodePathSegment(executionId)}/cancel`,
    approve: (executionId: string) => `/executions/${encodePathSegment(executionId)}/approve`,
    reject: (executionId: string) => `/executions/${encodePathSegment(executionId)}/reject`,
    events: (executionId: string) => `/executions/${encodePathSegment(executionId)}/events`,
    usage: (executionId: string) => `/executions/${encodePathSegment(executionId)}/usage`,
    contextUsage: (executionId: string) =>
      `/executions/${encodePathSegment(executionId)}/context-usage`,
    approvals: (executionId: string) => `/executions/${encodePathSegment(executionId)}/approvals`,
    waits: (executionId: string) => `/executions/${encodePathSegment(executionId)}/waits`,
    wait: (executionId: string, waitId: string) =>
      `/executions/${encodePathSegment(executionId)}/waits/${encodePathSegment(waitId)}`,
    resolveWait: (executionId: string, waitId: string) =>
      `/executions/${encodePathSegment(executionId)}/waits/${encodePathSegment(waitId)}/resolve`,
    artifacts: (executionId: string) => `/executions/${encodePathSegment(executionId)}/artifacts`,
    artifactImagesStream: (executionId: string) =>
      `/executions/${encodePathSegment(executionId)}/artifacts/images/stream`,
    hitlStream: (executionId: string) =>
      `/executions/${encodePathSegment(executionId)}/hitl/stream`,
    hitlReply: (executionId: string) => `/executions/${encodePathSegment(executionId)}/hitl/reply`,
    runtimeLogs: (executionId: string) =>
      `/executions/${encodePathSegment(executionId)}/runtime/logs`,
    stream: (executionId: string) => `/executions/${encodePathSegment(executionId)}/stream`,
  },
  storage: {
    presigned: () => '/storage/presigned',
  },
  schedules: {
    list: () => '/schedules',
    create: () => '/schedules',
    byId: (scheduleId: string) => `/schedules/${encodePathSegment(scheduleId)}`,
    enable: (scheduleId: string) => `/schedules/${encodePathSegment(scheduleId)}/enable`,
    disable: (scheduleId: string) => `/schedules/${encodePathSegment(scheduleId)}/disable`,
    triggerNow: (scheduleId: string) => `/schedules/${encodePathSegment(scheduleId)}/trigger-now`,
  },
  observability: {
    executionTimeline: (executionId: string) =>
      `/observability/executions/${encodePathSegment(executionId)}/timeline`,
    executionGraph: (executionId: string) =>
      `/observability/executions/${encodePathSegment(executionId)}/graph`,
    agentMetrics: (agentId: string) =>
      `/observability/agents/${encodePathSegment(agentId)}/metrics`,
    workflowMetrics: (workflowId: string) =>
      `/observability/workflows/${encodePathSegment(workflowId)}/metrics`,
    workflowGraph: (workflowId: string) =>
      `/observability/workflows/${encodePathSegment(workflowId)}/graph`,
    modelUsage: () => '/observability/models/usage',
    apiTokenActivity: () => '/observability/api-tokens/activity',
  },
  graphRead: {
    status: () => '/graph/read/status',
    node: (nodeId: string) => `/graph/read/nodes/${encodePathSegment(nodeId)}`,
    neighborhood: (nodeId: string) => `/graph/read/nodes/${encodePathSegment(nodeId)}/neighborhood`,
    expand: (nodeId: string) => `/graph/read/nodes/${encodePathSegment(nodeId)}/expand`,
    search: () => '/graph/read/search',
    workflowNeighborhood: (workflowId: string) =>
      `/graph/read/workflows/${encodePathSegment(workflowId)}/neighborhood`,
    workflowLineage: (workflowId: string) =>
      `/graph/read/workflows/${encodePathSegment(workflowId)}/lineage`,
    runNeighborhood: (runId: string) => `/graph/read/runs/${encodePathSegment(runId)}/neighborhood`,
    agentNeighborhood: (agentId: string) =>
      `/graph/read/agents/${encodePathSegment(agentId)}/neighborhood`,
    toolNeighborhood: (toolId: string) =>
      `/graph/read/tools/${encodePathSegment(toolId)}/neighborhood`,
    memoryNeighborhood: (memoryId: string) =>
      `/graph/read/memories/${encodePathSegment(memoryId)}/neighborhood`,
    entityNeighborhood: (entityId: string) =>
      `/graph/read/entities/${encodePathSegment(entityId)}/neighborhood`,
    taskNeighborhood: (taskId: string) =>
      `/graph/read/tasks/${encodePathSegment(taskId)}/neighborhood`,
  },
  graphStream: {
    deltas: () => '/graph/stream/deltas',
  },
  profile: {
    apiTokens: () => '/api-tokens',
    apiTokenScopes: () => '/api-tokens/scopes',
    revokeApiToken: (tokenId: string) => `/api-tokens/${encodePathSegment(tokenId)}/revoke`,
    credentials: () => '/credentials',
    connectorCredentialSchema: (providerKey: string) =>
      `/credentials/connectors/${encodePathSegment(providerKey)}/schema`,
    resolveConnectorCredential: () => '/credentials/connectors/resolve',
    validateConnectorCredential: (providerKey: string) =>
      `/credentials/connectors/${encodePathSegment(providerKey)}/validate`,
    createConnectorCredential: (providerKey: string) =>
      `/credentials/connectors/${encodePathSegment(providerKey)}`,
    credentialById: (credentialId: string) => `/credentials/${encodePathSegment(credentialId)}`,
    updateConnectorCredential: (credentialId: string) =>
      `/credentials/${encodePathSegment(credentialId)}/connector`,
    revokeCredential: (credentialId: string) =>
      `/credentials/${encodePathSegment(credentialId)}/revoke`,
    rotateCredential: (credentialId: string) =>
      `/credentials/${encodePathSegment(credentialId)}/rotate`,
  },
  a2a: {
    agentCard: () => '/.well-known/agent-card.json',
    createTask: () => '/a2a/tasks',
    taskById: (taskId: string) => `/a2a/tasks/${encodePathSegment(taskId)}`,
    taskMessages: (taskId: string) => `/a2a/tasks/${encodePathSegment(taskId)}/messages`,
    taskArtifacts: (taskId: string) => `/a2a/tasks/${encodePathSegment(taskId)}/artifacts`,
  },
} as const;
