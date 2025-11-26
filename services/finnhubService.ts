import { FinnhubQuote } from '../types';

const BASE_URL = 'https://finnhub.io/api/v1';
const DEFAULT_KEY = 'd4hhv69r01quqml91klgd4hhv69r01quqml91km0';
const BINANCE_URL = 'https://api.binance.com/api/v3';

// Priority list: These symbols should check Binance first, Finnhub second.
// This prevents "BTC" returning a $100 ETF fund instead of Bitcoin price.
const PRIORITY_CRYPTO_SYMBOLS = new Set([
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'SHIB', 'LTC', 'DOT', 'MATIC', 'TRX', 'AVAX', 'LINK', 'UNI'
]);

// Map for nicer crypto names in tooltip
const CRYPTO_NAMES: Record<string, string> = {
  'BTC': 'Bitcoin',
  'ETH': 'Ethereum',
  'SOL': 'Solana',
  'BNB': 'Binance Coin',
  'XRP': 'Ripple',
  'ADA': 'Cardano',
  'DOGE': 'Dogecoin',
  'LTC': 'Litecoin',
  'DOT': 'Polkadot',
  'MATIC': 'Polygon',
};

// Simple in-memory cache
const quoteCache = new Map<string, { data: FinnhubQuote, timestamp: number }>();
const CACHE_DURATION = 30 * 1000; // 30 Seconds cache

const getApiKey = () => {
  try {
    // @ts-ignore
    if (import.meta?.env?.VITE_FINNHUB_API_KEY) {
      // @ts-ignore
      return import.meta.env.VITE_FINNHUB_API_KEY;
    }
  } catch {}

  try {
    if (process?.env?.REACT_APP_FINNHUB_API_KEY) {
      return process.env.REACT_APP_FINNHUB_API_KEY;
    }
  } catch {}

  return DEFAULT_KEY;
};

// Helper: Fetch crypto data from Binance
const fetchBinanceQuote = async (symbol: string): Promise<FinnhubQuote | null> => {
  try {
    const rawSymbol = symbol.toUpperCase();
    // Assume pairing with USDT if not specified
    const pair = rawSymbol.endsWith('USDT') 
      ? rawSymbol 
      : `${rawSymbol}USDT`;
      
    const response = await fetch(`${BINANCE_URL}/ticker/24hr?symbol=${pair}`);
    if (!response.ok) return null;

    const data = await response.json();
    
    // Determine a nice name
    let name = `${data.symbol} Crypto`;
    // Try to find common name from base symbol (e.g. BTC from BTCUSDT)
    const baseSymbol = pair.replace('USDT', '');
    if (CRYPTO_NAMES[baseSymbol]) {
      name = CRYPTO_NAMES[baseSymbol];
    }

    return {
      c: parseFloat(data.lastPrice),
      d: parseFloat(data.priceChange),
      dp: parseFloat(data.priceChangePercent),
      h: parseFloat(data.highPrice),
      l: parseFloat(data.lowPrice),
      o: parseFloat(data.openPrice),
      pc: parseFloat(data.prevClosePrice),
      t: data.closeTime,
      name: name
    };
  } catch (error) {
    return null;
  }
};

// Helper: Fetch company profile name from Finnhub
const fetchFinnhubProfileName = async (symbol: string, apiKey: string): Promise<string | undefined> => {
  try {
    const response = await fetch(`${BASE_URL}/stock/profile2?symbol=${symbol}&token=${apiKey}`);
    if (response.ok) {
      const data = await response.json();
      return data.name;
    }
  } catch {
    // Ignore profile errors
  }
  return undefined;
};

// Helper: Fetch stock quote from Finnhub
const fetchFinnhubQuoteInternal = async (symbol: string, apiKey: string): Promise<FinnhubQuote | null> => {
    try {
        const response = await fetch(`${BASE_URL}/quote?symbol=${symbol}&token=${apiKey}`);
        if (!response.ok) return null;

        const data = await response.json();
        // Finnhub returns 0s if symbol not found but 200 OK
        if (data.c === 0 && data.h === 0 && data.l === 0) return null;

        const finalQuote = data as FinnhubQuote;
        const name = await fetchFinnhubProfileName(symbol, apiKey);
        if (name) finalQuote.name = name;
        
        return finalQuote;
    } catch (e) {
        return null;
    }
}

export const fetchStockQuote = async (symbol: string): Promise<FinnhubQuote | null> => {
  if (!symbol) return null;
  
  const cleanSymbol = symbol.toUpperCase();
  const apiKey = getApiKey();

  // 1. Check Cache
  const cached = quoteCache.get(cleanSymbol);
  if (cached) {
    const isFresh = (Date.now() - cached.timestamp) < CACHE_DURATION;
    if (isFresh) {
      console.log(`Using cached data for ${cleanSymbol}`);
      return cached.data;
    }
  }

  let finalQuote: FinnhubQuote | null = null;
  
  // 2. Determine Priority Strategy
  // If it's a known crypto symbol or looks like a crypto pair (ends in USDT), try Binance first.
  const isCryptoPriority = PRIORITY_CRYPTO_SYMBOLS.has(cleanSymbol) || cleanSymbol.endsWith('USDT');

  if (isCryptoPriority) {
    console.log(`Priority Crypto detected for ${cleanSymbol}. Trying Binance first.`);
    finalQuote = await fetchBinanceQuote(cleanSymbol);
    
    // Fallback to Finnhub if Binance fails (maybe it's a stock named SOL?)
    if (!finalQuote) {
        console.log(`Binance failed for ${cleanSymbol}, checking Finnhub fallback.`);
        finalQuote = await fetchFinnhubQuoteInternal(cleanSymbol, apiKey);
    }

  } else {
    // Standard Stock behavior: Finnhub first
    console.log(`Standard symbol ${cleanSymbol}. Trying Finnhub first.`);
    finalQuote = await fetchFinnhubQuoteInternal(cleanSymbol, apiKey);

    // Fallback to Binance if Finnhub fails (maybe user typed 'DOGE' but it wasn't in our priority list?)
    if (!finalQuote) {
        console.log(`Finnhub failed for ${cleanSymbol}, checking Binance fallback.`);
        finalQuote = await fetchBinanceQuote(cleanSymbol);
    }
  }

  if (!finalQuote) {
     // Check if we have stale cache to return as last resort
     if (cached) {
        console.warn('Returning stale cache after API failures');
        return cached.data;
     }
     throw new Error('Símbolo no encontrado en Stocks (Finnhub) ni Cripto (Binance).');
  }

  // 3. Save to Cache
  quoteCache.set(cleanSymbol, {
    data: finalQuote,
    timestamp: Date.now()
  });

  return finalQuote;
};