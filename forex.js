// ======================================================
//  📊 MODULE FOREX SIGNAL - GRATIS (Tanpa API Key)
// ======================================================
//  Mengambil data historis dari Frankfurter API (ECB)
//  dan Yahoo Finance (untuk commodity & index).
//  Signal trading berbasis indikator SMA crossover + RSI.
//  Support Multi-Timeframe + 3 Mode (Scalping/Swing/Intraday).
//
//  PASANG PAIR YANG DIDUKUNG:
//  Forex  : EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD,
//           NZDUSD, EURJPY, GBPJPY, EURGBP, AUDJPY, EURCHF
//  Logam  : XAUUSD (Gold)
//  Index  : NASDAQ (US100), SPX (S&P 500), DJI (Dow Jones)
// ======================================================

// Import helper untuk analisa trend (untuk entry timing M3/M5)
const { analyzeTrend } = require('./timeframe');

// ======================================================
//  🎯 KONFIGURASI MODE TRADING
// ======================================================
//  Setiap mode punya setting SL/TP/entry berbeda
const TRADING_MODES = {
  scalping: {
    name: '⚡ SCALPING',
    description: 'Entry presisi M3/M5, TP kecil, SL ketat. Cocok untuk trading cepat.',
    slMultiplier: 0.8,    // SL lebih ketat
    tp1Multiplier: 0.6,   // TP1 dekat
    tp2Multiplier: 1.2,   // TP2 sedang
    tp3Multiplier: 1.8,   // TP3 agak jauh
    timeInTrade: '1-15 menit',
    bestFor: 'Market tenang/trending, volatilitas rendah-sedang'
  },
  intraday: {
    name: '⏱️ INTRADAY',
    description: 'Entry di M15-H1, TP sedang, hold dalam hitungan jam. Balance scalping & swing.',
    slMultiplier: 1.2,
    tp1Multiplier: 1.0,
    tp2Multiplier: 1.8,
    tp3Multiplier: 2.8,
    timeInTrade: '1-4 jam',
    bestFor: 'Day trading, market trending jelas'
  },
  swing: {
    name: '🔄 SWING',
    description: 'Entry di H4-D1, TP besar, hold berhari-hari. Untuk trading santai.',
    slMultiplier: 2.0,    // SL longgar
    tp1Multiplier: 1.5,
    tp2Multiplier: 3.0,
    tp3Multiplier: 5.0,
    timeInTrade: '1-7 hari',
    bestFor: 'Market trending kuat, fundamental jelas'
  }
};

// Daftar pair forex yang didukung
const SUPPORTED_PAIRS = [
  // Forex
  { symbol: 'EURUSD', base: 'EUR', quote: 'USD', display: 'EUR/USD', source: 'frankfurter' },
  { symbol: 'GBPUSD', base: 'GBP', quote: 'USD', display: 'GBP/USD', source: 'frankfurter' },
  { symbol: 'USDJPY', base: 'USD', quote: 'JPY', display: 'USD/JPY', source: 'frankfurter' },
  { symbol: 'USDCHF', base: 'USD', quote: 'CHF', display: 'USD/CHF', source: 'frankfurter' },
  { symbol: 'AUDUSD', base: 'AUD', quote: 'USD', display: 'AUD/USD', source: 'frankfurter' },
  { symbol: 'USDCAD', base: 'USD', quote: 'CAD', display: 'USD/CAD', source: 'frankfurter' },
  { symbol: 'NZDUSD', base: 'NZD', quote: 'USD', display: 'NZD/USD', source: 'frankfurter' },
  { symbol: 'EURJPY', base: 'EUR', quote: 'JPY', display: 'EUR/JPY', source: 'frankfurter' },
  { symbol: 'GBPJPY', base: 'GBP', quote: 'JPY', display: 'GBP/JPY', source: 'frankfurter' },
  { symbol: 'EURGBP', base: 'EUR', quote: 'GBP', display: 'EUR/GBP', source: 'frankfurter' },
  { symbol: 'AUDJPY', base: 'AUD', quote: 'JPY', display: 'AUD/JPY', source: 'frankfurter' },
  { symbol: 'EURCHF', base: 'EUR', quote: 'CHF', display: 'EUR/CHF', source: 'frankfurter' },
  // Commodity & Index (via Yahoo Finance)
  // XAU/USD SPOT forex (bukan futures) - lebih akurat untuk trader forex
  { symbol: 'XAUUSD', base: 'XAU', quote: 'USD', display: 'XAU/USD (Gold Spot)', source: 'yahoo', yahooSymbol: 'GC=F' },
  { symbol: 'NASDAQ', base: 'IXIC', quote: 'USD', display: 'NASDAQ (US100)', source: 'yahoo', yahooSymbol: '^IXIC' },
  { symbol: 'SPX',    base: 'GSPC', quote: 'USD', display: 'S&P 500',        source: 'yahoo', yahooSymbol: '^GSPC' },
  { symbol: 'DJI',    base: 'DJI',  quote: 'USD', display: 'Dow Jones',       source: 'yahoo', yahooSymbol: '^DJI' }
];

// Cari object pair dari simbol (case-insensitive, tanpa slash)
function findPair(symbolInput) {
  const normalized = symbolInput.toUpperCase().replace('/', '').replace('-', '').trim();
  return SUPPORTED_PAIRS.find(p => p.symbol === normalized);
}

