import { createAzure, AzureOpenAIProvider } from '@ai-sdk/azure';

interface AzureProvider {
  azure: AzureOpenAIProvider;
  deploymentName: string;
}

export function getAzureProvider(): AzureProvider {
  const {
    AZURE_OPENAI_API_KEY: apiKey,
    AZURE_OPENAI_ENDPOINT: endpoint,
    DEPLOYMENT_NAME: deploymentName,
  } = process.env;

  if (!apiKey) throw new Error('Missing AZURE_OPENAI_API_KEY in environment variables.');
  if (!endpoint) throw new Error('Missing AZURE_OPENAI_ENDPOINT in environment variables.');
  if (!deploymentName) throw new Error('Missing DEPLOYMENT_NAME in environment variables.');

  const azureClient = createAzure({
    resourceName: endpoint,
    apiKey,
  });

  return { azure: azureClient, deploymentName };
}
