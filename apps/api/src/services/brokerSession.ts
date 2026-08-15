/**
 * brokerSession.ts — Shared Angel One SmartAPI Session Singleton
 *
 * Single source of truth for:
 *  - JWT token (cached 2 hours)
 *  - TOTP generation
 *  - Public IP resolution (cached)
 *  - Static Outbound Proxy Agent (Fixie / QuotaGuard / custom proxy support)
 *  - 2-minute holdings cache (prevents AG8002 rate limiting)
 *
 * All routes (portfolio, trading, system) import from here.
 * Never instantiate separate auth sessions in individual routes.
 */

import axios, { AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import { HttpsProxyAgent } from 'https-proxy-agent';

// ── Outbound Proxy Configuration ──────────────────────────────────────────────
/**
 * Returns the configured proxy URL if any.
 * Checks FIXIE_URL, QUOTAGUARDSTATIC_URL, QUOTAGUARD_URL, ANGELONE_PROXY_URL, SMARTAPI_PROXY_URL, HTTPS_PROXY, HTTP_PROXY.
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
 * Generates an Axios request config with proxy agent configured if active.
 */
export function getAngelOneAxiosConfig(extraConfig: AxiosRequestConfig = {}): AxiosRequestConfig {
  const agent = getAngelOneProxyAgent();
  const config: AxiosRequestConfig = {
    ...extraConfig,
  };

  if (agent) {
    config.httpsAgent = agent;
    config.httpAgent = agent;
    config.proxy = false; // Disable axios internal env proxy parsing so httpsAgent handles the tunnel
  }

  return config;
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

// ── Base32 Decoder ─────────────────────────────────────────────────────────────
function base32Decode(base32: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = base32.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

// ── TOTP Generator (RFC 6238) ──────────────────────────────────────────────────
export function generateTOTP(secret: string): string {
  try {
    const key = base32Decode(secret.trim());
    const epoch = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(epoch / 30);
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(timeStep));
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(buffer);
    const digest = hmac.digest();
    const offset = digest[digest.length - 1] & 0xf;
    const code =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);
    return (code % 1000000).toString().padStart(6, '0');
  } catch {
    return '000000';
  }
}

// ── Public IP Cache ────────────────────────────────────────────────────────────
export async function getPublicIp(): Promise<string> {
  if (process.env.ANGELONE_STATIC_IP) return process.env.ANGELONE_STATIC_IP.trim();
  if (process.env.SMARTAPI_STATIC_IP) return process.env.SMARTAPI_STATIC_IP.trim();
  if (process.env.FIXIE_STATIC_IP) return process.env.FIXIE_STATIC_IP.trim();
  return '13.57.136.86';
}

// ── JWT Token Cache ────────────────────────────────────────────────────────────
let _jwtToken: string | null = null;
let _refreshToken: string | null = null;
let _feedToken: string | null = null;
let _tokenExpiry = 0;
let _lastLoginError = '';
let _loginInProgress = false;
let _loginPromise: Promise<string | null> | null = null;

export function getSessionStatus(): {
  connected: boolean;
  lastError: string;
  tokenExpiresIn: number;
  proxyActive: boolean;
} {
  return {
    connected: !!_jwtToken && Date.now() < _tokenExpiry,
    lastError: _lastLoginError,
    tokenExpiresIn: Math.max(0, Math.floor((_tokenExpiry - Date.now()) / 1000)),
    proxyActive: !!getAngelOneProxyUrl(),
  };
}

export function clearSession(): void {
  _jwtToken = null;
  _refreshToken = null;
  _feedToken = null;
  _tokenExpiry = 0;
  _lastLoginError = '';
  console.log('[BrokerSession] Session cleared.');
}

export function getFeedToken(): string | null {
  return _feedToken;
}

export function getRefreshToken(): string | null {
  return _refreshToken;
}

/** Returns a valid JWT token, logging in if needed. Thread-safe (no duplicate logins). */
export async function getJwtToken(): Promise<string | null> {
  // Return cached token if still valid
  if (_jwtToken && Date.now() < _tokenExpiry) return _jwtToken;

  // Prevent simultaneous login attempts (duplicate TOTP issue)
  if (_loginInProgress && _loginPromise) return _loginPromise;

  _loginInProgress = true;
  _loginPromise = _doLogin().finally(() => {
    _loginInProgress = false;
    _loginPromise = null;
  });

  return _loginPromise;
}

async function _doLogin(): Promise<string | null> {
  const clientId   = (process.env.ANGELONE_CLIENT_ID     || process.env.SMARTAPI_CLIENT_ID || '').trim();
  const apiKey     = (process.env.ANGELONE_CLIENT_SECRET || process.env.SMARTAPI_API_KEY   || '').trim();
  const password   = (process.env.ANGELONE_PASSWORD      || process.env.SMARTAPI_PASSWORD || process.env.SMARTAPI_PIN || '').trim();
  const totpSecret = (process.env.ANGELONE_TOTP_SECRET  || process.env.SMARTAPI_TOTP_SECRET || '').trim();

  if (!clientId || !apiKey || clientId.includes('your_')) {
    _lastLoginError = 'Missing ANGELONE_CLIENT_ID or ANGELONE_CLIENT_SECRET (or SMARTAPI_*) credentials';
    return null;
  }

  const clientIp = await getPublicIp();
  const totp = totpSecret ? generateTOTP(totpSecret) : '000000';
  const proxyUrl = getAngelOneProxyUrl();

  const endpoints = [
    'https://apiconnect.angelone.in/rest/auth/angelbroking/user/v1/loginByPassword',
    'https://apiconnect.angelbroking.com/rest/auth/angelbroking/user/v1/loginByPassword',
  ];

  for (const endpoint of endpoints) {
    try {
      const axiosConfig = getAngelOneAxiosConfig({
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-UserType': 'USER',
          'X-SourceID': 'WEB',
          'X-ClientIP': clientIp,
          'X-LocalIP': clientIp,
          'clientlocalip': clientIp,
          'clientpublicip': clientIp,
          'X-MACAddress': '00-00-00-00-00-00',
          'X-PrivateKey': apiKey,
          'api_key': apiKey,
        },
        timeout: 10000,
      });

      const { data } = await axios.post(
        endpoint,
        { clientcode: clientId, password, totp },
        axiosConfig
      );

      if (data?.status === true && data?.data?.jwtToken) {
        _jwtToken = data.data.jwtToken;
        _refreshToken = data.data.refreshToken || null;
        _feedToken = data.data.feedToken || null;
        _tokenExpiry = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
        _lastLoginError = '';
        console.log(`[BrokerSession] ✅ Login successful. IP: ${clientIp}${proxyUrl ? ' (via proxy)' : ''}`);
        return _jwtToken;
      }

      if (data?.message) {
        _lastLoginError = data.message;
        console.warn(`[BrokerSession] Login notice @ ${endpoint}:`, data.message);
      }
    } catch (err: any) {
      _lastLoginError = err.response?.data?.message || err.message;
      console.warn(`[BrokerSession] Login failed @ ${endpoint}:`, _lastLoginError);
    }
  }

  return null;
}

