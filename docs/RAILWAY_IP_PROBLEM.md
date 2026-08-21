# 🚨 Railway Dynamic IP vs Angel One Static IP Whitelist

**Issue Priority:** BLOCKER — Live trade execution on deployed website  
**Affects:** All Angel One SmartAPI calls (auth, order placement, holdings, WebSocket)  
**Status:** Orders show "Order Placed" on Artha UI but never reach Angel One

---

## Problem Statement

Angel One's SmartAPI requires every incoming API request to originate from a **pre-registered static IP address**. This IP is set once in the [Angel One SmartAPI Portal](https://smartapi.angelone.in) under "Primary Static IP" and can only be changed **once per week**.

Our backend is deployed on **Railway**, which routes all outbound HTTP requests through a **shared NAT gateway pool with rotating IPs**. Every API call from Railway can use a different IP address.

### What Happens

```
Artha Backend (Railway)                        Angel One API Server
       │                                              │
       ├── Request #1 from IP 162.220.232.80  ──────► ❌ "Not a registered IP"
       ├── Request #2 from IP 152.55.177.81   ──────► ❌ "Not a registered IP"
       ├── Request #3 from IP 152.55.176.224  ──────► ❌ "Not a registered IP"
       └── Request #4 from IP ???.???.???.??  ──────► ❌ "Not a registered IP"
                                                       │
                                              Whitelisted: 152.55.176.224
                                              (but Railway already rotated past it)
```

### Why We Can't Just Update the IP

1. Railway rotates IPs **per request** — there is no single stable IP
2. Angel One only allows IP changes **once per week**
3. Even if we whitelist today's IP, Railway may use a different one on the next request

### Error Message from Angel One

```json
{
  "status": false,
  "message": "162.220.232.80 is not a registered IP, please check your registered IP.",
  "errorcode": "AG8002"
}
```

### What Works vs What Doesn't

| Feature | Status | Why |
|---|---|---|
| Yahoo Finance market data | ✅ Works | No IP restriction |
| Groq AI / Gemini AI | ✅ Works | No IP restriction |
| NewsAPI, RSS feeds | ✅ Works | No IP restriction |
| FMP fundamentals | ✅ Works | No IP restriction |
| Paper Trading | ✅ Works | No external broker call |
| **Angel One Login** | ❌ Blocked | Requires whitelisted IP |
| **Angel One Place Order** | ❌ Blocked | Requires whitelisted IP |
| **Angel One Holdings** | ❌ Blocked | Requires whitelisted IP |
| **Angel One WebSocket** | ❌ Blocked | Requires whitelisted IP |

---

## Available Solutions

### Option 1: Static IP Proxy Service (Recommended)

**Concept:** Route only Angel One API calls through a proxy that gives us one permanent outbound IP.

