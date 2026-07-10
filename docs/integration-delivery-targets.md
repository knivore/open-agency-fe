# Integration Delivery Targets

For the consolidated operating model across setup, delivery, workflow bindings, and future TODOs,
start with [integration-operations-guide.md](./integration-operations-guide.md).

Agency separates connector credentials from delivery targets.

## Credential Instance

A credential identifies the provider instance and secret source. Multiple credentials can exist for
the same provider, so instance identity metadata should be filled when available:

| Provider | Useful identity metadata                                                  |
|----------|---------------------------------------------------------------------------|
| Telegram | `bot_user_id`, `bot_username`                                             |
| Discord  | `application_id`, `bot_user_id`, `default_guild_id`, `default_channel_id` |
| WhatsApp | `phone_number_id`, `business_account_id`, `display_phone_number`          |

WhatsApp Cloud API requires `metadata.phone_number_id` for delivery.

## Tool And Workflow Bindings

Connector-backed tools use `ToolDefinition.security.connector_bindings`.
Workflow defaults use `workflow.metadata.connector_bindings`.

Tool bindings take precedence. Workflow bindings are used when a tool has no specific binding.
The workflow editor renders provider-specific target fields from `targetScopeMetadata` when the
registry has a concrete schema; it falls back to raw target-scope JSON only for providers without a
schema.

```json
{
  "provider": "telegram-bot",
  "credential_id": "credential-telegram-support",
  "purpose": "support_notifications",
  "target_scope": {
    "chat_id": "123456789"
  }
}
```

Runtime execution fails when a connector-backed tool has no binding, or when multiple bindings are
available and the tool call does not narrow the provider or credential id.

The built-in `agency.http.request` tool exposes the selected binding to interpolation variables at
runtime. Workflow authors can use `{credential_id}`, `{connector_credential_id}`,
`{connector_provider}`, `{connector_purpose}`, `{target_scope[key]}`, or direct target-scope keys
such as `{channel_id}`, `{repo}`, and `{folder_id}` in URL, headers, query params, and JSON body.
This lets agents use the saved binding instead of manually copying a credential id or workspace
target into each tool call.

## Conversation Targets

Conversation channel fields store operational delivery targets:

| Provider | Required conversation fields                                                  |
|----------|-------------------------------------------------------------------------------|
| Telegram | `channel_thread_id = chat_id`, `channel_user_id = trusted Telegram user id`   |
| Discord  | `channel_thread_id = channel_id`, `channel_user_id = trusted Discord user id` |
| WhatsApp | `channel_user_id = recipient phone number or wa_id`                           |

The backend supports conversation-bound delivery:

```http
POST /integrations/conversations/channels/{conversation_id}/deliver
```

```json
{
  "credential_id": "credential-id",
  "outbound_messages": [{ "type": "text", "text": "Message text" }]
}
```

The service formats Telegram, Discord, or WhatsApp payloads from the saved conversation target and
sends through the selected credential.

The lower-level adapter delivery route also supports outbound-only providers that do not yet have
conversation-bound inbound handling:

```http
POST /integrations/conversations/adapters/{provider}/deliver
```

| Provider        | Method               | Required payload/metadata                                                                 |
|-----------------|----------------------|-------------------------------------------------------------------------------------------|
| Slack           | `chat.postMessage`   | Payload `channel`, `text`; bearer token credential.                                       |
| Microsoft Teams | `sendChannelMessage` | Payload or metadata `team_id`, `channel_id`; payload `content`; bearer token credential.  |
| Twilio SMS      | `messages`           | Metadata `account_sid`, `from_number`; payload `to`, `body`; auth token credential.       |
| Gmail           | `sendMessage`        | Payload `raw`; optional payload/metadata `user_id` or `mailbox`; bearer token credential. |
| Outlook         | `sendMail`           | Payload `message`; optional payload/metadata `mailbox`; bearer token credential.          |

## Production Webhooks

Production webhook verification requires provider-specific metadata:

| Provider | Required production metadata                   |
|----------|------------------------------------------------|
| Telegram | `webhook_secret_ref` or `webhook_secret_token` |
| Discord  | `webhook_public_key`                           |
| WhatsApp | `app_secret_ref` or `app_secret`               |

The integrations setup UI surfaces these fields separately from delivery-only metadata because a
credential may be valid for outbound delivery before inbound production webhook verification is
enabled.
