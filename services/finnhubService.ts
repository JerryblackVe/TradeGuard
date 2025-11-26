import { FinnhubQuote } from '../types';

const BASE_URL = 'https://finnhub.io/api/v1';
const DEFAULT_KEY = 'd4hhv69r01quqml91klgd4hhv69r01quqml91km0';

// Simple in-memory cache to prevent hitting API limits on Vercel/Free Tier
// Map<Symbol, { data, timestamp }>
const quoteCache = new Map<string, { data: FinnhubQuote, timestamp: number }>();
const CACHE_DURATION = 30 * 1000; // 30 Seconds cache

const getApiKey = () => {
  // 1. Try Vite (common in modern React stacks on Vercel)
  try {
    // @ts-ignore
    if (import.meta?.env?.VITE_FINNHUB_API_KEY) {
      // @ts-ignore
      return import.meta.env.VITE_FINNHUB_API_KEY;
    }
  } catch {}

  // 2. Try Standard Process Env (CRA / Node / Next.js)
  try {
    if (process?.env?.REACT_APP_FINNHUB_API_KEY) {
      return process.env.REACT_APP_FINNHUB_API_KEY;
    }
  } catch {}

  // 3. Fallback to hardcoded key
  return DEFAULT_KEY;
};

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

  try {
    const response = await fetch(`${BASE_URL}/quote?symbol=${cleanSymbol}&token=${apiKey}`);
    
    if (!response.ok) {
      // If we hit a rate limit (429), try to return cached data even if stale
      if (response.status === 429 && cached) {
        console.warn('Rate limit hit, returning stale cache');
        return cached.data;
      }
      throw new Error(`Error fetching data: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Finnhub returns 0s if symbol not found but 200 OK
    if (data.c === 0 && data.h === 0 && data.l === 0) {
      throw new Error('Símbolo no encontrado');
    }

    const quoteData = data as FinnhubQuote;

    // 2. Save to Cache
    quoteCache.set(cleanSymbol, {
      data: quoteData,
      timestamp: Date.now()
    });

    return quoteData;
  } catch (error) {
    console.error("Finnhub API Error:", error);
    throw error;
  }
};