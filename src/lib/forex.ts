// ==============================================================================
// StarRuby.in Banking System — Real-Time Multi-Currency Forex Service
// Fetches live institutional foreign exchange rates with persistent local cache.
// ==============================================================================

export interface LiveForexRates {
  timestamp: number;
  ratesToInr: {
    INR: number;
    AED: number;
    USD: number;
    EUR: number;
    GBP: number;
    [key: string]: number;
  };
  isLive: boolean;
  lastUpdatedText: string;
}

// Sensible fallbacks if network is offline
const DEFAULT_RATES_TO_INR: LiveForexRates['ratesToInr'] = {
  INR: 1,
  AED: 26.02,
  USD: 95.50,
  EUR: 103.20,
  GBP: 122.40,
};

const FOREX_CACHE_KEY = 'starruby_forex_rates_cache_v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache

/**
 * Loads cached rates from localStorage if within TTL
 */
function getCachedRates(): LiveForexRates | null {
  try {
    const raw = localStorage.getItem(FOREX_CACHE_KEY);
    if (!raw) return null;
    const parsed: LiveForexRates = JSON.parse(raw);
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
      return parsed;
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

/**
 * Saves fetched rates to localStorage
 */
function saveRatesToCache(rates: LiveForexRates) {
  try {
    localStorage.setItem(FOREX_CACHE_KEY, JSON.stringify(rates));
  } catch (e) {
    console.warn('Could not cache forex rates:', e);
  }
}

/**
 * Fetches real-time institutional exchange rates from open forex API
 */
export async function fetchLiveForexRates(): Promise<LiveForexRates> {
  const cached = getCachedRates();
  if (cached) {
    return cached;
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();

    const usdToInr = data.rates.INR || 95.50;
    const ratesToInr: LiveForexRates['ratesToInr'] = {
      INR: 1,
      USD: Number(usdToInr.toFixed(4)),
      AED: Number((usdToInr / (data.rates.AED || 3.6725)).toFixed(4)),
      EUR: Number((usdToInr / (data.rates.EUR || 0.92)).toFixed(4)),
      GBP: Number((usdToInr / (data.rates.GBP || 0.78)).toFixed(4)),
    };

    const result: LiveForexRates = {
      timestamp: Date.now(),
      ratesToInr,
      isLive: true,
      lastUpdatedText: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };

    saveRatesToCache(result);
    return result;
  } catch (err) {
    console.warn('Real-time forex fetch notice, using fallback cache:', err);
    return {
      timestamp: Date.now(),
      ratesToInr: DEFAULT_RATES_TO_INR,
      isLive: false,
      lastUpdatedText: 'Default Standard',
    };
  }
}

/**
 * Returns the current exchange rate for a given currency to INR
 */
export function getRateToInr(currency: string, customRates?: Record<string, number>): number {
  const curr = (currency || 'INR').toUpperCase();
  if (curr === 'INR') return 1;
  if (customRates && customRates[curr]) return customRates[curr];

  const cached = getCachedRates();
  if (cached?.ratesToInr[curr]) return cached.ratesToInr[curr];

  return DEFAULT_RATES_TO_INR[curr] || 1;
}

/**
 * Converts any amount in given currency to INR
 */
export function convertToInr(amount: number, currency: string, customRates?: Record<string, number>): number {
  const rate = getRateToInr(currency, customRates);
  return Number((amount * rate).toFixed(2));
}