// ── Holdings Cache (prevents AG8002 rate limiting) ─────────────────────────────
interface HoldingsCache {
  data: any;
  cachedAt: number;
}

let _holdingsCache: HoldingsCache | null = null;
const HOLDINGS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

export function getCachedHoldings(): any | null {
  if (_holdingsCache && Date.now() - _holdingsCache.cachedAt < HOLDINGS_CACHE_TTL) {
    return _holdingsCache.data;
  }
  return null;
}

export function setCachedHoldings(data: any): void {
  _holdingsCache = { data, cachedAt: Date.now() };
}

export function invalidateHoldingsCache(): void {
  _holdingsCache = null;
}

/** Returns the standard Angel One API headers for authenticated requests. */
export async function getApiHeaders(): Promise<Record<string, string>> {
  const apiKey   = (process.env.ANGELONE_CLIENT_SECRET || process.env.SMARTAPI_API_KEY || '').trim();
  const clientIp = await getPublicIp();
  const token    = await getJwtToken();

  return {
    'Authorization': `Bearer ${token || ''}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-UserType': 'USER',
    'X-SourceID': 'WEB',
    'X-ClientIP': clientIp,
    'X-LocalIP': clientIp,
    'clientlocalip': clientIp,
    'clientpublicip': clientIp,
    'X-MACAddress': '00-00-00-00-00-00',
    'X-PrivateKey': apiKey,
    'api_key': apiKey,
  };
}
