import { describe, expect, it } from 'vitest';
import {
  agencyGraphHealthMetadataKeys,
  agencyGraphMetadataKeys,
  agencyGraphNodeTypes,
  agencyGraphRelationshipTypes,
  canonicalGraphMetadata,
  isAgencyGraphNodeType,
  isAgencyGraphRelationshipType,
  validateAgencyGraphInvariants,
} from './domainModel';
import { executionEventsToSigmaGraph } from './executionFallbackGraph';

describe('Agency Graph domain model', () => {
  it('defines the holistic vocabulary used by Agency Graph phases', () => {
    expect(agencyGraphNodeTypes).toEqual(
      expect.arrayContaining([
        'User',
        'Workflow',
        'Run',
        'Agent',
        'Task',
        'Tool',
        'ModelRequest',
        'RuntimeContainer',
        'ExecutionEvent',
        'Artifact',
        'Memory',
        'Document',
        'Entity',
        'Decision',
        'Error',
        'ApprovalRequest',
        'Credential',
      ])
    );
    expect(agencyGraphRelationshipTypes).toEqual(
      expect.arrayContaining([
        'CREATED_BY',
        'STARTED',
        'TRIGGERED',
        'PARTICIPATED_IN',
        'CALLED_TOOL',
        'USED_MODEL',
        'USED_RUNTIME',
        'EMITTED_EVENT',
        'FAILED_WITH',
        'PRODUCED_ARTIFACT',
        'SOURCE_DOCUMENT',
        'MENTIONS',
        'HAS_APPROVAL',
        'USES_INTEGRATION',
      ])
    );
    expect(agencyGraphMetadataKeys).toEqual(
      expect.arrayContaining(['source_system', 'projection_mode', 'root_type', 'confidence'])
    );
    expect(agencyGraphHealthMetadataKeys).toEqual(
      expect.arrayContaining(['status', 'severity', 'missing_embedding', 'token_count'])
    );
  });

  it('validates canonical node and relationship types', () => {
    expect(isAgencyGraphNodeType('Run')).toBe(true);
    expect(isAgencyGraphNodeType('UnknownNode')).toBe(false);
    expect(isAgencyGraphRelationshipType('STARTED')).toBe(true);
    expect(isAgencyGraphRelationshipType('UNKNOWN_EDGE')).toBe(false);
  });

  it('normalizes graph metadata with a generated timestamp', () => {
    const metadata = canonicalGraphMetadata({
      source_system: 'agency-backend',
      projection_mode: 'neo4j',
      root_type: 'Run',
      root_id: 'run-1',
    });

    expect(metadata).toMatchObject({
      source_system: 'agency-backend',
      projection_mode: 'neo4j',
      root_type: 'Run',
      root_id: 'run-1',
    });
    expect(typeof metadata.generated_at).toBe('string');
  });

  it('passes invariants for event fallback graphs with source metadata', () => {
    const document = executionEventsToSigmaGraph(
      {
        id: 'run-1',
        workflow_id: 'workflow-1',
        status: 'failed',
        error: 'Runtime failed.',
      },
      [
        {
          id: 'event-1',
          execution_id: 'run-1',
          event_type: 'execution.created',
          sequence: 1,
          timestamp: '2026-05-27T01:09:39Z',
        },
        {
          id: 'event-2',
          execution_id: 'run-1',
          event_type: 'tool.call.completed',
          tool_call_id: 'tool-call-1',
          sequence: 2,
          timestamp: '2026-05-27T01:09:40Z',
          payload: { tool_name: 'Shell' },
        },
      ]
    );

    expect(validateAgencyGraphInvariants(document)).toEqual([]);
  });

  it('reports invariant gaps for non-canonical graph documents', () => {
    const issues = validateAgencyGraphInvariants({
      schemaVersion: 'sigma.graph.document.v1',
      nodes: [{ id: 'node-1', type: 'UnknownNode', label: 'Unknown' }],
      edges: [{ id: 'edge-1', source: 'node-1', target: 'missing-node', type: 'UNKNOWN_EDGE' }],
    });

    expect(issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        'nodes[0].type',
        'nodes[0].metadata',
        'edges[0].target',
        'edges[0].type',
        'edges[0].metadata',
      ])
    );
  });
});
