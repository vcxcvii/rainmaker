import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const GOOGLE_SCOPES = {
  ga4: 'https://www.googleapis.com/auth/analytics.readonly',
  gsc: 'https://www.googleapis.com/auth/webmasters.readonly',
} as const;

const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';

export interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri: string;
}

export interface GoogleTokenProvider {
  getAccessToken(scopes: string[]): Promise<string>;
}

export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

/** Loads only fields needed for a JWT bearer grant, keeping the key local. */
export function loadServiceAccount(path: string): ServiceAccountCredentials {
  const absolutePath = resolve(path);
  if (!existsSync(absolutePath)) {
    throw new GoogleAuthError(`service account key not found: ${absolutePath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absolutePath, 'utf8')) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new GoogleAuthError(`service account key is not valid JSON: ${reason}`);
  }

  const record = asRecord(parsed);
  const clientEmail = record?.client_email;
  const privateKey = record?.private_key;
  const tokenUri = record?.token_uri;

  if (typeof clientEmail !== 'string' || typeof privateKey !== 'string') {
    throw new GoogleAuthError('service account key needs client_email and private_key');
  }

  return {
    client_email: clientEmail,
    private_key: privateKey,
    token_uri: typeof tokenUri === 'string' ? tokenUri : DEFAULT_TOKEN_URI,
  };
}

function encodeJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createAssertion(
  credentials: ServiceAccountCredentials,
  scopes: string[],
  nowSeconds: number,
): string {
  const header = encodeJson({ alg: 'RS256', typ: 'JWT' });
  const claims = encodeJson({
    aud: credentials.token_uri,
    exp: nowSeconds + 3600,
    iat: nowSeconds,
    iss: credentials.client_email,
    scope: [...scopes].sort().join(' '),
  });
  const unsigned = `${header}.${claims}`;
  const signature = createSign('RSA-SHA256')
    .update(unsigned)
    .end()
    .sign(credentials.private_key, 'base64url');

  return `${unsigned}.${signature}`;
}

interface TokenResponse {
  accessToken: string;
  expiresIn: number;
}

async function requestToken(
  credentials: ServiceAccountCredentials,
  scopes: string[],
  fetcher: typeof fetch,
  nowSeconds: number,
): Promise<TokenResponse> {
  const assertion = createAssertion(credentials, scopes, nowSeconds);
  const body = new URLSearchParams({
    assertion,
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
  });
  const response = await fetcher(credentials.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  const payload = (await response.json()) as unknown;
  const record = asRecord(payload);
  if (!response.ok) {
    const description = record?.error_description;
    const error = record?.error;
    const reason = typeof description === 'string'
      ? description
      : typeof error === 'string'
        ? error
        : `HTTP ${response.status}`;
    throw new GoogleAuthError(`Google token exchange failed: ${reason}`);
  }

  const accessToken = record?.access_token;
  const expiresIn = record?.expires_in;
  if (typeof accessToken !== 'string') {
    throw new GoogleAuthError('Google token response omitted access_token');
  }

  return {
    accessToken,
    expiresIn: typeof expiresIn === 'number' ? expiresIn : 3600,
  };
}

/** Reuses tokens by scope so GA4 and GSC stay isolated and cheap to probe. */
export function createGoogleTokenProvider(options: {
  credentials: ServiceAccountCredentials;
  fetcher?: typeof fetch;
  now?: () => number;
}): GoogleTokenProvider {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const cache = new Map<string, { accessToken: string; expiresAt: number }>();

  return {
    async getAccessToken(scopes: string[]): Promise<string> {
      const key = [...scopes].sort().join(' ');
      const nowSeconds = Math.floor(now() / 1000);
      const cached = cache.get(key);
      if (cached && cached.expiresAt > nowSeconds + 60) return cached.accessToken;

      const token = await requestToken(
        options.credentials,
        scopes,
        fetcher,
        nowSeconds,
      );
      cache.set(key, {
        accessToken: token.accessToken,
        expiresAt: nowSeconds + token.expiresIn,
      });
      return token.accessToken;
    },
  };
}
