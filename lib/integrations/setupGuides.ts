import type {
  ConnectorSetupGuideDefinition,
  ConnectorSetupGuideFieldDefinition,
} from '@/types/integrations';

const REVIEWED_AT = '2026-07-14';
const AGENCY_STORES = [
  'installation id',
  'provider key',
  'display name',
  'onecli credential ref',
  'non-secret metadata',
  'installation status',
];
const COMPLETION_SIGNAL =
  'Open Agency verifies the session-specific OneCLI resource through the metadata API, stores only its resource reference and non-secret metadata, and then marks the installation active.';

const secret = (
  key: string,
  label: string,
  description: string
): ConnectorSetupGuideFieldDefinition => ({ key, label, secret: true, description });

const metadata = (
  key: string,
  label: string,
  description: string
): ConnectorSetupGuideFieldDefinition => ({ key, label, secret: false, description });

function guide(
  backendKey: string,
  definition: Pick<
    ConnectorSetupGuideDefinition,
    | 'fields'
    | 'options'
    | 'notes'
    | 'prerequisites'
    | 'steps'
    | 'verification'
    | 'troubleshooting'
    | 'resources'
    | 'estimatedMinutes'
  >
): ConnectorSetupGuideDefinition {
  return {
    storagePath: `onecli://users/{agency_user_id}/${backendKey}/{agency_installation_id}`,
    agencyStores: AGENCY_STORES,
    completionSignal: COMPLETION_SIGNAL,
    reviewedAt: REVIEWED_AT,
    ...definition,
  };
}