// Ambil harga REAL-TIME dari Fawaz (SPOT, no key)
// - Forex & XAUUSD: Fawaz currency-api
// - Index: Yahoo Finance quote endpoint
async function getRealtimePrice(pair) {
  try {
    // KHUSUS XAUUSD & semua pair forex/non-yahoo: pakai Fawaz (SPOT)
    if (pair.source !== 'yahoo' || pair.symbol === 'XAUUSD') {
      // Tentukan base & quote yang dipakai di Fawaz
      let base, quote;
      if (pair.symbol === 'XAUUSD') {
        base = 'XAU'; quote = 'USD';
      } else {
        base = pair.base; quote = pair.quote;
      }
      const baseLow = base.toLowerCase();
      const quoteLow = quote.toLowerCase();
      const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${baseLow}.json`;
      const fetchRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!fetchRes.ok) return null;
      const data = await fetchRes.json();
      if (data[baseLow] && data[baseLow][quoteLow]) {
        return {
          price: data[baseLow][quoteLow],
          previousClose: null,
          source: `fawazahmed0 (SPOT ${base}/${quote})`
        };
      }
      return null;
    }

    if (pair.source === 'yahoo') {
      // Untuk index - pakai Yahoo Finance quote endpoint
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(pair.yahooSymbol)}?interval=1m&range=1d`;
      const fetchRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!fetchRes.ok) return null;
      const data = await fetchRes.json();
      const meta = data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;
      if (meta && meta.regularMarketPrice) {
        return {
          price: meta.regularMarketPrice,
          previousClose: meta.chartPreviousClose || meta.previousClose,
          source: 'yahoo-realtime'
        };
      }
    }
  } catch (err) {
    console.error('Realtime price error:', err.message);
    return null;
  }
  return null;
}

// ======================================================
//  📡 SUMBER DATA FOREX: FAWAZ CURRENCY-API (SPOT)
// ======================================================
//  Menggunakan https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api
//  - SPOT forex (bukan futures, bukan synthetic)
//  - GRATIS, tanpa API key
//  - Support historical per tanggal (CDN cached)
//  - Update harian, data lengkap (EUR, GBP, JPY, CHF, AUD, CAD, NZD, XAU, XAG)
//  - Pakai base = BASE currency, quote = currency yang dibandingkan
//
//  CATATAN: API ini memberikan rate "1 BASE = ? USD" atau "1 BASE = ? QUOTE"
//  Jadi untuk pair EUR/USD: ambil 1 EUR = ? USD → langsung dapat harga
//  Untuk pair USD/JPY: ambil 1 USD = ? JPY → langsung dapat harga
//  Untuk pair EUR/JPY: perlu cross rate (EUR/USD × USD/JPY)
// ======================================================

// Ambil rate per tanggal dari Fawaz (spot, no key)
async function getFawazRateAtDate(date, base, quote) {
  // base/quote lowercase untuk URL
  const baseLow = base.toLowerCase();
  const quoteLow = quote.toLowerCase();
  const dateStr = date.toISOString().split('T')[0];
  const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/${baseLow}.json`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return null;
    const data = await r.json();
    return data[baseLow] && data[baseLow][quoteLow] ? data[baseLow][quoteLow] : null;
  } catch (e) {
    return null;
  }
}

// Ambil data historis 30 hari dari Fawaz (spot forex, no key)
async function getFrankfurterRates(base, quote) {
  const prices = [];
  const endDate = new Date();
  // Ambil 30 hari ke belakang (skip weekend mungkin tidak ada data)
  for (let i = 30; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - i);
    const rate = await getFawazRateAtDate(d, base, quote);
    if (rate !== null) prices.push(rate);
    // Small delay supaya tidak kena rate limit CDN
    await new Promise(r => setTimeout(r, 100));
  }
  return prices.length >= 20 ? prices : null;
}

// Ambil data historis 30 hari dari Yahoo Finance (gratis, tanpa API key)
// Pakai endpoint chart publik: https://query1.finance.yahoo.com/v8/finance/chart/<SYMBOL>
async function getYahooRates(yahooSymbol) {
  const endTimestamp = Math.floor(Date.now() / 1000);
  const startTimestamp = endTimestamp - (60 * 24 * 60 * 60); // 60 hari

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?period1=${startTimestamp}&period2=${endTimestamp}&interval=1d`;

  try {
    const fetchRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
    const data = await fetchRes.json();
    const result = data.chart && data.chart.result && data.chart.result[0];
    if (!result || !result.indicators || !result.indicators.adjclose) {
      throw new Error('No data');
    }
    // adjclose[0].adjclose = array harga
    const prices = result.indicators.adjclose[0].adjclose.filter(p => p !== null);
    return prices.length > 0 ? prices : null;
  } catch (err) {
    console.error('Error fetching Yahoo data:', err.message);
    return null;
  }
}

// Dispatch ke source yang sesuai (frankfurter atau yahoo)
async function getHistoricalRates(pair) {
  if (pair.source === 'yahoo') {
    return getYahooRates(pair.yahooSymbol);
  }
  return getFrankfurterRates(pair.base, pair.quote);
}

// Hitung Simple Moving Average
function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

