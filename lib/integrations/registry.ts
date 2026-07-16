import type { IntegrationRegistryCategoryDefinition } from '@/types/integrations';

export const plannedIntegrationRegistry: IntegrationRegistryCategoryDefinition[] = [
  {
    id: 'communications',
    name: 'Communications',
    description:
      'Messaging, chat, and email connectors that can be connected through Open Agency-owned OneCLI setup sessions.',
    providers: {
      Telegram: {
        backendKey: 'telegram-bot',
        authModel: 'bot token',
        summary:
          'Bot API connector for notifications, inbound command handling, and chat delivery workflows.',
        launchPriority: 'now',
        providerAliases: ['telegram'],
      },
      'WhatsApp Cloud API': {
        backendKey: 'whatsapp-cloud-api',
        authModel: 'access token',
        summary:
          'Business messaging connector for outbound alerts, customer support handoff, and approval loops.',
        launchPriority: 'now',
        providerAliases: ['whatsapp', 'meta-whatsapp'],
      },
      Discord: {
        backendKey: 'discord-bot',
        authModel: 'bot token',
        summary:
          'Guild, channel, and webhook integration for community operations and agent notifications.',
        launchPriority: 'now',
        providerAliases: ['discord'],
      },
      Slack: {
        backendKey: 'slack-app',
        authModel: 'oauth',
        summary:
          'Workspace messaging and slash-command connector for operations, approvals, and incident response.',
        launchPriority: 'next',
        providerAliases: ['slack'],
      },
      'Microsoft Teams': {
        backendKey: 'microsoft-teams',
        authModel: 'oauth',
        summary: 'Teams messaging and workflow surfaces for enterprise collaboration flows.',
        launchPriority: 'next',
        providerAliases: ['teams', 'microsoft-teams'],
      },
      Twilio: {
        backendKey: 'twilio-sms',
        authModel: 'api key',
        summary: 'SMS and voice delivery primitive for OTP, escalation, and reminder workflows.',
        launchPriority: 'next',
        providerAliases: ['twilio'],
      },
      Gmail: {
        backendKey: 'gmail',
        authModel: 'oauth',
        summary: 'Mailbox connector for send, reply, triage, and notification digests.',
        launchPriority: 'later',
        providerAliases: ['google-mail'],
      },
      Outlook: {
        backendKey: 'outlook-email',
        authModel: 'oauth',
        summary: 'Microsoft mail connector for enterprise outbound and inbound automation.',
        launchPriority: 'later',
        providerAliases: ['outlook', 'microsoft-outlook'],
      },
    },
  },
  {
    id: 'productivity',
    name: 'Productivity',
    description:
      'Work management and office-suite connectors available for Open Agency-owned OneCLI credential setup.',
    providers: {
      Notion: {
        backendKey: 'notion',
        authModel: 'oauth',
        summary:
          'Workspace knowledge connector for search, publishing, and structured page updates.',
        launchPriority: 'next',
        providerAliases: ['notion'],
      },
      Linear: {
        backendKey: 'linear',
        authModel: 'oauth',
        summary:
          'Issue and project workflow connector for planning, triage, and release operations.',
        launchPriority: 'next',
        providerAliases: ['linear'],
      },
      Jira: {
        backendKey: 'jira',
        authModel: 'oauth',
        summary: 'Ticketing connector for enterprise engineering workflows and support queues.',
        launchPriority: 'later',
        providerAliases: ['atlassian-jira'],
      },
      Confluence: {
        backendKey: 'confluence',
        authModel: 'oauth',
        summary: 'Team knowledge base connector for retrieval, drafting, and documentation sync.',
        launchPriority: 'later',
        providerAliases: ['atlassian-confluence'],
      },
      Airtable: {
        backendKey: 'airtable',
        authModel: 'personal access token',
        summary:
          'Structured workspace connector for lightweight CRM, ops queues, and table-driven workflows.',
        launchPriority: 'later',
        providerAliases: ['airtable'],
      },
      'Google Workspace': {
        backendKey: 'google-workspace',
        authModel: 'oauth',
        summary: 'Docs, Sheets, Drive, and Calendar family for office productivity flows.',
        launchPriority: 'next',
        providerAliases: ['google-drive', 'google-calendar', 'google-docs', 'google-sheets'],
      },
      'Microsoft 365': {
        backendKey: 'microsoft-365',
        authModel: 'oauth',
        summary: 'Outlook, Calendar, OneDrive, and SharePoint family for enterprise collaboration.',
        launchPriority: 'next',
        providerAliases: ['office365', 'microsoft-365', 'sharepoint', 'onedrive'],
      },
    },
  },
  {
    id: 'developer',
    name: 'Developer',
    description:
      'Engineering-facing connectors available for Open Agency-owned OneCLI credential setup.',
    providers: {
      GitHub: {
        backendKey: 'github',
        authModel: 'oauth',
        summary: 'Repository, PR, issue, and CI connector for engineering automation.',
        launchPriority: 'next',
        providerAliases: ['github'],
      },
      GitLab: {
        backendKey: 'gitlab',
        authModel: 'oauth',
        summary: 'Source control and CI connector for self-hosted or GitLab-native workflows.',
        launchPriority: 'later',
        providerAliases: ['gitlab'],
      },
      Sentry: {
        backendKey: 'sentry',
        authModel: 'auth token',
        summary: 'Incident and error monitoring connector for alert enrichment and triage.',
        launchPriority: 'later',
        providerAliases: ['sentry'],
      },
      PagerDuty: {
        backendKey: 'pagerduty',
        authModel: 'REST API token',
        summary: 'On-call and escalation connector for human-in-the-loop operational workflows.',
        launchPriority: 'later',
        providerAliases: ['pagerduty'],
      },
    },
  },
  {
    id: 'media-creative',
    name: 'Media & Creative',
    description:
      'Creative and publishing connectors available for Open Agency-owned OneCLI credential setup.',
    providers: {
      Figma: {
        backendKey: 'figma',
        authModel: 'oauth',
        summary:
          'Design file connector for implementation context, component retrieval, and review loops.',
        launchPriority: 'next',
        providerAliases: ['figma'],
      },
      Canva: {
        backendKey: 'canva',
        authModel: 'oauth',
        summary: 'Asset and template connector for social, marketing, and light design automation.',
        launchPriority: 'later',
        providerAliases: ['canva'],
      },
      YouTube: {
        backendKey: 'youtube',
        authModel: 'oauth',
        summary: 'Channel and content connector for publishing, metadata, and reporting workflows.',
        launchPriority: 'later',
        providerAliases: ['google-youtube'],
      },
      Adobe: {
        backendKey: 'adobe-creative-cloud',
        authModel: 'oauth',
        summary:
          'Creative Cloud family placeholder for asset review and production handoff automation.',
        launchPriority: 'later',
        providerAliases: ['adobe', 'creative-cloud'],
      },
    },
  },
  {
    id: 'home-tools',
    name: 'Smart Home',
    description:
      'Smart-home and ambient-environment setup for Open Agency home automation, camera analysis, announcements, and room-aware actions.',
    providers: {
      'Smart Home': {
        backendKey: 'home-assistant',
        authModel: 'access token',
        summary:
          'Primary Open Agency Smart Home setup, currently implemented through a Home Assistant compatibility bridge for entity reads, safe actions, and camera-backed ambient reasoning.',
        launchPriority: 'now',
        providerAliases: ['home-assistant', 'home_assistant', 'homeassistant', 'smart-home'],
      },
    },
  },
  {
    id: 'search-knowledge',
    name: 'Search / Knowledge',
    description:
      'Retrieval and external knowledge connectors available for Open Agency-owned OneCLI credential setup.',
    providers: {
      Perplexity: {
        backendKey: 'perplexity',
        authModel: 'api key',
        summary:
          'Web answer and research connector for augmented retrieval and citation workflows.',
        launchPriority: 'later',
        providerAliases: ['perplexity'],
      },
      Tavily: {
        backendKey: 'tavily',
        authModel: 'api key',
        summary: 'Search API connector for controlled web retrieval in agent runs.',
        launchPriority: 'later',
        providerAliases: ['tavily'],
      },
      Wikipedia: {
        backendKey: 'wikipedia',
        authModel: 'public api',
        summary: 'Reference data connector for lightweight public knowledge retrieval.',
        launchPriority: 'later',
      },
    },
  },
  {
    id: 'storage',
    name: 'Storage',
    description:
      'File and object-store connectors available for Open Agency-owned OneCLI credential setup.',
    providers: {
      S3: {
        backendKey: 's3',
        authModel: 'access key',
        summary:
          'Bucket and object storage connector for artifacts, documents, and workflow payload exchange.',
        launchPriority: 'next',
        providerAliases: ['aws-s3'],
      },
      'Google Drive': {
        backendKey: 'google-drive',
        authModel: 'oauth',
        summary: 'Drive connector for document retrieval, writeback, and shared workspace sync.',
        launchPriority: 'next',
        providerAliases: ['google-workspace-drive'],
      },
      Dropbox: {
        backendKey: 'dropbox',
        authModel: 'oauth',
        summary: 'Cloud file connector for assets, exports, and folder-triggered workflows.',
        launchPriority: 'later',
        providerAliases: ['dropbox'],
      },
      OneDrive: {
        backendKey: 'onedrive',
        authModel: 'oauth',
        summary: 'Microsoft file storage connector for enterprise document workflows.',
        launchPriority: 'later',
        providerAliases: ['microsoft-onedrive'],
      },
      SharePoint: {
        backendKey: 'sharepoint',
        authModel: 'oauth',
        summary:
          'Document library connector for team knowledge, approvals, and enterprise content flows.',
        launchPriority: 'later',
        providerAliases: ['microsoft-sharepoint'],
      },
    },
  },
];
