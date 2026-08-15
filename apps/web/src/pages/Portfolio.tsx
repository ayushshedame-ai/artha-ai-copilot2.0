import { useState, useEffect } from 'react';
import MarketSessionBanner from '../components/MarketSessionBanner';
import { getPositions, getPaperTrades } from '../services/api';
import { supabase, fetchUserPortfolio, fetchUserBrokerCredentials } from '../services/supabaseClient';
import ConnectBrokerModal from '../components/ConnectBrokerModal';

const BASE = '/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Holding {
  symbol: string;
  qty: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
  pnlPct: number;
  currentValue: number;
  exchange?: string;
}

interface Position {
  symbol: string;
  product: string;
  qty: number;
  avgPrice: number;
  ltp: number;
  unrealizedPnl: number;
  side: 'BUY' | 'SELL';
  exchange?: string;
}

interface PaperTrade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  entryPrice: number;
  exitPrice: number | null;
  netPnl: number;
  rMultiple: number | null;
  status: 'OPEN' | 'CLOSED';
  strategy: string;
  openedAt: string;
  closedAt?: string;
}

type Tab = 'holdings' | 'positions' | 'paper';

// ── Helpers ───────────────────────────────────────────────────────────────────
const pnlColor = (v: number) => (v >= 0 ? '#34d399' : '#f87171');
const fmtRs = (v: number) =>
  `${v >= 0 ? '+' : ''}₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const TAB_BTN = (active: boolean): React.CSSProperties => ({
  padding: '8px 20px',
  borderRadius: 10,
  border: `1px solid ${active ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'}`,
  background: active ? 'rgba(99,102,241,0.18)' : 'transparent',
  color: active ? '#a5b4fc' : 'var(--muted)',
  fontWeight: active ? 700 : 500,
  fontSize: 14,
  cursor: 'pointer',
  transition: 'all 0.2s',
  whiteSpace: 'nowrap' as const,
});

const TABLE_HEADER: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  color: 'var(--muted)',
  fontWeight: 600,
  fontSize: 12,
  whiteSpace: 'nowrap',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const TABLE_CELL: React.CSSProperties = {
  padding: '10px 10px',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  fontSize: 13,
};