// Hitung RSI sederhana (14 periode)
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  // Hitung rata-rata gain/loss awal
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Tentukan signal berdasarkan SMA & RSI
// ATURAN:
// 1. RSI extremes (overbought/oversold) = signal Kuat
// 2. SMA7 vs SMA21 (crossover) = signal Sedang
// 3. Posisi harga vs SMA7 = konfirmasi (bullish jika di atas, bearish jika di bawah)
// 4. Jika SMA7 > SMA21 tapi harga di bawah SMA7 = konfirmasi lemah (retracement)
// 5. Jika SMA7 < SMA21 tapi harga di atas SMA7 = rebound (signal tidak valid)
function generateSignal(prices) {
  const sma7 = calculateSMA(prices, 7);   // short-term
  const sma21 = calculateSMA(prices, 21); // long-term
  const rsi = calculateRSI(prices, 14);
  const currentPrice = prices[prices.length - 1];

  let signal = 'NETRAL';
  let strength = 'Lemah';
  let reason = [];

  // === STEP 1: Cek posisi harga vs SMA (paling penting untuk akurasi) ===
  const priceAboveSma7 = currentPrice > sma7;
  const priceAboveSma21 = currentPrice > sma21;

  // === STEP 2: Cek RSI extremes dulu (overbought/oversold) ===
  if (rsi > 70) {
    signal = 'SELL';
    strength = 'Kuat';
    reason.push(`RSI ${rsi.toFixed(1)} (overbought)`);
  } else if (rsi < 30) {
    signal = 'BUY';
    strength = 'Kuat';
    reason.push(`RSI ${rsi.toFixed(1)} (oversold)`);
  }

  // === STEP 3: Cek SMA crossover + konfirmasi posisi harga ===
  if (sma7 > sma21) {
    // SMA7 > SMA21 = uptrend dominan
    if (priceAboveSma7 && priceAboveSma21) {
      // Konfirmasi penuh: harga di atas kedua SMA
      if (signal !== 'SELL') {
        signal = 'BUY';
        strength = signal === 'NETRAL' ? 'Kuat' : strength; // upgrade strength
        reason.push(`SMA7 > SMA21 + harga di atas SMA7/SMA21 (bullish kuat)`);
      } else {
        reason.push(`SMA7 > SMA21 (konflik dgn RSI overbought)`);
        strength = 'Sedang';
      }
    } else if (!priceAboveSma7) {
      // SMA7 > SMA21 tapi harga di bawah SMA7 = PULLBACK/RETRACEMENT
      // Ini SELL signal (tren masih up tapi harga koreksi dulu)
      if (signal === 'NETRAL') {
        signal = 'SELL';
        strength = 'Sedang';
        reason.push(`Pullback: SMA7 > SMA21 tapi harga di bawah SMA7 (koreksi)`);
      } else {
        reason.push(`SMA7 > SMA21 tapi harga pullback ke bawah SMA7`);
      }
    }
  } else if (sma7 < sma21) {
    // SMA7 < SMA21 = downtrend dominan
    if (!priceAboveSma7 && !priceAboveSma21) {
      // Konfirmasi penuh: harga di bawah kedua SMA
      if (signal !== 'BUY') {
        signal = 'SELL';
        strength = signal === 'NETRAL' ? 'Kuat' : strength;
        reason.push(`SMA7 < SMA21 + harga di bawah SMA7/SMA21 (bearish kuat)`);
      } else {
        reason.push(`SMA7 < SMA21 (konflik dgn RSI oversold)`);
        strength = 'Sedang';
      }
    } else if (priceAboveSma7) {
      // SMA7 < SMA21 tapi harga rebound di atas = BOUNCE
      // Ini BUY signal (rebound di tengah downtrend)
      if (signal === 'NETRAL') {
        signal = 'BUY';
        strength = 'Lemah';
        reason.push(`Bounce: SMA7 < SMA21 tapi harga rebound di atas SMA7`);
      } else {
        reason.push(`SMA7 < SMA21 tapi harga rebound di atas SMA7`);
      }
    }
  }

  // Tentukan level Support/Resistance sederhana
  const recentPrices = prices.slice(-7);
  const resistance = Math.max(...recentPrices);
  const support = Math.min(...recentPrices);

  // === KETERANGAN HARGA ===
  // Perubahan harga 1 hari (%)
  const price1dAgo = prices[prices.length - 2] || currentPrice;
  const priceChange1d = ((currentPrice - price1dAgo) / price1dAgo) * 100;

  // Perubahan harga 7 hari (%)
  const price7dAgo = prices[prices.length - 8] || currentPrice;
  const priceChange7d = ((currentPrice - price7dAgo) / price7dAgo) * 100;

  // High/Low 7 hari
  const last7 = prices.slice(-7);
  const high7d = Math.max(...last7);
  const low7d = Math.min(...last7);

  return {
    signal,
    strength,
    reason,
    currentPrice,
    sma7,
    sma21,
    rsi,
    resistance,
    support,
    priceChange1d,
    priceChange7d,
    high7d,
    low7d
  };
}

// Hitung ATR (Average True Range) sederhana - untuk SL/TP
function calculateATR(prices, period = 14) {
  if (prices.length < period + 1) return null;
  const ranges = [];
  for (let i = prices.length - period; i < prices.length; i++) {
    const tr = Math.abs(prices[i] - prices[i - 1]);
    ranges.push(tr);
  }
  return ranges.reduce((a, b) => a + b, 0) / ranges.length;
}

