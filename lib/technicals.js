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
 * Calculate On-Balance Volume (OBV)
 * OBV is a momentum indicator that uses volume flow to predict changes in stock price
 */
export function calculateOBV(historicalData) {
  if (!historicalData || historicalData.length < 2) return null;
  
  let obv = 0;
  const obvValues = [0]; // Start with 0
  
  for (let i = 1; i < historicalData.length; i++) {
    const current = historicalData[i];
    const previous = historicalData[i - 1];
    
    if (!current.close || !previous.close || !current.volume) continue;
    
    if (current.close > previous.close) {
      obv += current.volume;
    } else if (current.close < previous.close) {
      obv -= current.volume;
    }
    // If price unchanged, OBV stays the same
    
    obvValues.push(obv);
  }
  
  return {
    current: obv,
    values: obvValues,
    trend: determineOBVTrend(obvValues)
  };
}

/**
 * Determine OBV trend direction
 */
function determineOBVTrend(obvValues) {
  if (obvValues.length < 10) return 'unknown';
  
  const recent = obvValues.slice(-10);
  const sma = recent.reduce((a, b) => a + b, 0) / recent.length;
  
  const current = obvValues[obvValues.length - 1];
  
  if (current > sma * 1.05) return 'strong_bullish';
  if (current > sma) return 'bullish';
  if (current < sma * 0.95) return 'strong_bearish';
  if (current < sma) return 'bearish';
  
  return 'neutral';
}

/**
 * Detect bullish/bearish divergences between price and OBV
 * Divergence is a powerful signal for potential reversals
 */
export function detectOBVDivergence(historicalData, obvData) {
  if (!historicalData || !obvData || historicalData.length < 20) return null;
  
  const lookback = 20;
  const recentBars = historicalData.slice(-lookback);
  const recentOBV = obvData.values.slice(-lookback);
  
  // Find price peaks and troughs
  const priceHigh = Math.max(...recentBars.map(d => d.high));
  const priceLow = Math.min(...recentBars.map(d => d.low));
  const currentPrice = recentBars[recentBars.length - 1].close;
  
  // Find OBV peaks and troughs
  const obvHigh = Math.max(...recentOBV);
  const obvLow = Math.min(...recentOBV);
  const currentOBV = recentOBV[recentOBV.length - 1];
  
  // Detect divergences
  let divergence = null;
  
  // Bearish divergence: price making higher highs, but OBV making lower highs
  if (currentPrice >= priceHigh * 0.98 && currentOBV < obvHigh * 0.95) {
    divergence = {
      type: 'bearish',
      strength: 'strong',
      signal: 'Price making new highs but volume declining - potential reversal down',
      confidence: 7
    };
  }
  // Bullish divergence: price making lower lows, but OBV making higher lows
  else if (currentPrice <= priceLow * 1.02 && currentOBV > obvLow * 1.05) {
    divergence = {
      type: 'bullish',
      strength: 'strong',
      signal: 'Price making new lows but volume accumulating - potential reversal up',
      confidence: 7
    };
  }
  // Weaker divergences
  else if (currentPrice > priceHigh * 0.95 && currentOBV < obvHigh * 0.98) {
    divergence = {
      type: 'bearish',
      strength: 'moderate',
      signal: 'Slight bearish divergence detected - watch for weakness',
      confidence: 5
    };
  }
  else if (currentPrice < priceLow * 1.05 && currentOBV > obvLow * 1.02) {
    divergence = {
      type: 'bullish',
      strength: 'moderate',
      signal: 'Slight bullish divergence detected - watch for strength',
      confidence: 5
    };
  }
  
  return divergence;
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
  
  // OBV (On-Balance Volume)
  const obv = calculateOBV(marketData.historicalData);
  const obvDivergence = obv ? detectOBVDivergence(marketData.historicalData, obv) : null;
  
  // Support/Resistance
  const levels = findSupportResistance(marketData.historicalData);
  
  // Fibonacci Levels
  const fibonacci = calculateFibonacciLevels(marketData.historicalData);
  const nearestFib = fibonacci ? findNearestFibLevel(currentPrice, fibonacci) : null;
  
  // Volume Analysis
  const volumeAnalysis = detectUnusualVolume(marketData.volume, marketData.avgVolume);
  
  // Volatility
  const atr = calculateATR(marketData.historicalData);
  
  // Trend Strength
  const adx = calculateADX(marketData.historicalData);
  
  // Trend Detection
  const trend = detectTrend(currentPrice, sma20, sma50, sma200);
  
  // Candlestick Pattern Analysis
  const candlestickPatterns = analyzeCandlestickPatterns(marketData.historicalData, trend);
  
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
    obv,
    obvDivergence,
    atr,
    adx,
    fibonacci,
    nearestFib,
    supportResistance: levels,
    volume: volumeAnalysis,
    trend,
    candlestickPatterns,
    timestamp: Date.now()
  };
}

