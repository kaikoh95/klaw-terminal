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
 * Calculate MFI (Money Flow Index)
 * Volume-weighted RSI that incorporates both price and volume
 * Helps identify overbought/oversold conditions with volume confirmation
 */
export function calculateMFI(historicalData, period = 14) {
  if (!historicalData || historicalData.length < period + 1) return null;
  
  let positiveFlow = 0;
  let negativeFlow = 0;
  
  // Calculate typical price and money flow for initial period
  for (let i = 1; i <= period; i++) {
    const current = historicalData[i];
    const previous = historicalData[i - 1];
    
    if (!current.high || !current.low || !current.close || !current.volume) continue;
    if (!previous.high || !previous.low || !previous.close) continue;
    
    const currentTP = (current.high + current.low + current.close) / 3;
    const previousTP = (previous.high + previous.low + previous.close) / 3;
    const rawMoneyFlow = currentTP * current.volume;
    
    if (currentTP > previousTP) {
      positiveFlow += rawMoneyFlow;
    } else if (currentTP < previousTP) {
      negativeFlow += rawMoneyFlow;
    }
  }
  
  // Calculate for the entire dataset
  for (let i = period + 1; i < historicalData.length; i++) {
    const current = historicalData[i];
    const previous = historicalData[i - 1];
    const oldData = historicalData[i - period];
    const oldPrevData = historicalData[i - period - 1];
    
    if (!current.high || !current.low || !current.close || !current.volume) continue;
    if (!previous.high || !previous.low || !previous.close) continue;
    
    const currentTP = (current.high + current.low + current.close) / 3;
    const previousTP = (previous.high + previous.low + previous.close) / 3;
    const rawMoneyFlow = currentTP * current.volume;
    
    // Add new money flow
    if (currentTP > previousTP) {
      positiveFlow += rawMoneyFlow;
    } else if (currentTP < previousTP) {
      negativeFlow += rawMoneyFlow;
    }
    
    // Remove old money flow
    if (oldData && oldPrevData) {
      const oldTP = (oldData.high + oldData.low + oldData.close) / 3;
      const oldPrevTP = (oldPrevData.high + oldPrevData.low + oldPrevData.close) / 3;
      const oldRawMoneyFlow = oldTP * oldData.volume;
      
      if (oldTP > oldPrevTP) {
        positiveFlow -= oldRawMoneyFlow;
      } else if (oldTP < oldPrevTP) {
        negativeFlow -= oldRawMoneyFlow;
      }
    }
  }
  
  // Calculate Money Flow Ratio and MFI
  if (negativeFlow === 0) return 100;
  const moneyFlowRatio = positiveFlow / negativeFlow;
  const mfi = 100 - (100 / (1 + moneyFlowRatio));
  
  // Determine signal
  let signal = 'neutral';
  let strength = 'moderate';
  
  if (mfi >= 80) {
    signal = 'overbought';
    strength = mfi >= 90 ? 'very_strong' : 'strong';
  } else if (mfi <= 20) {
    signal = 'oversold';
    strength = mfi <= 10 ? 'very_strong' : 'strong';
  } else if (mfi >= 60) {
    signal = 'bullish';
    strength = 'moderate';
  } else if (mfi <= 40) {
    signal = 'bearish';
    strength = 'moderate';
  }
  
  return {
    value: mfi,
    signal: signal,
    strength: strength,
    moneyFlowRatio: moneyFlowRatio
  };
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
 * Calculate Chaikin Money Flow (CMF)
 * Measures buying/selling pressure by analyzing close location within high-low range
 * Weighted by volume over a period (typically 20-21 days)
 * 
 * Returns value between -1 and 1:
 *   CMF > 0.25: Strong buying pressure
 *   CMF > 0.05: Moderate buying pressure
 *   CMF -0.05 to 0.05: Neutral/balanced
 *   CMF < -0.05: Moderate selling pressure
 *   CMF < -0.25: Strong selling pressure
 */
export function calculateCMF(historicalData, period = 21) {
  if (!historicalData || historicalData.length < period) return null;
  
  const recentBars = historicalData.slice(-period);
  let mfvSum = 0;
  let volumeSum = 0;
  
  for (const bar of recentBars) {
    const { high, low, close, volume } = bar;
    
    if (!high || !low || !close || !volume) continue;
    
    // Money Flow Multiplier: ((close - low) - (high - close)) / (high - low)
    // Ranges from -1 (close at low) to +1 (close at high)
    const range = high - low;
    if (range === 0) continue; // Skip if no range (high = low)
    
    const mfMultiplier = ((close - low) - (high - close)) / range;
    
    // Money Flow Volume = multiplier * volume
    const mfVolume = mfMultiplier * volume;
    
    mfvSum += mfVolume;
    volumeSum += volume;
  }
  
  if (volumeSum === 0) return null;
  
  // CMF = sum of MFV / sum of volume over period
  const cmf = mfvSum / volumeSum;
  
  // Determine signal strength
  let signal = 'neutral';
  let strength = 'weak';
  
  if (cmf > 0.25) {
    signal = 'strong_buy';
    strength = 'very_strong';
  } else if (cmf > 0.15) {
    signal = 'buy';
    strength = 'strong';
  } else if (cmf > 0.05) {
    signal = 'buy';
    strength = 'moderate';
  } else if (cmf < -0.25) {
    signal = 'strong_sell';
    strength = 'very_strong';
  } else if (cmf < -0.15) {
    signal = 'sell';
    strength = 'strong';
  } else if (cmf < -0.05) {
    signal = 'sell';
    strength = 'moderate';
  }
  
  return {
    value: cmf,
    signal,
    strength,
    description: getCMFDescription(cmf)
  };
}

/**
 * Get human-readable CMF description
 */
function getCMFDescription(cmf) {
  if (cmf > 0.25) return 'Strong accumulation - institutions buying';
  if (cmf > 0.15) return 'Solid buying pressure';
  if (cmf > 0.05) return 'Moderate buying interest';
  if (cmf > -0.05) return 'Balanced trading - no clear pressure';
  if (cmf > -0.15) return 'Moderate selling pressure';
  if (cmf > -0.25) return 'Solid distribution - selling';
  return 'Strong distribution - institutions selling';
}

/**
 * Detect CMF divergences with price
 * Similar to OBV divergence but uses CMF's money flow approach
 */
export function detectCMFDivergence(historicalData, cmfHistory) {
  if (!historicalData || !cmfHistory || historicalData.length < 20) return null;
  
  const lookback = 20;
  const recentBars = historicalData.slice(-lookback);
  const recentCMF = cmfHistory.slice(-lookback);
  
  // Find price peaks and troughs
  const priceHigh = Math.max(...recentBars.map(d => d.high));
  const priceLow = Math.min(...recentBars.map(d => d.low));
  const currentPrice = recentBars[recentBars.length - 1].close;
  
  // Find CMF peaks and troughs
  const cmfHigh = Math.max(...recentCMF);
  const cmfLow = Math.min(...recentCMF);
  const currentCMF = recentCMF[recentCMF.length - 1];
  
  let divergence = null;
  
  // Bearish divergence: price making higher highs, but CMF making lower highs
  if (currentPrice >= priceHigh * 0.98 && currentCMF < cmfHigh * 0.9) {
    divergence = {
      type: 'bearish',
      strength: 'strong',
      signal: 'Price rising but buying pressure weakening - potential top',
      confidence: 8
    };
  }
  // Bullish divergence: price making lower lows, but CMF making higher lows
  else if (currentPrice <= priceLow * 1.02 && currentCMF > cmfLow * 1.1) {
    divergence = {
      type: 'bullish',
      strength: 'strong',
      signal: 'Price falling but selling pressure easing - potential bottom',
      confidence: 8
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
 * Calculate Volume Profile - identifies price levels with highest trading volume
 * Returns Point of Control (POC), Value Area High (VAH), Value Area Low (VAL)
 * These levels act as strong support/resistance based on actual trading activity
 */
export function calculateVolumeProfile(historicalData, lookbackPeriod = 30) {
  if (!historicalData || historicalData.length < lookbackPeriod) return null;
  
  const recentData = historicalData.slice(-lookbackPeriod);
  
  // Find price range
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  
  for (const candle of recentData) {
    if (candle.low < minPrice) minPrice = candle.low;
    if (candle.high > maxPrice) maxPrice = candle.high;
  }
  
  // Create price buckets (we'll use 50 buckets for granularity)
  const numBuckets = 50;
  const priceRange = maxPrice - minPrice;
  const bucketSize = priceRange / numBuckets;
  
  // Initialize volume buckets
  const volumeProfile = new Array(numBuckets).fill(0).map((_, i) => ({
    price: minPrice + (i * bucketSize) + (bucketSize / 2), // midpoint of bucket
    volume: 0
  }));
  
  // Distribute volume across price levels
  for (const candle of recentData) {
    if (!candle.volume || candle.volume === 0) continue;
    
    // Simple distribution: spread volume evenly across the candle's range
    const candleRange = candle.high - candle.low;
    if (candleRange === 0) {
      // Single price point - put all volume there
      const bucketIndex = Math.floor((candle.close - minPrice) / bucketSize);
      if (bucketIndex >= 0 && bucketIndex < numBuckets) {
        volumeProfile[bucketIndex].volume += candle.volume;
      }
    } else {
      // Distribute volume across the candle's price range
      const lowBucket = Math.floor((candle.low - minPrice) / bucketSize);
      const highBucket = Math.floor((candle.high - minPrice) / bucketSize);
      
      for (let i = lowBucket; i <= highBucket && i < numBuckets; i++) {
        if (i >= 0) {
          volumeProfile[i].volume += candle.volume / (highBucket - lowBucket + 1);
        }
      }
    }
  }
  
  // Find Point of Control (POC) - price level with highest volume
  let pocIndex = 0;
  let maxVolume = 0;
  
  for (let i = 0; i < volumeProfile.length; i++) {
    if (volumeProfile[i].volume > maxVolume) {
      maxVolume = volumeProfile[i].volume;
      pocIndex = i;
    }
  }
  
  const poc = volumeProfile[pocIndex].price;
  
  // Calculate total volume
  const totalVolume = volumeProfile.reduce((sum, bucket) => sum + bucket.volume, 0);
  const targetVolume = totalVolume * 0.70; // 70% of volume for Value Area
  
  // Find Value Area (70% of volume around POC)
  let valueAreaVolume = volumeProfile[pocIndex].volume;
  let lowerIndex = pocIndex;
  let upperIndex = pocIndex;
  
  while (valueAreaVolume < targetVolume && (lowerIndex > 0 || upperIndex < volumeProfile.length - 1)) {
    const lowerVol = lowerIndex > 0 ? volumeProfile[lowerIndex - 1].volume : 0;
    const upperVol = upperIndex < volumeProfile.length - 1 ? volumeProfile[upperIndex + 1].volume : 0;
    
    if (lowerVol > upperVol && lowerIndex > 0) {
      lowerIndex--;
      valueAreaVolume += lowerVol;
    } else if (upperIndex < volumeProfile.length - 1) {
      upperIndex++;
      valueAreaVolume += upperVol;
    } else if (lowerIndex > 0) {
      lowerIndex--;
      valueAreaVolume += lowerVol;
    } else {
      break;
    }
  }
  
  const val = volumeProfile[lowerIndex].price;
  const vah = volumeProfile[upperIndex].price;
  
  // Get current price position relative to value area
  const currentPrice = recentData[recentData.length - 1].close;
  let position;
  
  if (currentPrice > vah) {
    position = 'above_value_area';
  } else if (currentPrice < val) {
    position = 'below_value_area';
  } else if (Math.abs(currentPrice - poc) / poc < 0.002) { // within 0.2% of POC
    position = 'at_poc';
  } else {
    position = 'in_value_area';
  }
  
  return {
    poc: poc,                    // Point of Control - highest volume price
    vah: vah,                    // Value Area High
    val: val,                    // Value Area Low
    position: position,          // Current price position
    lookback: lookbackPeriod,
    volumeDistribution: volumeProfile.map(b => ({ price: b.price, volume: Math.round(b.volume) }))
  };
}

/**
 * Calculate Heikin-Ashi Candles
 * Heikin-Ashi (平均足, "average bar") smooths price data to filter noise
 * and identify trends more easily. Strong trends show consecutive candles
 * of the same color with no lower wicks (uptrend) or upper wicks (downtrend).
 */
export function calculateHeikinAshi(historicalData) {
  if (!historicalData || historicalData.length < 2) return null;
  
  const haCandles = [];
  
  for (let i = 0; i < historicalData.length; i++) {
    const current = historicalData[i];
    const previous = i > 0 ? haCandles[i - 1] : null;
    
    // Heikin-Ashi formulas:
    // HA-Close = (O + H + L + C) / 4
    // HA-Open = (prev HA-Open + prev HA-Close) / 2
    // HA-High = max(H, HA-Open, HA-Close)
    // HA-Low = min(L, HA-Open, HA-Close)
    
    const haClose = (current.open + current.high + current.low + current.close) / 4;
    const haOpen = previous ? (previous.open + previous.close) / 2 : (current.open + current.close) / 2;
    const haHigh = Math.max(current.high, haOpen, haClose);
    const haLow = Math.min(current.low, haOpen, haClose);
    
    haCandles.push({
      timestamp: current.timestamp,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
      volume: current.volume,
      // Additional metadata for trend analysis
      isBullish: haClose > haOpen,
      body: Math.abs(haClose - haOpen),
      upperWick: haHigh - Math.max(haOpen, haClose),
      lowerWick: Math.min(haOpen, haClose) - haLow
    });
  }
  
  return haCandles;
}

/**
 * Analyze Heikin-Ashi trend strength
 * Returns trend signals based on consecutive candle patterns
 */
export function analyzeHeikinAshiTrend(haCandles, lookback = 10) {
  if (!haCandles || haCandles.length < lookback) return null;
  
  const recent = haCandles.slice(-lookback);
  const current = recent[recent.length - 1];
  
  // Count consecutive bullish/bearish candles
  let consecutiveBullish = 0;
  let consecutiveBearish = 0;
  
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].isBullish) {
      consecutiveBullish++;
      if (consecutiveBearish > 0) break;
    } else {
      consecutiveBearish++;
      if (consecutiveBullish > 0) break;
    }
  }
  
  // Strong trend indicators:
  // 1. Multiple consecutive candles of same color
  // 2. Small/no opposing wicks
  // 3. Large bodies relative to wicks
  
  const totalWick = current.upperWick + current.lowerWick;
  const bodyToWickRatio = totalWick > 0 ? current.body / totalWick : 999;
  
  // Detect strong trends
  let trend = 'neutral';
  let strength = 'weak';
  let confidence = 5;
  
  if (consecutiveBullish >= 5) {
    trend = 'strong_uptrend';
    strength = 'very_strong';
    confidence = 9;
  } else if (consecutiveBullish >= 3) {
    trend = 'uptrend';
    strength = current.lowerWick < current.body * 0.2 ? 'strong' : 'moderate';
    confidence = current.lowerWick < current.body * 0.2 ? 8 : 7;
  } else if (consecutiveBearish >= 5) {
    trend = 'strong_downtrend';
    strength = 'very_strong';
    confidence = 9;
  } else if (consecutiveBearish >= 3) {
    trend = 'downtrend';
    strength = current.upperWick < current.body * 0.2 ? 'strong' : 'moderate';
    confidence = current.upperWick < current.body * 0.2 ? 8 : 7;
  } else {
    trend = 'consolidation';
    strength = 'weak';
    confidence = 4;
  }
  
  // Detect potential reversals
  let reversal = null;
  
  // Bullish reversal: after downtrend, HA candle with small upper wick and large lower wick
  if (consecutiveBearish >= 2 && current.isBullish && current.lowerWick > current.body * 0.5) {
    reversal = {
      type: 'bullish',
      signal: 'Potential reversal up - first green HA candle after red streak',
      confidence: 6 + Math.min(consecutiveBearish, 3)
    };
  }
  
  // Bearish reversal: after uptrend, HA candle with small lower wick and large upper wick
  if (consecutiveBullish >= 2 && !current.isBullish && current.upperWick > current.body * 0.5) {
    reversal = {
      type: 'bearish',
      signal: 'Potential reversal down - first red HA candle after green streak',
      confidence: 6 + Math.min(consecutiveBullish, 3)
    };
  }
  
  return {
    trend,
    strength,
    confidence,
    consecutiveBullish,
    consecutiveBearish,
    bodyToWickRatio,
    currentColor: current.isBullish ? 'green' : 'red',
    reversal,
    signals: {
      strongTrend: (consecutiveBullish >= 5 || consecutiveBearish >= 5),
      trendContinuation: (consecutiveBullish >= 3 || consecutiveBearish >= 3),
      indecision: consecutiveBullish <= 1 && consecutiveBearish <= 1,
      possibleReversal: reversal !== null
    }
  };
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
  const mfi = calculateMFI(marketData.historicalData, 14);
  const macd = calculateMACD(closes);
  const stochastic = calculateStochastic(marketData.historicalData);
  
  // Bands
  const bb = calculateBollingerBands(closes);
  
  // VWAP
  const vwap = calculateVWAP(marketData.historicalData);
  
  // OBV (On-Balance Volume)
  const obv = calculateOBV(marketData.historicalData);
  const obvDivergence = obv ? detectOBVDivergence(marketData.historicalData, obv) : null;
  
  // CMF (Chaikin Money Flow)
  const cmf = calculateCMF(marketData.historicalData, 21);
  
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
  
  // Volume Profile Analysis
  const volumeProfile = calculateVolumeProfile(marketData.historicalData);
  
  // Heikin-Ashi Analysis
  const heikinAshi = calculateHeikinAshi(marketData.historicalData);
  const haTrend = heikinAshi ? analyzeHeikinAshiTrend(heikinAshi) : null;
  
  // Ichimoku Cloud
  const ichimoku = calculateIchimoku(marketData.historicalData);
  
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
    mfi,
    macd,
    stochastic,
    bollingerBands: bb,
    vwap,
    obv,
    obvDivergence,
    cmf,
    atr,
    adx,
    fibonacci,
    nearestFib,
    supportResistance: levels,
    volume: volumeAnalysis,
    trend,
    candlestickPatterns,
    volumeProfile,
    heikinAshi: haTrend,
    ichimoku,
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
 * Calculate Ichimoku Cloud (Ichimoku Kinko Hyo)
 * Japanese technical indicator providing trend, momentum, and support/resistance
 */
export function calculateIchimoku(historicalData) {
  if (!historicalData || historicalData.length < 52) return null;
  
  const data = historicalData;
  const currentIdx = data.length - 1;
  
  // Helper function to get highest high and lowest low over period
  const getHighLow = (endIdx, period) => {
    const start = Math.max(0, endIdx - period + 1);
    const slice = data.slice(start, endIdx + 1);
    const high = Math.max(...slice.map(d => d.high));
    const low = Math.min(...slice.map(d => d.low));
    return { high, low };
  };
  
  // Tenkan-sen (Conversion Line): (9-period high + 9-period low) / 2
  const tenkanHL = getHighLow(currentIdx, 9);
  const tenkanSen = (tenkanHL.high + tenkanHL.low) / 2;
  
  // Kijun-sen (Base Line): (26-period high + 26-period low) / 2
  const kijunHL = getHighLow(currentIdx, 26);
  const kijunSen = (kijunHL.high + kijunHL.low) / 2;
  
  // Senkou Span A (Leading Span A): (Conversion Line + Base Line) / 2, plotted 26 periods ahead
  const senkouSpanA = (tenkanSen + kijunSen) / 2;
  
  // Senkou Span B (Leading Span B): (52-period high + 52-period low) / 2, plotted 26 periods ahead
  const senkouHL = getHighLow(currentIdx, 52);
  const senkouSpanB = (senkouHL.high + senkouHL.low) / 2;
  
  // Chikou Span (Lagging Span): Current close plotted 26 periods behind
  const chikouSpan = data[currentIdx].close;
  const chikouReference = currentIdx >= 26 ? data[currentIdx - 26].close : null;
  
  // Current price
  const currentPrice = data[currentIdx].close;
  
  // Cloud analysis
  const cloudTop = Math.max(senkouSpanA, senkouSpanB);
  const cloudBottom = Math.min(senkouSpanA, senkouSpanB);
  const cloudThickness = cloudTop - cloudBottom;
  const cloudColor = senkouSpanA > senkouSpanB ? 'bullish' : 'bearish';
  
  // Price position relative to cloud
  let pricePosition = 'in_cloud';
  if (currentPrice > cloudTop) {
    pricePosition = 'above_cloud';
  } else if (currentPrice < cloudBottom) {
    pricePosition = 'below_cloud';
  }
  
  // TK Cross (Tenkan-Kijun crossover signal)
  let tkCross = 'neutral';
  if (tenkanSen > kijunSen) {
    tkCross = 'bullish';
  } else if (tenkanSen < kijunSen) {
    tkCross = 'bearish';
  }
  
  // Future cloud analysis (what cloud looks like ahead)
  // In practice, we look at historical cloud 26 periods ago
  const futureCloudIdx = Math.max(0, currentIdx - 26);
  if (futureCloudIdx >= 26 && futureCloudIdx < data.length) {
    const futureA = getHighLow(futureCloudIdx, 9);
    const futureB = getHighLow(futureCloudIdx, 26);
    const futureSpanA = (((futureA.high + futureA.low) / 2) + ((futureB.high + futureB.low) / 2)) / 2;
    
    const futureC = getHighLow(futureCloudIdx, 52);
    const futureSpanB = (futureC.high + futureC.low) / 2;
  }
  
  // Generate trading signals
  const signals = [];
  let signal = 'neutral';
  let confidence = 5;
  
  // Strong bullish: Price above cloud, TK bullish cross, cloud is bullish
  if (pricePosition === 'above_cloud' && tkCross === 'bullish' && cloudColor === 'bullish') {
    signal = 'strong_bullish';
    confidence = 9;
    signals.push('Strong uptrend: Price above bullish cloud with TK bullish');
  }
  // Moderate bullish: Price above cloud
  else if (pricePosition === 'above_cloud' && cloudColor === 'bullish') {
    signal = 'bullish';
    confidence = 7;
    signals.push('Uptrend: Price above bullish cloud');
  }
  else if (pricePosition === 'above_cloud') {
    signal = 'bullish';
    confidence = 6;
    signals.push('Price above cloud (support)');
  }
  // Strong bearish: Price below cloud, TK bearish cross, cloud is bearish
  else if (pricePosition === 'below_cloud' && tkCross === 'bearish' && cloudColor === 'bearish') {
    signal = 'strong_bearish';
    confidence = 9;
    signals.push('Strong downtrend: Price below bearish cloud with TK bearish');
  }
  // Moderate bearish: Price below cloud
  else if (pricePosition === 'below_cloud' && cloudColor === 'bearish') {
    signal = 'bearish';
    confidence = 7;
    signals.push('Downtrend: Price below bearish cloud');
  }
  else if (pricePosition === 'below_cloud') {
    signal = 'bearish';
    confidence = 6;
    signals.push('Price below cloud (resistance)');
  }
  // In cloud = uncertainty/consolidation
  else if (pricePosition === 'in_cloud') {
    signal = 'neutral';
    confidence = 4;
    signals.push('Price in cloud (indecision/consolidation)');
  }
  
  // TK Cross signal (entry trigger)
  if (tkCross === 'bullish' && pricePosition !== 'below_cloud') {
    signals.push('TK Bullish Cross (buy signal)');
  } else if (tkCross === 'bearish' && pricePosition !== 'above_cloud') {
    signals.push('TK Bearish Cross (sell signal)');
  }
  
  // Chikou Span confirmation
  if (chikouReference !== null) {
    if (chikouSpan > chikouReference && pricePosition === 'above_cloud') {
      signals.push('Chikou confirms bullish (above price 26 bars ago)');
      confidence = Math.min(10, confidence + 1);
    } else if (chikouSpan < chikouReference && pricePosition === 'below_cloud') {
      signals.push('Chikou confirms bearish (below price 26 bars ago)');
      confidence = Math.min(10, confidence + 1);
    }
  }
  
  return {
    tenkanSen,
    kijunSen,
    senkouSpanA,
    senkouSpanB,
    chikouSpan,
    cloud: {
      top: cloudTop,
      bottom: cloudBottom,
      thickness: cloudThickness,
      color: cloudColor,
      thicknessPercent: (cloudThickness / currentPrice) * 100
    },
    pricePosition,
    tkCross,
    signal,
    confidence,
    signals: signals.slice(0, 3) // Top 3 signals
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