// Hitung Zone Entry, Stop Loss, Take Profit (3 level)
// Mendukung mode scalping/intraday/swing
// Untuk scalping: gunakan M5 high/low sebagai referensi zona entry presisi
function calculateZones(signal, currentPrice, atr, mode = 'intraday', m5Data = null) {
  // === KONFIGURASI SL/TP BARU ===
  // SL: 50 pips dari zona entry
  // TP: Risk:Reward 1:2 (TP = 2x SL)
  const SL_PIPS = 50; // 50 pips

  // Tentukan pip value (1 pip = 0.0001 untuk forex, 0.01 untuk JPY & XAUUSD)
  const isJPYorGold = currentPrice > 100; // JPY pairs & XAUUSD pakai 2 desimal
  const pipValue = isJPYorGold ? 0.01 : 0.0001;

  // SL distance = 50 pips
  const slDistance = SL_PIPS * pipValue;
  // TP dengan R:R 1:2 → TP = 2x SL = 100 pips
  const tp1Distance = slDistance * 2.0;  // R:R 1:2

  const modeConfig = TRADING_MODES[mode] || TRADING_MODES.intraday;
  const decimals = currentPrice > 100 ? 2 : 5;

  // Hitung Risk:Reward ratio (harus 1:2)
  const rr1 = (tp1Distance / slDistance).toFixed(1);

  // === UNTUK SCALPING: Tambahkan zona M5 spesifik ===
  let m5Zones = null;
  if (mode === 'scalping' && m5Data && m5Data.prices && m5Data.prices.length >= 20) {
    // Hitung high/low M5 terakhir (10-20 bar terakhir)
    const recentM5 = m5Data.prices.slice(-30);
    const m5High = Math.max(...recentM5);
    const m5Low = Math.min(...recentM5);
    const m5Pivot = (m5High + m5Low + recentM5[recentM5.length - 1]) / 3;

    // M5 Support/Resistance
    const m5Resistance1 = m5High;
    const m5Support1 = m5Low;

    // M5 Entry zones (berdasarkan Fibonacci retracement dari range M5)
    const fibLevels = [0.382, 0.5, 0.618]; // Golden ratio untuk entry presisi
    m5Zones = {
      high: m5High,
      low: m5Low,
      pivot: m5Pivot,
      resistance1: m5Resistance1,
      support1: m5Support1,
      fibEntries: fibLevels.map(fib => {
        // Untuk BUY, entry di retracement down
        // Untuk SELL, entry di retracement up
        if (signal === 'BUY') {
          return {
            level: (fib * 100).toFixed(1) + '%',
            price: (m5High - (m5High - m5Low) * fib).toFixed(decimals),
            note: 'Buy di pullback'
          };
        } else {
          return {
            level: (fib * 100).toFixed(1) + '%',
            price: (m5Low + (m5High - m5Low) * fib).toFixed(decimals),
            note: 'Sell di retracement'
          };
        }
      })
    };
  }

  let zones = {};
  if (signal === 'BUY') {
    // Untuk scalping: entry ideal di M5 support/fib
    let entryPrice = currentPrice;
    if (m5Zones) {
      // Ambil fib 50% sebagai entry ideal (mid-range pullback)
      const idealFib = m5Zones.fibEntries.find(e => e.level === '50.0%');
      if (idealFib) entryPrice = parseFloat(idealFib.price);
    }

    // SL 50 pips dari entry price
    const slPrice = entryPrice - slDistance;
    // TP R:R 1:2 = 100 pips dari entry
    const tp1Price = entryPrice + tp1Distance;

    zones = {
      entry: {
        ideal: entryPrice.toFixed(decimals),
        aggressive: (currentPrice * 1.0005).toFixed(decimals),  // langsung di market
        conservative: m5Zones ? m5Zones.fibEntries[2].price : (currentPrice * 0.999).toFixed(decimals)  // pullback dalam
      },
      stopLoss: slPrice.toFixed(decimals),
      stopLossPips: SL_PIPS,
      takeProfit: [
        { level: 'TP1', price: tp1Price.toFixed(decimals), rr: `1:${rr1}` }
      ]
    };

    // Tambahkan M5 reference zones
    if (m5Zones) {
      zones.m5Reference = {
        m5High: m5Zones.high.toFixed(decimals),
        m5Low: m5Zones.low.toFixed(decimals),
        m5Pivot: m5Zones.pivot.toFixed(decimals),
        fibEntries: m5Zones.fibEntries,
        note: 'Entry berdasarkan Fibonacci retracement M5'
      };
    }
  } else if (signal === 'SELL') {
    // Untuk SELL: entry ideal di atas harga (resistance area / upper fib)
    let entryPrice = currentPrice;
    if (m5Zones) {
      // Untuk SELL, ideal entry di upper fib 50% (retracement up sebelum turun)
      const idealFib = m5Zones.fibEntries.find(e => e.level === '50.0%');
      if (idealFib) {
        const fibPrice = parseFloat(idealFib.price);
        // Hanya pakai kalau fib di atas current price (retracement ke atas)
        if (fibPrice > currentPrice) entryPrice = fibPrice;
      }
    }

    // SL 50 pips di atas entry price (karena SELL)
    const slPrice = entryPrice + slDistance;
    // TP R:R 1:2 = 100 pips di bawah entry
    const tp1Price = entryPrice - tp1Distance;

    zones = {
      entry: {
        ideal: entryPrice.toFixed(decimals),
        aggressive: (currentPrice * 0.9995).toFixed(decimals),  // langsung di market
        conservative: m5Zones ? m5Zones.fibEntries[0].price : (currentPrice * 1.001).toFixed(decimals)  // pullback ke atas
      },
      stopLoss: slPrice.toFixed(decimals),
      stopLossPips: SL_PIPS,
      takeProfit: [
        { level: 'TP1', price: tp1Price.toFixed(decimals), rr: `1:${rr1}` }
      ]
    };

    if (m5Zones) {
      zones.m5Reference = {
        m5High: m5Zones.high.toFixed(decimals),
        m5Low: m5Zones.low.toFixed(decimals),
        m5Pivot: m5Zones.pivot.toFixed(decimals),
        fibEntries: m5Zones.fibEntries,
        note: 'Entry berdasarkan Fibonacci retracement M5'
      };
    }
  } else {
    zones = null;
  }

  return zones;
}

