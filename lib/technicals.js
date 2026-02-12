// Technical Analysis Indicators

/**
 * Calculate Simple Moving Average
 */
export function calculateSMA(data, period) {
  if (data.length < period) return null;
  
  const sum = data.slice(-period).reduce((a, b) => a + b, 0);
  return sum / period;
}

/**
 * Calculate Exponential Moving Average
 */
export function calculateEMA(data, period) {
  if (data.length < period) return null;
  
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = period; i < data.length; i++) {
    ema = (data[i] * k) + (ema * (1 - k));
  }
  
  return ema;
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // Calculate subsequent values
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - change) / period;
    }
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 */
export function calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  if (closes.length < slowPeriod + signalPeriod) return null;
  
  const emaFast = calculateEMA(closes, fastPeriod);
  const emaSlow = calculateEMA(closes, slowPeriod);
  
  if (!emaFast || !emaSlow) return null;
  
  const macdLine = emaFast - emaSlow;
  
  // Calculate signal line (EMA of MACD)
  const macdValues = [];
  for (let i = slowPeriod; i < closes.length; i++) {
    const fast = calculateEMA(closes.slice(0, i + 1), fastPeriod);
    const slow = calculateEMA(closes.slice(0, i + 1), slowPeriod);
    macdValues.push(fast - slow);
  }
  
  const signalLine = calculateEMA(macdValues, signalPeriod);
  const histogram = macdLine - signalLine;
  
  return {
    macd: macdLine,
    signal: signalLine,
    histogram: histogram
  };
}

/**
 * Calculate Bollinger Bands
 */
export function calculateBollingerBands(closes, period = 20, stdDev = 2) {
  if (closes.length < period) return null;
  
  const sma = calculateSMA(closes, period);
  const recentData = closes.slice(-period);
  
  // Calculate standard deviation
  const variance = recentData.reduce((sum, val) => {
    return sum + Math.pow(val - sma, 2);
  }, 0) / period;
  
  const std = Math.sqrt(variance);
  
  return {
    upper: sma + (std * stdDev),
    middle: sma,
    lower: sma - (std * stdDev),
    bandwidth: (std * stdDev * 2) / sma * 100
  };
}

/**
 * Calculate VWAP (Volume Weighted Average Price)
 */
export function calculateVWAP(historicalData) {
  if (!historicalData || historicalData.length === 0) return null;
  
  let totalVolume = 0;
  let totalVolumePrice = 0;
  
  for (const bar of historicalData) {
    if (!bar.high || !bar.low || !bar.close || !bar.volume) continue;
    
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    totalVolumePrice += typicalPrice * bar.volume;
    totalVolume += bar.volume;
  }
  
  if (totalVolume === 0) return null;
  return totalVolumePrice / totalVolume;
}

/**
 * Find support and resistance levels
 */
export function findSupportResistance(historicalData, tolerance = 0.02) {
  if (!historicalData || historicalData.length < 20) return { support: [], resistance: [] };
  
  const highs = historicalData.map(d => d.high).filter(h => h);
  const lows = historicalData.map(d => d.low).filter(l => l);
  
  // Find local peaks and troughs
  const resistance = [];
  const support = [];
  
  for (let i = 2; i < highs.length - 2; i++) {
    // Check if it's a local maximum
    if (highs[i] > highs[i-1] && highs[i] > highs[i-2] && 
        highs[i] > highs[i+1] && highs[i] > highs[i+2]) {
      resistance.push(highs[i]);
    }
    
    // Check if it's a local minimum
    if (lows[i] < lows[i-1] && lows[i] < lows[i-2] && 
        lows[i] < lows[i+1] && lows[i] < lows[i+2]) {
      support.push(lows[i]);
    }
  }
  
  // Cluster nearby levels
  const clusterLevels = (levels) => {
    if (levels.length === 0) return [];
    
    levels.sort((a, b) => a - b);
    const clustered = [];
    let current = [levels[0]];
    
    for (let i = 1; i < levels.length; i++) {
      const prev = levels[i - 1];
      const curr = levels[i];
      
      if (Math.abs(curr - prev) / prev <= tolerance) {
        current.push(curr);
      } else {
        clustered.push(current.reduce((a, b) => a + b, 0) / current.length);
        current = [curr];
      }
    }
    
    if (current.length > 0) {
      clustered.push(current.reduce((a, b) => a + b, 0) / current.length);
    }
    
    return clustered;
  };
  
  return {
    resistance: clusterLevels(resistance).slice(-3), // Top 3
    support: clusterLevels(support).slice(-3) // Bottom 3
  };
}

