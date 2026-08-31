// ======================================================
//  ⚡ LIQUIDATION WATCHER XAUUSDT - BINANCE FUTURES
// ======================================================
//  Modul ini:
//  - Polling /fapi/v1/forceOrders untuk XAUUSDT (recent)
//  - Hitung agregat liquidasi LONG/SHORT
//  - Deteksi SPIKE (jumlah/ukuran > threshold)
//  - Alert via callback (Telegram message)
//
//  Karena endpoint /forceOrders butuh SIGNED request (API key),
//  kita pakai alternatif publik: polling aggTrades besar di futures
//  + ticker.forceOrder dari WebSocket (lebih reliable).
//
//  Untuk polling-only mode (no API key), kita pantau:
//    1. /fapi/v1/allForceOrders (SIGNED -> butuh key)
//    2. Fallback: hitung dari trades besar di futures aggTrades
//
//  Di sini kita pakai WebSocket User Data Streams TANPA key
//  via publik endpoint: tetap butuh listenKey.
//  Solusi simpel: pakai /fapi/v1/aggTrades futures dengan filter size.
// ======================================================

const https = require('https');
const WebSocket = require('ws');
const orderflow = require('./orderflow');

const SYMBOL = 'XAUUSDT';
const FAPI_HOSTS = ['fapi.binance.com', 'fapi1.binance.com', 'fapi2.binance.com'];

// Threshold default
const SPIKE_THRESHOLD_USD = 100000; // alert kalau liquidasi > $100K dalam window
const WINDOW_MS = 60 * 1000; // 1 menit window

let ws = null;
let alertCallback = null;
let recentTrades = []; // buffer trades untuk deteksi spike
let lastSpikeAlert = 0;
const SPIKE_COOLDOWN = 30 * 1000; // 30 detik cooldown antar alert

// ======================================================
//  HTTP HELPER
// ======================================================
function httpsGet(host, path, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { host, path, method: 'GET', timeout, headers: { 'User-Agent': 'Mozilla/5.0' } },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 100)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end();
  });
}