// Hitung Probability Score (0-100%)
// mtf = { confluence: { bias, score, aligned, total }, analysis: {...} }
function calculateProbability(analysis, fundamental, regime, volatility, m5Confirmation = null, mtf = null) {
  let score = 50; // baseline

  // 1. RSI contribution (max ±15)
  if (analysis.rsi > 70 || analysis.rsi < 30) {
    score += 15; // extreme RSI = strong signal
  } else if (analysis.rsi > 60 || analysis.rsi < 40) {
    score += 8;
  } else if (analysis.rsi > 50 && analysis.rsi < 60) {
    score += 3; // mildly bullish
  } else if (analysis.rsi < 50 && analysis.rsi > 40) {
    score -= 3;
  }

  // 2. SMA alignment (max ±10) - hanya valid jika posisi harga konfirm
  const smaDiff = ((analysis.sma7 - analysis.sma21) / analysis.sma21) * 100;
  if (Math.abs(smaDiff) > 0.5) {
    const priceAboveSma7 = analysis.currentPrice > analysis.sma7;
    if (analysis.signal === 'BUY' && smaDiff > 0 && priceAboveSma7) score += 10;
    else if (analysis.signal === 'SELL' && smaDiff < 0 && !priceAboveSma7) score += 10;
    else if (analysis.signal === 'BUY' && smaDiff < 0) score -= 5; // sinyal vs SMA beda
    else if (analysis.signal === 'SELL' && smaDiff > 0) score -= 5;
  }

  // 3. Trend alignment (max ±10)
  if (analysis.signal === 'BUY' && regime === 'TRENDING_UP') score += 10;
  if (analysis.signal === 'SELL' && regime === 'TRENDING_DOWN') score += 10;
  if (analysis.signal === 'BUY' && regime === 'TRENDING_DOWN') score -= 8; // sinyal melawan trend
  if (analysis.signal === 'SELL' && regime === 'TRENDING_UP') score -= 8;
  if (regime === 'RANGING') score -= 5; // ranging = tidak ada trend

  // 4. Fundamental bias (max ±10)
  if (analysis.signal === 'BUY' && fundamental.bias === 'BULLISH') score += 10;
  if (analysis.signal === 'SELL' && fundamental.bias === 'BEARISH') score += 10;
  if (analysis.signal === 'BUY' && fundamental.bias === 'BEARISH') score -= 7;
  if (analysis.signal === 'SELL' && fundamental.bias === 'BULLISH') score -= 7;

  // 5. Volatility (max ±5) - volatilitas tinggi = kurang pasti
  if (volatility.level === 'HIGH') score -= 5;
  if (volatility.level === 'LOW') score += 3;

  // 6. M5 KONFIRMASI (max ±15) - validasi entry di timeframe kecil
  if (m5Confirmation) {
    if (m5Confirmation.status === 'CONFIRM') {
      score += 12; // M5 konfirmasi → signal kuat
    } else if (m5Confirmation.status === 'CONFLICT') {
      score -= 15; // M5 kontradiksi → jangan entry
    }
    // M5 RSI extreme untuk validasi
    if (m5Confirmation.m5RSI > 70 || m5Confirmation.m5RSI < 30) {
      score += 3; // M5 juga overbought/oversold, tambah keyakinan
    }
  }

  // 7. MTF CONFLUENCE (max ±20) - BOBOT TERBESAR, sinyal harus searah mayoritas TF
  if (mtf && mtf.confluence) {
    const c = mtf.confluence;
    const expectedBias = analysis.signal === 'BUY' ? 'BULLISH' : analysis.signal === 'SELL' ? 'BEARISH' : 'NEUTRAL';
    if (c.bias === expectedBias && expectedBias !== 'NEUTRAL') {
      // Signal searah MTF
      if (c.score >= 80) score += 20;      // 4-5 TF searah = signal sangat kuat
      else if (c.score >= 60) score += 12; // 3 TF searah
      else if (c.score >= 40) score += 5;  // 2 TF searah
    } else if (c.bias !== 'NEUTRAL' && expectedBias !== 'NEUTRAL' && c.bias !== expectedBias) {
      // Signal BERTENTANGAN dengan MTF → penalty BESAR
      if (c.score >= 80) score -= 25;      // 4-5 TF berlawanan = jangan entry
      else if (c.score >= 60) score -= 18; // 3 TF berlawanan
      else if (c.score >= 40) score -= 10; // 2 TF berlawanan
    }
  }

  // Clamp 5-95
  return Math.max(5, Math.min(95, Math.round(score)));
}