/**
 * Calculate Stochastic Oscillator (%K and %D)
 */
export function calculateStochastic(historicalData, kPeriod = 14, dPeriod = 3) {
  if (!historicalData || historicalData.length < kPeriod) return null;
  
  const recentData = historicalData.slice(-kPeriod);
  const currentClose = recentData[recentData.length - 1].close;
  
  const highestHigh = Math.max(...recentData.map(d => d.high));
  const lowestLow = Math.min(...recentData.map(d => d.low));
  
  if (highestHigh === lowestLow) return null;
  
  // %K calculation
  const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  
  // Calculate %D (SMA of %K)
  const kValues = [];
  for (let i = historicalData.length - kPeriod; i < historicalData.length - kPeriod + dPeriod; i++) {
    if (i < 0) continue;
    
    const slice = historicalData.slice(Math.max(0, i - kPeriod + 1), i + 1);
    const close = slice[slice.length - 1].close;
    const high = Math.max(...slice.map(d => d.high));
    const low = Math.min(...slice.map(d => d.low));
    
    if (high !== low) {
      kValues.push(((close - low) / (high - low)) * 100);
    }
  }
  
  const d = kValues.length > 0 ? 
    kValues.reduce((a, b) => a + b, 0) / kValues.length : k;
  
  return {
    k: k,
    d: d,
    signal: k > 80 ? 'overbought' : k < 20 ? 'oversold' : 'neutral'
  };
}

/**
 * Calculate Average True Range (ATR) for volatility
 */
export function calculateATR(historicalData, period = 14) {
  if (!historicalData || historicalData.length < period + 1) return null;
  
  const trueRanges = [];
  
  for (let i = 1; i < historicalData.length; i++) {
    const current = historicalData[i];
    const previous = historicalData[i - 1];
    
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );
    
    trueRanges.push(tr);
  }
  
  // Calculate ATR as SMA of true ranges
  const recentTR = trueRanges.slice(-period);
  const atr = recentTR.reduce((a, b) => a + b, 0) / period;
  
  return atr;
}

/**
 * Calculate ADX (Average Directional Index) for trend strength
 */
export function calculateADX(historicalData, period = 14) {
  if (!historicalData || historicalData.length < period * 2) return null;
  
  const trueRanges = [];
  const plusDM = [];
  const minusDM = [];
  
  // Calculate TR, +DM, -DM
  for (let i = 1; i < historicalData.length; i++) {
    const current = historicalData[i];
    const previous = historicalData[i - 1];
    
    // True Range
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );
    trueRanges.push(tr);
    
    // Directional Movement
    const highDiff = current.high - previous.high;
    const lowDiff = previous.low - current.low;
    
    let plusDMValue = 0;
    let minusDMValue = 0;
    
    if (highDiff > lowDiff && highDiff > 0) {
      plusDMValue = highDiff;
    }
    if (lowDiff > highDiff && lowDiff > 0) {
      minusDMValue = lowDiff;
    }
    
    plusDM.push(plusDMValue);
    minusDM.push(minusDMValue);
  }
  
  // Smooth the values using Wilder's smoothing
  const smoothTR = wilderSmooth(trueRanges, period);
  const smoothPlusDM = wilderSmooth(plusDM, period);
  const smoothMinusDM = wilderSmooth(minusDM, period);
  
  if (!smoothTR || smoothTR === 0) return null;
  
  // Calculate +DI and -DI
  const plusDI = (smoothPlusDM / smoothTR) * 100;
  const minusDI = (smoothMinusDM / smoothTR) * 100;
  
  // Calculate DX
  const diSum = plusDI + minusDI;
  const diDiff = Math.abs(plusDI - minusDI);
  const dx = diSum === 0 ? 0 : (diDiff / diSum) * 100;
  
  // Calculate ADX (average of DX values)
  const dxValues = [];
  for (let i = period; i < trueRanges.length; i++) {
    const sliceTR = trueRanges.slice(i - period, i);
    const slicePlusDM = plusDM.slice(i - period, i);
    const sliceMinusDM = minusDM.slice(i - period, i);
    
    const sTR = wilderSmooth(sliceTR, period);
    const sPDM = wilderSmooth(slicePlusDM, period);
    const sMDM = wilderSmooth(sliceMinusDM, period);
    
    if (sTR && sTR > 0) {
      const pdi = (sPDM / sTR) * 100;
      const mdi = (sMDM / sTR) * 100;
      const sum = pdi + mdi;
      const diff = Math.abs(pdi - mdi);
      dxValues.push(sum === 0 ? 0 : (diff / sum) * 100);
    }
  }
  
  const adx = dxValues.length >= period ? 
    wilderSmooth(dxValues.slice(-period), period) : 
    dxValues.reduce((a, b) => a + b, 0) / dxValues.length;
  
  // Interpret ADX
  let strength = 'weak';
  if (adx >= 50) strength = 'very_strong';
  else if (adx >= 25) strength = 'strong';
  else if (adx >= 20) strength = 'moderate';
  
  return {
    adx: adx,
    plusDI: plusDI,
    minusDI: minusDI,
    strength: strength,
    trending: adx >= 25
  };
}

