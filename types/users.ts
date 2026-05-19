import { z } from 'zod';
import type { JsonObject } from '@/types/api';

export const UserBaseSchema = z.object({
  id: z.string().nullish(),
  name: z.string(),
  email: z.string(),
  image: z.any().nullish(),
});

export interface User extends JsonObject {
  id?: string | null;
  name: string;
  email: string;
  image?: string | null;
}

export type UserRecord = z.infer<typeof UserBaseSchema>;
