import generateJWKS from '../pemtojwks';
import { OAuthConfig } from 'next-auth/providers';

interface AzureAdProfile {
  email?: string;
  name?: string;
  picture?: string;
  sub: string;
}

const tenant = process.env.AZURE_AD_TENANT_ID || '';
const clientID = process.env.AZURE_AD_CLIENT_ID || '';
const redirectUrl = process.env.REDIRECT_URL || '';
export async function getPrivateKey(pk: string, x5t: string): Promise<CryptoKey> {
  const privateJwk = await generateJWKS(pk, x5t);

  try {
    return await crypto.subtle.importKey(
      'jwk', // Format of the key you are importing
      JSON.parse(privateJwk).keys[0], // JWK object
      {
        name: 'RSA-PSS', // Algorithm the key will be used for
        hash: 'SHA-256', // Hashing algorithm to use
      },
      true, // Whether the key is extractable
      ['sign'] // Key usage (can be 'sign', 'verify', 'encrypt', 'decrypt', etc.)
    );
  } catch (error) {
    console.error('Error importing private key:', error);
    throw new Error('Failed to import private key');
  }
}
// customer provider for next auth to use certificate instead of secret
const CustomProvider = (req: Request, privateKey: CryptoKey): OAuthConfig<AzureAdProfile> => {
  return {
    id: 'azure-ad',
    name: 'Custom Azure AD Provider',
    type: 'oidc',
    issuer: 'https://login.microsoftonline.com/' + tenant + '/v2.0',
    style: {
      logo: '/azure.svg',
      bg: '#fff',
      text: '#0072c6',
    },
    userinfo: 'https://graph.microsoft.com/oidc/userinfo',
    clientId: clientID,
    checks: ['state'],
    allowDangerousEmailAccountLinking: true,
    authorization: {
      url:
        'https://login.microsoftonline.com/' +
        process.env.AZURE_AD_TENANT_ID +
        '/oauth2/v2.0/authorize',
      params: {
        response_type: 'code',
        redirect_uri: redirectUrl,
        response_mode: 'query',
        scope: 'email profile openid user.read',
        client_id: clientID,
        state: '12345',
      },
    },

    token: {
      url:
        'https://login.microsoftonline.com/' +
        process.env.AZURE_AD_TENANT_ID +
        '/oauth2/v2.0/token',
      clientPrivateKey: privateKey,
    },
    client: {
      client_id: clientID,
      token_endpoint_auth_method: 'private_key_jwt',
      token_endpoint_auth_signing_alg: 'RS256',
      redirect_uris: [redirectUrl],
    },
    jwks_endpoint:
      'https://login.microsoftonline.com/' +
      process.env.AZURE_AD_TENANT_ID +
      '/discovery/v2.0/keys',
    profile(profile: AzureAdProfile) {
      return {
        id: profile.sub,
        name: profile.name,
        email: profile.email,
        image: profile.picture,
      };
    },
  };
};

export default CustomProvider;
