type ConnectorLocation = {
  categoryId: string;
  connectorId: string;
};

const connectorLocations: Record<string, ConnectorLocation> = {
  'telegram-bot': { categoryId: 'communications', connectorId: 'communications-telegram' },
  'whatsapp-cloud-api': {
    categoryId: 'communications',
    connectorId: 'communications-whatsapp-cloud-api',
  },
  'discord-bot': { categoryId: 'communications', connectorId: 'communications-discord' },
  'slack-app': { categoryId: 'communications', connectorId: 'communications-slack' },
  'microsoft-teams': {
    categoryId: 'communications',
    connectorId: 'communications-microsoft-teams',
  },
  'twilio-sms': { categoryId: 'communications', connectorId: 'communications-twilio' },
  gmail: { categoryId: 'communications', connectorId: 'communications-gmail' },
  'outlook-email': { categoryId: 'communications', connectorId: 'communications-outlook' },
  notion: { categoryId: 'productivity', connectorId: 'productivity-notion' },
  linear: { categoryId: 'productivity', connectorId: 'productivity-linear' },
  jira: { categoryId: 'productivity', connectorId: 'productivity-jira' },
  confluence: { categoryId: 'productivity', connectorId: 'productivity-confluence' },
  airtable: { categoryId: 'productivity', connectorId: 'productivity-airtable' },
  'google-workspace': {
    categoryId: 'productivity',
    connectorId: 'productivity-google-workspace',
  },
  'microsoft-365': { categoryId: 'productivity', connectorId: 'productivity-microsoft-365' },
  github: { categoryId: 'developer', connectorId: 'developer-github' },
  gitlab: { categoryId: 'developer', connectorId: 'developer-gitlab' },
  sentry: { categoryId: 'developer', connectorId: 'developer-sentry' },
  pagerduty: { categoryId: 'developer', connectorId: 'developer-pagerduty' },
  figma: { categoryId: 'media-creative', connectorId: 'media-creative-figma' },
  canva: { categoryId: 'media-creative', connectorId: 'media-creative-canva' },
  youtube: { categoryId: 'media-creative', connectorId: 'media-creative-youtube' },
  'adobe-creative-cloud': { categoryId: 'media-creative', connectorId: 'media-creative-adobe' },
  perplexity: { categoryId: 'search-knowledge', connectorId: 'search-knowledge-perplexity' },
  tavily: { categoryId: 'search-knowledge', connectorId: 'search-knowledge-tavily' },
  wikipedia: { categoryId: 'search-knowledge', connectorId: 'search-knowledge-wikipedia' },
  s3: { categoryId: 'storage', connectorId: 'storage-s3' },
  'google-drive': { categoryId: 'storage', connectorId: 'storage-google-drive' },
  dropbox: { categoryId: 'storage', connectorId: 'storage-dropbox' },
  onedrive: { categoryId: 'storage', connectorId: 'storage-onedrive' },
  sharepoint: { categoryId: 'storage', connectorId: 'storage-sharepoint' },
};

export function integrationConnectorHrefForProviderKey(providerKey: string) {
  if (providerKey === 'home-assistant') {
    return '/integrations/smart-home';
  }
  if (providerKey === 'physical-devices') {
    return '/operations/physical-devices';
  }

  const location = connectorLocations[providerKey];
  if (!location) {
    return '/integrations';
  }

  return `/integrations?integration-tab=${encodeURIComponent(location.categoryId)}&integration-connector=${encodeURIComponent(location.connectorId)}`;
}
