import * as jose from 'node-jose';

async function generateJWKS(PEMPair: string, x5t: string): Promise<any> {
  const keystore: jose.JWK.KeyStore = jose.JWK.createKeyStore();

  const jwks: any = await keystore.add(PEMPair, 'pem').then((_) => {
    return keystore.toJSON(true);
  });

  if (jwks.keys && jwks.keys.length > 0) {
    jwks.keys[0].x5t = x5t;
  }
  return JSON.stringify(jwks, null, 4);
}

export default generateJWKS;
