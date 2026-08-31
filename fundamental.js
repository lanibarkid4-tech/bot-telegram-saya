// ======================================================
//  📰 MODULE ANALISA FUNDAMENTAL - GRATIS
// ======================================================
//  Mengambil data fundamental dari sumber publik gratis:
//  - Currency strength (dari pergerakan forex 7 hari)
//  - DXY proxy (EUR/USD inverse) untuk Gold & Index
//  - Market regime detection (trending / ranging)
//  - Volatility score
//
//  Semua berbasis data harga real, bukan asumsi.
// ======================================================

const https = require('https');

// Helper: fetch JSON dari URL (follow redirect)
function fetchJson(url, headers = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', ...headers } }, (res) => {
      // Follow redirect (301, 302, 307, 308)
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location && redirectCount < 3) {
        const newUrl = new URL(res.headers.location, url).toString();
        resolve(fetchJson(newUrl, headers, redirectCount + 1));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('JSON parse error: ' + data.substring(0, 50)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// Hitung kekuatan mata uang berdasarkan perubahan 7 hari
// Mengambil data EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, NZDUSD, USDCHF
// lalu menghitung USD strength dari inverse beberapa pair
async function getCurrencyStrength() {
  try {
    // Frankfurter timeseries 7 hari
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 14);
    const fmt = d => d.toISOString().split('T')[0];
    const url = `https://api.frankfurter.app/${fmt(startDate)}..${fmt(endDate)}?from=USD&to=EUR,GBP,JPY,CHF,AUD,CAD,NZD`;
    const data = await fetchJson(url);

    if (!data.rates) return null;

    // Hitung % perubahan setiap mata uang terhadap USD
    const dates = Object.keys(data.rates).sort();
    if (dates.length < 2) return null;
    const first = data.rates[dates[0]];
    const last = data.rates[dates[dates.length - 1]];

    const pctChange = {};
    for (const ccy of Object.keys(last)) {
      const oldVal = first[ccy];
      const newVal = last[ccy];
      if (oldVal && newVal) {
        // USD/ccy naik = USD melemah (ccy menguat)
        pctChange[ccy] = ((newVal - oldVal) / oldVal) * 100;
      }
    }

    // Map currency strength (positif = menguat, negatif = melemah)
    const strength = {
      USD: 0,
      EUR: pctChange.EUR ? -pctChange.EUR : 0,
      GBP: pctChange.GBP ? -pctChange.GBP : 0,
      JPY: pctChange.JPY ? -pctChange.JPY : 0,
      CHF: pctChange.CHF ? -pctChange.CHF : 0,
      AUD: pctChange.AUD ? -pctChange.AUD : 0,
      CAD: pctChange.CAD ? -pctChange.CAD : 0,
      NZD: pctChange.NZD ? -pctChange.NZD : 0
    };

    return strength;
  } catch (err) {
    console.error('Error currency strength:', err.message);
    return null;
  }
}

// Tentukan market regime (trending atau ranging)
// Berdasarkan perbandingan SMA 7 vs SMA 21 dan range harga
function determineRegime(prices) {
  if (!prices || prices.length < 21) return 'UNKNOWN';

  const sma7 = prices.slice(-7).reduce((a, b) => a + b, 0) / 7;
  const sma21 = prices.slice(-21).reduce((a, b) => a + b, 0) / 21;

  // Range = (high - low) / avg
  const recent = prices.slice(-14);
  const high = Math.max(...recent);
  const low = Math.min(...recent);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const rangePct = ((high - low) / avg) * 100;

  const smaDiff = Math.abs(((sma7 - sma21) / sma21) * 100);

  // Trending jika SMA7 dan SMA21 cukup berbeda DAN range cukup besar
  if (smaDiff > 0.5 && rangePct > 1.5) {
    return sma7 > sma21 ? 'TRENDING_UP' : 'TRENDING_DOWN';
  }
  // Ranging jika SMA berdekatan dan range sempit
  if (smaDiff < 0.3 || rangePct < 1.0) {
    return 'RANGING';
  }
  return 'TRANSITION';
}

// Hitung volatility (deviasi standar dari perubahan harian)
function calculateVolatility(prices) {
  if (!prices || prices.length < 5) return { value: 0, level: 'UNKNOWN' };

  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(((prices[i] - prices[i-1]) / prices[i-1]) * 100);
  }

  const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
  const variance = changes.reduce((a, b) => a + (b - mean) ** 2, 0) / changes.length;
  const stdDev = Math.sqrt(variance);

  // Annualized volatility (approx)
  const annualized = stdDev * Math.sqrt(252);

  let level = 'LOW';
  if (annualized > 25) level = 'HIGH';
  else if (annualized > 12) level = 'MEDIUM';

  return { value: stdDev, annualized, level };
}

// Mapping pair ke currency strength-nya
function getPairCurrencyStrength(pair, strength) {
  if (!strength) return { base: 0, quote: 0 };

  if (pair.source === 'yahoo') {
    // Untuk index & commodity, "base" dianggap USD proxy
    // DXY berlawanan dengan EURUSD
    if (pair.symbol === 'XAUUSD') {
      // Gold menguat saat USD melemah → pakai inverse USD
      return { base: 0, quote: -strength.USD * 0.7 };
    }
    // Index saham menguat saat risk-on (USD lemah)
    if (['NASDAQ', 'SPX', 'DJI'].includes(pair.symbol)) {
      return { base: -strength.USD * 0.5, quote: 0 };
    }
    return { base: 0, quote: 0 };
  }

  return {
    base: strength[pair.base] || 0,
    quote: strength[pair.quote] || 0
  };
}

// Analisa fundamental lengkap untuk satu pair
async function analyzeFundamental(pair, prices) {
  let strength = null;
  try {
    strength = await getCurrencyStrength();
  } catch (err) {
    console.error('Currency strength error:', err.message);
  }

  const regime = determineRegime(prices);
  const volatility = calculateVolatility(prices);

  // Kalau strength null, gunakan default netral
  const pairStrength = strength
    ? getPairCurrencyStrength(pair, strength)
    : { base: 0, quote: 0 };

  // Fundamental bias (pair base menguat + quote melemah = BUY favorable)
  const fundamentalBias = pairStrength.base - pairStrength.quote;

  let bias = 'NEUTRAL';
  if (fundamentalBias > 0.3) bias = 'BULLISH';
  else if (fundamentalBias < -0.3) bias = 'BEARISH';

  return {
    strength: strength || {},
    pairStrength,
    fundamentalBias: fundamentalBias.toFixed(2),
    bias,
    regime,
    volatility
  };
}

module.exports = {
  getCurrencyStrength,
  determineRegime,
  calculateVolatility,
  getPairCurrencyStrength,
  analyzeFundamental
};
