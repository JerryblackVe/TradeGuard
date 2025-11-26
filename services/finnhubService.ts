import { FinnhubQuote } from '../types';

const API_KEY = 'd4hhv69r01quqml91klgd4hhv69r01quqml91km0';
const BASE_URL = 'https://finnhub.io/api/v1';

export const fetchStockQuote = async (symbol: string): Promise<FinnhubQuote | null> => {
  if (!symbol) return null;
  
  try {
    const response = await fetch(`${BASE_URL}/quote?symbol=${symbol.toUpperCase()}&token=${API_KEY}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching data: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Finnhub returns 0s if symbol not found but 200 OK
    if (data.c === 0 && data.h === 0 && data.l === 0) {
      throw new Error('Símbolo no encontrado');
    }

    return data as FinnhubQuote;
  } catch (error) {
    console.error("Finnhub API Error:", error);
    throw error;
  }
};