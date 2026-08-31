// ======================================================
//  📊 MODULE MULTI-TIMEFRAME ANALYSIS
// ======================================================
//  Ambil data dari Yahoo Finance untuk berbagai timeframe:
//  - D1 (Daily)
//  - H4 (4 Hour)
//  - H1 (1 Hour)
//  - M30 (30 Min)
//  - M15 (15 Min)
//  - M5  (5 Min)
//  - M3  (3 Min)
//
//  Analisa trend di setiap TF, lalu gabungkan untuk
//  confidence score yang lebih tinggi.
// ======================================================

const https = require('https');

// Mapping timeframe ke Yahoo Finance interval & period
const TIMEFRAMES = {
  D1:  { interval: '1d',  range: '6mo',  label: 'Daily' },
  H4:  { interval: '1h',  range: '60d',  label: '4H (re-sample)' },
  H1:  { interval: '1h',  range: '30d',  label: '1 Hour' },
  M30: { interval: '30m', range: '14d',  label: '30 Min' },
  M15: { interval: '15m', range: '7d',   label: '15 Min' },
  M5:  { interval: '5m',  range: '5d',   label: '5 Min' },
  M3:  { interval: '1m',  range: '2d',   label: '3 Min (proxy 1m)' }
};

// Fetch data dari Yahoo Finance untuk satu timeframe dengan retry
async function fetchYahooInterval(yahooSymbol, interval, range, retries = 2) {
  const endTimestamp = Math.floor(Date.now() / 1000);
  // Range days sebelum now (sedikit buffer)
  const rangeSeconds = {
    '1d': 86400 * 7,
    '5d': 86400 * 7,
    '7d': 86400 * 8,
    '14d': 86400 * 15,
    '30d': 86400 * 31,
    '60d': 86400 * 61,
    '6mo': 86400 * 200
  };
  const startTimestamp = endTimestamp - (rangeSeconds[range] || 86400 * 60);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?period1=${startTimestamp}&period2=${endTimestamp}&interval=${interval}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await new Promise((resolve) => {
      const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode === 429) {
              resolve({ success: false, prices: null, error: 'Rate limit' });
              return;
            }
            const json = JSON.parse(data);
            const r = json.chart && json.chart.result && json.chart.result[0];
            if (!r || !r.indicators) {
              resolve({ success: false, prices: null, error: 'No data' });
              return;
            }
            // Yahoo kadang return 'quote' (close), kadang 'adjclose'
            let prices = null;
            if (r.indicators.adjclose && r.indicators.adjclose[0] && r.indicators.adjclose[0].adjclose) {
              prices = r.indicators.adjclose[0].adjclose.filter(p => p !== null);
            } else if (r.indicators.quote && r.indicators.quote[0] && r.indicators.quote[0].close) {
              prices = r.indicators.quote[0].close.filter(p => p !== null);
            }
            if (!prices || prices.length === 0) {
              resolve({ success: false, prices: null, error: 'Empty data' });
              return;
            }
            resolve({ success: true, prices, count: prices.length });
          } catch (e) {
            resolve({ success: false, prices: null, error: 'Parse error' });
          }
        });
      });
      req.on('error', () => resolve({ success: false, prices: null, error: 'Network' }));
      req.setTimeout(10000, () => { req.destroy(); resolve({ success: false, prices: null, error: 'Timeout' }); });
    });

    if (result.success) return result;
    if (attempt < retries) {
      // Tunggu sebelum retry (rate limit butuh jeda)
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    } else {
      return result;
    }
  }
}

// Re-sample hourly data ke 4H
function resampleTo4H(prices) {
  if (!prices || prices.length < 4) return prices;
  const result = [];
  for (let i = 0; i < prices.length; i += 4) {
    const chunk = prices.slice(i, i + 4);
    result.push(chunk[chunk.length - 1]); // close of last bar
  }
  return result;
}

// Hitung SMA
function calcSMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Hitung RSI
function calcRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
  return 100 - (100 / (1 + rs));
}

