import { getAgencyApiBaseUrl } from '@/lib/api/config';
import { backendRoutes } from '@/lib/api/backend/routes';

const graphStreamProxyPath = '/api/graph-stream/deltas';

export interface GraphDeltaStreamParams {
  after?: string;
  executionId?: string;
  workflowId?: string;
  aggregateType?: string;
  eventTypes?: string[];
  heartbeatSeconds?: number;
  pollSeconds?: number;
  retryMs?: number;
  limit?: number;
}

export function buildGraphDeltaStreamUrl(params: GraphDeltaStreamParams = {}) {
  const baseUrl = getAgencyApiBaseUrl().replace(/\/+$/, '');
  const query = new URLSearchParams();
  if (params.after) {
    query.set('after', params.after);
  }
  if (params.executionId) {
    query.set('execution_id', params.executionId);
  }
  if (params.workflowId) {
    query.set('workflow_id', params.workflowId);
  }
  if (params.aggregateType) {
    query.set('aggregate_type', params.aggregateType);
  }
  if (params.eventTypes?.length) {
    query.set('event_types', params.eventTypes.join(','));
  }
  if (params.heartbeatSeconds !== undefined) {
    query.set('heartbeat_seconds', String(params.heartbeatSeconds));
  }
  if (params.pollSeconds !== undefined) {
    query.set('poll_seconds', String(params.pollSeconds));
  }
  if (params.retryMs !== undefined) {
    query.set('retry_ms', String(params.retryMs));
  }
  if (params.limit !== undefined) {
    query.set('limit', String(params.limit));
  }

  const path =
    !baseUrl || baseUrl.startsWith('/')
      ? graphStreamProxyPath
      : `${baseUrl}${backendRoutes.graphStream.deltas()}`;
  const queryString = query.toString();
  return queryString ? `${path}?${queryString}` : path;
}
