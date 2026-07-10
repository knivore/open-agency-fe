import { describe, expect, it } from 'vitest';
import {
  sortToolsForWorkflowCapabilities,
  toolCapabilityTags,
  toolsRecommendedForWorkflowCapabilities,
} from '@/lib/workflows/capabilityTooling';
import type { ToolDefinition } from '@/types/tools';

const homeTool: ToolDefinition = {
  id: 'home_assistant.turn_on',
  name: 'home_assistant_turn_on',
  description: 'Turn on a smart-home entity.',
  tags: ['catalog', 'home_assistant'],
};

const visionTool: ToolDefinition = {
  id: 'home_assistant.analyse_camera',
  name: 'home_assistant_analyse_camera',
  description: 'Analyze a camera snapshot with Agency vision.',
  tags: ['catalog', 'camera_analysis'],
};

const speechTool: ToolDefinition = {
  id: 'agency.speech.listen',
  name: 'agency_speech_listen',
  description: 'Transcribe recorded speech into text.',
  tags: ['catalog', 'speech'],
};

const canonicalDeviceTool: ToolDefinition = {
  id: 'agency.device.command',
  name: 'agency_device_command',
  description: 'Issue a policy-checked canonical device command.',
  tags: ['catalog', 'physical_devices', 'smart_home'],
};

const generalTool: ToolDefinition = {
  id: 'agency.http.request',
  name: 'agency_http_request',
  description: 'Call an HTTP endpoint.',
  tags: ['catalog'],
};

describe('capabilityTooling', () => {
  it('classifies tools by workflow capability tags', () => {
    expect(toolCapabilityTags(homeTool)).toContain('home-control');
    expect(toolCapabilityTags(visionTool)).toContain('vision');
    expect(toolCapabilityTags(speechTool)).toContain('voice');
  });

  it('returns recommended tools for selected workflow capabilities', () => {
    expect(
      toolsRecommendedForWorkflowCapabilities(
        [homeTool, visionTool, speechTool, generalTool],
        ['home-control', 'vision']
      ).map((tool) => tool.id)
    ).toEqual(['home_assistant.turn_on', 'home_assistant.analyse_camera']);
  });

  it('prefers canonical device tools over Home Assistant tools for generic home-control recommendations', () => {
    expect(
      toolsRecommendedForWorkflowCapabilities(
        [homeTool, canonicalDeviceTool, speechTool, generalTool],
        ['home-control']
      ).map((tool) => tool.id)
    ).toEqual(['agency.device.command']);
  });

  it('keeps Home Assistant tools that are matched for a different requested capability', () => {
    expect(
      toolsRecommendedForWorkflowCapabilities(
        [homeTool, visionTool, canonicalDeviceTool],
        ['home-control', 'vision']
      ).map((tool) => tool.id)
    ).toEqual(['home_assistant.analyse_camera', 'agency.device.command']);
  });

  it('sorts recommended tools ahead of generic tools', () => {
    expect(
      sortToolsForWorkflowCapabilities([generalTool, speechTool, homeTool], ['voice']).map(
        (tool) => tool.id
      )
    ).toEqual(['agency.speech.listen', 'agency.http.request', 'home_assistant.turn_on']);
  });
});