/**
 * Calculate Fibonacci Retracement Levels
 * Based on the swing high and swing low over a given period
 */
export function calculateFibonacciLevels(historicalData, lookbackPeriod = 50) {
  if (!historicalData || historicalData.length < lookbackPeriod) return null;
  
  const recentData = historicalData.slice(-lookbackPeriod);
  
  // Find swing high and swing low
  const swingHigh = Math.max(...recentData.map(d => d.high));
  const swingLow = Math.min(...recentData.map(d => d.low));
  
  if (swingHigh === swingLow) return null;
  
  const range = swingHigh - swingLow;
  
  // Calculate Fibonacci levels (from high to low for retracements)
  const levels = {
    '0.0': swingHigh,
    '23.6': swingHigh - (range * 0.236),
    '38.2': swingHigh - (range * 0.382),
    '50.0': swingHigh - (range * 0.500),
    '61.8': swingHigh - (range * 0.618),
    '78.6': swingHigh - (range * 0.786),
    '100.0': swingLow
  };
  
  // Extension levels (for targets beyond the swing low/high)
  const extensions = {
    '127.2': swingHigh - (range * 1.272),
    '161.8': swingHigh - (range * 1.618),
    '200.0': swingHigh - (range * 2.000),
    '261.8': swingHigh - (range * 2.618)
  };
  
  return {
    swingHigh,
    swingLow,
    range,
    retracements: levels,
    extensions,
    lookback: lookbackPeriod
  };
}

/**
 * Find the nearest Fibonacci level to current price
 */
export function findNearestFibLevel(price, fibLevels, tolerance = 0.01) {
  if (!fibLevels) return null;
  
  let nearest = null;
  let minDistance = Infinity;
  
  // Check retracement levels
  for (const [level, value] of Object.entries(fibLevels.retracements)) {
    const distance = Math.abs(price - value);
    const percentDistance = distance / price;
    
    if (percentDistance <= tolerance && distance < minDistance) {
      minDistance = distance;
      nearest = {
        level: level + '%',
        price: value,
        distance: percentDistance * 100,
        type: 'retracement'
      };
    }
  }
  
  // Check extension levels
  for (const [level, value] of Object.entries(fibLevels.extensions)) {
    const distance = Math.abs(price - value);
    const percentDistance = distance / price;
    
    if (percentDistance <= tolerance && distance < minDistance) {
      minDistance = distance;
      nearest = {
        level: level + '%',
        price: value,
        distance: percentDistance * 100,
        type: 'extension'
      };
    }
  }
  
  return nearest;
}

/**
 * Candlestick Pattern Recognition
 * Identifies common candlestick patterns for reversal and continuation signals
 */

/**
 * Detect Doji - indicates indecision, potential reversal
 */
function detectDoji(candle) {
  const bodySize = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  
  if (range === 0) return null;
  
  // Doji: body is less than 10% of the total range
  if (bodySize / range <= 0.1) {
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    
    // Dragonfly Doji: long lower wick, minimal upper wick (bullish)
    if (lowerWick > range * 0.6 && upperWick < range * 0.1) {
      return { pattern: 'Dragonfly Doji', signal: 'bullish', strength: 'strong' };
    }
    
    // Gravestone Doji: long upper wick, minimal lower wick (bearish)
    if (upperWick > range * 0.6 && lowerWick < range * 0.1) {
      return { pattern: 'Gravestone Doji', signal: 'bearish', strength: 'strong' };
    }
    
    // Standard Doji: both wicks present
    return { pattern: 'Doji', signal: 'neutral', strength: 'moderate' };
  }
  
  return null;
}

/**
 * Detect Hammer / Hanging Man - single candle reversal patterns
 */