**Services:**
- [Fixie](https://usefixie.com/) — Free tier: 500 req/month, Paid: $9/month
- [QuotaGuard Static](https://www.quotaguard.com/) — Free tier: 250 req/month, Paid: $19/month

**Implementation:**
```typescript
// In AngelOneBrokerAdapter.ts and brokerSession.ts
// Route Angel One calls through the static proxy
import { HttpsProxyAgent } from 'https-proxy-agent';

const PROXY_URL = process.env.FIXIE_URL; // e.g. http://fixie:xxxxx@velodrome.usefixie.com:80
const agent = new HttpsProxyAgent(PROXY_URL);

// Use agent in fetch/axios calls to Angel One
const res = await fetch('https://apiconnect.angelone.in/...', {
  agent,  // Routes through Fixie's static IP
  headers: { ... }
});
```

**Steps:**
1. Sign up for Fixie (or QuotaGuard) → Get a static IP (e.g. `54.83.120.55`)
2. Whitelist `54.83.120.55` in Angel One portal as Primary Static IP
3. Add `FIXIE_URL` to Railway environment variables
4. Install `https-proxy-agent` npm package
5. Wrap only Angel One API calls with the proxy agent

| Pros | Cons |
|---|---|
| ✅ No migration needed, stays on Railway | ⚠️ Monthly cost ($9–19) |
| ✅ 15 min implementation | ⚠️ Free tier has request limits |
| ✅ IP never changes | |

---

### Option 2: Deploy Backend to a VPS with Fixed IP

**Concept:** Move the API server from Railway to a VPS (DigitalOcean, AWS Lightsail, Hetzner) that has a dedicated static IP.

**Hosting Options:**
| Provider | Plan | Monthly Cost | Static IP |
|---|---|---|---|
| DigitalOcean Droplet | 1 vCPU, 1GB RAM | $6/month (~₹500) | ✅ Included |
| AWS Lightsail | 1 vCPU, 1GB RAM | $5/month (~₹420) | ✅ Included |
| Hetzner Cloud | CX22 (2 vCPU, 4GB) | €4.5/month (~₹420) | ✅ Included |

**Steps:**
1. Provision a VPS → Note the public IP (e.g. `68.183.45.120`)
2. Whitelist that IP in Angel One portal
3. Install Node.js, PM2, clone the repo, build, run
4. Point frontend API base URL to the VPS IP/domain
5. The existing `deploy_vps.bat` script can be adapted

| Pros | Cons |
|---|---|
| ✅ Full control over IP | ⚠️ Must manage server (updates, security, uptime) |
| ✅ No proxy overhead | ⚠️ Need to set up SSL, firewall, PM2 |
| ✅ Cheapest long-term | ⚠️ Migration effort (~2-4 hours) |

---

### Option 3: Railway Static Outbound IP (Paid Feature)

**Concept:** Railway offers static outbound IPs on their **Pro plan** ($20/month per seat).

**Steps:**
1. Upgrade to Railway Pro plan
2. Enable "Static Outbound IP" in project settings
3. Whitelist that IP in Angel One portal

| Pros | Cons |
|---|---|
| ✅ Zero code changes | ⚠️ $20/month minimum |
| ✅ Stay on Railway | ⚠️ Feature availability may vary by region |

---

### Option 4: Hybrid — Keep Railway + Add a Tiny Proxy VPS

**Concept:** Keep the main backend on Railway. Deploy a lightweight proxy (Nginx or a 20-line Node script) on a $5 VPS. Only Angel One API calls route through the proxy.

```
Railway Backend ──(Angel One calls only)──► Tiny VPS Proxy (fixed IP) ──► Angel One API
       │
       └──(everything else: Yahoo, Groq, News)──► Direct (no proxy needed)
```

**Steps:**
1. Spin up a $5 DigitalOcean droplet
2. Install Nginx as a reverse proxy for `apiconnect.angelone.in`
3. Whitelist the droplet's IP in Angel One portal
4. In our backend, point Angel One API calls to the proxy URL

| Pros | Cons |
|---|---|
| ✅ Cheapest ($5/month) | ⚠️ Extra hop adds ~50ms latency |
| ✅ Minimal code changes | ⚠️ Must maintain the proxy VPS |
| ✅ Main backend stays on Railway | |

---

## Recommendation

**Go with Option 1 (Fixie Proxy)** for the fastest fix:
- 15 minutes to implement
- Zero infrastructure to manage
- Free tier covers testing; $9/month for production
- One permanent IP that never changes

If we want to avoid any recurring cost, **Option 2 (VPS)** is the best long-term choice at ~₹420-500/month with full control.

---

## Files That Need Changes (Any Option)

Only 2 files need modification:

| File | Change |
|---|---|
| `packages/phase7-broker/src/adapters/AngelOneBrokerAdapter.ts` | Add proxy agent to `placeOrder()`, `searchScrip()` fetch calls |
| `apps/api/src/services/brokerSession.ts` | Add proxy agent to `_doLogin()` and `getHoldings()` calls |

No frontend changes needed. No database changes needed.
