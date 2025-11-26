
export interface FinnhubQuote {
  c: number; // Current price
  d: number; // Change
  dp: number; // Percent change
  h: number; // High
  l: number; // Low
  o: number; // Open
  pc: number; // Previous close
  t: number; // Timestamp
  name?: string; // Company or Asset Name
}

export interface TradeCalculation {
  maxShares: number;
  positionSize: number;
  totalRiskAmount: number; // The actual money risked including commissions
  potentialProfit: number;
  riskRewardRatio: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  breakEvenPrice: number; // Price needed to cover entry + commissions
  isValid: boolean;
  error?: string;
}

export interface TradeInputs {
  symbol: string;
  accountBalance: number | string;
  riskPercentage: number | string;
  entryPrice: number | string;
  stopLossPrice: number | string;
  takeProfitPrice: number | string;
}