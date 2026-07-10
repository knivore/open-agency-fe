import type { ConnectorCapabilityDefinition } from '@/types/integrations';

export const SMART_HOME_CAPABILITY_SURFACE: ConnectorCapabilityDefinition['capabilitySurface'] =
  'module';

export const SMART_HOME_CAPABILITIES = [
  'entity discovery',
  'room and area context',
  'safe home actions',
  'camera-capable entity access',
  'home state reads',
] as const;

export const SMART_HOME_AGENCY_DEPENDENCIES = [
  'vision',
  'speech',
  'speech output',
  'speech continuation',
  'ambient-agent orchestration',
] as const;

export const SMART_HOME_OWNERSHIP_NOTES = [
  'Home Assistant is the current compatibility bridge behind Agency Smart Home.',
  'Camera analysis should run through Agency vision capabilities rather than a Smart Home-owned vision stack.',
  'Speech session handling and conversational continuation should run through Agency speech capabilities rather than a Smart Home-owned speech stack.',
] as const;

export function buildSmartHomeCapabilityMetadata(): Pick<
  ConnectorCapabilityDefinition,
  'capabilitySurface' | 'moduleCapabilities' | 'dependsOnAgencyCapabilities' | 'ownershipNotes'
> {
  return {
    capabilitySurface: SMART_HOME_CAPABILITY_SURFACE,
    moduleCapabilities: [...SMART_HOME_CAPABILITIES],
    dependsOnAgencyCapabilities: [...SMART_HOME_AGENCY_DEPENDENCIES],
    ownershipNotes: [...SMART_HOME_OWNERSHIP_NOTES],
  };
}
