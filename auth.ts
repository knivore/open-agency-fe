import NextAuth, { NextAuthConfig, NextAuthResult } from 'next-auth';
import CustomProvider, { getPrivateKey } from '@/lib/auth/customprovider';
import GoogleProvider from 'next-auth/providers/google';
import { NextRequest } from 'next/server';
import CredentialsProvider from 'next-auth/providers/credentials';
import { loginWithDevCredentials } from '@/lib/auth/devAuthAdapter';
import type { AuthMode } from '@/types/auth';

const isLocalAppEnv = process.env.NEXT_PUBLIC_APP_ENV === 'local';
const hasDevCredentialConfig = Boolean(process.env.DEV_AUTH_EMAIL && process.env.DEV_AUTH_PASSWORD);
const hasAzureAuthConfig = Boolean(
  process.env.AD_PRIVATE_KEY &&
    process.env.X5T &&
    process.env.AZURE_AD_CLIENT_ID &&
    process.env.AZURE_AD_TENANT_ID &&
    process.env.REDIRECT_URL
);
const isDevAuthEnabled =
  process.env.NEXT_PUBLIC_AGENCY_DEV_AUTH_ENABLED === 'true' ||
  (isLocalAppEnv && hasDevCredentialConfig && !hasAzureAuthConfig);

const nextAuth: NextAuthResult = NextAuth(async (req: NextRequest | undefined) => {
  const providers: NonNullable<NextAuthConfig['providers']> = [];

  if (isDevAuthEnabled) {
    providers.push(
      CredentialsProvider({
        name: 'Development Email Login',
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          const email = String(credentials?.email || '');
          const password = String(credentials?.password || '');
          const result = await loginWithDevCredentials({ email, password });

          if (!result) {
            return null;
          }

          return {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            image: result.user.image,
            accessToken: result.accessToken,
            authMode: 'dev',
          };
        },
      })
    );
  } else if (hasAzureAuthConfig) {
    providers.push(
      CustomProvider(
        req as Request,
        await getPrivateKey(process.env.AD_PRIVATE_KEY!, process.env.X5T!)
      )
    );
  } else {
    console.warn(
      'Auth provider configuration is incomplete. Enable dev auth locally or configure Azure AD variables.'
    );
  }

  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      })
    );
  }

  const config: NextAuthConfig = {
    providers,
    callbacks: {
      async signIn({ user }) {
        // Log sign-in attempts
        console.log('User signing in:', user.email);
        return true;
      },
      jwt({ token, user }) {
        if (user) {
          token.sub = user.id;
          token.name = user.name;
          token.email = user.email;
          token.picture = user.image;
          token.accessToken = (user as { accessToken?: string }).accessToken || null;
          token.authMode = ((user as { authMode?: AuthMode }).authMode || (isDevAuthEnabled ? 'dev' : 'prod')) as AuthMode;
        }

        return token;
      },
      session({ session, token }) {
        return {
          expires: session.expires,
          user: {
            id: String(token.sub || ''),
            name: token.name || '',
            email: token.email || '',
            image: typeof token.picture === 'string' ? token.picture : '',
            accessToken: typeof token.accessToken === 'string' ? token.accessToken : null,
            authMode: typeof token.authMode === 'string' ? token.authMode : 'prod',
          },
        };
      },
    },
    events: {
      async session(message) {
        // This is called whenever a session is accessed
        console.log('Session checked for:', message.session.user.email);
      },
    },
    trustHost: true,
    session: {
      strategy: 'jwt',
      maxAge: 24 * 60 * 60, // 24 hours in seconds
      updateAge: 24 * 60 * 60, // Optional: refresh the session after a full day of use
    },
  };
  return config;
});

// Check for existing session
const checkSession = async () => {
  const session = await auth();
  return session;
};

// export the handlers and methods
const signIn: NextAuthResult['signIn'] = nextAuth.signIn;
const signOut: NextAuthResult['signOut'] = nextAuth.signOut;
const auth: NextAuthResult['auth'] = nextAuth.auth;
const handlers = nextAuth.handlers;

export { signIn, signOut, auth, handlers, checkSession };