const BROKER_NAMES: Record<string, string> = {
  ANGELONE: '🦅 Angel One (SmartAPI)',
  ZERODHA:  '🔷 Zerodha Kite',
  UPSTOX:   '⚡ Upstox Developer',
  DHAN:     '🏦 DhanHQ',
  FYERS:    '🦊 Fyers API',
  PAPER:    '📄 Paper Trading (Demo)',
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function Portfolio() {
  const [tab, setTab] = useState<Tab>('holdings');
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [activeBroker, setActiveBroker] = useState<{ name: string; mode: string } | null>(null);

  // Holdings tab state
  const [holdingsData, setHoldingsData] = useState<{
    holdings: Holding[];
    totalValue: number;
    overallPnl: number;
    availableFunds: number;
    connected: boolean;
    broker: string | null;
    error?: string;
  }>({ holdings: [], totalValue: 0, overallPnl: 0, availableFunds: 0, connected: false, broker: null });
  const [holdingsLoading, setHoldingsLoading] = useState(true);

  // Positions tab state
  const [positionsData, setPositionsData] = useState<{
    positions: Position[];
    unrealizedPnl: number;
    isMarketCloseSoon: boolean;
    error?: string;
  }>({ positions: [], unrealizedPnl: 0, isMarketCloseSoon: false });

  // Paper tab state
  const [paperData, setPaperData] = useState<{
    trades: PaperTrade[];
    summary: { winRate: number; totalPnL: number; totalTrades: number; avgRMultiple: number; sharpe?: number };
  }>({ trades: [], summary: { winRate: 0, totalPnL: 0, totalTrades: 0, avgRMultiple: 0 } });

  const loadPortfolioData = () => {
    setHoldingsLoading(true);

    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (user) {
        // Load saved broker credentials from Supabase
        const brokerCreds = await fetchUserBrokerCredentials(user.id);
        if (brokerCreds) {
          setActiveBroker({
            name: BROKER_NAMES[brokerCreds.broker_name] || brokerCreds.broker_name,
            mode: brokerCreds.trading_mode || 'LIVE',
          });
        } else {
          setActiveBroker(null);
        }

        // Load saved user portfolio from Supabase
        const userPort = await fetchUserPortfolio(user.id);
        if (userPort && Array.isArray(userPort.holdings_json) && userPort.holdings_json.length > 0) {
          const holdings = userPort.holdings_json;
          const totalVal = holdings.reduce((sum: number, h: any) => sum + (h.currentValue || 0), 0);
          const totalPnl = holdings.reduce((sum: number, h: any) => sum + (h.pnl || 0), 0);
          setHoldingsData({
            holdings,
            totalValue: totalVal,
            overallPnl: totalPnl,
            availableFunds: userPort.cash_balance || 100000,
            connected: true,
            broker: brokerCreds ? BROKER_NAMES[brokerCreds.broker_name] : 'User Isolated Account',
          });
        } else {
          // New Gmail account has no holdings yet — show clean user-isolated empty state
          setHoldingsData({
            holdings: [],
            totalValue: 0,
            overallPnl: 0,
            availableFunds: userPort?.cash_balance || 100000,
            connected: !!brokerCreds,
            broker: brokerCreds ? BROKER_NAMES[brokerCreds.broker_name] : null,
          });
        }
        setHoldingsLoading(false);
        return;
      }

      // Guest / unauthenticated fallback
      setHoldingsData({
        holdings: [],
        totalValue: 0,
        overallPnl: 0,
        availableFunds: 0,
        connected: false,
        broker: null,
      });
      setHoldingsLoading(false);
    });

    getPositions().then(setPositionsData);
    getPaperTrades().then(setPaperData);
  };

  // Fetch data on mount
  useEffect(() => {
    loadPortfolioData();
  }, []);

  // Refresh positions/paper every 10s
  useEffect(() => {
    const id = setInterval(() => {
      getPositions().then(setPositionsData);
      getPaperTrades().then(setPaperData);
    }, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <MarketSessionBanner />

      {/* Title + Connect Broker Header Banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14, marginBottom: 20
      }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            Portfolio
            {activeBroker && (
              <span style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 8,
                background: activeBroker.mode === 'LIVE' ? 'rgba(16,185,129,0.18)' : 'rgba(99,102,241,0.18)',
                border: `1px solid ${activeBroker.mode === 'LIVE' ? '#10b981' : '#6366f1'}`,
                color: activeBroker.mode === 'LIVE' ? '#34d399' : '#a5b4fc',
                fontWeight: 700,
              }}>
                {activeBroker.name} ({activeBroker.mode})
              </span>
            )}
          </h2>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Private portfolio saved under your Google Account
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsConnectModalOpen(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 12,
            background: 'linear-gradient(135deg, #6366f1 0%, #a78bfa 100%)',
            color: '#fff', border: 'none', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
            transition: 'transform 0.15s ease',
          }}
        >
          <span>🔗 Connect Broker Account</span>
        </button>
      </div>

      {/* ── Tab Switcher ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <button id="tab-holdings" style={TAB_BTN(tab === 'holdings')} onClick={() => setTab('holdings')}>
          📦 Demat Holdings
        </button>
        <button id="tab-positions" style={TAB_BTN(tab === 'positions')} onClick={() => setTab('positions')}>
          ⚡ Intraday / F&amp;O
        </button>
        <button id="tab-paper" style={TAB_BTN(tab === 'paper')} onClick={() => setTab('paper')}>
          🧪 Paper Trading
        </button>
      </div>

      {/* ── TAB 1: Holdings ────────────────────────────────────────────────── */}
      {tab === 'holdings' && (
        <div>
          {holdingsLoading ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
              Loading holdings from broker database…
            </div>
          ) : (
            <>
              {/* Summary Banner */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: 14, marginBottom: 20,
              }}>
                {[
                  { label: 'Total Value', value: `₹${(holdingsData.totalValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#60a5fa' },
                  { label: 'Overall P&L', value: fmtRs(holdingsData.overallPnl || 0), color: pnlColor(holdingsData.overallPnl || 0) },
                  { label: 'Available Funds', value: `₹${(holdingsData.availableFunds || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#34d399' },
                  { label: 'Holdings', value: holdingsData.holdings.length, color: '#a78bfa' },
                ].map(s => (
                  <div key={s.label} className="card" style={{ padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {holdingsData.error && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13, marginBottom: 16 }}>
                  ⚠️ {holdingsData.error}
                </div>
              )}

              {holdingsData.holdings.length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📦</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                    No Holdings Found
                  </div>
                  <div style={{ fontSize: 13, marginBottom: 20 }}>
                    Click <strong>Connect Broker Account</strong> to link Angel One, Zerodha, Upstox, Dhan, or Fyers!
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsConnectModalOpen(true)}
                    style={{
                      padding: '10px 20px', borderRadius: 10, background: '#6366f1',
                      color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    🔗 Connect Your Broker Account
                  </button>
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={TABLE_HEADER}>Instrument</th>
                        <th style={TABLE_HEADER}>Qty</th>
                        <th style={TABLE_HEADER}>Avg Price</th>
                        <th style={TABLE_HEADER}>LTP</th>
                        <th style={TABLE_HEADER}>Cur. Value</th>
                        <th style={TABLE_HEADER}>P&amp;L</th>
                        <th style={TABLE_HEADER}>P&amp;L %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdingsData.holdings.map((h, i) => (
                        <tr key={i}>
                          <td style={{ ...TABLE_CELL, fontWeight: 700 }}>{h.symbol}</td>
                          <td style={TABLE_CELL}>{h.qty}</td>
                          <td style={TABLE_CELL}>₹{h.avgPrice}</td>
                          <td style={TABLE_CELL}>₹{h.ltp}</td>
                          <td style={TABLE_CELL}>₹{h.currentValue.toLocaleString('en-IN')}</td>
                          <td style={{ ...TABLE_CELL, color: pnlColor(h.pnl), fontWeight: 700 }}>
                            {fmtRs(h.pnl)}
                          </td>
                          <td style={{ ...TABLE_CELL, color: pnlColor(h.pnlPct), fontWeight: 700 }}>
                            {h.pnlPct >= 0 ? '+' : ''}{h.pnlPct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: Positions ────────────────────────────────────────────────── */}
      {tab === 'positions' && (
        <div>
          {positionsData.error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13, marginBottom: 16 }}>
              ⚠️ {positionsData.error}
            </div>
          )}

          {positionsData.positions.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
              No open intraday or F&amp;O positions.
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={TABLE_HEADER}>Instrument</th>
                    <th style={TABLE_HEADER}>Product</th>
                    <th style={TABLE_HEADER}>Side</th>
                    <th style={TABLE_HEADER}>Qty</th>
                    <th style={TABLE_HEADER}>Avg Price</th>
                    <th style={TABLE_HEADER}>LTP</th>
                    <th style={TABLE_HEADER}>Unrealized P&amp;L</th>
                  </tr>
                </thead>
                <tbody>
                  {positionsData.positions.map((p, i) => (
                    <tr key={i}>
                      <td style={{ ...TABLE_CELL, fontWeight: 700 }}>{p.symbol}</td>
                      <td style={TABLE_CELL}>{p.product}</td>
                      <td style={{ ...TABLE_CELL, color: p.side === 'BUY' ? '#34d399' : '#f87171', fontWeight: 700 }}>
                        {p.side}
                      </td>
                      <td style={TABLE_CELL}>{p.qty}</td>
                      <td style={TABLE_CELL}>₹{p.avgPrice}</td>
                      <td style={TABLE_CELL}>₹{p.ltp}</td>
                      <td style={{ ...TABLE_CELL, color: pnlColor(p.unrealizedPnl), fontWeight: 700 }}>
                        {fmtRs(p.unrealizedPnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Paper ────────────────────────────────────────────────────── */}
      {tab === 'paper' && (
        <div>
          {/* Summary Banner */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 14, marginBottom: 20,
          }}>
            {[
              { label: 'Paper P&L', value: fmtRs(paperData.summary.totalPnL || 0), color: pnlColor(paperData.summary.totalPnL || 0) },
              { label: 'Win Rate', value: `${paperData.summary.winRate || 0}%`, color: '#60a5fa' },
              { label: 'Total Trades', value: paperData.summary.totalTrades || 0, color: '#a78bfa' },
              { label: 'Avg R-Multiple', value: paperData.summary.avgRMultiple || 0, color: '#34d399' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {paperData.trades.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
              No paper trades executed yet. Run a backtest or execute manual trades to test strategies!
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={TABLE_HEADER}>Symbol</th>
                    <th style={TABLE_HEADER}>Side</th>
                    <th style={TABLE_HEADER}>Qty</th>
                    <th style={TABLE_HEADER}>Entry</th>
                    <th style={TABLE_HEADER}>Exit</th>
                    <th style={TABLE_HEADER}>Net P&amp;L</th>
                    <th style={TABLE_HEADER}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paperData.trades.map((t, i) => (
                    <tr key={i}>
                      <td style={{ ...TABLE_CELL, fontWeight: 700 }}>{t.symbol}</td>
                      <td style={{ ...TABLE_CELL, color: t.side === 'BUY' ? '#34d399' : '#f87171', fontWeight: 700 }}>
                        {t.side}
                      </td>
                      <td style={TABLE_CELL}>{t.qty}</td>
                      <td style={TABLE_CELL}>₹{t.entryPrice}</td>
                      <td style={TABLE_CELL}>{t.exitPrice ? `₹${t.exitPrice}` : '-'}</td>
                      <td style={{ ...TABLE_CELL, color: pnlColor(t.netPnl), fontWeight: 700 }}>
                        {fmtRs(t.netPnl)}
                      </td>
                      <td style={TABLE_CELL}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: t.status === 'OPEN' ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)',
                          color: t.status === 'OPEN' ? '#34d399' : 'var(--muted)'
                        }}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Connect Broker Modal */}
      <ConnectBrokerModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        onSuccess={(brokerName, mode) => {
          loadPortfolioData();
        }}
      />
    </div>
  );
}
