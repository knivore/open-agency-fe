import type { JsonObject } from '@/types/api';

export interface User extends JsonObject {
  id?: string | null;
  name: string;
  email: string;
  image?: string | null;
}
