// ======================================================
//  📊 MODULE FOREX SIGNAL - GRATIS (Tanpa API Key)
// ======================================================
//  Mengambil data historis dari Frankfurter API (ECB)
//  dan menghasilkan signal trading sederhana berbasis
//  indikator SMA crossover + RSI.
//
//  PASANG PAIR YANG DIDUKUNG:
//  EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD,
//  NZDUSD, EURJPY, GBPJPY, EURGBP, AUDJPY, EURCHF
// ======================================================

// Daftar pair forex yang didukung
const SUPPORTED_PAIRS = [
  { symbol: 'EURUSD', base: 'EUR', quote: 'USD', display: 'EUR/USD' },
  { symbol: 'GBPUSD', base: 'GBP', quote: 'USD', display: 'GBP/USD' },
  { symbol: 'USDJPY', base: 'USD', quote: 'JPY', display: 'USD/JPY' },
  { symbol: 'USDCHF', base: 'USD', quote: 'CHF', display: 'USD/CHF' },
  { symbol: 'AUDUSD', base: 'AUD', quote: 'USD', display: 'AUD/USD' },
  { symbol: 'USDCAD', base: 'USD', quote: 'CAD', display: 'USD/CAD' },
  { symbol: 'NZDUSD', base: 'NZD', quote: 'USD', display: 'NZD/USD' },
  { symbol: 'EURJPY', base: 'EUR', quote: 'JPY', display: 'EUR/JPY' },
  { symbol: 'GBPJPY', base: 'GBP', quote: 'JPY', display: 'GBP/JPY' },
  { symbol: 'EURGBP', base: 'EUR', quote: 'GBP', display: 'EUR/GBP' },
  { symbol: 'AUDJPY', base: 'AUD', quote: 'JPY', display: 'AUD/JPY' },
  { symbol: 'EURCHF', base: 'EUR', quote: 'CHF', display: 'EUR/CHF' }
];

// Cari object pair dari simbol (case-insensitive, tanpa slash)
function findPair(symbolInput) {
  const normalized = symbolInput.toUpperCase().replace('/', '').replace('-', '').trim();
  return SUPPORTED_PAIRS.find(p => p.symbol === normalized);
}

// Ambil data historis 30 hari dari Frankfurter (gratis, tanpa API key)
// Frankfurter = European Central Bank reference rates
async function getHistoricalRates(base, quote) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30);

  const fmt = (d) => d.toISOString().split('T')[0];
  const url = `https://api.frankfurter.app/${fmt(startDate)}..${fmt(endDate)}?from=${base}&to=${quote}`;

  try {
    const fetchRes = await fetch(url);
    if (!fetchRes.ok) throw new Error(`HTTP ${fetchRes.status}`);
    const data = await fetchRes.json();
    return data.rates ? Object.values(data.rates).map(r => r[quote]) : null;
  } catch (err) {
    console.error('Error fetching forex data:', err.message);
    return null;
  }
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
function generateSignal(prices) {
  const sma7 = calculateSMA(prices, 7);   // short-term
  const sma21 = calculateSMA(prices, 21); // long-term
  const rsi = calculateRSI(prices, 14);
  const currentPrice = prices[prices.length - 1];

  let signal = 'NETRAL';
  let strength = 'Lemah';
  let reason = [];

  // Cek RSI dulu (overbought/oversold)
  if (rsi > 70) {
    signal = 'SELL';
    strength = 'Kuat';
    reason.push(`RSI ${rsi.toFixed(1)} (overbought)`);
  } else if (rsi < 30) {
    signal = 'BUY';
    strength = 'Kuat';
    reason.push(`RSI ${rsi.toFixed(1)} (oversold)`);
  }

  // Cek crossover SMA
  if (sma7 > sma21) {
    if (signal !== 'SELL') {
      signal = 'BUY';
      reason.push(`SMA7 > SMA21 (bullish)`);
    } else {
      reason.push(`SMA7 > SMA21 (konflik dgn RSI)`);
      strength = 'Sedang';
    }
  } else if (sma7 < sma21) {
    if (signal !== 'BUY') {
      signal = 'SELL';
      reason.push(`SMA7 < SMA21 (bearish)`);
    } else {
      reason.push(`SMA7 < SMA21 (konflik dgn RSI)`);
      strength = 'Sedang';
    }
  }

  // Tentukan level Support/Resistance sederhana
  const recentPrices = prices.slice(-7);
  const resistance = Math.max(...recentPrices);
  const support = Math.min(...recentPrices);

  return {
    signal,
    strength,
    reason,
    currentPrice,
    sma7,
    sma21,
    rsi,
    resistance,
    support
  };
}

// Format hasil signal jadi pesan Telegram
function formatSignalMessage(pair, analysis) {
  const isJPY = pair.quote === 'JPY';
  const decimalPlaces = isJPY ? 3 : 5;

  const signalEmoji = {
    'BUY': '🟢',
    'SELL': '🔴',
    'NETRAL': '🟡'
  }[analysis.signal];

  const lines = [];
  lines.push(`📊 *SIGNAL FOREX: ${pair.display}*`);
  lines.push('');
  lines.push(`${signalEmoji} *Signal: ${analysis.signal}*`);
  lines.push(`💪 Kekuatan: ${analysis.strength}`);
  lines.push('');
  lines.push('💰 *Harga Saat Ini:*');
  lines.push(`\`${analysis.currentPrice.toFixed(decimalPlaces)}\``);
  lines.push('');
  lines.push('📈 *Indikator:*');
  lines.push(`• RSI (14): \`${analysis.rsi.toFixed(1)}\``);
  lines.push(`• SMA 7: \`${analysis.sma7.toFixed(decimalPlaces)}\``);
  lines.push(`• SMA 21: \`${analysis.sma21.toFixed(decimalPlaces)}\``);
  lines.push('');
  lines.push('🎯 *Level Penting:*');
  lines.push(`• Resistance: \`${analysis.resistance.toFixed(decimalPlaces)}\``);
  lines.push(`• Support: \`${analysis.support.toFixed(decimalPlaces)}\``);
  lines.push('');
  lines.push('📝 *Alasan:*');
  analysis.reason.forEach(r => lines.push(`• ${r}`));
  lines.push('');
  lines.push('⚠️ *Disclaimer:*');
  lines.push('_Signal ini berdasarkan indikator teknikal sederhana (SMA + RSI). Bukan saran finansial. Trading forex memiliki risiko tinggi. Gunakan manajemen risiko yang baik._');

  return lines.join('\n');
}

// Ambil signal untuk satu pair
async function getSignalForPair(symbolInput) {
  const pair = findPair(symbolInput);
  if (!pair) {
    return {
      success: false,
      message: `❌ Pair "${symbolInput}" tidak didukung.\n\nGunakan: /pairs untuk lihat daftar pair yang tersedia.`
    };
  }

  const prices = await getHistoricalRates(pair.base, pair.quote);
  if (!prices || prices.length < 21) {
    return {
      success: false,
      message: '❌ Gagal mengambil data forex. Coba lagi nanti.'
    };
  }

  const analysis = generateSignal(prices);
  const message = formatSignalMessage(pair, analysis);
  return { success: true, message };
}

// Ambil signal untuk semua pair
async function getAllSignals() {
  const results = [];
  for (const pair of SUPPORTED_PAIRS) {
    try {
      const prices = await getHistoricalRates(pair.base, pair.quote);
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
  getAllSignals
};
