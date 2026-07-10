# Integration Operations Guide

This guide is the high-level operating model for Agency integrations. Use the linked docs for
implementation details, but keep this page as the map for setup, delivery, workflow bindings, and
future integration work.

## Operating Model

Agency treats an integration as four separate concerns:

| Concern              | Stored where                                                                           | Purpose                                                                                                                       |
|----------------------|----------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| Credential instance  | Backend credential state                                                               | Identifies the provider, secret reference, and instance identity such as workspace, tenant, repo, bucket, sender, or mailbox. |
| Delivery target      | Conversation channel fields or workflow/tool target scope                              | Identifies the concrete destination such as channel, chat, recipient, folder, repo, or mailbox.                               |
| Binding              | `ToolDefinition.security.connector_bindings` or `workflow.metadata.connector_bindings` | Tells agents and runtimes which credential instance and target scope to use.                                                  |
| Webhook verification | Credential metadata                                                                    | Verifies inbound production events for providers that support callbacks.                                                      |

This separation matters because the same provider can be installed many times for different
workspaces, bots, sender numbers, repositories, buckets, or users.

OneCLI is the setup and secret-storage surface for connector installation. For providers that can
run through the proxy path, Agency can keep transport routed through OneCLI. For direct-only
providers such as Telegram, Agency mirrors the secret into runtime storage at setup completion and
uses that mirrored secret for direct delivery and health checks. When the launcher exports
`AGENCY_PUBLIC_WEBHOOK_BASE_URL`, Telegram completion can also auto-register the webhook against
the live public URL so operators do not have to call `setWebhook` manually.

## Setup Readiness

Integration setup should capture:

- Required credential metadata needed for delivery or health checks.
- Instance identity metadata used by agents to distinguish repeated installations.
- Production webhook metadata when inbound verification is needed.
- Health-test history so operators can see whether a credential is operational.

Frontend setup cards should surface an duplicate-instance guidance.
Backend connector capabilities provide the schema through `requiredMetadata`,
`instanceIdentityMetadata`, and `targetScopeMetadata`.

The frontend keeps these steps inside the selected connector so users do not have to switch to a
separate documentation route during setup.

## Delivery Targets

Conversation-bound delivery currently supports Telegram, Discord, and WhatsApp. The saved
conversation target is used by:

```http
POST /integrations/conversations/channels/{conversation_id}/deliver
```

Outbound-only adapter delivery exists for Slack, Microsoft Teams, Twilio SMS, Gmail, and Outlook:

```http
POST /integrations/conversations/adapters/{provider}/deliver
```

Detailed target and payload contract: [integration-delivery-targets.md](./integration-delivery-targets.md)

## Workflow Bindings

Tool-level bindings take precedence:

```json
ToolDefinition.security.connector_bindings
```

Workflow-level defaults are used when a tool has no specific binding:

```json
workflow.metadata.connector_bindings
```

The workflow editor renders provider-specific target-scope fields when the connector registry has a
schema. Runtime execution exposes selected bindings to `agency.http.request` interpolation variables
such as `{credential_id}`, `{connector_provider}`, `{target_scope[key]}`, and direct keys like
`{channel_id}`, `{repo}`, or `{folder_id}`.

For linked tool nodes in the workflow graph:

- `agency.http.request` supports either connector binding or saved tool-parameter defaults, but not
  both at once
- choosing a credential can auto-fill purpose and target-scope fields from credential metadata and
  lock those values when the credential is the source of truth
- tool parameters marked by the backend schema as agent-filled remain visible as runtime hints
  instead of editable setup fields

Monitoring and workflow delivery context: [workflow-monitoring.md](./workflow-monitoring.md)

## Agent Behavior

Agents should not guess between repeated installations. When multiple credentials can match a
provider, agents should call `agency.connector.resolve` with provider and identity filters before
proposing connector-backed workflows or tools.

Backend workflow validation rejects connector-backed workflow tools that have neither a tool-level
binding nor a matching workflow-level binding. This catches missing bindings before approval and
runtime execution.

## Future Work

The backend tools documentation tracks remaining provider-specific TODOs for Slack, Teams, Twilio,
Gmail, Outlook, Notion, Linear, Jira, Confluence, Airtable, Google Workspace, Microsoft 365,
GitHub, GitLab, Sentry, PagerDuty, Figma, Canva, YouTube, Adobe, S3, Drive, Dropbox, OneDrive,
SharePoint, Perplexity, and Tavily.

Future integrations should not be considered complete until they have concrete schemas, setup UI,
resolver coverage, binding validation, request-shape tests, and conversation-bound delivery only
where inbound identity and webhook verification are well-defined.

Backend TODO tracker: `agency/docs/tools.md`
