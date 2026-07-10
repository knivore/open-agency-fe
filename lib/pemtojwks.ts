import { createPrivateKey } from 'node:crypto';

type PrivateJWK = JsonWebKey & {
  x5t?: string;
};

function normalizePem(pem: string): string {
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}

async function generateJWKS(PEMPair: string, x5t: string): Promise<string> {
  const privateKey = createPrivateKey(normalizePem(PEMPair));
  const jwk = privateKey.export({ format: 'jwk' }) as PrivateJWK;

  return JSON.stringify({ keys: [{ ...jwk, x5t }] }, null, 4);
}

export default generateJWKS;