// Analisa trend satu timeframe
function analyzeTrend(prices) {
  if (!prices || prices.length < 20) {
    return { trend: 'UNKNOWN', strength: 0 };
  }

  const sma7 = calcSMA(prices, Math.min(7, prices.length - 1));
  const sma21 = calcSMA(prices, Math.min(21, prices.length - 1));
  const rsi = calcRSI(prices) || 50;
  const last = prices[prices.length - 1];

  let trend = 'SIDEWAYS';
  let strength = 0;

  if (sma7 && sma21) {
    if (sma7 > sma21) {
      trend = 'BULLISH';
      strength = ((sma7 - sma21) / sma21) * 100;
    } else if (sma7 < sma21) {
      trend = 'BEARISH';
      strength = ((sma21 - sma7) / sma21) * 100;
    }
  }

  // Konfirmasi dengan RSI
  if (trend === 'BULLISH' && rsi > 70) strength *= 1.2;
  if (trend === 'BEARISH' && rsi < 30) strength *= 1.2;

  return {
    trend,
    strength: Math.min(Math.abs(strength), 5), // cap 5%
    sma7,
    sma21,
    rsi,
    last
  };
}

// Analisa multi-timeframe (D1, H4, H1, M30, M15)
async function analyzeMTF(yahooSymbol) {
  // Timeframe analisis (trend)
  const analysisTfs = ['D1', 'H4', 'H1', 'M30', 'M15'];
  // Timeframe entry (presisi)
  const entryTfs = ['M5', 'M3'];

  const result = {
    analysis: {},  // D1, H4, H1, M30, M15
    entry: {}      // M5, M3
  };

  // Helper: delay
  const sleep = ms => new Promise(res => setTimeout(res, ms));

  // Fetch sequential dengan delay 200ms antar request (hemat rate limit)
  for (const tf of analysisTfs) {
    const config = TIMEFRAMES[tf];
    const fetch = await fetchYahooInterval(yahooSymbol, config.interval, config.range);

    if (!fetch.success) {
      result.analysis[tf] = { error: fetch.error, trend: 'UNKNOWN', label: config.label, bars: 0, prices: null };
    } else {
      let prices = fetch.prices;
      if (tf === 'H4') prices = resampleTo4H(prices);
      const trend = analyzeTrend(prices);
      result.analysis[tf] = { ...trend, label: config.label, bars: prices.length, prices: prices };
    }
    await sleep(200);
  }

  for (const tf of entryTfs) {
    const config = TIMEFRAMES[tf];
    const fetch = await fetchYahooInterval(yahooSymbol, config.interval, config.range);

    if (!fetch.success) {
      result.entry[tf] = { error: fetch.error, prices: null, label: config.label };
    } else {
      result.entry[tf] = { prices: fetch.prices, label: config.label, bars: fetch.count };
    }
    await sleep(200);
  }

  // Hitung MTF confluence
  result.confluence = calculateConfluence(result.analysis);

  return result;
}

// Hitung confluence score (% timeframe yang searah)
function calculateConfluence(analysisTfs) {
  const tfs = Object.keys(analysisTfs).filter(tf => analysisTfs[tf].trend && analysisTfs[tf].trend !== 'UNKNOWN');
  if (tfs.length === 0) {
    return { bias: 'UNKNOWN', score: 0, aligned: 0, total: 0 };
  }

  const bullish = tfs.filter(tf => analysisTfs[tf].trend === 'BULLISH').length;
  const bearish = tfs.filter(tf => analysisTfs[tf].trend === 'BEARISH').length;
  const total = tfs.length;

  let bias = 'NEUTRAL';
  let score = 0;

  if (bullish > bearish) {
    bias = 'BULLISH';
    score = (bullish / total) * 100;
  } else if (bearish > bullish) {
    bias = 'BEARISH';
    score = (bearish / total) * 100;
  } else {
    score = 50;
  }

  return { bias, score: Math.round(score), aligned: Math.max(bullish, bearish), total };
}

module.exports = {
  TIMEFRAMES,
  fetchYahooInterval,
  analyzeTrend,
  analyzeMTF,
  calculateConfluence
};
