import type { JsonObject } from '@/types/api';

export interface ApiTokenDefinition extends JsonObject {
  id: string;
  owner_user_id: string;
  name: string;
  prefix: string;
  last4: string;
  scopes: string[];
  expires_at?: string | null;
  revoked_at?: string | null;
  last_used_at?: string | null;
  metadata?: JsonObject;
}

export interface ApiTokenCreateResponse extends ApiTokenDefinition {
  token: string;
}

export interface ApiTokenScopeDefinition extends JsonObject {
  id: string;
  label: string;
  description: string;
  category: string;
}

export interface ApiTokenActivityItem extends JsonObject {
  action: string;
  token_id: string;
  owner_user_id: string;
  scopes?: string[];
  prefix?: string;
  last4?: string;
  name?: string;
  path?: string;
  method?: string;
  used_at?: string;
  revoked_at?: string | null;
}
