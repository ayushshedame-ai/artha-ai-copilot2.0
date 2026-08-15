/**
 * packages/phase7-broker/src/adapters/proxyHelper.ts
 * Artha AI — Outbound Proxy Agent for Angel One SmartAPI
 *
 * Enables routing Angel One API calls through a static outbound IP proxy
 * (such as Fixie or QuotaGuard Static) when deployed on platforms with
 * rotating NAT IPs (like Railway, Render, or Heroku).
 */

import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * Returns the configured proxy URL if any.
 * Checks FIXIE_URL, QUOTAGUARDSTATIC_URL, ANGELONE_PROXY_URL, SMARTAPI_PROXY_URL, HTTPS_PROXY, HTTP_PROXY.
 */
export function getAngelOneProxyUrl(): string | null {
  const url =
    process.env.FIXIE_URL ||
    process.env.QUOTAGUARDSTATIC_URL ||
    process.env.QUOTAGUARD_URL ||
    process.env.ANGELONE_PROXY_URL ||
    process.env.SMARTAPI_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    '';
  return url.trim() || null;
}

let _cachedProxyAgent: HttpsProxyAgent<string> | null = null;
let _cachedProxyUrl: string | null = null;

/**
 * Returns a cached HttpsProxyAgent instance for Angel One API calls.
 */
export function getAngelOneProxyAgent(): HttpsProxyAgent<string> | undefined {
  const proxyUrl = getAngelOneProxyUrl();
  if (!proxyUrl) return undefined;

  if (_cachedProxyAgent && _cachedProxyUrl === proxyUrl) {
    return _cachedProxyAgent;
  }

  _cachedProxyUrl = proxyUrl;
  _cachedProxyAgent = new HttpsProxyAgent(proxyUrl);
  return _cachedProxyAgent;
}

/**
 * Proxy-aware fetch wrapper for Angel One SmartAPI requests.
 * Transparently attaches proxy agent/dispatcher if a proxy URL is configured.
 */
export async function angelOneFetch(url: string | URL, init: RequestInit = {}): Promise<Response> {
  const proxyUrl = getAngelOneProxyUrl();
  const agent = getAngelOneProxyAgent();

  const options: any = { ...init };
  if (agent) {
    options.agent = agent;
    try {
      if (proxyUrl && !(options as any).dispatcher) {
        // undici ProxyAgent support for Node 18+ global fetch
        const { ProxyAgent } = require('undici');
        options.dispatcher = new ProxyAgent(proxyUrl);
      }
    } catch {
      // undici not present or global fetch handles agent
    }
  }

  return fetch(url, options);
}