// Format hasil signal jadi pesan Telegram
function formatSignalMessage(pair, analysis, fundamental, zones, probability, mode, mtf, m5Confirmation) {
  const isJPY = pair.quote === 'JPY';
  const decimalPlaces = isJPY ? 3 : 5;
  const modeConfig = TRADING_MODES[mode] || TRADING_MODES.intraday;

  const signalEmoji = {
    'BUY': '🟢',
    'SELL': '🔴',
    'NETRAL': '🟡'
  }[analysis.signal];

  // Probability bar visual
  const filled = Math.round(probability / 10);
  const empty = 10 - filled;
  const probBar = '▓'.repeat(filled) + '░'.repeat(empty);

  let probLabel = 'RENDAH';
  if (probability >= 75) probLabel = 'TINGGI';
  else if (probability >= 55) probLabel = 'SEDANG';

  // Emoji M5 confirmation
  const m5Emoji = m5Confirmation
    ? (m5Confirmation.status === 'CONFIRM' ? '✅' : m5Confirmation.status === 'CONFLICT' ? '⚠️' : '➖')
    : '➖';
  const m5Status = m5Confirmation
    ? (m5Confirmation.status === 'CONFIRM' ? 'MENGKONFIRMASI' : m5Confirmation.status === 'CONFLICT' ? 'BERTENTANGAN' : 'NETRAL')
    : 'TIDAK ADA DATA';

  const lines = [];
  lines.push(`📊 *SIGNAL: ${pair.display}*`);
  lines.push(`🎯 *Mode: ${modeConfig.name}*`);
  lines.push(`⏰ Hold time: ${modeConfig.timeInTrade}`);
  lines.push('');
  lines.push(`${signalEmoji} *Signal: ${analysis.signal}*`);
  lines.push(`💪 Kekuatan Teknis: ${analysis.strength}`);
  lines.push(`🎯 *Probability: ${probability}%* [${probBar}] ${probLabel}`);
  lines.push('');

  // === MTF CONFLUENCE ===
  if (mtf && mtf.confluence && mtf.confluence.score > 0) {
    const mtfEmoji = mtf.confluence.score >= 80 ? '🔥' : mtf.confluence.score >= 60 ? '✨' : '⚠️';
    lines.push(`${mtfEmoji} *MTF Confluence: ${mtf.confluence.score}%* (${mtf.confluence.aligned}/${mtf.confluence.total} TF searah → ${mtf.confluence.bias})`);

    // Tampilkan trend tiap TF
    const tfLines = [];
    const tfOrder = ['D1', 'H4', 'H1', 'M30', 'M15'];
    for (const tf of tfOrder) {
      const tfData = mtf.analysis[tf];
      if (tfData && tfData.trend && tfData.trend !== 'UNKNOWN') {
        const trendEmoji = tfData.trend === 'BULLISH' ? '🟢' : tfData.trend === 'BEARISH' ? '🔴' : '🟡';
        tfLines.push(`   ${trendEmoji} ${tf}: ${tfData.trend}`);
      }
    }
    if (tfLines.length > 0) {
      lines.push('*Trend per Timeframe:*');
      tfLines.forEach(l => lines.push(l));
    }
    lines.push('');
  }

  // === ZONE ENTRY / SL / TP ===
  if (zones && analysis.signal !== 'NETRAL') {
    lines.push('🎯 *ZONE TRADING (SL 50 pips, TP R:R 1:2):*');
    lines.push(`📍 *Entry:*`);
    lines.push(`   • Ideal: \`${zones.entry.ideal}\``);
    lines.push(`   • Agresif: \`${zones.entry.aggressive}\``);
    lines.push(`   • Konservatif: \`${zones.entry.conservative}\``);
    lines.push(`🛑 *Stop Loss:* \`${zones.stopLoss}\` (50 pips dari entry)`);
    lines.push(`🎯 *Take Profit:*`);
    zones.takeProfit.forEach(tp => {
      lines.push(`   • ${tp.level}: \`${tp.price}\` (R:R ${tp.rr})`);
    });
    lines.push('');

    // === M5 Reference Zones (khusus scalping) ===
    if (zones.m5Reference) {
      lines.push('📊 *M5 Reference Zone:*');
      lines.push(`   • M5 High: \`${zones.m5Reference.m5High}\``);
      lines.push(`   • M5 Low: \`${zones.m5Reference.m5Low}\``);
      lines.push(`   • M5 Pivot: \`${zones.m5Reference.m5Pivot}\``);
      if (zones.m5Reference.fibEntries) {
        lines.push('   • *Fibonacci Entry Levels:*');
        zones.m5Reference.fibEntries.forEach(fib => {
          lines.push(`      - ${fib.level}: \`${fib.price}\` (${fib.note})`);
        });
      }
      lines.push(`   _${zones.m5Reference.note}_`);
      lines.push('');
    }
  }

  // === INDIKATOR TEKNIKAL ===
  lines.push('💰 *Harga Saat Ini:*');
  lines.push(`   \`${analysis.currentPrice.toFixed(decimalPlaces)}\``);
  if (analysis.realtimeSource) {
    lines.push(`   _📡 Real-time (${analysis.realtimeSource})_`);
  } else {
    lines.push(`   _📊 Daily close (kemarin)_`);
  }
  lines.push('');

  // === KETERANGAN HARGA ===
  // Hitung perubahan harga (1 hari, 7 hari) dari data D1
  // Kita gunakan prices array yang sudah di-pass via analysis
  const priceChange1d = (analysis.priceChange1d || 0).toFixed(2);
  const priceChange7d = (analysis.priceChange7d || 0).toFixed(2);
  const priceRange7d = `${analysis.low7d?.toFixed(decimalPlaces)} - ${analysis.high7d?.toFixed(decimalPlaces)}`;

  const changeEmoji1d = analysis.priceChange1d > 0 ? '📈' : analysis.priceChange1d < 0 ? '📉' : '➖';
  const changeEmoji7d = analysis.priceChange7d > 0 ? '📈' : analysis.priceChange7d < 0 ? '📉' : '➖';

  lines.push('💵 *Keterangan Harga:*');
  lines.push(`   ${changeEmoji1d} *24 jam:* ${priceChange1d > 0 ? '+' : ''}${priceChange1d}%`);
  lines.push(`   ${changeEmoji7d} *7 hari:* ${priceChange7d > 0 ? '+' : ''}${priceChange7d}%`);
  lines.push(`   📊 *Range 7 hari:* \`${priceRange7d}\``);
  lines.push(`   📏 *Pip Value:* ${decimalPlaces} angka di belakang koma`);
  lines.push('');

  // === INDIKATOR H1 (UTAMA) ===
  const tfName = analysis.primaryTimeframe || 'D1';
  lines.push(`📈 *Indikator (${tfName}) - Analisa Utama:*`);
  lines.push(`• RSI (14): \`${analysis.rsi.toFixed(1)}\` ${analysis.rsi > 70 ? '(Overbought)' : analysis.rsi < 30 ? '(Oversold)' : '(Netral)'}`);
  lines.push(`• SMA 7: \`${analysis.sma7.toFixed(decimalPlaces)}\` ${analysis.currentPrice > analysis.sma7 ? '(Harga di atas SMA7 = Bullish)' : '(Harga di bawah SMA7 = Bearish)'}`);
  lines.push(`• SMA 21: \`${analysis.sma21.toFixed(decimalPlaces)}\` ${analysis.currentPrice > analysis.sma21 ? '(Harga di atas SMA21 = Bullish)' : '(Harga di bawah SMA21 = Bearish)'}`);
  lines.push('');

  // === M5 KONFIRMASI ENTRY ===
  if (m5Confirmation && m5Confirmation.status !== 'NONE') {
    const confEmoji = m5Confirmation.status === 'CONFIRM' ? '✅' : '⚠️';
    const confText = m5Confirmation.status === 'CONFIRM'
      ? `M5 MENGKONFIRMASI signal ${tfName} → AMAN ENTRY`
      : `M5 BERTENTANGAN dengan signal ${tfName} → TUNGGU!`;

    lines.push(`${confEmoji} *M5 Konfirmasi:* ${confText}`);
    lines.push(`   • ${tfName} signal: ${m5Confirmation.h1Trend}`);
    lines.push(`   • M5 signal: ${m5Confirmation.m5Trend} (RSI ${m5Confirmation.m5RSI?.toFixed(1)})`);
    lines.push('');
  }

  // === ENTRY TIMING (M3/M5) ===
  if (mtf && (mtf.entry.M5 || mtf.entry.M3)) {
    const m5 = mtf.entry.M5;
    const m3 = mtf.entry.M3;
    lines.push('⏱️ *Entry Timing:*');
    if (m5 && m5.bars > 0) {
      const m5Trend = analyzeTrend(m5.prices);
      const m5Emoji = m5Trend.trend === 'BULLISH' ? '🟢' : m5Trend.trend === 'BEARISH' ? '🔴' : '🟡';
      lines.push(`   ${m5Emoji} M5 trend: ${m5Trend.trend} (RSI ${m5Trend.rsi?.toFixed(1)})`);
    }
    if (m3 && m3.bars > 0) {
      const m3Trend = analyzeTrend(m3.prices);
      const m3Emoji = m3Trend.trend === 'BULLISH' ? '🟢' : m3Trend.trend === 'BEARISH' ? '🔴' : '🟡';
      lines.push(`   ${m3Emoji} M3 trend: ${m3Trend.trend} (RSI ${m3Trend.rsi?.toFixed(1)})`);
    }
    if ((!m5 || m5.bars === 0) && (!m3 || m3.bars === 0)) {
      lines.push('   ⚠️ Data intraday tidak tersedia (rate limit)');
      lines.push('   📊 Gunakan chart M3/M5 platform trading Anda');
    }
    lines.push('');
  }

  lines.push('🎯 *Level Support/Resistance:*');
  lines.push(`• Resistance: \`${analysis.resistance.toFixed(decimalPlaces)}\``);
  lines.push(`• Support: \`${analysis.support.toFixed(decimalPlaces)}\``);
  lines.push('');

  // === ANALISA FUNDAMENTAL ===
  lines.push('📰 *Fundamental:*');
  lines.push(`• Market Regime: *${fundamental.regime}*`);
  lines.push(`• Volatilitas: ${fundamental.volatility.level} (${fundamental.volatility.annualized.toFixed(1)}% annualized)`);
  lines.push(`• Bias Fundamental: *${fundamental.bias}* (${fundamental.fundamentalBias}%)`);
  if (fundamental.pairStrength.base !== 0 || fundamental.pairStrength.quote !== 0) {
    lines.push(`• ${pair.base} strength: ${fundamental.pairStrength.base > 0 ? '+' : ''}${fundamental.pairStrength.base.toFixed(2)}%`);
    if (pair.quote !== 'USD' && pair.quote !== pair.base) {
      lines.push(`• ${pair.quote} strength: ${fundamental.pairStrength.quote > 0 ? '+' : ''}${fundamental.pairStrength.quote.toFixed(2)}%`);
    }
  }
  lines.push('');

  // === ALASAN TEKNIKAL ===
  lines.push('📝 *Alasan:*');
  analysis.reason.forEach(r => lines.push(`• ${r}`));
  lines.push('');

  lines.push('💡 *Info Mode:*');
  lines.push(`_${modeConfig.description}_`);
  lines.push(`_${modeConfig.bestFor}_`);
  lines.push('');
  lines.push('⚠️ *Disclaimer:*');
  lines.push('_Signal ini BUKAN saran finansial. Gunakan manajemen risiko yang baik._');

  return lines.join('\n');
}

