import { graphReadDtoToSigmaGraph } from '@/modules/sigma-graph/adapters/graphReadDto';
import type { AgencyGraphDocumentResponse } from './types';

export function agencyGraphReadToSigmaGraph(response: AgencyGraphDocumentResponse) {
  return graphReadDtoToSigmaGraph(response);
}
