import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import generateJWKS from './pemtojwks';

describe('generateJWKS', () => {
  it('exports a PEM private key as a private JWK with the certificate thumbprint', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();

    const jwks = JSON.parse(await generateJWKS(pem, 'thumbprint'));

    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]).toMatchObject({
      kty: 'RSA',
      x5t: 'thumbprint',
    });
    expect(jwks.keys[0].d).toEqual(expect.any(String));
    expect(() => createPrivateKey({ key: jwks.keys[0], format: 'jwk' })).not.toThrow();
  });

  it('normalizes escaped newlines in environment-sourced PEM values', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey
      .export({ format: 'pem', type: 'pkcs8' })
      .toString()
      .replace(/\n/g, '\\n');

    const jwks = JSON.parse(await generateJWKS(pem, 'escaped-thumbprint'));

    expect(jwks.keys[0].x5t).toBe('escaped-thumbprint');
    expect(() => createPrivateKey({ key: jwks.keys[0], format: 'jwk' })).not.toThrow();
  });
});
