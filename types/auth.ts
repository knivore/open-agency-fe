export type AuthMode = 'dev' | 'prod';

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

export interface AuthSession {
  user: AuthUser;
  expires?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}
