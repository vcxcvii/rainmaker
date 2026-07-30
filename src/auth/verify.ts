import type { RainmakerConfig } from '../config/schema.js';
import {
  GOOGLE_SCOPES,
  createGoogleTokenProvider,
  loadServiceAccount,
  type GoogleTokenProvider,
} from './google.js';

export const CAPABILITIES = ['crawl', 'pagespeed', 'gsc', 'ga4', 'clarity'] as const;
export type Capability = (typeof CAPABILITIES)[number];

export interface CapabilityClient {
  check(): Promise<string>;
}

export type CapabilityClients = Partial<Record<Capability, CapabilityClient>>;

export interface CapabilityResult {
  capability: Capability;
  status: 'ok' | 'missing' | 'error';
  detail: string;
}

const DEGRADATION: Record<Capability, string> = {
  crawl: 'site-health-check unavailable; audit cannot crawl',
  pagespeed: 'site-health-check CWV unavailable',
  gsc: 'google-rankings-check unavailable; opportunity scoring falls back to 1.0',
  ga4: 'conversion-path tiering unavailable; rule 1 skipped',
  clarity: 'visitor-drop-off-audit unavailable',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

async function responseJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return asRecord((await response.json()) as unknown);
  } catch {
    return null;
  }
}

async function requireOk(
  response: Response,
  service: string,
): Promise<Record<string, unknown> | null> {
  const payload = await responseJson(response);
  if (response.ok) return payload;

  const errorRecord = asRecord(payload?.error);
  const message = errorRecord?.message;
  throw new Error(
    `${service} ${typeof message === 'string' ? message : `HTTP ${response.status}`}`,
  );
}

function withBearer(token: string): HeadersInit {
  return { authorization: `Bearer ${token}` };
}

function googleClient(
  tokenProvider: GoogleTokenProvider,
  scope: string,
  request: (token: string) => Promise<string>,
): CapabilityClient {
  return {
    async check(): Promise<string> {
      const token = await tokenProvider.getAccessToken([scope]);
      return request(token);
    },
  };
}

/** Builds real, one-request probes. Missing credentials omit only that client. */
export function createDefaultCapabilityClients(options: {
  config?: RainmakerConfig;
  env?: NodeJS.ProcessEnv;
  fetcher?: typeof fetch;
}): CapabilityClients {
  const config = options.config;
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  const clients: CapabilityClients = {};

  if (env.FIRECRAWL_API_KEY) {
    clients.crawl = {
      async check(): Promise<string> {
        const response = await fetcher('https://api.firecrawl.dev/v2/team/credit-usage', {
          headers: withBearer(env.FIRECRAWL_API_KEY ?? ''),
        });
        const payload = await requireOk(response, 'Firecrawl');
        const data = asRecord(payload?.data);
        const remaining = data?.remainingCredits;
        return typeof remaining === 'number'
          ? `firecrawl, ${remaining} credits`
          : 'firecrawl, credit balance unavailable';
      },
    };
  }

  if (config?.site) {
    clients.pagespeed = {
      async check(): Promise<string> {
        const url = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
        url.searchParams.set('url', config.site);
        url.searchParams.set('strategy', 'mobile');
        if (env.PAGESPEED_API_KEY) url.searchParams.set('key', env.PAGESPEED_API_KEY);
        const response = await fetcher(url);
        await requireOk(response, 'PageSpeed');
        return env.PAGESPEED_API_KEY ? 'API key configured' : 'no key (5 req/min limit)';
      },
    };
  }

  let tokenProvider: GoogleTokenProvider | undefined;
  const credentialPath = env.GOOGLE_APPLICATION_CREDENTIALS;
  const getTokenProvider = (): GoogleTokenProvider => {
    if (tokenProvider) return tokenProvider;
    if (!credentialPath) throw new Error('GOOGLE_APPLICATION_CREDENTIALS is unset');
    tokenProvider = createGoogleTokenProvider({
      credentials: loadServiceAccount(credentialPath),
      fetcher,
    });
    return tokenProvider;
  };

  if (credentialPath) {
    const provider: GoogleTokenProvider = {
      getAccessToken: (scopes) => getTokenProvider().getAccessToken(scopes),
    };
    clients.gsc = googleClient(provider, GOOGLE_SCOPES.gsc, async (token) => {
      const response = await fetcher('https://www.googleapis.com/webmasters/v3/sites', {
        headers: withBearer(token),
      });
      const payload = await requireOk(response, 'GSC');
      const entries = payload?.siteEntry;
      const count = Array.isArray(entries) ? entries.length : 0;
      if (config?.gsc_site_url && Array.isArray(entries)) {
        const hasConfiguredSite = entries.some((entry) => {
          const record = asRecord(entry);
          return record?.siteUrl === config.gsc_site_url;
        });
        if (!hasConfiguredSite) throw new Error(`GSC cannot access ${config.gsc_site_url}`);
      }
      return config?.gsc_site_url ?? `${count} site(s)`;
    });

    if (config?.ga4_property_id) {
      clients.ga4 = googleClient(provider, GOOGLE_SCOPES.ga4, async (token) => {
        const property = encodeURIComponent(config.ga4_property_id ?? '');
        const response = await fetcher(
          `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`,
          {
            method: 'POST',
            headers: { ...withBearer(token), 'content-type': 'application/json' },
            body: JSON.stringify({
              dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }],
              dimensions: [{ name: 'pagePath' }],
              limit: 1,
              metrics: [{ name: 'sessions' }],
            }),
          },
        );
        await requireOk(response, 'GA4');
        return `property ${config.ga4_property_id}`;
      });
    }
  }

  if (env.CLARITY_TOKEN) {
    clients.clarity = {
      async check(): Promise<string> {
        const url = new URL('https://www.clarity.ms/export-data/api/v1/project-live-insights');
        url.searchParams.set('numOfDays', '1');
        url.searchParams.set('dimension1', 'URL');
        const response = await fetcher(url, {
          headers: {
            ...withBearer(env.CLARITY_TOKEN ?? ''),
            'content-type': 'application/json',
          },
        });
        await requireOk(response, 'Clarity');
        return 'token valid';
      },
    };
  }

  return clients;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function checkWithTimeout(
  capability: Capability,
  client: CapabilityClient,
  timeoutMs: number,
): Promise<CapabilityResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const detail = await Promise.race([
      client.check(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    return { capability, status: 'ok', detail };
  } catch (error) {
    return {
      capability,
      status: 'error',
      detail: `${errorMessage(error)}; ${DEGRADATION[capability]}`,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Runs every probe even when another capability errors. */
export async function verifyCapabilities(
  clients: CapabilityClients,
  timeoutMs = 10_000,
): Promise<CapabilityResult[]> {
  return Promise.all(
    CAPABILITIES.map((capability) => {
      const client = clients[capability];
      if (!client) {
        return Promise.resolve({
          capability,
          status: 'missing' as const,
          detail: DEGRADATION[capability],
        });
      }
      return checkWithTimeout(capability, client, timeoutMs);
    }),
  );
}