// These guides intentionally live in the frontend fallback so every catalog entry remains usable
// when an older backend returns only the connector schema and not the richer operator guidance.
export const integrationSetupGuides: Record<string, ConnectorSetupGuideDefinition> = {
  'telegram-bot': guide('telegram-bot', {
    estimatedMinutes: 8,
    fields: [
      secret('bot_token', 'Bot token', 'Copy the token issued by the verified @BotFather account.'),
      metadata('bot_username', 'Bot username', 'The username chosen in BotFather, without the @.'),
      metadata(
        'webhook_secret_ref',
        'Webhook secret ref',
        'Reference to the random secret used to verify production webhook deliveries.'
      ),
    ],
    prerequisites: ['A Telegram account', 'Permission to add the bot to the target chat or group'],
    steps: [
      {
        title: 'Create the bot in BotFather',
        description:
          'Open the verified @BotFather chat, run /newbot, then choose a display name and a username ending in bot.',
      },
      {
        title: 'Copy and protect the token',
        description:
          'Copy the token BotFather shows once and paste it only into OneCLI. Anyone with this token controls the bot.',
      },
      {
        title: 'Start a chat and capture the target',
        description:
          'Message the bot directly or add it to the intended group. Bots cannot initiate a conversation with a user.',
        details: [
          'For group-wide messages, give the bot permission to post.',
          'Disable BotFather privacy mode only if workflows must receive ordinary group messages.',
        ],
      },
      {
        title: 'Complete the Open Agency handoff',
        description:
          'Start setup below, create the matching OneCLI Generic Secret, then return here and complete the installation.',
      },
    ],
    verification: [
      'Call getMe or run Open Agency connection testing and confirm the returned username matches.',
      'Send a test message only after the user has started the bot or added it to the group.',
    ],
    troubleshooting: [
      {
        issue: '401 Unauthorized',
        resolution:
          'The token is wrong or was revoked. Generate a replacement with BotFather and rotate the saved secret.',
      },
      {
        issue: 'Bot cannot message a user',
        resolution:
          'Ask the user to open the bot and press Start first; Telegram bots cannot begin private conversations.',
      },
    ],
    resources: [
      { label: 'Telegram bot tutorial', url: 'https://core.telegram.org/bots/tutorial' },
      { label: 'BotFather guide', url: 'https://core.telegram.org/bots/features#botfather' },
    ],
    notes: [
      'Telegram uses OneCLI URL-path injection. Set the path template exactly to /bot{value}; Open Agency sends a placeholder path and never stores the bot token.',
    ],
  }),
  'whatsapp-cloud-api': guide('whatsapp-cloud-api', {
    estimatedMinutes: 25,
    fields: [
      secret(
        'access_token',
        'System-user access token',
        'Use a production system-user token, not the 24-hour test token.'
      ),
      metadata(
        'phone_number_id',
        'Phone number ID',
        'The sender Phone Number ID shown in WhatsApp API Setup.'
      ),
      metadata(
        'business_account_id',
        'WhatsApp Business Account ID',
        'The WABA that owns the sending number.'
      ),
      metadata(
        'app_secret_ref',
        'App secret ref',
        'Secret reference used to validate webhook signatures.'
      ),
    ],
    prerequisites: [
      'A Meta business portfolio and developer app',
      'A WhatsApp Business Account and a phone number you can verify',
    ],
    steps: [
      {
        title: 'Add WhatsApp to a Meta app',
        description:
          'In the Meta App Dashboard, add the WhatsApp product and finish API Setup. Use the test number only for an initial proof.',
      },
      {
        title: 'Register a production sender',
        description:
          'Add and verify the business phone number, then copy its Phone Number ID and the WABA ID. These are different identifiers.',
      },
      {
        title: 'Create durable credentials',
        description:
          'Create a Meta Business system user, assign the app and WhatsApp assets, and issue the least-privilege token needed for messaging.',
      },
      {
        title: 'Configure inbound webhooks if needed',
        description:
          'Subscribe the app to the WABA and configure an HTTPS callback, verify token, and app-secret signature validation.',
      },
      {
        title: 'Store and complete',
        description:
          'Paste the token only into OneCLI; enter the Phone Number ID and other non-secret identifiers in Open Agency.',
      },
    ],
    verification: [
      'Send a template message to an allowed test recipient, then confirm a successful message ID.',
      'For inbound workflows, send a reply and confirm the signed webhook reaches Open Agency.',
    ],
    troubleshooting: [
      {
        issue: 'Test worked, production stopped later',
        resolution:
          'The dashboard test token expires quickly. Replace it with a properly assigned system-user token.',
      },
      {
        issue: 'Unsupported post request or permission error',
        resolution:
          'Confirm the token owns the WABA/phone asset and that Phone Number ID was not confused with the WABA ID.',
      },
    ],
    resources: [
      {
        label: 'WhatsApp Cloud API overview',
        url: 'https://developers.facebook.com/docs/whatsapp/cloud-api/overview',
      },
      {
        label: 'Official Meta API collection',
        url: 'https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api',
      },
    ],
  }),
  'discord-bot': guide('discord-bot', {
    estimatedMinutes: 12,
    fields: [
      secret('bot_token', 'Bot token', 'Token generated on the application Bot page.'),
      metadata('application_id', 'Application ID', 'Identifier from General Information.'),
      metadata(
        'webhook_public_key',
        'Public Key',
        'Hex public key used to verify Discord interactions.'
      ),
      metadata(
        'default_guild_id',
        'Default server ID',
        'Optional target server for this installation.'
      ),
    ],
    prerequisites: ['A Discord account', 'Manage Server permission in the target test server'],
    steps: [
      {
        title: 'Create a Discord application',
        description:
          'Create an app in the Developer Portal, then copy the Application ID and Public Key from General Information.',
      },
      {
        title: 'Generate the bot token',
        description:
          'Open Bot, reset or generate the token, copy it once, and enable only the Gateway intents your workflows actually need.',
      },
      {
        title: 'Configure installation',
        description:
          'Under Installation, select the required contexts and add applications.commands plus bot for a server install. Grant the minimum bot permissions, such as Send Messages.',
      },
      {
        title: 'Install into a test server',
        description:
          'Open the Discord-provided install link, choose a non-production server, and confirm the bot appears in the member list.',
      },
      {
        title: 'Store and complete',
        description:
          'Paste the bot token into OneCLI and save the public identifiers as Open Agency metadata.',
      },
    ],
    verification: [
      'Run Open Agency connection testing or call /users/@me with Bot authentication.',
      'Send a message in a channel where the bot has View Channel and Send Messages permissions.',
    ],
    troubleshooting: [
      {
        issue: '401 Unauthorized',
        resolution:
          'Resetting a token invalidates the old value immediately. Start a new Open Agency rotation session and replace the matching OneCLI resource.',
      },
      {
        issue: 'Bot is online but events are missing',
        resolution:
          'Enable the required Gateway intent and, for privileged intents, complete Discord approval when applicable.',
      },
    ],
    resources: [
      {
        label: 'Discord bot quick start',
        url: 'https://docs.discord.com/developers/quick-start/getting-started',
      },
      { label: 'Discord application portal', url: 'https://discord.com/developers/applications' },
    ],
  }),
  'slack-app': guide('slack-app', {
    estimatedMinutes: 15,
    fields: [
      secret('bot_access_token', 'Bot access token', 'Workspace token returned after OAuth.'),
      secret('client_secret', 'Client secret', 'Slack app client secret used only during OAuth.'),
      metadata('client_id', 'Client ID', 'Slack app client ID.'),
      metadata('workspace_id', 'Workspace ID', 'Workspace selected during installation.'),
    ],
    prerequisites: [
      'Permission to create or install apps in the Slack workspace',
      'A public HTTPS OAuth callback URL',
    ],
    steps: [
      {
        title: 'Create the Slack app',
        description:
          'Create an app from scratch in the Slack API console and select a development workspace.',
      },
      {
        title: 'Configure OAuth',
        description:
          'Add the exact HTTPS redirect URL under OAuth & Permissions and add only the bot scopes the workflows call.',
        details: [
          'chat:write is sufficient for basic outbound messages.',
          'Add channels:read or history scopes only when the connector truly reads those resources.',
        ],
      },
      {
        title: 'Install and authorize',
        description:
          'Start Slack OAuth v2, validate state, approve the workspace, and exchange the short-lived code with oauth.v2.access.',
      },
      {
        title: 'Save the installed bot token',
        description:
          'Store the resulting xoxb bot token in the session-specific OneCLI Generic Secret, with workspace/team identifiers as non-secret metadata.',
      },
    ],
    verification: [
      'Call auth.test and confirm the expected team and bot user.',
      'Post to a test channel where the app is a member.',
    ],
    troubleshooting: [
      {
        issue: 'bad_redirect_uri',
        resolution:
          'The authorize and token-exchange redirect_uri values must be identical and allowed by the configured Redirect URL.',
      },
      {
        issue: 'not_in_channel',
        resolution:
          'Invite the app to the channel or use an allowed public-channel scope and behavior.',
      },
    ],
    resources: [
      { label: 'Slack OAuth v2', url: 'https://api.slack.com/authentication/oauth-v2' },
      { label: 'Slack authentication overview', url: 'https://api.slack.com/authentication' },
    ],
    notes: [
      'Open Agency’s verified self-hosted OneCLI path stores the installed bot access token. Client secrets and OAuth refresh handling are not copied into Open Agency.',
    ],
  }),
  'microsoft-teams': guide('microsoft-teams', {
    estimatedMinutes: 30,
    fields: [
      secret('client_secret', 'Client secret', 'Microsoft Entra application secret.'),
      metadata('client_id', 'Application ID', 'Entra application/client ID.'),
      metadata('tenant_id', 'Tenant ID', 'Tenant that grants access.'),
      metadata('teams_app_id', 'Teams app ID', 'Published Teams catalog app identifier.'),
    ],
    prerequisites: [
      'Microsoft Entra and Teams app-registration access',
      'Admin consent for any application permissions',
    ],
    steps: [
      {
        title: 'Register the Entra application',
        description:
          'Create the app registration, record client and tenant IDs, add a server-side secret, and register the exact redirect URI.',
      },
      {
        title: 'Configure least-privilege permissions',
        description:
          'Choose delegated scopes for signed-in actions or application permissions for background operation; application permissions require admin consent.',
      },
      {
        title: 'Create and publish the Teams app',
        description:
          'Associate the Entra app in the Teams manifest, add the bot/messaging capability, then publish to the organization catalog or Teams Store.',
      },
      {
        title: 'Install before proactive messaging',
        description:
          'Install the app for the user or team. A bot cannot proactively message a target until installed and a conversation reference exists.',
      },
      {
        title: 'Authorize and store',
        description:
          'Complete OAuth, then store the token set in OneCLI and the tenant/Teams identifiers as metadata.',
      },
    ],
    verification: [
      'Confirm token claims contain the expected tenant and permissions.',
      'Install in a test team and send a test message to the captured conversation.',
    ],
    troubleshooting: [
      {
        issue: 'Admin approval required',
        resolution:
          'A tenant administrator must grant configured application permissions before app-only access works.',
      },
      {
        issue: 'Proactive message has no conversation',
        resolution:
          'Install the Teams app for the target first and retain the conversationUpdate reference.',
      },
    ],
    resources: [
      {
        label: 'Teams bot authentication',
        url: 'https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/authentication/add-authentication',
      },
      {
        label: 'Proactive bot installation',
        url: 'https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/proactive-bots-and-messages/graph-proactive-bots-and-messages',
      },
    ],
  }),
  'twilio-sms': guide('twilio-sms', {
    estimatedMinutes: 10,
    fields: [
      secret('api_key_secret', 'API key secret', 'Secret shown once when the key is created.'),
      metadata('api_key_sid', 'API key SID', 'SID beginning with SK.'),
      metadata('account_sid', 'Account SID', 'Owning Twilio account SID beginning with AC.'),
      metadata('from_number', 'From number', 'Twilio sender used by workflows.'),
    ],
    prerequisites: [
      'A Twilio project with a funded or trial account',
      'A Twilio number or approved Messaging Service',
    ],
    steps: [
      {
        title: 'Prepare a sender',
        description:
          'Buy or select a messaging-capable Twilio number and complete any country-specific registration.',
      },
      {
        title: 'Create an API key',
        description:
          'In Twilio Console, create a Restricted key when possible or Standard key for broader server access. Do not use the master Auth Token in production.',
      },
      {
        title: 'Copy all credential parts',
        description: 'Record Account SID, API Key SID, and the secret shown only at creation.',
      },
      {
        title: 'Store and complete',
        description:
          'Paste the key secret into OneCLI and save SIDs, region, and sender as non-secret metadata.',
      },
    ],
    verification: [
      'Send an SMS to a verified recipient and confirm a Message SID.',
      'Check delivery status; trial accounts can only message verified destinations.',
    ],
    troubleshooting: [
      {
        issue: 'Authentication failed',
        resolution:
          'Use API Key SID as username, key secret as password, and the owning Account SID in the request path.',
      },
      {
        issue: 'Message rejected',
        resolution:
          'Check sender capability, trial restrictions, geographic permissions, and required sender registration.',
      },
    ],
    resources: [{ label: 'Twilio API keys', url: 'https://www.twilio.com/docs/iam/api-keys' }],
  }),
  gmail: guide('gmail', {
    estimatedMinutes: 20,
    fields: [
      secret('client_secret', 'OAuth client secret', 'Google web client secret.'),
      secret('refresh_token', 'Refresh token', 'Offline-access refresh token.'),
      metadata('client_id', 'OAuth client ID', 'Google web client ID.'),
      metadata('mailbox', 'Mailbox', 'Authorized Gmail address.'),
    ],
    prerequisites: ['A Google Cloud project', 'A verified HTTPS redirect URI for production'],
    steps: [
      {
        title: 'Enable Gmail API',
        description: 'Select or create a Cloud project and enable the Gmail API.',
      },
      {
        title: 'Configure Google Auth',
        description:
          'Set Branding, Audience, and Data Access, add test users when the app is in testing, and declare the narrowest Gmail scopes.',
      },
      {
        title: 'Create a web OAuth client',
        description:
          'Create a Web application client and add the exact callback URI. Scheme, host, path, case, and trailing slash must match.',
      },
      {
        title: 'Authorize for offline access',
        description:
          'Request state and access_type=offline; exchange the code server-side and retain the refresh token.',
      },
      {
        title: 'Store and complete',
        description:
          'Keep client secret and refresh token in OneCLI; save the mailbox identifier as metadata.',
      },
    ],
    verification: [
      'Call users.getProfile or list labels for the authorized mailbox.',
      'Send only after confirming the granted scope includes the required Gmail action.',
    ],
    troubleshooting: [
      {
        issue: 'redirect_uri_mismatch',
        resolution:
          'Copy the callback exactly into the Google OAuth client, including trailing slash.',
      },
      {
        issue: 'No refresh token returned',
        resolution:
          'Request offline access and, when reconnecting an existing grant, explicitly prompt for consent.',
      },
    ],
    resources: [
      {
        label: 'Gmail server-side authorization',
        url: 'https://developers.google.com/workspace/gmail/api/auth/web-server',
      },
      {
        label: 'Gmail scopes',
        url: 'https://developers.google.com/workspace/gmail/api/auth/scopes',
      },
    ],
  }),
  'outlook-email': guide('outlook-email', {
    estimatedMinutes: 20,
    fields: [
      secret('client_secret', 'Client secret', 'Microsoft Entra client secret.'),
      secret(
        'refresh_token',
        'Refresh token',
        'Refresh token returned when offline_access is granted.'
      ),
      metadata('client_id', 'Application ID', 'Entra application/client ID.'),
      metadata('tenant_id', 'Tenant ID', 'Tenant or common authority used for sign-in.'),
      metadata('mailbox', 'Mailbox', 'Connected Outlook mailbox.'),
    ],
    prerequisites: [
      'Microsoft Entra app-registration access',
      'Tenant admin approval if required by policy or application permissions',
    ],
    steps: [
      {
        title: 'Register the application',
        description:
          'Create an Entra app, choose supported account types, add the exact Web redirect URI, and create a client secret.',
      },
      {
        title: 'Add Microsoft Graph permissions',
        description:
          'Use delegated Mail.Read or Mail.Send for user-authorized access; use application permissions only for background organization-wide access and grant admin consent.',
      },
      {
        title: 'Run authorization-code flow',
        description:
          'Request state and offline_access, exchange the code on the server, and bind the grant to its tenant and mailbox.',
      },
      {
        title: 'Store and complete',
        description:
          'Store client secret and refresh token in OneCLI; keep tenant, mailbox, and granted scopes as metadata.',
      },
    ],
    verification: [
      'Call /me for delegated access, then read or send against the authorized mailbox.',
      'Confirm the token tenant and scopes/roles match the chosen access model.',
    ],
    troubleshooting: [
      {
        issue: 'AADSTS redirect error',
        resolution:
          'Ensure the redirect URI and application platform type match the authorization request exactly.',
      },
      {
        issue: '403 despite a valid token',
        resolution:
          'Check Graph permission type, admin consent, mailbox policy, and the signed-in user’s own access.',
      },
    ],
    resources: [
      {
        label: 'Microsoft Graph user OAuth',
        url: 'https://learn.microsoft.com/en-us/graph/auth-v2-user',
      },
      {
        label: 'Graph auth concepts',
        url: 'https://learn.microsoft.com/en-us/graph/auth/auth-concepts',
      },
    ],
  }),
  notion: guide('notion', {
    estimatedMinutes: 12,
    fields: [
      secret(
        'access_token',
        'Access token',
        'OAuth, internal connection, or personal access token.'
      ),
      metadata('workspace_id', 'Workspace ID', 'Workspace returned during authorization.'),
    ],
    options: [
      {
        id: 'public-oauth',
        name: 'Public OAuth connection',
        authModel: 'oauth',
        summary: 'Best when Open Agency connects workspaces for multiple users.',
        fields: [
          secret('client_secret', 'OAuth client secret', 'Notion public connection secret.'),
          secret('refresh_token', 'Refresh token', 'Refresh token returned by Notion.'),
          metadata('client_id', 'OAuth client ID', 'Public connection client ID.'),
        ],
      },
      {
        id: 'internal-token',
        name: 'Internal connection',
        authModel: 'access token',
        summary: 'Simpler for one workspace; pages must be explicitly shared with the connection.',
        fields: [
          secret('access_token', 'Internal integration token', 'Static installation access token.'),
        ],
      },
    ],
    prerequisites: [
      'Workspace-owner access to create a connection',
      'A list of pages or databases Open Agency should access',
    ],
    steps: [
      {
        title: 'Choose the connection model',
        description:
          'Use public OAuth for multi-workspace user installs or an internal connection for a controlled single workspace.',
      },
      {
        title: 'Set minimum capabilities',
        description:
          'In the Notion developer portal, enable only the read, update, or insert capabilities needed by the workflows.',
      },
      {
        title: 'Authorize or copy the token',
        description:
          'For OAuth, configure the redirect and complete code exchange. For internal setup, copy the installation access token.',
      },
      {
        title: 'Grant content access',
        description:
          'On each top-level Notion page, use ••• → Add connections and select the connection. Children inherit access.',
      },
      {
        title: 'Store and complete',
        description: 'Keep tokens in OneCLI and save workspace identity as metadata.',
      },
    ],
    verification: [
      'List the authenticated bot/user and retrieve one page that was explicitly shared.',
      'Try a known unshared page to confirm the connection does not have accidental workspace-wide access.',
    ],
    troubleshooting: [
      {
        issue: 'object_not_found for a real page',
        resolution:
          'Share the page or a parent page with the connection; a valid token does not grant content access by itself.',
      },
      {
        issue: 'New write call fails',
        resolution:
          'Enable the matching capability and re-authorize public connections after capability changes.',
      },
    ],
    resources: [
      {
        label: 'Notion authorization',
        url: 'https://developers.notion.com/guides/get-started/authorization',
      },
      { label: 'Notion capabilities', url: 'https://developers.notion.com/reference/capabilities' },
    ],
  }),
  linear: guide('linear', {
    estimatedMinutes: 6,
    fields: [
      secret('personal_api_key', 'Personal API key', 'Dedicated key from Security & access.'),
      metadata('workspace_id', 'Workspace ID', 'Authorized Linear workspace.'),
    ],
    prerequisites: [
      'A Linear account with access to the target workspace',
      'Permission to create a personal API key in Security & access',
    ],
    steps: [
      {
        title: 'Create a dedicated personal API key',
        description:
          'Open Settings → Security & access → Personal API keys and create a key specifically for Open Agency.',
      },
      {
        title: 'Record the intended workspace',
        description:
          'Personal keys act with the creating user’s permissions, so use a dedicated least-privilege operator account when appropriate.',
      },
      {
        title: 'Store the key only in OneCLI',
        description:
          'Start setup below and save the key with the exact session name and Authorization header profile.',
      },
      {
        title: 'Verify the identity',
        description:
          'Activate the Open Agency installation, then query viewer and confirm it resolves to the intended operator and workspace.',
      },
    ],
    verification: [
      'Query viewer and organization, then confirm the expected workspace.',
      'Create a test comment only when the targeted write scope was granted.',
    ],
    troubleshooting: [
      {
        issue: 'Authentication failed',
        resolution:
          'Personal API keys are sent as the raw Authorization header value, without a Bearer prefix. Check the OneCLI value format is exactly {value}.',
      },
      {
        issue: 'Mutation forbidden',
        resolution:
          'Reconnect with the targeted write scope and confirm the authorizing user can perform the action.',
      },
    ],
    resources: [
      { label: 'Linear GraphQL authentication', url: 'https://linear.app/developers/graphql' },
    ],
    notes: [
      'Open Agency’s verified self-hosted OneCLI flow currently supports Linear personal API keys. Multi-user OAuth with rotating refresh tokens remains guide-only until OneCLI exposes a usable self-hosted native Linear connection.',
    ],
  }),
  jira: guide('jira', {
    estimatedMinutes: 20,
    fields: [
      secret('client_secret', 'Client secret', 'Atlassian OAuth 2.0 (3LO) secret.'),
      secret(
        'refresh_token',
        'Refresh token',
        'Rotating refresh token when offline_access is requested.'
      ),
      metadata('client_id', 'Client ID', 'Atlassian OAuth client ID.'),
      metadata('cloud_id', 'Cloud ID', 'Authorized Jira site resource ID.'),
    ],
    prerequisites: [
      'Atlassian developer-console access',
      'A Jira Cloud site and an exact callback URL',
    ],
    steps: [
      {
        title: 'Create a 3LO app',
        description:
          'Create an OAuth 2.0 integration in the Atlassian developer console and configure its callback under Authorization.',
      },
      {
        title: 'Add Jira API scopes',
        description:
          'Prefer classic scopes and add only what the called endpoints require. Jira project permissions still limit the user.',
      },
      {
        title: 'Authorize with state',
        description:
          'Use auth.atlassian.com with audience=api.atlassian.com, response_type=code, prompt=consent, and an unpredictable state value.',
      },
      {
        title: 'Exchange and select site',
        description:
          'Exchange the code, request accessible-resources, and save the selected Jira cloud ID rather than the human site URL.',
      },
      {
        title: 'Store and complete',
        description: 'Store the token set in OneCLI and site/cloud identity as metadata.',
      },
    ],
    verification: [
      'Call accessible-resources and confirm the chosen site.',
      'Retrieve the current user and one known project or issue with the granted scopes.',
    ],
    troubleshooting: [
      {
        issue: 'Site is missing',
        resolution:
          'The authorizing user must have access to that Jira Cloud site and consent to the app.',
      },
      {
        issue: '403 with correct scopes',
        resolution:
          'Jira’s own project and issue permissions still apply; check the user’s Browse Projects and action permissions.',
      },
    ],
    resources: [
      {
        label: 'Atlassian OAuth 2.0 (3LO)',
        url: 'https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/',
      },
      {
        label: 'Jira OAuth scopes',
        url: 'https://developer.atlassian.com/cloud/jira/platform/scopes-for-oauth-2-3LO-and-forge-apps/',
      },
    ],
  }),
  confluence: guide('confluence', {
    estimatedMinutes: 20,
    fields: [
      secret('client_secret', 'Client secret', 'Atlassian OAuth 2.0 secret.'),
      secret('refresh_token', 'Refresh token', 'Refresh token for background access.'),
      metadata('client_id', 'Client ID', 'Atlassian app client ID.'),
      metadata('cloud_id', 'Cloud ID', 'Authorized Confluence site resource ID.'),
    ],
    prerequisites: [
      'Atlassian developer-console access',
      'A Confluence Cloud site and callback URL',
    ],
    steps: [
      {
        title: 'Create an Atlassian 3LO app',
        description: 'Create the integration, configure the callback URL, and add Confluence APIs.',
      },
      {
        title: 'Select least-privilege scopes',
        description:
          'Choose read scopes for retrieval and add write scopes only for publishing or page updates.',
      },
      {
        title: 'Authorize and validate state',
        description:
          'Run the Atlassian authorization-code flow with prompt=consent and validate the returned state before exchange.',
      },
      {
        title: 'Resolve the Cloud ID',
        description:
          'Call accessible-resources, let the operator choose the intended Confluence site, and retain its cloud ID.',
      },
      {
        title: 'Store and complete',
        description: 'Store token material in OneCLI and the cloud/site identity in metadata.',
      },
    ],
    verification: [
      'Read the current user and one known space/page.',
      'If write access is enabled, update a disposable test page and confirm the author attribution.',
    ],
    troubleshooting: [
      {
        issue: 'Page not returned',
        resolution:
          'Confirm the token’s cloud ID and the user’s Confluence space/page permissions.',
      },
      {
        issue: 'Consent succeeds but API fails',
        resolution:
          'Ensure Confluence scopes—not Jira-only scopes—were added to the app and requested.',
      },
    ],
    resources: [
      {
        label: 'Atlassian OAuth 2.0 (3LO)',
        url: 'https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/',
      },
      {
        label: 'Confluence security and OAuth',
        url: 'https://developer.atlassian.com/cloud/confluence/security-overview/',
      },
    ],
  }),
  airtable: guide('airtable', {
    estimatedMinutes: 8,
    fields: [
      secret(
        'personal_access_token',
        'Personal access token',
        'Scoped Airtable PAT; legacy API keys no longer work.'
      ),
      metadata('base_id', 'Base ID', 'Base explicitly granted to the token.'),
    ],
    options: [
      {
        id: 'personal-access-token',
        name: 'Personal access token',
        authModel: 'personal access token',
        summary: 'Best for one operator or internal automation.',
        fields: [secret('personal_access_token', 'Personal access token', 'Airtable PAT.')],
      },
      {
        id: 'oauth',
        name: 'OAuth integration',
        authModel: 'oauth',
        summary: 'Use for a multi-user third-party integration.',
        fields: [
          secret('client_secret', 'OAuth client secret', 'Airtable OAuth secret.'),
          secret('refresh_token', 'Refresh token', 'OAuth refresh token.'),
          metadata('client_id', 'Client ID', 'OAuth integration ID.'),
        ],
      },
    ],
    prerequisites: [
      'Access to the Airtable base',
      'A clear list of tables and read/write operations',
    ],
    steps: [
      {
        title: 'Open the Airtable developer hub',
        description:
          'Choose Personal access tokens and create a named token. Legacy user API keys were retired and cannot call the API.',
      },
      {
        title: 'Add narrow scopes',
        description:
          'Add data.records:read for reads and data.records:write only for mutations; add schema scopes only if workflows modify schema.',
      },
      {
        title: 'Restrict resources',
        description:
          'Grant only the required base or workspace. Token scopes cannot exceed the creating user’s own collaborator permissions.',
      },
      {
        title: 'Copy and store once',
        description:
          'Create the token, paste it into OneCLI, and save the selected base ID as metadata.',
      },
    ],
    verification: [
      'List records from one allowed table.',
      'Confirm an unselected base is not accessible, proving resource restriction is active.',
    ],
    troubleshooting: [
      {
        issue: 'INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND',
        resolution:
          'Check the PAT scopes, selected base resources, user collaborator role, and base ID.',
      },
      {
        issue: 'Old API key stopped working',
        resolution:
          'Create a personal access token or OAuth integration; legacy API keys have been disabled since 2024.',
      },
    ],
    resources: [
      {
        label: 'Airtable personal access tokens',
        url: 'https://support.airtable.com/v1/docs/creating-personal-access-tokens',
      },
    ],
  }),
  'google-workspace': guide('google-workspace', {
    estimatedMinutes: 25,
    fields: [
      secret('client_secret', 'OAuth client secret', 'Google web OAuth secret.'),
      secret('refresh_token', 'Refresh token', 'Offline-access token.'),
      metadata('client_id', 'OAuth client ID', 'Google client ID.'),
      metadata('workspace_id', 'Workspace domain', 'Connected Google Workspace domain.'),
    ],
    prerequisites: [
      'A Google Cloud project',
      'Knowledge of the exact Docs, Sheets, Drive, and Calendar features required',
    ],
    steps: [
      {
        title: 'Enable only required APIs',
        description:
          'Enable the individual Workspace APIs Open Agency will call; enabling OAuth alone does not enable an API.',
      },
      {
        title: 'Configure Google Auth platform',
        description:
          'Set branding, audience, test users, and Data Access. Sensitive or restricted scopes may require verification and a security assessment.',
      },
      {
        title: 'Create a web OAuth client',
        description:
          'Add exact HTTPS redirect URIs, then securely retain the client ID and one-time-displayed secret.',
      },
      {
        title: 'Request scopes incrementally',
        description:
          'Ask for each product’s narrowest scope when the user enables that feature, plus offline access for background workflows.',
      },
      {
        title: 'Store and complete',
        description:
          'Store secret and refresh token in OneCLI; record domain/account and granted products as metadata.',
      },
    ],
    verification: [
      'Call a lightweight endpoint in every enabled product rather than assuming one token proves all APIs.',
      'Confirm the grant belongs to the intended Workspace account and domain.',
    ],
    troubleshooting: [
      {
        issue: 'API not enabled',
        resolution:
          'Enable that specific Workspace API in the same Cloud project that owns the OAuth client.',
      },
      {
        issue: 'Unverified app or blocked scope',
        resolution:
          'Keep the app in testing with listed test users, or complete Google verification before external production use.',
      },
    ],
    resources: [
      {
        label: 'Google OAuth web-server flow',
        url: 'https://developers.google.com/identity/protocols/oauth2/web-server',
      },
      {
        label: 'Configure OAuth consent',
        url: 'https://developers.google.com/workspace/guides/configure-oauth-consent',
      },
    ],
  }),
  'microsoft-365': guide('microsoft-365', {
    estimatedMinutes: 25,
    fields: [
      secret('client_secret', 'Client secret', 'Entra app client secret.'),
      secret('refresh_token', 'Refresh token', 'Delegated offline-access token.'),
      metadata('client_id', 'Application ID', 'Entra app/client ID.'),
      metadata('tenant_id', 'Tenant ID', 'Microsoft 365 tenant.'),
    ],
    prerequisites: [
      'Microsoft Entra app-registration access',
      'Tenant admin involvement for organization-wide application permissions',
    ],
    steps: [
      {
        title: 'Register one Entra application',
        description:
          'Select supported account types, configure the Web callback, and create a server-side secret or certificate.',
      },
      {
        title: 'Map features to Graph permissions',
        description:
          'Choose delegated permissions for user-driven access or application permissions for unattended jobs. Apply least privilege per Outlook, Calendar, Files, and Sites.',
      },
      {
        title: 'Grant consent',
        description:
          'Run user OAuth for delegated permissions; obtain explicit tenant-admin consent for every application permission.',
      },
      {
        title: 'Acquire and bind tokens',
        description:
          'Use authorization code plus offline_access for delegated use, or client credentials for app-only use; bind the installation to its tenant.',
      },
      {
        title: 'Store and complete',
        description:
          'Store secrets/token material in OneCLI and tenant plus selected service identifiers as metadata.',
      },
    ],
    verification: [
      'Call Graph /me for delegated flow or a tenant-scoped endpoint for app-only flow.',
      'Exercise one read-only endpoint per enabled Microsoft 365 service.',
    ],
    troubleshooting: [
      {
        issue: 'Insufficient privileges',
        resolution:
          'Check whether the endpoint requires delegated versus application permission and whether admin consent was granted.',
      },
      {
        issue: 'Wrong organization data',
        resolution:
          'Use the installation tenant ID rather than common when acquiring background tokens.',
      },
    ],
    resources: [
      {
        label: 'Graph authentication concepts',
        url: 'https://learn.microsoft.com/en-us/graph/auth/auth-concepts',
      },
      { label: 'App-only access', url: 'https://learn.microsoft.com/en-us/graph/auth-v2-service' },
    ],
  }),
  github: guide('github', {
    estimatedMinutes: 20,
    fields: [
      secret(
        'private_key',
        'GitHub App private key',
        'PEM private key used to mint installation tokens.'
      ),
      secret('client_secret', 'Client secret', 'Needed only for user OAuth.'),
      metadata('app_id', 'App ID', 'GitHub App identifier.'),
      metadata('installation_id', 'Installation ID', 'Selected account installation.'),
      metadata('owner', 'Owner', 'Target user or organization.'),
    ],
    options: [
      {
        id: 'github-app',
        name: 'GitHub App',
        authModel: 'app installation',
        summary:
          'Recommended: granular repository selection, scoped permissions, short-lived tokens, and webhooks.',
        fields: [
          secret('private_key', 'Private key', 'GitHub App PEM key.'),
          metadata('app_id', 'App ID', 'GitHub App ID.'),
          metadata('installation_id', 'Installation ID', 'Installed account ID.'),
        ],
      },
      {
        id: 'oauth-app',
        name: 'OAuth App',
        authModel: 'oauth',
        summary: 'Use only when the connector must act broadly as the authorizing user.',
        fields: [
          secret('client_secret', 'Client secret', 'OAuth App secret.'),
          metadata('client_id', 'Client ID', 'OAuth App client ID.'),
        ],
      },
    ],
    prerequisites: [
      'Permission to register an app under the chosen account',
      'A callback URL and a repository/organization access plan',
    ],
    steps: [
      {
        title: 'Register a GitHub App',
        description:
          'Create the app under the owning user or organization, configure callback/setup URLs, and keep expiring user tokens enabled.',
      },
      {
        title: 'Select minimum permissions',
        description:
          'GitHub Apps start with no permissions. Add only endpoint-required repository, organization, or account permissions and matching webhook events.',
      },
      {
        title: 'Install on selected repositories',
        description:
          'Prefer Only select repositories, install the app, and capture its installation ID.',
      },
      {
        title: 'Create and store the private key',
        description:
          'Generate a private key, store the PEM only in OneCLI, and use short-lived installation tokens for API calls.',
      },
      {
        title: 'Add user OAuth only if required',
        description:
          'Request user authorization during install only when actions must be attributed to a person.',
      },
    ],
    verification: [
      'Mint an installation token and list accessible repositories.',
      'Confirm an unselected private repository is inaccessible.',
    ],
    troubleshooting: [
      {
        issue: '403 Resource not accessible by integration',
        resolution:
          'Check app permission level, repository selection, and whether a requested permission update was approved.',
      },
      {
        issue: 'Bad credentials while minting a token',
        resolution: 'Confirm App ID, PEM key formatting, JWT time window, and installation ID.',
      },
    ],
    resources: [
      {
        label: 'Register a GitHub App',
        url: 'https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app',
      },
      {
        label: 'Choose app permissions',
        url: 'https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app',
      },
    ],
  }),
  gitlab: guide('gitlab', {
    estimatedMinutes: 15,
    fields: [
      secret('client_secret', 'Client secret', 'GitLab OAuth application secret.'),
      secret('refresh_token', 'Refresh token', 'Refresh token returned by GitLab.'),
      metadata('client_id', 'Application ID', 'GitLab OAuth application ID.'),
      metadata('base_url', 'GitLab base URL', 'gitlab.com or self-managed instance URL.'),
    ],
    prerequisites: [
      'Permission to register a GitLab OAuth application',
      'The exact GitLab.com or self-managed instance URL',
    ],
    steps: [
      {
        title: 'Register the application',
        description:
          'Create an application in user settings (or at group/instance level as appropriate), add redirect URI, and mark it confidential for a secure server.',
      },
      {
        title: 'Choose scopes',
        description:
          'Use read_api/read_user for reads; request api only when write endpoints truly require it.',
      },
      {
        title: 'Authorize with PKCE and state',
        description:
          'Use authorization code with PKCE where possible, validate state, and exchange the code against the same GitLab instance.',
      },
      {
        title: 'Store and complete',
        description:
          'Keep client secret and token material in OneCLI; save base URL and namespace/project identity as metadata.',
      },
    ],
    verification: [
      'Call /oauth/token/info and /user.',
      'List one intended project and confirm the correct self-managed host, if applicable.',
    ],
    troubleshooting: [
      {
        issue: 'Works on gitlab.com but not self-managed',
        resolution:
          'Use the self-managed instance for both authorize and token endpoints and confirm the application is registered there.',
      },
      {
        issue: 'Project missing under SAML SSO',
        resolution:
          'Authorize through the required group SSO context and use root_namespace_id when the instance requires it.',
      },
    ],
    resources: [{ label: 'GitLab OAuth 2.0', url: 'https://docs.gitlab.com/api/oauth2/' }],
  }),
  sentry: guide('sentry', {
    estimatedMinutes: 8,
    fields: [
      secret('auth_token', 'Organization auth token', 'Token created by an internal integration.'),
      metadata('organization_slug', 'Organization slug', 'Sentry organization identifier.'),
      metadata('project_slug', 'Project slug', 'Optional default project.'),
    ],
    prerequisites: [
      'Manager or Admin role in the Sentry organization',
      'The organization/project operations Open Agency must perform',
    ],
    steps: [
      {
        title: 'Create an internal integration',
        description:
          'Open Organization Settings → Custom Integrations and create an Internal Integration. Organization tokens are preferable to user-bound tokens.',
      },
      {
        title: 'Assign endpoint-specific scopes',
        description:
          'Use org:read and project:read for retrieval; add project:write or org:ci only when those workflows are enabled.',
      },
      {
        title: 'Copy the generated token',
        description: 'Save the token shown in the integration settings directly to OneCLI.',
      },
      {
        title: 'Save targeting metadata',
        description:
          'Record the organization slug, optional project slug, and Sentry base URL for self-hosted deployments.',
      },
    ],
    verification: [
      'Call /api/0/organizations/{slug}/projects/ with Bearer authentication.',
      'Confirm the response only includes the expected organization context.',
    ],
    troubleshooting: [
      {
        issue: '403 from one endpoint',
        resolution:
          'Read that endpoint’s required scope and raise only the integration permission needed.',
      },
      {
        issue: 'Organization not returned',
        resolution:
          'Confirm the token belongs to that organization and the slug is the URL slug, not display name.',
      },
    ],
    resources: [
      { label: 'Sentry auth tokens', url: 'https://docs.sentry.io/api/guides/create-auth-token/' },
      { label: 'Sentry API authentication', url: 'https://docs.sentry.io/api/auth/' },
    ],
  }),
  pagerduty: guide('pagerduty', {
    estimatedMinutes: 8,
    fields: [
      secret('api_token', 'REST API token', 'General Access or User Token REST API key.'),
      metadata(
        'account_subdomain',
        'Account subdomain',
        'First segment of the PagerDuty account URL.'
      ),
      metadata('region', 'Region', 'US or EU API region.'),
    ],
    prerequisites: [
      'PagerDuty Admin/Account Owner for a General Access key, or an eligible user for a User Token',
      'A decision between read-only and write access',
    ],
    steps: [
      {
        title: 'Choose token type',
        description:
          'Use a General Access REST API key for account automation or a User Token when calls should inherit one user’s permissions.',
      },
      {
        title: 'Create the REST API key',
        description:
          'Go to Integrations → Developer Tools → API Access Keys for a general key, or User Settings → API Access for a user token.',
      },
      {
        title: 'Prefer read-only when possible',
        description:
          'Mark a general key read-only unless workflows create or modify PagerDuty objects.',
      },
      {
        title: 'Copy and store once',
        description:
          'The full key is shown only at creation. Paste it into OneCLI and save region/subdomain as metadata.',
      },
    ],
    verification: [
      'Call a read endpoint with Authorization: Token token=… against the correct US or EU base URL.',
      'Confirm returned account objects match the intended PagerDuty account.',
    ],
    troubleshooting: [
      {
        issue: 'Token rejected by Events API',
        resolution:
          'REST API keys and Events API integration keys are different credential types and are not interchangeable.',
      },
      {
        issue: '403 Forbidden',
        resolution:
          'A user token cannot exceed that user’s PagerDuty permissions; use an appropriately authorized user or general key.',
      },
    ],
    resources: [
      {
        label: 'PagerDuty API access keys',
        url: 'https://support.pagerduty.com/main/docs/api-access-keys',
      },
    ],
  }),
  figma: guide('figma', {
    estimatedMinutes: 12,
    fields: [secret('personal_access_token', 'Personal access token', 'Scoped Figma PAT.')],
    options: [
      {
        id: 'oauth',
        name: 'OAuth app',
        authModel: 'oauth',
        summary: 'Recommended for acting on behalf of multiple Figma users.',
        fields: [
          secret('client_secret', 'Client secret', 'OAuth app secret.'),
          secret('refresh_token', 'Refresh token', 'OAuth token rotation material.'),
          metadata('client_id', 'Client ID', 'OAuth app ID.'),
        ],
      },
      {
        id: 'personal-access-token',
        name: 'Personal access token',
        authModel: 'personal access token',
        summary: 'Suitable for a single user’s internal scripts and local tooling.',
        fields: [secret('personal_access_token', 'Personal access token', 'Scoped Figma PAT.')],
      },
    ],
    prerequisites: [
      'A Figma account with access to the target files',
      'Permission to generate a personal access token in account security settings',
    ],
    steps: [
      {
        title: 'Create a personal access token',
        description:
          'Open Settings → Security → Personal access tokens, create a dedicated token, and copy it once.',
      },
      {
        title: 'Select granular scopes',
        description:
          'Use file_content:read for file nodes, file_comments scopes for comments, and project scopes only when listing projects. Do not use deprecated file_read.',
      },
      {
        title: 'Store the PAT only in OneCLI',
        description:
          'Start setup below and save the token with the exact session name and X-Figma-Token header profile.',
      },
      {
        title: 'Verify and activate',
        description:
          'Verify the OneCLI resource in Open Agency, then retain team, project, and file IDs as non-secret targets.',
      },
    ],
    verification: [
      'Call /v1/me, then read a file already shared with the authorizing user.',
      'Confirm a non-shared file remains inaccessible; scopes do not override Figma file permissions.',
    ],
    troubleshooting: [
      {
        issue: '403 on a file endpoint',
        resolution: 'Check the granular scope and whether the Figma user can open that file.',
      },
      {
        issue: 'A long-lived multi-user OAuth flow is required',
        resolution:
          'Use the OAuth guide as preparation only. Open Agency’s verified self-hosted OneCLI flow currently supports a scoped Figma personal access token.',
      },
    ],
    resources: [
      {
        label: 'Figma authentication',
        url: 'https://developers.figma.com/docs/rest-api/authentication/',
      },
      { label: 'Figma OAuth apps', url: 'https://developers.figma.com/docs/rest-api/oauth-apps/' },
    ],
    notes: [
      'The activatable self-hosted OneCLI path uses a Figma personal access token. The OAuth option documents future multi-user setup but is not activated by this flow.',
    ],
  }),
  canva: guide('canva', {
    estimatedMinutes: 15,
    fields: [
      secret('client_secret', 'Client secret', 'Canva integration client secret.'),
      secret('refresh_token', 'Refresh token', 'OAuth refresh token.'),
      metadata('client_id', 'Client ID', 'Canva integration ID.'),
    ],
    prerequisites: ['A Canva Developer Portal integration', 'At least one configured redirect URL'],
    steps: [
      {
        title: 'Configure the Canva integration',
        description:
          'Set the integration name, generate and save the client secret, add redirect URLs, and select explicit scopes.',
      },
      {
        title: 'Generate PKCE for every attempt',
        description:
          'Create a 43–128 character verifier, derive an S256 challenge, and keep the verifier server-side until callback.',
      },
      {
        title: 'Authorize with explicit scopes',
        description:
          'Request every needed read and write scope separately; asset:write does not imply asset:read. Send and verify a random state value.',
      },
      {
        title: 'Exchange and store tokens',
        description:
          'Authenticate the token request with client credentials, include the original code_verifier, and store refresh material in OneCLI.',
      },
    ],
    verification: [
      'Call a lightweight endpoint covered by each enabled scope.',
      'Refresh the token once in a test environment to prove rotation is persisted.',
    ],
    troubleshooting: [
      {
        issue: 'invalid_grant',
        resolution:
          'Use the original verifier, exact redirect URL, and unused authorization code before it expires.',
      },
      {
        issue: 'Scope denied',
        resolution:
          'The requested scope must be enabled in the Canva Developer Portal and explicitly included in authorization.',
      },
    ],
    resources: [
      {
        label: 'Canva OAuth authentication',
        url: 'https://www.canva.dev/docs/connect/authentication/',
      },
    ],
  }),
  youtube: guide('youtube', {
    estimatedMinutes: 20,
    fields: [
      secret('client_secret', 'OAuth client secret', 'Google web OAuth secret.'),
      secret('refresh_token', 'Refresh token', 'Offline-access refresh token.'),
      metadata('client_id', 'OAuth client ID', 'Google client ID.'),
      metadata('channel_id', 'Channel ID', 'Authorized YouTube channel.'),
    ],
    prerequisites: [
      'A Google Cloud project with YouTube Data API v3 enabled',
      'A Google/YouTube account and exact redirect URI',
    ],
    steps: [
      {
        title: 'Enable YouTube Data API v3',
        description:
          'Enable the API in the Cloud project that owns the OAuth client; monitor project quota for production use.',
      },
      {
        title: 'Configure consent and scopes',
        description:
          'Set the Google Auth audience and test users, then choose read-only or youtube.force-ssl/write scopes according to actual features.',
      },
      {
        title: 'Create and run web OAuth',
        description:
          'Create a Web client, add the exact redirect URI, use state, and request offline access for scheduled publishing or reporting.',
      },
      {
        title: 'Bind the channel and store',
        description:
          'After consent, call channels.list(mine=true), let the operator confirm the channel, and store refresh material in OneCLI.',
      },
    ],
    verification: [
      'Call channels.list with mine=true and confirm the channel ID/title.',
      'Perform a read-only test before enabling any upload or mutation workflow.',
    ],
    troubleshooting: [
      {
        issue: 'NoLinkedYouTubeAccount',
        resolution:
          'YouTube Data API does not support service accounts; authorize a real Google user with a YouTube channel.',
      },
      {
        issue: 'quotaExceeded',
        resolution:
          'Review endpoint quota costs, reduce polling, or request a quota extension through Google.',
      },
    ],
    resources: [
      {
        label: 'YouTube OAuth',
        url: 'https://developers.google.com/youtube/v3/guides/authentication',
      },
    ],
  }),
  'adobe-creative-cloud': guide('adobe-creative-cloud', {
    estimatedMinutes: 25,
    fields: [
      secret('client_secret', 'Client secret', 'Adobe OAuth credential secret.'),
      metadata('client_id', 'Client ID', 'Adobe project credential ID.'),
      metadata('organization_id', 'Organization ID', 'Adobe organization owning product profiles.'),
      metadata('scopes', 'Scopes', 'Space-separated scopes configured for the selected API.'),
    ],
    options: [
      {
        id: 'user-oauth',
        name: 'OAuth user authentication',
        authModel: 'authorization code',
        summary: 'Use when Open Agency accesses data owned by an Adobe end user.',
        fields: [
          secret('client_secret', 'Client secret', 'OAuth Web App secret.'),
          secret('refresh_token', 'Refresh token', 'User OAuth refresh token.'),
          metadata('client_id', 'Client ID', 'OAuth client ID.'),
        ],
      },
      {
        id: 'server-to-server',
        name: 'OAuth Server-to-Server',
        authModel: 'client credentials',
        summary: 'Use for organization/application-owned data without an end-user session.',
        fields: [
          secret('client_secret', 'Client secret', 'Server-to-server secret.'),
          metadata('client_id', 'Client ID', 'Adobe credential client ID.'),
          metadata('scopes', 'Scopes', 'Credential scopes.'),
        ],
      },
    ],
    prerequisites: [
      'Adobe Developer Console project access',
      'Access to the specific Adobe API/product profile',
    ],
    steps: [
      {
        title: 'Choose authentication by ownership',
        description:
          'Use user OAuth for end-user data or OAuth Server-to-Server for organization/application data. Do not create legacy Service Account (JWT) credentials.',
      },
      {
        title: 'Add the specific Adobe API',
        description:
          'Create a Developer Console project, add the product API, and assign the required product profiles.',
      },
      {
        title: 'Configure the credential',
        description:
          'For user OAuth, add the redirect and consent settings. For server-to-server, record client ID, secret, and the console-provided scopes.',
      },
      {
        title: 'Store and complete',
        description:
          'Store secret/token material in OneCLI and organization/product-profile identity as metadata.',
      },
    ],
    verification: [
      'Generate an access token using the selected flow.',
      'Call a low-risk endpoint from the exact Adobe product API added to the project.',
    ],
    troubleshooting: [
      {
        issue: 'Legacy JWT sample no longer works',
        resolution:
          'Migrate to OAuth Server-to-Server; Adobe ended Service Account (JWT) support on June 30, 2025.',
      },
      {
        issue: 'Token works but data is empty',
        resolution:
          'Check product-profile assignment and whether the chosen flow can access user-owned versus organization-owned data.',
      },
    ],
    resources: [
      {
        label: 'Adobe authentication guide',
        url: 'https://developer.adobe.com/developer-console/docs/guides/authentication/',
      },
      {
        label: 'OAuth Server-to-Server',
        url: 'https://developer.adobe.com/developer-console/docs/guides/authentication/ServerToServerAuthentication/',
      },
    ],
  }),
  'home-assistant': guide('home-assistant', {
    estimatedMinutes: 10,
    fields: [
      metadata('base_url', 'Base URL', 'Reachable Home Assistant URL including scheme and port.'),
      secret(
        'access_token',
        'Long-lived access token',
        'Token created from the Home Assistant user profile.'
      ),
      metadata(
        'verify_ssl',
        'Verify SSL',
        'Keep enabled for trusted production HTTPS certificates.'
      ),
      metadata('home_name', 'Home name', 'Friendly installation name.'),
    ],
    prerequisites: [
      'A Home Assistant user with only the permissions Open Agency needs',
      'A URL reachable from the Open Agency backend, not merely from the browser',
    ],
    steps: [
      {
        title: 'Confirm network reachability',
        description:
          'Choose the exact base URL Open Agency can reach. Prefer HTTPS with a trusted certificate for access outside a private network.',
      },
      {
        title: 'Create a dedicated token',
        description:
          'Open the Home Assistant user profile, scroll to Long-Lived Access Tokens, create a clearly named token, and copy the complete value once.',
      },
      {
        title: 'Store the bridge settings',
        description:
          'Paste the token into OneCLI, save the base URL as metadata, and leave SSL verification enabled in production.',
      },
      {
        title: 'Discover and scope entities',
        description:
          'After connection, review areas/entities and assign safe defaults rather than permitting arbitrary service calls.',
      },
    ],
    verification: [
      'Request /api/ and /api/states with Bearer authentication from the Open Agency runtime network.',
      'Use the guided Smart Home page to read entities, then perform one reversible action on a test device.',
    ],
    troubleshooting: [
      {
        issue: 'Browser opens Home Assistant but Open Agency cannot connect',
        resolution: 'The backend needs its own network route and DNS resolution to the base URL.',
      },
      {
        issue: 'TLS certificate error',
        resolution:
          'Install a trusted certificate or CA chain. Disable verification only for a temporary private-network diagnosis.',
      },
    ],
    resources: [
      {
        label: 'Home Assistant REST API',
        url: 'https://developers.home-assistant.io/docs/api/rest/',
      },
      {
        label: 'Home Assistant long-lived tokens',
        url: 'https://developers.home-assistant.io/docs/auth_api/#long-lived-access-token',
      },
    ],
    notes: [
      'Long-lived tokens can remain valid for years and are not recoverable after creation; revoke and replace them when exposure is suspected.',
    ],
  }),
  perplexity: guide('perplexity', {
    estimatedMinutes: 5,
    fields: [
      secret('api_key', 'API key', 'Perplexity API key shown once at creation.'),
      metadata('api_group', 'API group', 'Owning API group for usage and billing.'),
    ],
    prerequisites: [
      'A Perplexity API account and API group',
      'Billing/admin access if the group is not yet configured',
    ],
    steps: [
      {
        title: 'Prepare the API group',
        description:
          'Open the Perplexity API Portal, select or create the API group, and configure billing/usage controls.',
      },
      {
        title: 'Generate a dedicated key',
        description:
          'Open API Keys and generate a key specifically named for Open Agency. Copy it immediately; full keys cannot be retrieved later.',
      },
      {
        title: 'Store and complete',
        description: 'Paste the key only into OneCLI and record the owning API group as metadata.',
      },
      {
        title: 'Choose the API intentionally',
        description:
          'Use Search for raw ranked results, Sonar for grounded answers, or Agent API for multi-provider agent work.',
      },
    ],
    verification: [
      'Make one minimal Search or Sonar request and confirm citations/results.',
      'Check the API group usage dashboard and confirm the request is attributed to the new key.',
    ],
    troubleshooting: [
      {
        issue: 'Key creation is unavailable',
        resolution:
          'Create/select an API group and ensure the user has the required group or billing role.',
      },
      {
        issue: '401 Unauthorized',
        resolution:
          'Use Authorization: Bearer <key> and replace the key if it was not copied completely.',
      },
    ],
    resources: [
      {
        label: 'Perplexity quickstart',
        url: 'https://docs.perplexity.ai/docs/getting-started/quickstart',
      },
      {
        label: 'API key management',
        url: 'https://docs.perplexity.ai/docs/admin/api-key-management',
      },
    ],
  }),
  tavily: guide('tavily', {
    estimatedMinutes: 5,
    fields: [
      secret('api_key', 'API key', 'Tavily key beginning with tvly-.'),
      metadata('project_id', 'Project ID', 'Optional project used for usage attribution.'),
    ],
    prerequisites: ['A Tavily Platform account', 'A project/usage attribution decision'],
    steps: [
      {
        title: 'Create or select a key',
        description:
          'Sign in to the Tavily Platform and copy a dedicated API key from the dashboard.',
      },
      {
        title: 'Optionally create a project',
        description:
          'Use a Project ID to separate Open Agency usage from other applications sharing the same Tavily account.',
      },
      {
        title: 'Store and complete',
        description: 'Paste the tvly- key into OneCLI and save Project ID as non-secret metadata.',
      },
      {
        title: 'Choose conservative defaults',
        description:
          'Start with basic search and small result counts; enable extract, crawl, map, or research only for workflows that need them.',
      },
    ],
    verification: [
      'POST one search to https://api.tavily.com/search with Bearer authentication.',
      'Confirm the call appears in Tavily logs under the expected project.',
    ],
    troubleshooting: [
      {
        issue: 'Authentication error',
        resolution:
          'Include the full tvly- key in the Bearer header and ensure it is still active in the dashboard.',
      },
      {
        issue: 'Unexpected credit usage',
        resolution:
          'Review endpoint choice and result depth; research/crawl operations consume more than a basic search.',
      },
    ],
    resources: [
      { label: 'Tavily quickstart', url: 'https://docs.tavily.com/documentation/quickstart' },
      {
        label: 'Tavily API introduction',
        url: 'https://docs.tavily.com/documentation/api-reference/introduction',
      },
    ],
  }),
  wikipedia: guide('wikipedia', {
    estimatedMinutes: 3,
    fields: [
      metadata(
        'user_agent',
        'API User-Agent',
        'Descriptive client/version plus contact information.'
      ),
      metadata('language', 'Default wiki language', 'Language subdomain such as en.'),
    ],
    prerequisites: [
      'No API credential is needed for public read requests',
      'A contact URL or email for the required identifying User-Agent',
    ],
    steps: [
      {
        title: 'Choose the API and wiki',
        description:
          'Use the MediaWiki Action API for wiki content/actions and select the intended language host, such as en.wikipedia.org.',
      },
      {
        title: 'Set an identifying User-Agent',
        description:
          'Use a value such as Open Agency/1.0 (https://example.com/contact; ops@example.com). Browser clients may use Api-User-Agent.',
      },
      {
        title: 'Configure considerate requests',
        description:
          'Request JSON, serialize bulk calls, honor maxlag and retry guidance, and avoid aggressive parallel fetching.',
      },
      {
        title: 'Save non-secret settings',
        description:
          'Complete setup with language, User-Agent, and any request-limit defaults; there is no secret to store.',
      },
    ],
    verification: [
      'Query action=query&meta=siteinfo&format=json and confirm the selected wiki.',
      'Inspect the outgoing request to confirm the identifying User-Agent or Api-User-Agent is present.',
    ],
    troubleshooting: [
      {
        issue: 'Requests are blocked or throttled',
        resolution:
          'Add meaningful contact information, reduce concurrency, honor Retry-After/maxlag, and cache repeated reads.',
      },
      {
        issue: 'Wrong-language content',
        resolution:
          'Use the correct language subdomain; language is not simply a response parameter for every API call.',
      },
    ],
    resources: [
      { label: 'MediaWiki API etiquette', url: 'https://www.mediawiki.org/wiki/API:Etiquette' },
      { label: 'Action API main page', url: 'https://www.mediawiki.org/wiki/API:Main_page' },
    ],
  }),
  s3: guide('s3', {
    estimatedMinutes: 15,
    fields: [
      secret('secret_access_key', 'Secret access key', 'Secret half of an IAM access key pair.'),
      metadata('access_key_id', 'Access key ID', 'Public half of the IAM key pair.'),
      metadata('bucket', 'Bucket', 'Allowed S3 bucket.'),
      metadata('region', 'Region', 'Bucket AWS Region.'),
      metadata('prefix', 'Prefix', 'Optional path prefix restriction.'),
    ],
    prerequisites: [
      'An existing S3 bucket and known region',
      'AWS IAM permission to create a role or narrowly scoped workload identity',
    ],
    steps: [
      {
        title: 'Prefer temporary credentials',
        description:
          'For AWS-hosted workloads, attach an IAM role and use temporary credentials. Create long-term access keys only when the deployment cannot use roles or federation.',
      },
      {
        title: 'Write a least-privilege policy',
        description:
          'Limit actions to required GetObject/PutObject/ListBucket operations, the exact bucket ARN, and a prefix condition when possible.',
      },
      {
        title: 'Create a dedicated identity',
        description:
          'Create a workload-specific role or IAM user. Never create or use root-user access keys.',
      },
      {
        title: 'Store connection fields',
        description:
          'If long-term keys are unavoidable, paste the secret key into OneCLI and save access key ID, bucket, region, and prefix as metadata.',
      },
    ],
    verification: [
      'List only the configured bucket/prefix and read or write one disposable test object.',
      'Confirm an object outside the allowed prefix or another bucket is denied.',
    ],
    troubleshooting: [
      {
        issue: 'SignatureDoesNotMatch',
        resolution:
          'Check secret/access-key pairing, request signing clock, endpoint, and bucket region.',
      },
      {
        issue: 'AccessDenied',
        resolution:
          'Inspect both IAM identity policy and bucket policy; explicit denies override allows.',
      },
    ],
    resources: [
      {
        label: 'AWS IAM security best practices',
        url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html',
      },
      {
        label: 'Accessing S3 buckets',
        url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-bucket-intro.html',
      },
    ],
  }),
  'google-drive': guide('google-drive', {
    estimatedMinutes: 20,
    fields: [
      secret('client_secret', 'OAuth client secret', 'Google web client secret.'),
      secret('refresh_token', 'Refresh token', 'Offline-access refresh token.'),
      metadata('client_id', 'OAuth client ID', 'Google web client ID.'),
      metadata('folder_id', 'Default folder ID', 'Optional Drive folder selected by the user.'),
    ],
    prerequisites: ['A Google Cloud project with Drive API enabled', 'A web OAuth callback URI'],
    steps: [
      {
        title: 'Enable Drive API',
        description:
          'Enable Google Drive API in the same Cloud project that owns the OAuth client.',
      },
      {
        title: 'Choose narrow scopes',
        description:
          'Prefer drive.file with Google Picker so users select accessible files. Broad drive or drive.readonly scopes are restricted and may require verification/security assessment.',
      },
      {
        title: 'Configure and run OAuth',
        description:
          'Set the consent screen, create a Web client, use the exact redirect URI and state, and request offline access for background workflows.',
      },
      {
        title: 'Let the user select targets',
        description:
          'Use Picker or explicit sharing to select files/folders rather than granting all-Drive access.',
      },
      {
        title: 'Store and complete',
        description:
          'Store secret/refresh token in OneCLI and selected drive/folder identity as metadata.',
      },
    ],
    verification: [
      'List or read a file selected through the app.',
      'Confirm an unrelated file is not visible when using drive.file.',
    ],
    troubleshooting: [
      {
        issue: 'File not found despite a valid ID',
        resolution:
          'The user must select/share it with the app and the correct account must authorize the grant.',
      },
      {
        issue: 'App blocked as unverified',
        resolution:
          'Use test users during development or complete Google verification for sensitive/restricted production scopes.',
      },
    ],
    resources: [
      {
        label: 'Google Drive OAuth scopes',
        url: 'https://developers.google.com/workspace/drive/api/guides/api-specific-auth',
      },
      {
        label: 'Google OAuth web-server flow',
        url: 'https://developers.google.com/identity/protocols/oauth2/web-server',
      },
    ],
  }),
  dropbox: guide('dropbox', {
    estimatedMinutes: 15,
    fields: [
      secret('app_secret', 'App secret', 'Dropbox app secret.'),
      secret('refresh_token', 'Refresh token', 'Offline-access refresh token.'),
      metadata('app_key', 'App key', 'Dropbox OAuth client ID.'),
      metadata('root_namespace', 'Content access', 'App Folder or Full Dropbox.'),
    ],
    prerequisites: [
      'A Dropbox developer app',
      'A decision between App Folder and Full Dropbox access',
    ],
    steps: [
      {
        title: 'Register the Dropbox app',
        description:
          'Create the app in App Console, choose App Folder whenever the integration only manages its own files, and add exact redirect URIs.',
      },
      {
        title: 'Select endpoint scopes',
        description:
          'Enable only the account, files, folders, or sharing scopes required by the workflows.',
      },
      {
        title: 'Run OAuth code flow',
        description:
          'Use authorization code with state and PKCE where appropriate. For background work, add token_access_type=offline to receive a refresh token.',
      },
      {
        title: 'Store and complete',
        description:
          'Store app secret and refresh token in OneCLI; save content-access type, account/team, and root folder as metadata.',
      },
    ],
    verification: [
      'Call users/get_current_account and list the intended app folder or root.',
      'Refresh a short-lived token once before enabling scheduled workflows.',
    ],
    troubleshooting: [
      {
        issue: 'Access token expired',
        resolution:
          'Dropbox access tokens are short-lived; use the stored refresh token instead of expecting a long-lived access token.',
      },
      {
        issue: 'Path not found',
        resolution:
          'Check whether the app is App Folder-scoped; its API root is inside /Apps/{app name}, not the user’s full Dropbox.',
      },
    ],
    resources: [
      { label: 'Dropbox OAuth guide', url: 'https://developers.dropbox.com/oauth-guide' },
    ],
  }),
  onedrive: guide('onedrive', {
    estimatedMinutes: 20,
    fields: [
      secret('client_secret', 'Client secret', 'Entra application secret.'),
      secret('refresh_token', 'Refresh token', 'Delegated offline-access token.'),
      metadata('client_id', 'Application ID', 'Entra app/client ID.'),
      metadata('tenant_id', 'Tenant ID', 'Owning Microsoft tenant.'),
      metadata('drive_id', 'Drive ID', 'Selected OneDrive drive.'),
    ],
    prerequisites: [
      'Microsoft Entra app-registration access',
      'A choice between personal, delegated work/school, or app-only organization access',
    ],
    steps: [
      {
        title: 'Register the Entra app',
        description:
          'Select supported account types, add an exact Web redirect URI, and create a server credential.',
      },
      {
        title: 'Choose the smallest Files permission',
        description:
          'Use Files.Read for user files, Files.ReadWrite only for writes, or Files.ReadWrite.AppFolder when an isolated app folder meets the use case.',
      },
      {
        title: 'Authorize and consent',
        description:
          'Use delegated OAuth plus offline_access for user drives. Application permissions require tenant-admin consent.',
      },
      {
        title: 'Resolve the drive',
        description:
          'Call /me/drive or the appropriate user/site drive endpoint and record the returned drive ID.',
      },
      {
        title: 'Store and complete',
        description:
          'Store secret/token material in OneCLI and tenant/drive/folder identity as metadata.',
      },
    ],
    verification: [
      'Read drive metadata and list the intended root or app folder.',
      'Perform a disposable upload only if write permission was deliberately granted.',
    ],
    troubleshooting: [
      {
        issue: '/me fails',
        resolution:
          '/me requires delegated user context; app-only tokens must address a user, group, or site drive explicitly.',
      },
      {
        issue: 'Personal account cannot consent',
        resolution:
          'Confirm the app registration’s supported account types and that the chosen permission supports personal Microsoft accounts.',
      },
    ],
    resources: [
      {
        label: 'OneDrive permission scopes',
        url: 'https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/permissions_reference?view=odsp-graph-online',
      },
      {
        label: 'OneDrive app folder',
        url: 'https://learn.microsoft.com/en-us/graph/onedrive-sharepoint-appfolder',
      },
    ],
  }),
  sharepoint: guide('sharepoint', {
    estimatedMinutes: 25,
    fields: [
      secret('client_secret', 'Client secret', 'Entra application secret.'),
      metadata('client_id', 'Application ID', 'Entra app/client ID.'),
      metadata('tenant_id', 'Tenant ID', 'Owning Microsoft tenant.'),
      metadata('site_id', 'Site ID', 'Selected SharePoint site.'),
      metadata('drive_id', 'Library drive ID', 'Selected document library.'),
    ],
    prerequisites: [
      'Microsoft Entra app-registration access',
      'SharePoint admin support for app-only selected-site grants',
    ],
    steps: [
      {
        title: 'Register an Entra application',
        description:
          'Create the app, credential, and exact callback configuration for delegated access or client credentials for app-only access.',
      },
      {
        title: 'Choose the access model',
        description:
          'Use delegated Sites.Read.All/Sites.ReadWrite.All when a signed-in user’s access should apply. Prefer application Sites.Selected for unattended access to a small set of sites.',
      },
      {
        title: 'Grant selected-site access',
        description:
          'For Sites.Selected, tenant consent alone grants no site data. A SharePoint admin must separately assign read or write permission to each target site.',
      },
      {
        title: 'Resolve site and library IDs',
        description:
          'Use Graph to resolve the hostname/path to a site ID, then choose the correct document-library drive ID.',
      },
      {
        title: 'Store and complete',
        description: 'Store app secret in OneCLI and tenant, site, and library IDs as metadata.',
      },
    ],
    verification: [
      'Get the selected site and list its intended document library.',
      'With Sites.Selected, confirm a non-granted site returns access denied.',
    ],
    troubleshooting: [
      {
        issue: 'Sites.Selected token works but every site is denied',
        resolution:
          'Assign the app a role on the specific site; tenant admin consent alone is not a resource grant.',
      },
      {
        issue: 'Wrong document library',
        resolution:
          'A SharePoint site can expose multiple drives. Record the drive ID, not only the site URL.',
      },
    ],
    resources: [
      {
        label: 'SharePoint in Microsoft Graph',
        url: 'https://learn.microsoft.com/en-us/graph/sharepoint-concept-overview',
      },
      {
        label: 'Sites.Selected permission',
        url: 'https://learn.microsoft.com/en-us/graph/permissions-reference#sitesselected',
      },
    ],
  }),
};

export function getIntegrationSetupGuide(backendKey: string) {
  return integrationSetupGuides[backendKey] ?? null;
}
