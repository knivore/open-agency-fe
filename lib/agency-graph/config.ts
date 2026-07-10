export function isAgencyGraphRealtimeEnabled() {
  return process.env.NEXT_PUBLIC_GRAPH_REALTIME_ENABLED === 'true';
}