function detectHammer(candle, trend) {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  
  if (range === 0) return null;
  
  // Hammer/Hanging Man criteria:
  // - Small body (< 30% of range)
  // - Long lower wick (> 2x body)
  // - Minimal upper wick (< body)
  if (body / range <= 0.3 && lowerWick > body * 2 && upperWick < body) {
    // Hammer (bullish) appears after downtrend
    if (trend === 'downtrend' || trend === 'strong_downtrend') {
      return { pattern: 'Hammer', signal: 'bullish', strength: 'strong' };
    }
    // Hanging Man (bearish) appears after uptrend
    if (trend === 'uptrend' || trend === 'strong_uptrend') {
      return { pattern: 'Hanging Man', signal: 'bearish', strength: 'moderate' };
    }
  }
  
  return null;
}

/**
 * Detect Shooting Star / Inverted Hammer
 */
function detectShootingStar(candle, trend) {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  
  if (range === 0) return null;
  
  // Shooting Star/Inverted Hammer criteria:
  // - Small body (< 30% of range)
  // - Long upper wick (> 2x body)
  // - Minimal lower wick (< body)
  if (body / range <= 0.3 && upperWick > body * 2 && lowerWick < body) {
    // Shooting Star (bearish) appears after uptrend
    if (trend === 'uptrend' || trend === 'strong_uptrend') {
      return { pattern: 'Shooting Star', signal: 'bearish', strength: 'strong' };
    }
    // Inverted Hammer (bullish) appears after downtrend
    if (trend === 'downtrend' || trend === 'strong_downtrend') {
      return { pattern: 'Inverted Hammer', signal: 'bullish', strength: 'moderate' };
    }
  }
  
  return null;
}

/**
 * Detect Engulfing Patterns - two candle reversal patterns
 */
function detectEngulfing(prevCandle, currentCandle) {
  const prevBody = Math.abs(prevCandle.close - prevCandle.open);
  const currBody = Math.abs(currentCandle.close - currentCandle.open);
  
  const prevBullish = prevCandle.close > prevCandle.open;
  const currBullish = currentCandle.close > currentCandle.open;
  
  // Bullish Engulfing: bearish candle followed by larger bullish candle that engulfs it
  if (!prevBullish && currBullish && 
      currentCandle.open <= prevCandle.close && 
      currentCandle.close > prevCandle.open &&
      currBody > prevBody) {
    return { pattern: 'Bullish Engulfing', signal: 'bullish', strength: 'strong' };
  }
  
  // Bearish Engulfing: bullish candle followed by larger bearish candle that engulfs it
  if (prevBullish && !currBullish && 
      currentCandle.open >= prevCandle.close && 
      currentCandle.close < prevCandle.open &&
      currBody > prevBody) {
    return { pattern: 'Bearish Engulfing', signal: 'bearish', strength: 'strong' };
  }
  
  return null;
}

/**
 * Detect Morning Star / Evening Star - three candle reversal patterns
 */
function detectStar(candle1, candle2, candle3) {
  const body1 = Math.abs(candle1.close - candle1.open);
  const body2 = Math.abs(candle2.close - candle2.open);
  const body3 = Math.abs(candle3.close - candle3.open);
  
  const candle1Bullish = candle1.close > candle1.open;
  const candle3Bullish = candle3.close > candle3.open;
  
  // Morning Star (bullish reversal):
  // 1. Large bearish candle
  // 2. Small body candle (gap down)
  // 3. Large bullish candle closing above midpoint of first candle
  if (!candle1Bullish && candle3Bullish && body2 < body1 * 0.3 && body3 > body1 * 0.5) {
    const midpoint1 = (candle1.open + candle1.close) / 2;
    if (candle3.close > midpoint1 && candle2.high < candle1.close) {
      return { pattern: 'Morning Star', signal: 'bullish', strength: 'very_strong' };
    }
  }
  
  // Evening Star (bearish reversal):
  // 1. Large bullish candle
  // 2. Small body candle (gap up)
  // 3. Large bearish candle closing below midpoint of first candle
  if (candle1Bullish && !candle3Bullish && body2 < body1 * 0.3 && body3 > body1 * 0.5) {
    const midpoint1 = (candle1.open + candle1.close) / 2;
    if (candle3.close < midpoint1 && candle2.low > candle1.close) {
      return { pattern: 'Evening Star', signal: 'bearish', strength: 'very_strong' };
    }
  }
  
  return null;
}

/**
 * Detect Piercing Line / Dark Cloud Cover - two candle reversal patterns
 */
