
import React, { useState, useEffect, useMemo } from 'react';
import { fetchStockQuote } from './services/finnhubService';
import { FinnhubQuote, TradeCalculation, TradeInputs } from './types';
import { InputGroup } from './components/InputGroup';
import { 
  Calculator, 
  Moon, 
  Sun, 
  TrendingUp, 
  DollarSign, 
  AlertTriangle, 
  Target, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Activity,
  Search,
  RefreshCw,
  Info,
  Scale
} from 'lucide-react';

const COMMISION_ENTRY = 0.15;
const COMMISION_EXIT = 0.15;
const TOTAL_COMMISSION = COMMISION_ENTRY + COMMISION_EXIT;

const App: React.FC = () => {
  // Theme State
  const [darkMode, setDarkMode] = useState<boolean>(true);

  // Data States
  const [quote, setQuote] = useState<FinnhubQuote | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Input States - Initialize as numbers or strings
  const [inputs, setInputs] = useState<TradeInputs>({
    symbol: '',
    accountBalance: 10000,
    riskPercentage: 2,
    entryPrice: '',
    stopLossPrice: '',
    takeProfitPrice: '',
  });

  // Derived Calculation
  const calculation: TradeCalculation = useMemo(() => {
    // Parse inputs safely to numbers for calculation, defaulting to 0 if invalid/empty
    const accountBalance = Number(inputs.accountBalance) || 0;
    const riskPercentage = Number(inputs.riskPercentage) || 0;
    const entryPrice = Number(inputs.entryPrice) || 0;
    const stopLossPrice = Number(inputs.stopLossPrice) || 0;
    const takeProfitPrice = Number(inputs.takeProfitPrice) || 0;
    
    // Default result structure
    const result: TradeCalculation = { 
      maxShares: 0, 
      positionSize: 0, 
      totalRiskAmount: 0, 
      potentialProfit: 0, 
      riskRewardRatio: 0, 
      stopLossPercent: 0, 
      takeProfitPercent: 0, 
      breakEvenPrice: 0,
      isValid: false,
      error: undefined
    };

    // Minimum requirements: Entry, StopLoss and Balance must be > 0
    if (entryPrice <= 0 || stopLossPrice <= 0 || accountBalance <= 0) {
      return result;
    }

    if (entryPrice === stopLossPrice) {
      return { ...result, error: "El precio de entrada y stop loss no pueden ser iguales." };
    }

    // 1. Calculate per-share metrics (Always available for display)
    const priceDiffRisk = Math.abs(entryPrice - stopLossPrice);
    result.stopLossPercent = ((stopLossPrice - entryPrice) / entryPrice) * 100;
    
    // Calculate Reward metrics if TP exists
    let priceDiffReward = 0;
    if (takeProfitPrice > 0) {
      priceDiffReward = Math.abs(takeProfitPrice - entryPrice);
      result.riskRewardRatio = priceDiffRisk === 0 ? 0 : priceDiffReward / priceDiffRisk;
      result.takeProfitPercent = ((takeProfitPrice - entryPrice) / entryPrice) * 100;
    }

    // 2. Risk Calculation
    // Total $ willing to lose based on account size
    const maxRiskDollars = accountBalance * (riskPercentage / 100);
    
    // Available risk capital after subtracting fixed commissions
    const riskAvailableForShares = maxRiskDollars - TOTAL_COMMISSION;

    // CHECK 1: Do we have enough risk budget to cover just the commissions?
    if (riskAvailableForShares <= 0) {
      return { 
        ...result,
        totalRiskAmount: TOTAL_COMMISSION,
        error: `El riesgo permitido ($${maxRiskDollars.toFixed(2)}) es menor que la comisión ($${TOTAL_COMMISSION}). Aumenta el % de riesgo.` 
      };
    }

    // 3. Max shares calculation (Fractional Shares Enabled)
    // We do NOT use Math.floor here anymore.
    const maxShares = riskAvailableForShares / priceDiffRisk;
    
    // CHECK 2: Is the share count reasonably valid? (e.g. not practically zero)
    if (maxShares < 0.00001) {
       return {
        ...result,
        totalRiskAmount: TOTAL_COMMISSION, // Only commissions risked
        error: `El tamaño de la posición es demasiado pequeño para calcular.`
      };
    }

    // 4. Final Valid Calculation
    const positionSize = maxShares * entryPrice;
    
    // Actual Risk Amount (Actual loss if stop hit)
    const actualLoss = (maxShares * priceDiffRisk) + TOTAL_COMMISSION;

    // Optional: Profit Calculation
    let potentialProfitRaw = 0;
    if (takeProfitPrice > 0) {
      potentialProfitRaw = (maxShares * priceDiffReward) - TOTAL_COMMISSION;
    }

    // Break Even Calculation: Entry Price + (Total Commission / Number of Shares)
    // This assumes a LONG position. For SHORT it would be Entry - (Comm/Shares).
    // Assuming Long based on typical "Buying Power" context, but if Stop < Entry it's usually Long.
    // If Entry > Stop (Long): BreakEven = Entry + CostPerShare
    // If Entry < Stop (Short): BreakEven = Entry - CostPerShare
    const isLong = entryPrice > stopLossPrice;
    const costPerShare = TOTAL_COMMISSION / maxShares;
    const breakEvenPrice = isLong ? (entryPrice + costPerShare) : (entryPrice - costPerShare);

    return {
      ...result,
      maxShares,
      positionSize,
      totalRiskAmount: actualLoss,
      potentialProfit: potentialProfitRaw,
      breakEvenPrice,
      isValid: true
    };

  }, [inputs]);

  // Effects
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof TradeInputs) => {
    setInputs(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleFetchPrice = async () => {
    if (!inputs.symbol) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStockQuote(inputs.symbol);
      setQuote(data);
      if (data) {
        // Auto-populate entry price if it's empty or 0
        setInputs(prev => ({ 
          ...prev, 
          entryPrice: prev.entryPrice === '' || Number(prev.entryPrice) === 0 ? data.c : prev.entryPrice 
        }));
      }
    } catch (err: any) {
      setError(err.message || 'Error al obtener datos');
      setQuote(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFetchPrice();
    }
  }

  // Format currency
  const fmtMoney = (num: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };
  
  // Format number (Updated for fractional shares: shows up to 5 decimals if needed)
  const fmtNum = (num: number) => {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 5 }).format(num);
  };

  // Helper to get raw number from input safely for display logic
  const getNum = (val: string | number) => Number(val) || 0;

  return (
    <div className="min-h-screen bg-light dark:bg-dark text-slate-800 dark:text-slate-100 transition-colors duration-300 font-sans pb-10">
      
      {/* Navbar */}
      <nav className="border-b border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-darkCard/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-tr from-primary to-secondary p-2 rounded-lg">
                <Calculator className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                TradeGuard
              </span>
            </div>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Inputs */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Ticker Section */}
            <div className="bg-white dark:bg-darkCard rounded-2xl shadow-lg border border-gray-100 dark:border-slate-800 p-6">
              <h2 className="text-lg font-bold mb-4 flex items-center">
                <Search className="w-5 h-5 mr-2 text-primary" />
                Buscar Acción
              </h2>
              <div className="flex gap-2">
                <div className="relative flex-grow">
                  <input
                    type="text"
                    value={inputs.symbol}
                    onChange={(e) => handleInputChange(e, 'symbol')}
                    onKeyDown={handleKeyDown}
                    placeholder="Ej. AAPL, TSLA"
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary outline-none uppercase font-bold tracking-wide"
                  />
                </div>
                <button
                  onClick={handleFetchPrice}
                  disabled={loading}
                  className="bg-primary hover:bg-blue-600 text-white px-4 rounded-xl font-medium transition-colors flex items-center justify-center min-w-[60px]"
                >
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                </button>
              </div>

              {error && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  {error}
                </div>
              )}

              {quote && (
                <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Precio Actual</span>
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${quote.c.toFixed(2)}
                    </span>
                  </div>
                  <div className={`flex items-center text-sm font-medium ${quote.d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {quote.d >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingUp className="w-4 h-4 mr-1 rotate-180" />}
                    {quote.d > 0 ? '+' : ''}{quote.d.toFixed(2)} ({quote.dp.toFixed(2)}%)
                  </div>
                </div>
              )}
            </div>

            {/* Inputs Form */}
            <div className="bg-white dark:bg-darkCard rounded-2xl shadow-lg border border-gray-100 dark:border-slate-800 p-6">
              <h2 className="text-lg font-bold mb-6 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-secondary" />
                Parámetros de Entrada
              </h2>

              <div className="space-y-5">
                <InputGroup
                  label="Capital Líquido Total"
                  type="number"
                  value={inputs.accountBalance}
                  onChange={(e) => handleInputChange(e, 'accountBalance')}
                  prefix={<DollarSign className="w-4 h-4" />}
                  placeholder="10000"
                />

                <InputGroup
                  label="Riesgo por Operación (%)"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={inputs.riskPercentage}
                  onChange={(e) => handleInputChange(e, 'riskPercentage')}
                  suffix={<span className="font-bold text-gray-500">%</span>}
                  helperText="Define el porcentaje exacto de riesgo."
                />

                <hr className="border-gray-100 dark:border-slate-700" />

                <InputGroup
                  label="Precio Entrada"
                  type="number"
                  step="0.01"
                  value={inputs.entryPrice}
                  onChange={(e) => handleInputChange(e, 'entryPrice')}
                  prefix={<span className="text-sm font-bold">$</span>}
                />

                <div className="grid grid-cols-2 gap-4">
                  <InputGroup
                    label="Stop Loss (Salida)"
                    type="number"
                    step="0.01"
                    className="col-span-1"
                    value={inputs.stopLossPrice}
                    onChange={(e) => handleInputChange(e, 'stopLossPrice')}
                    prefix={<ArrowDownCircle className="w-4 h-4 text-red-500" />}
                  />
                  <InputGroup
                    label="Take Profit (Objetivo)"
                    type="number"
                    step="0.01"
                    className="col-span-1"
                    value={inputs.takeProfitPrice}
                    onChange={(e) => handleInputChange(e, 'takeProfitPrice')}
                    prefix={<Target className="w-4 h-4 text-green-500" />}
                    helperText="Opcional"
                  />
                </div>
              </div>
            </div>
            
            {/* Commission Info */}
            <div className="text-center text-xs text-gray-400">
              * Comisión fija calculada: ${TOTAL_COMMISSION.toFixed(2)} por operación completa (Entrada + Salida)
            </div>

          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Main Result Card */}
            <div className={`bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-3xl shadow-xl p-8 relative overflow-hidden border border-slate-700 transition-all ${!calculation.isValid && calculation.error ? 'ring-2 ring-red-500/50' : ''}`}>
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              
              <div className="relative z-10">
                <h3 className="text-slate-400 uppercase tracking-widest text-xs font-bold mb-1">Capacidad de Compra</h3>
                <div className="flex items-baseline space-x-2">
                  <h1 className="text-5xl font-bold tracking-tight">
                    {calculation.isValid ? fmtMoney(calculation.positionSize) : '$0.00'}
                  </h1>
                </div>
                <p className="text-slate-400 text-sm mt-2">
                  Dinero total que puedes poner en juego respetando tu riesgo.
                </p>

                <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                    <div className="text-slate-400 text-xs uppercase font-bold mb-1">Acciones</div>
                    <div className="text-2xl font-semibold">{fmtNum(calculation.maxShares)}</div>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                     <div className="text-slate-400 text-xs uppercase font-bold mb-1">Riesgo ($)</div>
                    <div className="text-2xl font-semibold text-red-400">{fmtMoney(calculation.totalRiskAmount)}</div>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                    <div className="text-slate-400 text-xs uppercase font-bold mb-1">Ratio R:B</div>
                    <div className={`text-2xl font-semibold ${calculation.riskRewardRatio >= 2 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {calculation.riskRewardRatio > 0 ? `1:${calculation.riskRewardRatio.toFixed(2)}` : '-'}
                    </div>
                  </div>
                   <div className="bg-white/5 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                    <div className="text-slate-400 text-xs uppercase font-bold mb-1">Ganancia Est.</div>
                    <div className="text-2xl font-semibold text-green-400">
                      {Number(inputs.takeProfitPrice) > 0 ? fmtMoney(calculation.potentialProfit) : '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Error / Guidance Message */}
            {calculation.error && (
               <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl flex items-start animate-fade-in">
                 <Info className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                 <div>
                   <h4 className="font-bold text-sm uppercase mb-1">Aviso de Riesgo</h4>
                   <p className="text-sm opacity-90 leading-relaxed">{calculation.error}</p>
                 </div>
               </div>
            )}

            {/* Detailed Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Risk Analysis */}
              <div className="bg-white dark:bg-darkCard rounded-2xl shadow-lg border border-gray-100 dark:border-slate-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center text-red-500">
                    <ArrowDownCircle className="w-5 h-5 mr-2" />
                    Escenario de Pérdida
                  </h3>
                  {calculation.stopLossPercent !== 0 && (
                    <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-1 rounded-full font-bold">
                      {calculation.stopLossPercent.toFixed(2)}%
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Pérdida por Acción</span>
                    <span className="font-mono font-medium">
                      {getNum(inputs.entryPrice) > 0 && getNum(inputs.stopLossPrice) > 0
                        ? fmtMoney(Math.abs(getNum(inputs.entryPrice) - getNum(inputs.stopLossPrice))) 
                        : '$0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Comisiones</span>
                    <span className="font-mono font-medium">{fmtMoney(TOTAL_COMMISSION)}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center">
                    <span className="font-bold text-gray-700 dark:text-gray-200">Pérdida Neta Total</span>
                    <span className="font-bold text-red-500 text-lg">
                      -{fmtMoney(calculation.totalRiskAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Profit Analysis */}
              <div className="bg-white dark:bg-darkCard rounded-2xl shadow-lg border border-gray-100 dark:border-slate-800 p-6 opacity-90">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center text-green-500">
                    <ArrowUpCircle className="w-5 h-5 mr-2" />
                    Escenario de Ganancia
                  </h3>
                  {Number(inputs.takeProfitPrice) > 0 && (
                    <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-1 rounded-full font-bold">
                      +{calculation.takeProfitPercent.toFixed(2)}%
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                   {/* Break Even Row */}
                  <div className="flex justify-between text-sm items-center bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg -mx-2 mb-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center">
                      <Scale className="w-3 h-3 mr-1" />
                      Precio Break Even
                    </span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {calculation.isValid ? fmtNum(calculation.breakEvenPrice) : '-'}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Ganancia por Acción</span>
                    <span className="font-mono font-medium">
                      {getNum(inputs.takeProfitPrice) > 0 && getNum(inputs.entryPrice) > 0
                        ? fmtMoney(Math.abs(getNum(inputs.takeProfitPrice) - getNum(inputs.entryPrice))) 
                        : '$0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                     <span className="text-gray-500 dark:text-gray-400">Comisiones</span>
                    <span className="font-mono font-medium">{fmtMoney(TOTAL_COMMISSION)}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center">
                    <span className="font-bold text-gray-700 dark:text-gray-200">Ganancia Neta</span>
                    <span className="font-bold text-green-500 text-lg">
                      +{Number(inputs.takeProfitPrice) > 0 ? fmtMoney(calculation.potentialProfit) : '$0.00'}
                    </span>
                  </div>
                </div>
              </div>

            </div>

             {/* Balance Impact Visualization */}
             {calculation.isValid && (
              <div className="bg-white dark:bg-darkCard rounded-2xl shadow-lg border border-gray-100 dark:border-slate-800 p-6">
                <h3 className="font-bold text-sm uppercase text-gray-500 dark:text-gray-400 mb-4">Proyección de Capital</h3>
                <div className="relative h-4 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                   {/* Base Balance Marker - Just a visual bar */}
                   <div className="absolute top-0 bottom-0 bg-primary w-full opacity-20"></div>
                </div>
                <div className="mt-4 flex justify-between text-xs sm:text-sm">
                   <div className="text-center">
                      <div className="text-red-500 font-bold">{fmtMoney(Number(inputs.accountBalance) - calculation.totalRiskAmount)}</div>
                      <div className="text-gray-400">Si toca Stop</div>
                   </div>
                   <div className="text-center">
                      <div className="text-gray-500 dark:text-gray-300 font-bold">{fmtMoney(Number(inputs.accountBalance))}</div>
                      <div className="text-gray-400">Actual</div>
                   </div>
                   <div className="text-center">
                      <div className="text-green-500 font-bold">
                        {Number(inputs.takeProfitPrice) > 0 
                          ? fmtMoney(Number(inputs.accountBalance) + calculation.potentialProfit)
                          : '-'}
                      </div>
                      <div className="text-gray-400">Si toca Target</div>
                   </div>
                </div>
              </div>
             )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