// Ambil signal untuk satu pair (dengan mode trading)
async function getSignalForPair(symbolInput, mode = 'intraday') {
  const pair = findPair(symbolInput);
  if (!pair) {
    return {
      success: false,
      message: `❌ Pair "${symbolInput}" tidak didukung.\n\nGunakan: /pairs untuk lihat daftar pair yang tersedia.`
    };
  }

  if (!TRADING_MODES[mode]) {
    mode = 'intraday';
  }

  // Ambil data D1 (daily) untuk analisa utama
  const prices = await getHistoricalRates(pair);
  if (!prices || prices.length < 21) {
    return {
      success: false,
      message: '❌ Gagal mengambil data forex. Coba lagi nanti.'
    };
  }

  // === AMBIL DATA UNTUK ANALISA UTAMA ===
  // Strategi TANPA YAHOO (per request user):
  // - SEMUA pair: pakai D1 SPOT dari Fawaz (sudah dari prices = D1 historical)
  //   - Forex: langsung dari Fawaz (D1 spot)
  //   - XAUUSD: D1 spot dari Fawaz XAU/USD
  //   - NASDAQ/SPX/DJI: D1 spot dari Yahoo (satu-satunya free source untuk indeks)
  //     Catatan: Indeks tidak ada di Fawaz, hanya Yahoo yang kasih gratis
  // - MTF (multi-timeframe) dari Yahoo hanya untuk NASDAQ/SPX/DJI (index)
  //   Pair forex & XAUUSD TIDAK pakai Yahoo (sesuai request)
  let mtf = null;
  let primaryTimeframe = 'D1';
  let analysisPrices = prices; // default D1

  // Hanya indeks yang boleh pakai Yahoo (karena tidak ada sumber SPOT gratis lain)
  if (pair.source === 'yahoo' && pair.yahooSymbol && ['NASDAQ', 'SPX', 'DJI'].includes(pair.symbol)) {
    try {
      const tfMod = require('./timeframe');
      mtf = await tfMod.analyzeMTF(pair.yahooSymbol);
      console.log(`✓ MTF loaded for index ${pair.symbol} (Yahoo) - analisa utama tetap D1`);
    } catch (err) {
      console.error('MTF fetch error:', err.message);
    }
  } else {
    console.log(`✓ D1 SPOT bias for ${pair.symbol} (dari Fawaz, tanpa Yahoo)`);
  }

  // Generate analisa dari D1 (analysisPrices = prices dari getHistoricalRates = D1)
  const analysis = generateSignal(analysisPrices);
  analysis.primaryTimeframe = primaryTimeframe;
  analysis.h1Available = false;

  // === AMBIL HARGA REAL-TIME (untuk akurasi) ===
  // Historical price dipakai untuk analisa, real-time price untuk display
  try {
    const realtime = await getRealtimePrice(pair);
    if (realtime && realtime.price) {
      analysis.currentPrice = realtime.price;
      // Update resistance/support juga dengan real-time price
      if (analysis.resistance < realtime.price) analysis.resistance = realtime.price;
      if (analysis.support > realtime.price) analysis.support = realtime.price;
      analysis.realtimeSource = realtime.source;
    }
  } catch (err) {
    console.error('Realtime fetch error:', err.message);
  }

  // Import fundamental module - dengan data H1/D1 (analysisPrices)
  const fundamentalMod = require('./fundamental');
  const fundamental = await fundamentalMod.analyzeFundamental(pair, analysisPrices);

  // === M5 KONFIRMASI UNTUK ENTRY ===
  // Cek apakah M5 mengkonfirmasi signal dari primary TF (H1 atau D1)
  let m5Confirmation = null;
  if (mtf && mtf.entry && mtf.entry.M5 && mtf.entry.M5.prices && mtf.entry.M5.prices.length >= 14) {
    const m5Signal = generateSignal(mtf.entry.M5.prices);
    const m5Trend = m5Signal.signal;
    const primaryTrend = analysis.signal;

    // Hitung apakah M5 konfirmasi atau kontradiksi
    let confirmStatus = 'NONE';
    if (m5Trend === primaryTrend && primaryTrend !== 'NETRAL') {
      confirmStatus = 'CONFIRM'; // M5 searah dengan primary
    } else if (m5Trend !== primaryTrend && m5Trend !== 'NETRAL' && primaryTrend !== 'NETRAL') {
      confirmStatus = 'CONFLICT'; // M5 berlawanan dengan primary
    }

    m5Confirmation = {
      m5Trend,
      h1Trend: primaryTrend,  // keep field name for display compat
      m5RSI: m5Signal.rsi,
      m5Signal,
      status: confirmStatus
    };
  }

  // Hitung zones (dengan mode trading + M5 untuk scalping) - pakai REAL-TIME price
  const atr = calculateATR(analysisPrices, 14);
  const m5Data = mtf && mtf.entry && mtf.entry.M5 ? mtf.entry.M5 : null;
  const zones = calculateZones(analysis.signal, analysis.currentPrice, atr, mode, m5Data);

  // Hitung probability dengan M5 confirmation + MTF confluence
  let probability = calculateProbability(analysis, fundamental, fundamental.regime, fundamental.volatility, m5Confirmation, mtf);

  if (mtf && mtf.confluence && mtf.confluence.score >= 80) {
    // MTF confluence tinggi → probability bonus
    if ((analysis.signal === 'BUY' && mtf.confluence.bias === 'BULLISH') ||
        (analysis.signal === 'SELL' && mtf.confluence.bias === 'BEARISH')) {
      probability = Math.min(95, probability + 10);
    }
  } else if (mtf && mtf.confluence && mtf.confluence.score < 50) {
    // MTF tidak searah → probability penalty
    if ((analysis.signal === 'BUY' && mtf.confluence.bias === 'BEARISH') ||
        (analysis.signal === 'SELL' && mtf.confluence.bias === 'BULLISH')) {
      probability = Math.max(5, probability - 15);
    }
  }

  const message = formatSignalMessage(pair, analysis, fundamental, zones, probability, mode, mtf, m5Confirmation);
  return { success: true, message };
}

// Ambil signal untuk semua pair
async function getAllSignals(mode = 'intraday') {
  const results = [];
  for (const pair of SUPPORTED_PAIRS) {
    try {
      const prices = await getHistoricalRates(pair);
      if (prices && prices.length >= 21) {
        const analysis = generateSignal(prices);
        results.push({ pair, analysis });
      }
    } catch (err) {
      // skip pair yang gagal
    }
  }
  return results;
}

module.exports = {
  SUPPORTED_PAIRS,
  findPair,
  getSignalForPair,
  getAllSignals,
  getRealtimePrice,
  TRADING_MODES
};
