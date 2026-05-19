export type AuthMode = 'local' | 'dev' | 'prod';

export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface AuthUser extends User {
  accessToken: string | null;
  authMode: AuthMode;
}
