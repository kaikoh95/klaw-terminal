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
 * Calculate Volume Weighted Moving Average (VWMA)
 * Weights each price by its volume, giving more importance to high-volume periods
 * More responsive to volume-confirmed moves than simple MA
 */
export function calculateVWMA(historicalData, period = 20) {
  if (!historicalData || historicalData.length < period) return null;
  
  const recentData = historicalData.slice(-period);
  
  let sumPriceVolume = 0;
  let sumVolume = 0;
  
  for (const candle of recentData) {
    if (!candle.close || !candle.volume) continue;
    
    const typicalPrice = candle.high && candle.low 
      ? (candle.high + candle.low + candle.close) / 3 
      : candle.close;
    
    sumPriceVolume += typicalPrice * candle.volume;
    sumVolume += candle.volume;
  }
  
  if (sumVolume === 0) return null;
  
  return sumPriceVolume / sumVolume;
}

/**
 * Analyze VWMA signals and trends
 */
export function analyzeVWMA(currentPrice, vwma20, vwma50, sma20, sma50) {
  if (!vwma20 || !sma20) {
    return {
      vwma20: null,
      vwma50: null,
      signal: 'neutral',
      strength: 'n/a',
      volumeConfirmation: false,
      description: 'Insufficient data for VWMA analysis'
    };
  }
  
  const vwmaVsSmaSpread20 = ((vwma20 - sma20) / sma20) * 100;
  const vwmaVsSmaSpread50 = vwma50 && sma50 ? ((vwma50 - sma50) / sma50) * 100 : null;
  const priceVsVwma20 = ((currentPrice - vwma20) / vwma20) * 100;
  
  // Signal logic
  let signal = 'neutral';
  let strength = 'weak';
  let volumeConfirmation = false;
  let description = '';
  
  // Volume confirmation: VWMA > SMA means high volume is pushing price higher (bullish)
  // VWMA < SMA means high volume is pushing price lower (bearish)
  if (Math.abs(vwmaVsSmaSpread20) > 0.5) {
    volumeConfirmation = true;
    
    if (vwma20 > sma20 && currentPrice > vwma20) {
      signal = 'bullish';
      strength = Math.abs(vwmaVsSmaSpread20) > 1.5 ? 'strong' : 
                 Math.abs(vwmaVsSmaSpread20) > 0.8 ? 'moderate' : 'weak';
      description = 'Volume-weighted price above SMA - institutional accumulation likely';
    } else if (vwma20 < sma20 && currentPrice < vwma20) {
      signal = 'bearish';
      strength = Math.abs(vwmaVsSmaSpread20) > 1.5 ? 'strong' : 
                 Math.abs(vwmaVsSmaSpread20) > 0.8 ? 'moderate' : 'weak';
      description = 'Volume-weighted price below SMA - institutional distribution likely';
    }
  }
  
  // Trend alignment check
  const trendAligned = vwma50 && vwma20 
    ? (signal === 'bullish' && vwma20 > vwma50) || (signal === 'bearish' && vwma20 < vwma50)
    : null;
  
  if (signal === 'neutral') {
    if (Math.abs(priceVsVwma20) < 0.5) {
      description = 'Price consolidating around VWMA - waiting for directional move';
    } else {
      description = 'Mixed volume signals - no clear institutional bias';
    }
  }
  
  return {
    vwma20,
    vwma50: vwma50 || null,
    signal,
    strength,
    volumeConfirmation,
    vwmaVsSmaSpread20: vwmaVsSmaSpread20.toFixed(2),
    vwmaVsSmaSpread50: vwmaVsSmaSpread50?.toFixed(2) || null,
    priceVsVwma20: priceVsVwma20.toFixed(2),
    trendAligned,
    description
  };
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
 * Calculate Williams %R
 * Momentum indicator that moves between 0 and -100
 * -20 to 0 = overbought | -80 to -100 = oversold
 * More sensitive than Stochastic, better for short-term reversals
 */
export function calculateWilliamsR(historicalData, period = 14) {
  if (!historicalData || historicalData.length < period) {
    return {
      value: null,
      signal: 'neutral',
      strength: 'none',
      divergence: null
    };
  }
  
  const recentData = historicalData.slice(-period);
  const currentClose = recentData[recentData.length - 1].close;
  
  const highestHigh = Math.max(...recentData.map(d => d.high));
  const lowestLow = Math.min(...recentData.map(d => d.low));
  
  if (highestHigh === lowestLow) {
    return {
      value: -50,
      signal: 'neutral',
      strength: 'none',
      divergence: null
    };
  }
  
  // Williams %R formula: ((Highest High - Close) / (Highest High - Lowest Low)) * -100
  const williamsR = ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
  
  // Determine signal strength
  let signal, strength;
  if (williamsR >= -20) {
    signal = 'overbought';
    strength = williamsR >= -10 ? 'very_strong' : 'strong';
  } else if (williamsR <= -80) {
    signal = 'oversold';
    strength = williamsR <= -90 ? 'very_strong' : 'strong';
  } else if (williamsR >= -40 && williamsR <= -30) {
    signal = 'neutral';
    strength = 'moderate';
  } else if (williamsR > -40) {
    signal = 'bullish';
    strength = 'moderate';
  } else {
    signal = 'bearish';
    strength = 'moderate';
  }
  
  // Detect divergence (requires historical Williams %R values)
  let divergence = null;
  if (historicalData.length >= period * 2) {
    const priceArray = historicalData.slice(-period * 2).map(d => d.close);
    const wrArray = [];
    
    for (let i = period - 1; i < historicalData.length; i++) {
      const slice = historicalData.slice(i - period + 1, i + 1);
      const close = slice[slice.length - 1].close;
      const high = Math.max(...slice.map(d => d.high));
      const low = Math.min(...slice.map(d => d.low));
      
      if (high !== low) {
        wrArray.push(((high - close) / (high - low)) * -100);
      }
    }
    
    if (wrArray.length >= 10) {
      const recentPrices = priceArray.slice(-5);
      const recentWR = wrArray.slice(-5);
      
      const priceTrend = recentPrices[recentPrices.length - 1] - recentPrices[0];
      const wrTrend = recentWR[recentWR.length - 1] - recentWR[0];
      
      // Bullish divergence: price making lower lows, WR making higher lows
      if (priceTrend < -0.02 * priceArray[0] && wrTrend > 5) {
        divergence = {
          type: 'bullish',
          signal: 'potential_reversal_up',
          confidence: Math.min(10, Math.floor(Math.abs(wrTrend) / 5))
        };
      }
      // Bearish divergence: price making higher highs, WR making lower highs
      else if (priceTrend > 0.02 * priceArray[0] && wrTrend < -5) {
        divergence = {
          type: 'bearish',
          signal: 'potential_reversal_down',
          confidence: Math.min(10, Math.floor(Math.abs(wrTrend) / 5))
        };
      }
    }
  }
  
  return {
    value: williamsR,
    signal,
    strength,
    divergence,
    highestHigh,
    lowestLow
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
 * Calculate Parabolic SAR (Stop and Reverse)
 * Trend-following indicator showing potential reversal points and dynamic stop levels
 * 
 * @param {Array} historicalData - OHLC data
 * @param {number} acceleration - Acceleration factor start (default 0.02)
 * @param {number} maximum - Max acceleration factor (default 0.2)
 * @returns {Object} PSAR data with value, trend, and signals
 */
export function calculateParabolicSAR(historicalData, acceleration = 0.02, maximum = 0.2) {
  if (!historicalData || historicalData.length < 5) return null;
  
  const len = historicalData.length;
  let trend = 1; // 1 = uptrend, -1 = downtrend
  let sar = historicalData[0].low; // Start with first low
  let ep = historicalData[0].high; // Extreme point (highest high in uptrend)
  let af = acceleration; // Acceleration factor
  
  // Initialize based on first few candles to determine initial trend
  if (historicalData[1].close > historicalData[0].close) {
    trend = 1;
    sar = historicalData[0].low;
    ep = historicalData[1].high;
  } else {
    trend = -1;
    sar = historicalData[0].high;
    ep = historicalData[1].low;
  }
  
  const psarData = [];
  
  for (let i = 2; i < len; i++) {
    const candle = historicalData[i];
    const prevCandle = historicalData[i - 1];
    
    // Calculate new SAR
    sar = sar + af * (ep - sar);
    
    // Check for reversal
    let reversed = false;
    
    if (trend === 1) { // Uptrend
      // SAR must be below the last two lows
      if (sar > prevCandle.low) sar = prevCandle.low;
      if (i > 2 && sar > historicalData[i - 2].low) sar = historicalData[i - 2].low;
      
      // Check if current low breaks SAR (reversal to downtrend)
      if (candle.low < sar) {
        trend = -1;
        sar = ep; // EP becomes new SAR
        ep = candle.low; // New EP is current low
        af = acceleration; // Reset AF
        reversed = true;
      } else {
        // No reversal: update EP and AF if new high
        if (candle.high > ep) {
          ep = candle.high;
          af = Math.min(af + acceleration, maximum);
        }
      }
    } else { // Downtrend
      // SAR must be above the last two highs
      if (sar < prevCandle.high) sar = prevCandle.high;
      if (i > 2 && sar < historicalData[i - 2].high) sar = historicalData[i - 2].high;
      
      // Check if current high breaks SAR (reversal to uptrend)
      if (candle.high > sar) {
        trend = 1;
        sar = ep; // EP becomes new SAR
        ep = candle.high; // New EP is current high
        af = acceleration; // Reset AF
        reversed = true;
      } else {
        // No reversal: update EP and AF if new low
        if (candle.low < ep) {
          ep = candle.low;
          af = Math.min(af + acceleration, maximum);
        }
      }
    }
    
    psarData.push({
      index: i,
      sar,
      trend,
      ep,
      af,
      reversed
    });
  }
  
  // Get current PSAR values
  const current = psarData[psarData.length - 1];
  const currentPrice = historicalData[len - 1].close;
  const distance = Math.abs(currentPrice - current.sar);
  const distancePercent = (distance / currentPrice) * 100;
  
  // Determine signal strength based on trend consistency and distance
  let strength = 'weak';
  let consecutiveTrend = 1;
  
  // Count consecutive periods in same trend
  for (let i = psarData.length - 2; i >= 0; i--) {
    if (psarData[i].trend === current.trend) {
      consecutiveTrend++;
    } else {
      break;
    }
  }
  
  // Strong trend = 5+ consecutive periods in same direction
  // Moderate trend = 3-4 consecutive periods
  if (consecutiveTrend >= 5 && distancePercent >= 1.0) {
    strength = 'strong';
  } else if (consecutiveTrend >= 3 || distancePercent >= 0.5) {
    strength = 'moderate';
  }
  
  // Determine signal
  const signal = current.trend === 1 ? 'bullish' : 'bearish';
  const trailStop = current.sar;
  
  // Check if recent reversal (high conviction signal)
  const recentReversal = current.reversed || (psarData.length > 1 && psarData[psarData.length - 2].reversed);
  
  return {
    value: current.sar,
    trend: current.trend === 1 ? 'uptrend' : 'downtrend',
    signal,
    strength,
    trailStop,
    distance: distancePercent,
    af: current.af,
    ep: current.ep,
    consecutiveTrend,
    recentReversal,
    description: current.trend === 1 
      ? `Bullish trend - SAR below price at $${current.sar.toFixed(2)} (${strength} momentum)`
      : `Bearish trend - SAR above price at $${current.sar.toFixed(2)} (${strength} momentum)`
  };
}

/**
 * Calculate SuperTrend indicator
 * Popular trend-following indicator using ATR for dynamic support/resistance
 * 
 * @param {Array} historicalData - OHLC data
 * @param {number} period - ATR period (default 10)
 * @param {number} multiplier - ATR multiplier (default 3)
 * @returns {Object} SuperTrend data with trend direction and levels
 */
export function calculateSuperTrend(historicalData, period = 10, multiplier = 3) {
  if (!historicalData || historicalData.length < period + 1) return null;
  
  const superTrendData = [];
  let prevUpperBand = null;
  let prevLowerBand = null;
  let prevSuperTrend = null;
  let prevTrend = 1; // 1 = bullish, -1 = bearish
  
  for (let i = period; i < historicalData.length; i++) {
    const slice = historicalData.slice(0, i + 1);
    const current = slice[slice.length - 1];
    
    // Calculate ATR for this point
    const atr = calculateATR(slice, period);
    if (!atr) continue;
    
    // Calculate basic bands
    const hl2 = (current.high + current.low) / 2;
    const basicUpperBand = hl2 + (multiplier * atr);
    const basicLowerBand = hl2 - (multiplier * atr);
    
    // Calculate final bands
    let finalUpperBand = basicUpperBand;
    let finalLowerBand = basicLowerBand;
    
    if (prevUpperBand !== null) {
      finalUpperBand = basicUpperBand < prevUpperBand || slice[slice.length - 2].close > prevUpperBand
        ? basicUpperBand
        : prevUpperBand;
    }
    
    if (prevLowerBand !== null) {
      finalLowerBand = basicLowerBand > prevLowerBand || slice[slice.length - 2].close < prevLowerBand
        ? basicLowerBand
        : prevLowerBand;
    }
    
    // Determine SuperTrend value and trend
    let superTrend;
    let trend;
    
    if (prevSuperTrend === null) {
      // Initial value
      superTrend = current.close <= hl2 ? finalUpperBand : finalLowerBand;
      trend = current.close <= hl2 ? -1 : 1;
    } else {
      // Trend continuation or reversal
      if (prevTrend === 1) {
        if (current.close <= finalLowerBand) {
          superTrend = finalUpperBand;
          trend = -1;
        } else {
          superTrend = finalLowerBand;
          trend = 1;
        }
      } else {
        if (current.close >= finalUpperBand) {
          superTrend = finalLowerBand;
          trend = 1;
        } else {
          superTrend = finalUpperBand;
          trend = -1;
        }
      }
    }
    
    superTrendData.push({
      timestamp: current.timestamp,
      value: superTrend,
      trend: trend,
      upperBand: finalUpperBand,
      lowerBand: finalLowerBand
    });
    
    prevUpperBand = finalUpperBand;
    prevLowerBand = finalLowerBand;
    prevSuperTrend = superTrend;
    prevTrend = trend;
  }
  
  // Get the latest values
  const latest = superTrendData[superTrendData.length - 1];
  const current = historicalData[historicalData.length - 1];
  
  // Calculate signal strength based on distance from SuperTrend line
  const distancePercent = Math.abs((current.close - latest.value) / current.close) * 100;
  let strength = 'moderate';
  
  if (distancePercent > 3) strength = 'very_strong';
  else if (distancePercent > 1.5) strength = 'strong';
  else if (distancePercent < 0.5) strength = 'weak';
  
  // Detect trend changes
  let trendChange = false;
  if (superTrendData.length > 1) {
    const previous = superTrendData[superTrendData.length - 2];
    trendChange = latest.trend !== previous.trend;
  }
  
  return {
    value: latest.value,
    trend: latest.trend === 1 ? 'bullish' : 'bearish',
    signal: latest.trend === 1 ? 'buy' : 'sell',
    strength: strength,
    trendChange: trendChange,
    upperBand: latest.upperBand,
    lowerBand: latest.lowerBand,
    distance: distancePercent,
    history: superTrendData
  };
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
 * Basic Market Data Analysis
 * For tickers without historical data (Google Finance only sources)
 * Provides limited but useful analysis based on current price data
 */
export function analyzeBasicMarketData(marketData) {
  if (!marketData || !marketData.price) {
    return null;
  }
  
  const currentPrice = marketData.price;
  const change = marketData.change || 0;
  const changePercent = marketData.changePercent || 0;
  
  // Determine basic trend from price change
  let trend = 'sideways';
  if (changePercent > 2) trend = 'uptrend';
  else if (changePercent < -2) trend = 'downtrend';
  
  // Basic momentum assessment from change
  let rsi = null;
  if (changePercent > 5) rsi = 75;  // Strong upward momentum
  else if (changePercent > 2) rsi = 65;
  else if (changePercent > 0) rsi = 55;
  else if (changePercent < -5) rsi = 25;  // Strong downward momentum
  else if (changePercent < -2) rsi = 35;
  else rsi = 45;
  
  // Basic volume analysis (if available)
  const volumeAnalysis = {
    ratio: marketData.volumeRatio || 1,
    unusual: (marketData.volumeRatio || 1) >= 1.5,
    level: (marketData.volumeRatio || 1) >= 2 ? 'high' : 'normal'
  };
  
  return {
    ticker: marketData.symbol,
    price: currentPrice,
    change,
    changePercent,
    trend,
    rsi,
    volume: volumeAnalysis,
    
    // Mark as basic analysis (limited data)
    analysisType: 'basic',
    dataSource: marketData.source || 'google',
    limitedData: true,  // Flag for UI/analysis to know this is estimate-based
    
    // Null out advanced indicators
    movingAverages: { sma20: null, sma50: null, sma200: null, ema9: null, ema21: null },
    mfi: null,
    macd: null,
    stochastic: null,
    williamsR: null,
    bollingerBands: null,
    vwap: null,
    obv: null,
    obvDivergence: null,
    cmf: null,
    atr: null,
    adx: null,
    fibonacci: null,
    nearestFib: null,
    supportResistance: { support: [], resistance: [] },
    candlestickPatterns: null,
    volumeProfile: null,
    heikinAshi: null,
    ichimoku: null,
    
    timestamp: Date.now()
  };
}

/**
 * Calculate Volume Delta - tracks buying vs selling pressure
 * Positive delta = buying pressure (volume on up-moves)
 * Negative delta = selling pressure (volume on down-moves)
 */
export function calculateVolumeDelta(historicalData, lookback = 20) {
  if (!historicalData || historicalData.length < 2) return null;
  
  const recentData = historicalData.slice(-Math.min(lookback, historicalData.length));
  
  let cumulativeDelta = 0;
  let buyVolume = 0;
  let sellVolume = 0;
  const deltaValues = [];
  
  for (let i = 1; i < recentData.length; i++) {
    const current = recentData[i];
    const previous = recentData[i - 1];
    
    if (!current.close || !previous.close || !current.volume) continue;
    
    const priceChange = current.close - previous.close;
    
    // Classify volume as buying or selling based on price direction
    if (priceChange > 0) {
      buyVolume += current.volume;
      cumulativeDelta += current.volume;
    } else if (priceChange < 0) {
      sellVolume += current.volume;
      cumulativeDelta -= current.volume;
    } else {
      // On unchanged price, split volume 50/50
      buyVolume += current.volume / 2;
      sellVolume += current.volume / 2;
    }
    
    deltaValues.push(cumulativeDelta);
  }
  
  const totalVolume = buyVolume + sellVolume;
  const buyPercentage = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 50;
  const sellPercentage = totalVolume > 0 ? (sellVolume / totalVolume) * 100 : 50;
  
  // Determine signal strength
  let signal = 'neutral';
  let strength = 'weak';
  
  if (buyPercentage >= 70) {
    signal = 'strong_accumulation';
    strength = 'very_strong';
  } else if (buyPercentage >= 60) {
    signal = 'accumulation';
    strength = 'strong';
  } else if (buyPercentage >= 55) {
    signal = 'buying_bias';
    strength = 'moderate';
  } else if (sellPercentage >= 70) {
    signal = 'strong_distribution';
    strength = 'very_strong';
  } else if (sellPercentage >= 60) {
    signal = 'distribution';
    strength = 'strong';
  } else if (sellPercentage >= 55) {
    signal = 'selling_bias';
    strength = 'moderate';
  }
  
  // Detect divergence: cumulative delta trending vs price
  let divergence = null;
  if (deltaValues.length >= 10) {
    const recentDeltas = deltaValues.slice(-10);
    const recentPrices = recentData.slice(-10);
    
    const deltaSlope = (recentDeltas[recentDeltas.length - 1] - recentDeltas[0]) / recentDeltas.length;
    const priceSlope = (recentPrices[recentPrices.length - 1].close - recentPrices[0].close) / recentPrices.length;
    
    // Bullish divergence: price down, delta up (hidden accumulation)
    if (priceSlope < 0 && deltaSlope > 0) {
      divergence = {
        type: 'bullish',
        signal: 'Price falling but buying pressure increasing - smart money accumulating',
        confidence: 8
      };
    }
    // Bearish divergence: price up, delta down (hidden distribution)
    else if (priceSlope > 0 && deltaSlope < 0) {
      divergence = {
        type: 'bearish',
        signal: 'Price rising but selling pressure increasing - smart money distributing',
        confidence: 8
      };
    }
  }
  
  return {
    cumulativeDelta,
    buyVolume,
    sellVolume,
    buyPercentage,
    sellPercentage,
    signal,
    strength,
    divergence,
    deltaValues,
    lookback,
    description: getVolumeDeltaDescription(signal)
  };
}

/**
 * Get human-readable Volume Delta description
 */
function getVolumeDeltaDescription(signal) {
  const descriptions = {
    'strong_accumulation': 'Strong institutional buying - aggressive accumulation',
    'accumulation': 'Clear buying pressure - steady accumulation',
    'buying_bias': 'Slight buying bias - mild accumulation',
    'neutral': 'Balanced buying/selling - no clear bias',
    'selling_bias': 'Slight selling bias - mild distribution',
    'distribution': 'Clear selling pressure - steady distribution',
    'strong_distribution': 'Strong institutional selling - aggressive distribution'
  };
  
  return descriptions[signal] || 'Neutral flow';
}

/**
 * Calculate Elder-Ray Index
 * Measures buying and selling pressure relative to EMA(13)
 * Bull Power = High - EMA(13) (ability of buyers to push above average)
 * Bear Power = Low - EMA(13) (ability of sellers to push below average)
 * 
 * Trading Signals:
 * - Bullish: Bull Power rising + Bear Power > 0 or rising from negative
 * - Bearish: Bear Power falling + Bull Power < 0 or falling from positive
 * - Divergences: Price makes new high/low but Elder-Ray doesn't confirm
 */
export function calculateElderRay(historicalData, period = 13) {
  if (!historicalData || historicalData.length < period + 1) return null;
  
  const closes = historicalData.map(d => d.close);
  const ema = calculateEMA(closes, period);
  
  if (!ema) return null;
  
  const latest = historicalData[historicalData.length - 1];
  const bullPower = latest.high - ema;
  const bearPower = latest.low - ema;
  
  // Calculate historical values for trend detection
  const bullPowerHistory = [];
  const bearPowerHistory = [];
  
  for (let i = period; i < historicalData.length; i++) {
    const slice = closes.slice(0, i + 1);
    const periodEma = calculateEMA(slice, period);
    
    if (periodEma) {
      bullPowerHistory.push(historicalData[i].high - periodEma);
      bearPowerHistory.push(historicalData[i].low - periodEma);
    }
  }
  
  // Determine trends
  const recentBullPower = bullPowerHistory.slice(-5);
  const recentBearPower = bearPowerHistory.slice(-5);
  
  const bullTrend = recentBullPower[recentBullPower.length - 1] > recentBullPower[0] ? 'rising' : 'falling';
  const bearTrend = recentBearPower[recentBearPower.length - 1] > recentBearPower[0] ? 'rising' : 'falling';
  
  // Signal logic
  let signal = 'neutral';
  let strength = 'weak';
  let confidence = 5;
  
  // Strong bullish: Bull Power positive and rising, Bear Power rising or positive
  if (bullPower > 0 && bullTrend === 'rising' && (bearPower > 0 || bearTrend === 'rising')) {
    signal = 'bullish';
    strength = bearPower > 0 ? 'very_strong' : 'strong';
    confidence = bearPower > 0 ? 8 : 7;
  }
  // Moderate bullish: Bull Power positive, Bear Power improving but negative
  else if (bullPower > 0 && bearTrend === 'rising' && bearPower < 0) {
    signal = 'bullish';
    strength = 'moderate';
    confidence = 6;
  }
  // Strong bearish: Bear Power negative and falling, Bull Power falling or negative
  else if (bearPower < 0 && bearTrend === 'falling' && (bullPower < 0 || bullTrend === 'falling')) {
    signal = 'bearish';
    strength = bullPower < 0 ? 'very_strong' : 'strong';
    confidence = bullPower < 0 ? 8 : 7;
  }
  // Moderate bearish: Bear Power negative, Bull Power weakening but positive
  else if (bearPower < 0 && bullTrend === 'falling' && bullPower > 0) {
    signal = 'bearish';
    strength = 'moderate';
    confidence = 6;
  }
  // Weak signals
  else if (bullPower > 0 && bearPower > -0.5) {
    signal = 'bullish';
    strength = 'weak';
    confidence = 4;
  }
  else if (bearPower < 0 && bullPower < 0.5) {
    signal = 'bearish';
    strength = 'weak';
    confidence = 4;
  }
  
  // Detect divergences
  let divergence = null;
  
  if (historicalData.length >= 20) {
    const lookback = 20;
    const recentBars = historicalData.slice(-lookback);
    const recentBull = bullPowerHistory.slice(-lookback);
    const recentBear = bearPowerHistory.slice(-lookback);
    
    const priceHigh = Math.max(...recentBars.map(d => d.high));
    const priceLow = Math.min(...recentBars.map(d => d.low));
    const bullHigh = Math.max(...recentBull);
    const bearLow = Math.min(...recentBear);
    
    const currentHigh = latest.high;
    const currentLow = latest.low;
    
    // Bearish divergence: Price making higher high, but Bull Power lower
    if (currentHigh >= priceHigh * 0.998 && bullPower < bullHigh * 0.95) {
      divergence = {
        type: 'bearish',
        signal: 'Price making new highs but bulls weakening - potential reversal down',
        confidence: 8
      };
    }
    // Bullish divergence: Price making lower low, but Bear Power higher (less negative)
    else if (currentLow <= priceLow * 1.002 && bearPower > bearLow * 0.95) {
      divergence = {
        type: 'bullish',
        signal: 'Price making new lows but bears weakening - potential reversal up',
        confidence: 8
      };
    }
  }
  
  return {
    bullPower,
    bearPower,
    bullTrend,
    bearTrend,
    signal,
    strength,
    confidence,
    divergence,
    description: getElderRayDescription(signal, strength, bullPower, bearPower)
  };
}

/**
 * Get human-readable Elder-Ray description
 */
function getElderRayDescription(signal, strength, bullPower, bearPower) {
  if (signal === 'bullish') {
    if (strength === 'very_strong') {
      return `Bulls in full control - both powers positive (Bull: ${bullPower.toFixed(3)}, Bear: ${bearPower.toFixed(3)})`;
    } else if (strength === 'strong') {
      return `Bulls dominant - power rising (Bull: ${bullPower.toFixed(3)}, Bear: ${bearPower.toFixed(3)})`;
    } else if (strength === 'moderate') {
      return `Bulls gaining ground - bear pressure easing (Bull: ${bullPower.toFixed(3)}, Bear: ${bearPower.toFixed(3)})`;
    } else {
      return `Slight bullish bias (Bull: ${bullPower.toFixed(3)}, Bear: ${bearPower.toFixed(3)})`;
    }
  } else if (signal === 'bearish') {
    if (strength === 'very_strong') {
      return `Bears in full control - both powers negative (Bull: ${bullPower.toFixed(3)}, Bear: ${bearPower.toFixed(3)})`;
    } else if (strength === 'strong') {
      return `Bears dominant - power falling (Bull: ${bullPower.toFixed(3)}, Bear: ${bearPower.toFixed(3)})`;
    } else if (strength === 'moderate') {
      return `Bears gaining ground - bull pressure easing (Bull: ${bullPower.toFixed(3)}, Bear: ${bearPower.toFixed(3)})`;
    } else {
      return `Slight bearish bias (Bull: ${bullPower.toFixed(3)}, Bear: ${bearPower.toFixed(3)})`;
    }
  } else {
    return `Neutral - balanced powers (Bull: ${bullPower.toFixed(3)}, Bear: ${bearPower.toFixed(3)})`;
  }
}

/**
 * Calculate all technical indicators for market data
 */
export function analyzeMarketData(marketData) {
  if (!marketData) {
    return null;
  }
  
  // Fallback to basic analysis if no historical data (Google Finance only sources)
  if (!marketData.historicalData || marketData.historicalData.length < 14) {
    return analyzeBasicMarketData(marketData);
  }
  
  const closes = marketData.historicalData.map(d => d.close);
  const currentPrice = marketData.price;
  
  // Moving Averages
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  
  // Volume Weighted Moving Averages
  const vwma20 = calculateVWMA(marketData.historicalData, 20);
  const vwma50 = calculateVWMA(marketData.historicalData, 50);
  const vwmaAnalysis = analyzeVWMA(currentPrice, vwma20, vwma50, sma20, sma50);
  
  // Oscillators
  const rsi = calculateRSI(closes, 14);
  const mfi = calculateMFI(marketData.historicalData, 14);
  const macd = calculateMACD(closes);
  const stochastic = calculateStochastic(marketData.historicalData);
  const williamsR = calculateWilliamsR(marketData.historicalData, 14);
  
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
  
  // Parabolic SAR - trend following with dynamic stops
  const psar = calculateParabolicSAR(marketData.historicalData);
  
  // SuperTrend - trend following indicator
  const superTrend = calculateSuperTrend(marketData.historicalData, 10, 3);
  
  // Trend Strength
  const adx = calculateADX(marketData.historicalData);
  
  // Elder-Ray Index - Bull and Bear Power
  const elderRay = calculateElderRay(marketData.historicalData, 13);
  
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
  
  // Volume Delta Analysis
  const volumeDelta = calculateVolumeDelta(marketData.historicalData, 20);
  
  // Price Action Patterns (Double Tops/Bottoms, H&S, Triangles, Wedges, etc.)
  const priceActionPatterns = detectPriceActionPatterns(marketData.historicalData, 50);
  
  return {
    ticker: marketData.symbol,
    price: currentPrice,
    movingAverages: {
      sma20,
      sma50,
      sma200,
      ema9,
      ema21,
      vwma20,
      vwma50
    },
    vwma: vwmaAnalysis,
    rsi,
    mfi,
    macd,
    stochastic,
    williamsR,
    bollingerBands: bb,
    vwap,
    obv,
    obvDivergence,
    cmf,
    atr,
    psar,
    superTrend,
    adx,
    elderRay,
    fibonacci,
    nearestFib,
    supportResistance: levels,
    volume: volumeAnalysis,
    volumeDelta,
    trend,
    candlestickPatterns,
    priceActionPatterns,
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
 * Detect Price Action Patterns
 * Identifies classic chart patterns: Double Top/Bottom, Head & Shoulders, Triangles, Wedges, etc.
 */
export function detectPriceActionPatterns(historicalData, lookback = 50) {
  if (!historicalData || historicalData.length < lookback) return null;
  
  const data = historicalData.slice(-lookback);
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const currentPrice = closes[closes.length - 1];
  
  const patterns = [];
  
  // Helper: Find local peaks and troughs
  const findPeaksAndTroughs = (prices, sensitivity = 5) => {
    const peaks = [];
    const troughs = [];
    
    for (let i = sensitivity; i < prices.length - sensitivity; i++) {
      let isPeak = true;
      let isTrough = true;
      
      for (let j = 1; j <= sensitivity; j++) {
        if (prices[i] <= prices[i - j] || prices[i] <= prices[i + j]) {
          isPeak = false;
        }
        if (prices[i] >= prices[i - j] || prices[i] >= prices[i + j]) {
          isTrough = false;
        }
      }
      
      if (isPeak) peaks.push({ index: i, price: prices[i] });
      if (isTrough) troughs.push({ index: i, price: prices[i] });
    }
    
    return { peaks, troughs };
  };
  
  const { peaks, troughs } = findPeaksAndTroughs(closes);
  
  // Double Top Pattern (bearish reversal)
  if (peaks.length >= 2) {
    const lastTwo = peaks.slice(-2);
    const priceDiff = Math.abs(lastTwo[0].price - lastTwo[1].price) / lastTwo[0].price;
    const timeDiff = lastTwo[1].index - lastTwo[0].index;
    
    if (priceDiff < 0.03 && timeDiff >= 10 && timeDiff <= 35 && currentPrice < lastTwo[1].price * 0.98) {
      const neckline = Math.min(...closes.slice(lastTwo[0].index, lastTwo[1].index));
      const target = neckline - (lastTwo[0].price - neckline);
      const confidence = priceDiff < 0.01 ? 8 : priceDiff < 0.02 ? 7 : 6;
      
      patterns.push({
        pattern: 'Double Top',
        type: 'bearish_reversal',
        confidence,
        signal: 'SHORT',
        description: 'Bearish reversal pattern - price failed twice at resistance',
        entry: neckline * 0.995,
        target,
        stopLoss: Math.max(lastTwo[0].price, lastTwo[1].price) * 1.01,
        neckline,
        formation: `Peaks at $${lastTwo[0].price.toFixed(2)} and $${lastTwo[1].price.toFixed(2)}`
      });
    }
  }
  
  // Double Bottom Pattern (bullish reversal)
  if (troughs.length >= 2) {
    const lastTwo = troughs.slice(-2);
    const priceDiff = Math.abs(lastTwo[0].price - lastTwo[1].price) / lastTwo[0].price;
    const timeDiff = lastTwo[1].index - lastTwo[0].index;
    
    if (priceDiff < 0.03 && timeDiff >= 10 && timeDiff <= 35 && currentPrice > lastTwo[1].price * 1.02) {
      const neckline = Math.max(...closes.slice(lastTwo[0].index, lastTwo[1].index));
      const target = neckline + (neckline - lastTwo[0].price);
      const confidence = priceDiff < 0.01 ? 8 : priceDiff < 0.02 ? 7 : 6;
      
      patterns.push({
        pattern: 'Double Bottom',
        type: 'bullish_reversal',
        confidence,
        signal: 'LONG',
        description: 'Bullish reversal pattern - price held twice at support',
        entry: neckline * 1.005,
        target,
        stopLoss: Math.min(lastTwo[0].price, lastTwo[1].price) * 0.99,
        neckline,
        formation: `Troughs at $${lastTwo[0].price.toFixed(2)} and $${lastTwo[1].price.toFixed(2)}`
      });
    }
  }
  
  // Head and Shoulders Pattern (bearish reversal)
  if (peaks.length >= 3) {
    const lastThree = peaks.slice(-3);
    const head = lastThree[1];
    const leftShoulder = lastThree[0];
    const rightShoulder = lastThree[2];
    
    // Check if middle peak is highest (head) and shoulders are similar height
    if (head.price > leftShoulder.price && head.price > rightShoulder.price) {
      const shoulderDiff = Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price;
      const headHeightL = (head.price - leftShoulder.price) / leftShoulder.price;
      const headHeightR = (head.price - rightShoulder.price) / rightShoulder.price;
      
      if (shoulderDiff < 0.05 && headHeightL > 0.03 && headHeightR > 0.03 && currentPrice < rightShoulder.price) {
        const necklineLeft = lows[leftShoulder.index + 3] || lows[leftShoulder.index];
        const necklineRight = lows[head.index + 3] || lows[head.index];
        const neckline = (necklineLeft + necklineRight) / 2;
        const target = neckline - (head.price - neckline);
        const confidence = shoulderDiff < 0.02 ? 9 : shoulderDiff < 0.04 ? 8 : 7;
        
        patterns.push({
          pattern: 'Head and Shoulders',
          type: 'bearish_reversal',
          confidence,
          signal: 'SHORT',
          description: 'Major bearish reversal pattern - expect significant downside',
          entry: neckline * 0.995,
          target,
          stopLoss: head.price * 1.02,
          neckline,
          formation: `LS $${leftShoulder.price.toFixed(2)} | H $${head.price.toFixed(2)} | RS $${rightShoulder.price.toFixed(2)}`
        });
      }
    }
  }
  
  // Inverse Head and Shoulders Pattern (bullish reversal)
  if (troughs.length >= 3) {
    const lastThree = troughs.slice(-3);
    const head = lastThree[1];
    const leftShoulder = lastThree[0];
    const rightShoulder = lastThree[2];
    
    // Check if middle trough is lowest (head) and shoulders are similar
    if (head.price < leftShoulder.price && head.price < rightShoulder.price) {
      const shoulderDiff = Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price;
      const headDepthL = (leftShoulder.price - head.price) / head.price;
      const headDepthR = (rightShoulder.price - head.price) / head.price;
      
      if (shoulderDiff < 0.05 && headDepthL > 0.03 && headDepthR > 0.03 && currentPrice > rightShoulder.price) {
        const necklineLeft = highs[leftShoulder.index + 3] || highs[leftShoulder.index];
        const necklineRight = highs[head.index + 3] || highs[head.index];
        const neckline = (necklineLeft + necklineRight) / 2;
        const target = neckline + (neckline - head.price);
        const confidence = shoulderDiff < 0.02 ? 9 : shoulderDiff < 0.04 ? 8 : 7;
        
        patterns.push({
          pattern: 'Inverse Head and Shoulders',
          type: 'bullish_reversal',
          confidence,
          signal: 'LONG',
          description: 'Major bullish reversal pattern - expect significant upside',
          entry: neckline * 1.005,
          target,
          stopLoss: head.price * 0.98,
          neckline,
          formation: `LS $${leftShoulder.price.toFixed(2)} | H $${head.price.toFixed(2)} | RS $${rightShoulder.price.toFixed(2)}`
        });
      }
    }
  }
  
  // Ascending Triangle (bullish continuation)
  if (peaks.length >= 2 && troughs.length >= 2) {
    const recentPeaks = peaks.slice(-3);
    const recentTroughs = troughs.slice(-3);
    
    // Check if peaks are at similar resistance and troughs are rising
    if (recentPeaks.length >= 2 && recentTroughs.length >= 2) {
      const resistanceDiff = Math.abs(recentPeaks[0].price - recentPeaks[recentPeaks.length - 1].price) / recentPeaks[0].price;
      const troughsRising = recentTroughs.every((t, i) => i === 0 || t.price > recentTroughs[i - 1].price);
      
      if (resistanceDiff < 0.02 && troughsRising) {
        const resistance = Math.max(...recentPeaks.map(p => p.price));
        const support = recentTroughs[recentTroughs.length - 1].price;
        const target = resistance + (resistance - support);
        
        patterns.push({
          pattern: 'Ascending Triangle',
          type: 'bullish_continuation',
          confidence: 7,
          signal: 'LONG',
          description: 'Bullish continuation - breakout above resistance likely',
          entry: resistance * 1.005,
          target,
          stopLoss: support * 0.98,
          resistance,
          support,
          formation: `Resistance at $${resistance.toFixed(2)}, rising support`
        });
      }
    }
  }
  
  // Descending Triangle (bearish continuation)
  if (peaks.length >= 2 && troughs.length >= 2) {
    const recentPeaks = peaks.slice(-3);
    const recentTroughs = troughs.slice(-3);
    
    // Check if troughs are at similar support and peaks are falling
    if (recentPeaks.length >= 2 && recentTroughs.length >= 2) {
      const supportDiff = Math.abs(recentTroughs[0].price - recentTroughs[recentTroughs.length - 1].price) / recentTroughs[0].price;
      const peaksFalling = recentPeaks.every((p, i) => i === 0 || p.price < recentPeaks[i - 1].price);
      
      if (supportDiff < 0.02 && peaksFalling) {
        const support = Math.min(...recentTroughs.map(t => t.price));
        const resistance = recentPeaks[recentPeaks.length - 1].price;
        const target = support - (resistance - support);
        
        patterns.push({
          pattern: 'Descending Triangle',
          type: 'bearish_continuation',
          confidence: 7,
          signal: 'SHORT',
          description: 'Bearish continuation - breakdown below support likely',
          entry: support * 0.995,
          target,
          stopLoss: resistance * 1.02,
          resistance,
          support,
          formation: `Support at $${support.toFixed(2)}, falling resistance`
        });
      }
    }
  }
  
  // Rising Wedge (bearish reversal)
  if (peaks.length >= 3 && troughs.length >= 3) {
    const recentPeaks = peaks.slice(-3);
    const recentTroughs = troughs.slice(-3);
    
    const peaksSlope = (recentPeaks[recentPeaks.length - 1].price - recentPeaks[0].price) / (recentPeaks[recentPeaks.length - 1].index - recentPeaks[0].index);
    const troughsSlope = (recentTroughs[recentTroughs.length - 1].price - recentTroughs[0].price) / (recentTroughs[recentTroughs.length - 1].index - recentTroughs[0].index);
    
    // Both lines rising, but converging (trough slope > peak slope)
    if (peaksSlope > 0 && troughsSlope > 0 && troughsSlope > peaksSlope * 0.8) {
      const apex = recentPeaks[recentPeaks.length - 1].price;
      const base = recentTroughs[0].price;
      const target = base - (apex - base) * 0.5;
      
      patterns.push({
        pattern: 'Rising Wedge',
        type: 'bearish_reversal',
        confidence: 6,
        signal: 'SHORT',
        description: 'Bearish reversal pattern - uptrend losing momentum',
        entry: currentPrice * 0.98,
        target,
        stopLoss: apex * 1.02,
        formation: 'Converging uptrend lines suggest breakdown'
      });
    }
  }
  
  // Falling Wedge (bullish reversal)
  if (peaks.length >= 3 && troughs.length >= 3) {
    const recentPeaks = peaks.slice(-3);
    const recentTroughs = troughs.slice(-3);
    
    const peaksSlope = (recentPeaks[recentPeaks.length - 1].price - recentPeaks[0].price) / (recentPeaks[recentPeaks.length - 1].index - recentPeaks[0].index);
    const troughsSlope = (recentTroughs[recentTroughs.length - 1].price - recentTroughs[0].price) / (recentTroughs[recentTroughs.length - 1].index - recentTroughs[0].index);
    
    // Both lines falling, but converging (peak slope < trough slope)
    if (peaksSlope < 0 && troughsSlope < 0 && peaksSlope < troughsSlope * 0.8) {
      const apex = recentTroughs[recentTroughs.length - 1].price;
      const base = recentPeaks[0].price;
      const target = base + (base - apex) * 0.5;
      
      patterns.push({
        pattern: 'Falling Wedge',
        type: 'bullish_reversal',
        confidence: 6,
        signal: 'LONG',
        description: 'Bullish reversal pattern - downtrend losing momentum',
        entry: currentPrice * 1.02,
        target,
        stopLoss: apex * 0.98,
        formation: 'Converging downtrend lines suggest breakout'
      });
    }
  }
  
  // Cup and Handle (bullish continuation)
  if (closes.length >= 30) {
    const cupStart = 0;
    const cupEnd = Math.floor(closes.length * 0.7);
    const handleStart = cupEnd;
    const handleEnd = closes.length - 1;
    
    const cupLow = Math.min(...closes.slice(cupStart, cupEnd));
    const cupHigh = Math.max(closes[cupStart], closes[cupEnd]);
    const handleHigh = Math.max(...closes.slice(handleStart, handleEnd));
    const handleLow = Math.min(...closes.slice(handleStart, handleEnd));
    
    // Cup depth check (20-50% retracement) and handle pullback (10-25%)
    const cupDepth = (cupHigh - cupLow) / cupHigh;
    const handleDepth = (handleHigh - handleLow) / handleHigh;
    
    if (cupDepth >= 0.15 && cupDepth <= 0.50 && handleDepth >= 0.05 && handleDepth <= 0.25 && currentPrice > handleHigh * 0.98) {
      const target = cupHigh + (cupHigh - cupLow);
      
      patterns.push({
        pattern: 'Cup and Handle',
        type: 'bullish_continuation',
        confidence: 8,
        signal: 'LONG',
        description: 'Strong bullish continuation - expect breakout to new highs',
        entry: cupHigh * 1.01,
        target,
        stopLoss: handleLow * 0.98,
        formation: `Cup depth ${(cupDepth * 100).toFixed(1)}%, handle depth ${(handleDepth * 100).toFixed(1)}%`
      });
    }
  }
  
  // Bull Flag (bullish continuation)
  const recentCloses = closes.slice(-20);
  if (recentCloses.length >= 15) {
    const flagStart = recentCloses.slice(0, 5);
    const flagBody = recentCloses.slice(5, 15);
    const flagEnd = recentCloses.slice(-3);
    
    const poleStrength = (Math.max(...flagStart) - Math.min(...flagStart)) / Math.min(...flagStart);
    const flagSlope = (flagBody[flagBody.length - 1] - flagBody[0]) / flagBody[0];
    const breakout = flagEnd[flagEnd.length - 1] > Math.max(...flagBody);
    
    // Strong upward pole (>5%), slight downward flag (-3% to +1%), breakout
    if (poleStrength > 0.05 && flagSlope >= -0.03 && flagSlope <= 0.01 && breakout) {
      const poleHeight = Math.max(...flagStart) - Math.min(...flagStart);
      const target = currentPrice + poleHeight;
      
      patterns.push({
        pattern: 'Bull Flag',
        type: 'bullish_continuation',
        confidence: 7,
        signal: 'LONG',
        description: 'Bullish continuation - consolidation after strong move up',
        entry: currentPrice,
        target,
        stopLoss: Math.min(...flagBody) * 0.98,
        formation: `Pole rise ${(poleStrength * 100).toFixed(1)}%, flag consolidation`
      });
    }
  }
  
  // Bear Flag (bearish continuation)
  if (recentCloses.length >= 15) {
    const flagStart = recentCloses.slice(0, 5);
    const flagBody = recentCloses.slice(5, 15);
    const flagEnd = recentCloses.slice(-3);
    
    const poleStrength = (Math.max(...flagStart) - Math.min(...flagStart)) / Math.max(...flagStart);
    const flagSlope = (flagBody[flagBody.length - 1] - flagBody[0]) / flagBody[0];
    const breakdown = flagEnd[flagEnd.length - 1] < Math.min(...flagBody);
    
    // Strong downward pole (>5%), slight upward flag (-1% to +3%), breakdown
    if (poleStrength > 0.05 && flagSlope >= -0.01 && flagSlope <= 0.03 && breakdown) {
      const poleHeight = Math.max(...flagStart) - Math.min(...flagStart);
      const target = currentPrice - poleHeight;
      
      patterns.push({
        pattern: 'Bear Flag',
        type: 'bearish_continuation',
        confidence: 7,
        signal: 'SHORT',
        description: 'Bearish continuation - consolidation after strong move down',
        entry: currentPrice,
        target,
        stopLoss: Math.max(...flagBody) * 1.02,
        formation: `Pole drop ${(poleStrength * 100).toFixed(1)}%, flag consolidation`
      });
    }
  }
  
  // Sort patterns by confidence
  patterns.sort((a, b) => b.confidence - a.confidence);
  
  if (patterns.length === 0) return null;
  
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