function detectPiercingDarkCloud(prevCandle, currentCandle) {
  const prevBullish = prevCandle.close > prevCandle.open;
  const currBullish = currentCandle.close > currentCandle.open;
  const prevMidpoint = (prevCandle.open + prevCandle.close) / 2;
  
  // Piercing Line (bullish): bearish candle followed by bullish that opens below low and closes above midpoint
  if (!prevBullish && currBullish && 
      currentCandle.open < prevCandle.low && 
      currentCandle.close > prevMidpoint && 
      currentCandle.close < prevCandle.open) {
    return { pattern: 'Piercing Line', signal: 'bullish', strength: 'strong' };
  }
  
  // Dark Cloud Cover (bearish): bullish candle followed by bearish that opens above high and closes below midpoint
  if (prevBullish && !currBullish && 
      currentCandle.open > prevCandle.high && 
      currentCandle.close < prevMidpoint && 
      currentCandle.close > prevCandle.open) {
    return { pattern: 'Dark Cloud Cover', signal: 'bearish', strength: 'strong' };
  }
  
  return null;
}

/**
 * Detect Three White Soldiers / Three Black Crows - continuation patterns
 */
function detectThreeSoldiersCrows(candle1, candle2, candle3) {
  const all1Bullish = candle1.close > candle1.open;
  const all2Bullish = candle2.close > candle2.open;
  const all3Bullish = candle3.close > candle3.open;
  
  const body1 = Math.abs(candle1.close - candle1.open);
  const body2 = Math.abs(candle2.close - candle2.open);
  const body3 = Math.abs(candle3.close - candle3.open);
  
  const avgBody = (body1 + body2 + body3) / 3;
  
  // Three White Soldiers (bullish continuation):
  // Three consecutive bullish candles with increasingly higher closes
  if (all1Bullish && all2Bullish && all3Bullish &&
      candle2.close > candle1.close && candle3.close > candle2.close &&
      body1 > avgBody * 0.7 && body2 > avgBody * 0.7 && body3 > avgBody * 0.7) {
    return { pattern: 'Three White Soldiers', signal: 'bullish', strength: 'strong' };
  }
  
  // Three Black Crows (bearish continuation):
  // Three consecutive bearish candles with increasingly lower closes
  if (!all1Bullish && !all2Bullish && !all3Bullish &&
      candle2.close < candle1.close && candle3.close < candle2.close &&
      body1 > avgBody * 0.7 && body2 > avgBody * 0.7 && body3 > avgBody * 0.7) {
    return { pattern: 'Three Black Crows', signal: 'bearish', strength: 'strong' };
  }
  
  return null;
}

/**
 * Analyze candlestick patterns from historical data
 */
export function analyzeCandlestickPatterns(historicalData, trend = 'unknown') {
  if (!historicalData || historicalData.length < 3) return null;
  
  const patterns = [];
  const len = historicalData.length;
  
  // Get the most recent candles
  const current = historicalData[len - 1];
  const prev1 = historicalData[len - 2];
  const prev2 = len >= 3 ? historicalData[len - 3] : null;
  
  // Single candle patterns
  const dojiPattern = detectDoji(current);
  if (dojiPattern) patterns.push(dojiPattern);
  
  const hammerPattern = detectHammer(current, trend);
  if (hammerPattern) patterns.push(hammerPattern);
  
  const shootingStarPattern = detectShootingStar(current, trend);
  if (shootingStarPattern) patterns.push(shootingStarPattern);
  
  // Two candle patterns
  const engulfingPattern = detectEngulfing(prev1, current);
  if (engulfingPattern) patterns.push(engulfingPattern);
  
  const piercingDarkCloudPattern = detectPiercingDarkCloud(prev1, current);
  if (piercingDarkCloudPattern) patterns.push(piercingDarkCloudPattern);
  
  // Three candle patterns
  if (prev2) {
    const starPattern = detectStar(prev2, prev1, current);
    if (starPattern) patterns.push(starPattern);
    
    const soldiersCrowsPattern = detectThreeSoldiersCrows(prev2, prev1, current);
    if (soldiersCrowsPattern) patterns.push(soldiersCrowsPattern);
  }
  
  // Return the strongest pattern found
  if (patterns.length === 0) return null;
  
  // Sort by strength priority
  const strengthOrder = { very_strong: 4, strong: 3, moderate: 2, weak: 1 };
  patterns.sort((a, b) => (strengthOrder[b.strength] || 0) - (strengthOrder[a.strength] || 0));
  
  return {
    primary: patterns[0],
    all: patterns,
    count: patterns.length
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