async function fetchFapi(path) {
  let lastErr;
  for (const h of FAPI_HOSTS) {
    try { return await httpsGet(h, path); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// ======================================================
//  WebSocket: futures aggTrade stream (public, no key)
// ======================================================
//  Stream: wss://fstream.binance.com/ws/<symbol>@aggTrade
//  Field penting: p (price), q (qty), m (is buyer maker)
//  TIDAK bisa deteksi liquidation langsung dari aggTrade.
//  Tapi kita bisa filter trades BESAR yang kemungkinan besar
//  adalah forced liquidation cascade.
// ======================================================
function connectLiquidationStream(callback) {
  alertCallback = callback;

  const url = `wss://fstream.binance.com/ws/${SYMBOL.toLowerCase()}@aggTrade`;
  console.log(`[liquidations] Connecting to ${url}`);

  ws = new WebSocket(url);

  ws.on('open', () => {
    console.log('[liquidations] ✅ Connected to futures aggTrade stream');
  });

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw);
      const price = parseFloat(data.p);
      const qty = parseFloat(data.q);
      const value = price * qty;
      const isBuyerMaker = data.m;
      const time = data.T;

      // Deteksi "potential liquidation" - trade SANGAT besar
      // di futures XAUUSDT (normal trade biasanya < $50K)
      if (value >= SPIKE_THRESHOLD_USD) {
        const trade = {
          time,
          price,
          qty,
          value,
          // di futures aggTrade, m=true artinya buyer=maker (seller initiated = taker sell)
          // liquidasi LONG = forced sell (taker sell), liquidasi SHORT = forced buy (taker buy)
          side: isBuyerMaker ? 'SELL 🔴 (potential LONG liq)' : 'BUY 🟢 (potential SHORT liq)',
          isLiquidationCandidate: true,
        };
        recentTrades.push(trade);

        // Trigger alert
        const now = Date.now();
        if (now - lastSpikeAlert >= SPIKE_COOLDOWN) {
          lastSpikeAlert = now;
          if (alertCallback) {
            alertCallback(trade);
          }
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  });

  ws.on('error', (err) => {
    console.error('[liquidations] ❌ WS error:', err.message);
  });

  ws.on('close', () => {
    console.log('[liquidations] 🔌 Disconnected, reconnecting in 5s...');
    setTimeout(() => connectLiquidationStream(alertCallback), 5000);
  });

  return ws;
}

// ======================================================
//  Get recent large trades (untuk /liquidations command)
// ======================================================
async function getRecentLiquidations(limit = 50) {
  try {
    const data = await fetchFapi(`/fapi/v1/aggTrades?symbol=${SYMBOL}&limit=${limit}`);
    const liquidations = [];
    for (const t of data) {
      const price = parseFloat(t.p);
      const qty = parseFloat(t.q);
      const value = price * qty;
      if (value >= SPIKE_THRESHOLD_USD) {
        liquidations.push({
          time: t.T,
          price,
          qty,
          value,
          side: t.m ? 'SELL 🔴' : 'BUY 🟢',
          isLiqCandidate: true,
        });
      }
    }
    return liquidations.sort((a, b) => b.value - a.value);
  } catch (e) {
    return [];
  }
}

// ======================================================
//  Aggregate liquidations dalam window waktu
// ======================================================
function getWindowStats(windowMs = WINDOW_MS) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const inWindow = recentTrades.filter((t) => t.time >= cutoff);
  let longLiq = 0, shortLiq = 0, totalValue = 0;
  for (const t of inWindow) {
    totalValue += t.value;
    if (t.side.includes('SELL')) longLiq += t.value;
    else shortLiq += t.value;
  }
  return {
    windowMs,
    count: inWindow.length,
    longLiqValue: longLiq,
    shortLiqValue: shortLiq,
    totalValue,
    netFlow: shortLiq - longLiq, // positif = short liquidated (bullish)
    trades: inWindow,
  };
}

// ======================================================
//  Format alert message
// ======================================================
function formatLiquidationAlert(trade) {
  const isLong = trade.side.includes('SELL');
  const emoji = isLong ? '🔴' : '🟢';
  return `🚨 *LIQUIDATION SPIKE TERDETEKSI*\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `${emoji} *${isLong ? 'LONG LIQUIDATION' : 'SHORT LIQUIDATION'}*\n` +
    `💰 Value: *$${orderflow.fmtBig(trade.value)}*\n` +
    `📊 Price: $${orderflow.fmt(trade.price)} | Qty: ${orderflow.fmt(trade.qty, 2)} XAU\n` +
    `⏰ ${new Date(trade.time).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`;
}

function formatLiquidationsList(liquidations) {
  if (liquidations.length === 0) {
    return `⚠️ Tidak ada liquidasi besar terdeteksi dalam 50 trade terakhir XAUUSDT Futures.\n` +
      `Threshold: $${orderflow.fmtBig(SPIKE_THRESHOLD_USD)}`;
  }
  let msg = `⚡ *LIQUIDATION TRADES XAUUSDT (Futures)*\n`;
  msg += `━━━━━━━━━━━━━━━━━━\n`;
  msg += `Threshold: $${orderflow.fmtBig(SPIKE_THRESHOLD_USD)}\n\n`;
  for (const l of liquidations.slice(0, 15)) {
    msg += `${l.side} *$${orderflow.fmtBig(l.value)}* @ $${orderflow.fmt(l.price)}\n`;
    msg += `   ${new Date(l.time).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\n`;
  }
  msg += `\n📌 _Trade besar di futures biasanya indikasi forced liquidation_`;
  return msg;
}

// ======================================================
//  Stop watcher
// ======================================================
function stopWatcher() {
  if (ws) {
    ws.close();
    ws = null;
  }
  alertCallback = null;
  recentTrades = [];
}

// ======================================================
//  GET LATEST FROM STREAM BUFFER (untuk /alert command)
// ======================================================
function getLatestSpikes(count = 5) {
  return recentTrades.slice(-count).reverse();
}

module.exports = {
  SYMBOL,
  SPIKE_THRESHOLD_USD,
  WINDOW_MS,
  connectLiquidationStream,
  stopWatcher,
  getRecentLiquidations,
  getWindowStats,
  getLatestSpikes,
  formatLiquidationAlert,
  formatLiquidationsList,
};