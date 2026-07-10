import 'next-auth/jwt';
import type { AuthMode, AuthUser } from '@/types/auth';

declare module 'next-auth' {
  interface Session {
    user: AuthUser;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string | null;
    authMode?: AuthMode;
  }
}