/**
 * Wilder's Smoothing (used for ADX calculation)
 */
function wilderSmooth(data, period) {
  if (data.length < period) return null;
  
  // Initial sum
  let sum = data.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothed = sum;
  
  // Apply Wilder's smoothing
  for (let i = period; i < data.length; i++) {
    smoothed = smoothed - (smoothed / period) + data[i];
  }
  
  return smoothed / period;
}

/**
 * Detect unusual volume
 */
export function detectUnusualVolume(currentVolume, avgVolume) {
  const ratio = currentVolume / avgVolume;
  
  if (ratio >= 3) return { unusual: true, level: 'extreme', ratio };
  if (ratio >= 2) return { unusual: true, level: 'high', ratio };
  if (ratio >= 1.5) return { unusual: true, level: 'moderate', ratio };
  
  return { unusual: false, level: 'normal', ratio };
}

/**
 * Calculate all technical indicators for market data
 */
export function analyzeMarketData(marketData) {
  if (!marketData || !marketData.historicalData) {
    return null;
  }
  
  const closes = marketData.historicalData.map(d => d.close);
  const currentPrice = marketData.price;
  
  // Moving Averages
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  
  // Oscillators
  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const stochastic = calculateStochastic(marketData.historicalData);
  
  // Bands
  const bb = calculateBollingerBands(closes);
  
  // VWAP
  const vwap = calculateVWAP(marketData.historicalData);
  
  // Support/Resistance
  const levels = findSupportResistance(marketData.historicalData);
  
  // Volume Analysis
  const volumeAnalysis = detectUnusualVolume(marketData.volume, marketData.avgVolume);
  
  // Volatility
  const atr = calculateATR(marketData.historicalData);
  
  // Trend Strength
  const adx = calculateADX(marketData.historicalData);
  
  // Trend Detection
  const trend = detectTrend(currentPrice, sma20, sma50, sma200);
  
  return {
    ticker: marketData.symbol,
    price: currentPrice,
    movingAverages: {
      sma20,
      sma50,
      sma200,
      ema9,
      ema21
    },
    rsi,
    macd,
    stochastic,
    bollingerBands: bb,
    vwap,
    atr,
    adx,
    supportResistance: levels,
    volume: volumeAnalysis,
    trend,
    timestamp: Date.now()
  };
}

/**
 * Detect trend based on moving averages
 */
function detectTrend(price, sma20, sma50, sma200) {
  if (!sma20 || !sma50) return 'unknown';
  
  // Strong uptrend: price > SMA20 > SMA50 > SMA200
  if (price > sma20 && sma20 > sma50 && (!sma200 || sma50 > sma200)) {
    return 'strong_uptrend';
  }
  
  // Uptrend: price > SMA20 > SMA50
  if (price > sma20 && sma20 > sma50) {
    return 'uptrend';
  }
  
  // Strong downtrend: price < SMA20 < SMA50 < SMA200
  if (price < sma20 && sma20 < sma50 && (!sma200 || sma50 < sma200)) {
    return 'strong_downtrend';
  }
  
  // Downtrend: price < SMA20 < SMA50
  if (price < sma20 && sma20 < sma50) {
    return 'downtrend';
  }
  
  // Sideways/consolidation
  return 'sideways';
}
