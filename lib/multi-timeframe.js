// Multi-Timeframe Confluence Analysis
// Analyzes multiple timeframes to identify high-probability setups

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

/**
 * Timeframe configurations
 */
const TIMEFRAMES = {
  daily: { interval: '1d', range: '1y', label: 'Daily', weight: 3 },
  hourly: { interval: '1h', range: '1mo', label: 'Hourly', weight: 2 },
  fifteenMin: { interval: '15m', range: '5d', label: '15min', weight: 1 }
};

/**
 * Fetch data for a specific timeframe
 */
async function fetchTimeframeData(ticker, interval, range) {
  try {
    const url = `${YAHOO_BASE}/${ticker}?interval=${interval}&range=${range}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    
    if (!result) return null;
    
    const quote = result.indicators?.quote?.[0];
    const timestamps = result.timestamp;
    
    if (!quote || !timestamps) return null;
    
    // Build historical data array
    const historicalData = timestamps.map((ts, i) => ({
      timestamp: ts,
      open: quote.open[i],
      high: quote.high[i],
      low: quote.low[i],
      close: quote.close[i],
      volume: quote.volume[i]
    })).filter(d => d.close !== null);
    
    return historicalData;
  } catch (error) {
    console.error(`Error fetching ${interval} data for ${ticker}:`, error.message);
    return null;
  }
}

/**
 * Analyze a single timeframe using simplified technicals
 */
function analyzeTimeframe(data) {
  if (!data || data.length < 50) return null;
  
  const closes = data.map(d => d.close);
  const volumes = data.map(d => d.volume);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  
  const currentPrice = closes[closes.length - 1];
  const previousPrice = closes[closes.length - 2];
  const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;
  
  // Simple Moving Averages
  const sma20 = closes.slice(-20).reduce((a, b) => a + b) / 20;
  const sma50 = closes.slice(-50).reduce((a, b) => a + b) / 50;
  
  // Price position relative to SMAs
  const aboveSMA20 = currentPrice > sma20;
  const aboveSMA50 = currentPrice > sma50;
  const smaAlignment = sma20 > sma50; // Bullish if true
  
  // RSI (14 period)
  const rsi = calculateRSI(closes, 14);
  
  // MACD
  const macd = calculateMACD(closes);
  
  // Trend determination
  let trend = 'sideways';
  if (aboveSMA20 && aboveSMA50 && smaAlignment && rsi > 50) {
    trend = 'bullish';
  } else if (!aboveSMA20 && !aboveSMA50 && !smaAlignment && rsi < 50) {
    trend = 'bearish';
  }
  
  // Volume analysis
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b) / 20;
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = currentVolume / avgVolume;
  
  // Support/Resistance (basic)
  const recent = data.slice(-50);
  const support = Math.min(...recent.map(d => d.low));
  const resistance = Math.max(...recent.map(d => d.high));
  
  return {
    price: currentPrice,
    priceChange,
    trend,
    sma20,
    sma50,
    aboveSMA20,
    aboveSMA50,
    smaAlignment,
    rsi,
    macd: {
      value: macd.macd,
      signal: macd.signal,
      histogram: macd.histogram,
      trend: macd.histogram > 0 ? 'bullish' : 'bearish'
    },
    volumeRatio,
    support,
    resistance,
    distanceToSupport: ((currentPrice - support) / support) * 100,
    distanceToResistance: ((resistance - currentPrice) / currentPrice) * 100
  };
}

/**
 * Calculate RSI
 */
function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  
  const changes = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  
  const recentChanges = changes.slice(-period);
  const gains = recentChanges.filter(c => c > 0);
  const losses = recentChanges.filter(c => c < 0).map(c => Math.abs(c));
  
  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b) / period : 0;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return rsi;
}

/**
 * Calculate MACD
 */
function calculateMACD(closes) {
  if (closes.length < 26) {
    return { macd: 0, signal: 0, histogram: 0 };
  }
  
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macd = ema12 - ema26;
  
  // Signal line (9-period EMA of MACD)
  const macdValues = [];
  for (let i = 26; i < closes.length; i++) {
    const ema12_i = calculateEMA(closes.slice(0, i + 1), 12);
    const ema26_i = calculateEMA(closes.slice(0, i + 1), 26);
    macdValues.push(ema12_i - ema26_i);
  }
  
  const signal = macdValues.length >= 9 ? calculateEMA(macdValues, 9) : 0;
  const histogram = macd - signal;
  
  return { macd, signal, histogram };
}

/**
 * Calculate EMA
 */
function calculateEMA(data, period) {
  if (data.length < period) return data[data.length - 1];
  
  const multiplier = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((a, b) => a + b) / period;
  
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

/**
 * Calculate confluence score across timeframes
 */
function calculateConfluence(analyses) {
  let bullishScore = 0;
  let bearishScore = 0;
  let totalWeight = 0;
  
  const signals = [];
  
  for (const [tf, analysis] of Object.entries(analyses)) {
    if (!analysis) continue;
    
    const weight = TIMEFRAMES[tf].weight;
    totalWeight += weight;
    
    const tfSignals = [];
    
    // Trend alignment
    if (analysis.trend === 'bullish') {
      bullishScore += weight * 2;
      tfSignals.push(`${TIMEFRAMES[tf].label}: Bullish trend`);
    } else if (analysis.trend === 'bearish') {
      bearishScore += weight * 2;
      tfSignals.push(`${TIMEFRAMES[tf].label}: Bearish trend`);
    }
    
    // RSI
    if (analysis.rsi > 60) {
      bullishScore += weight;
      tfSignals.push(`${TIMEFRAMES[tf].label}: RSI ${analysis.rsi.toFixed(0)} (strong)`);
    } else if (analysis.rsi < 40) {
      bearishScore += weight;
      tfSignals.push(`${TIMEFRAMES[tf].label}: RSI ${analysis.rsi.toFixed(0)} (weak)`);
    }
    
    // MACD
    if (analysis.macd.histogram > 0) {
      bullishScore += weight;
      tfSignals.push(`${TIMEFRAMES[tf].label}: MACD bullish`);
    } else {
      bearishScore += weight;
      tfSignals.push(`${TIMEFRAMES[tf].label}: MACD bearish`);
    }
    
    // SMA alignment
    if (analysis.smaAlignment && analysis.aboveSMA20) {
      bullishScore += weight;
    } else if (!analysis.smaAlignment && !analysis.aboveSMA20) {
      bearishScore += weight;
    }
    
    signals.push(...tfSignals);
  }
  
  // Normalize scores (0-100)
  const maxScore = totalWeight * 4; // Max possible score
  const bullishPercent = (bullishScore / maxScore) * 100;
  const bearishPercent = (bearishScore / maxScore) * 100;
  
  // Determine overall direction
  let direction = 'neutral';
  let confidence = 0;
  
  if (bullishPercent > bearishPercent + 20) {
    direction = 'bullish';
    confidence = Math.min(10, Math.round((bullishPercent - bearishPercent) / 10));
  } else if (bearishPercent > bullishPercent + 20) {
    direction = 'bearish';
    confidence = Math.min(10, Math.round((bearishPercent - bullishPercent) / 10));
  }
  
  return {
    direction,
    confidence,
    bullishScore: bullishPercent.toFixed(1),
    bearishScore: bearishPercent.toFixed(1),
    alignment: Math.abs(bullishPercent - bearishPercent) > 40 ? 'strong' : 
                Math.abs(bullishPercent - bearishPercent) > 20 ? 'moderate' : 'weak',
    signals
  };
}

/**
 * Main function: Analyze ticker across all timeframes
 */
export async function analyzeMultiTimeframe(ticker) {
  console.log(`\n📊 Multi-Timeframe Analysis for ${ticker}...`);
  
  // Fetch data for all timeframes
  const timeframeData = {};
  
  for (const [key, config] of Object.entries(TIMEFRAMES)) {
    console.log(`  Fetching ${config.label} data...`);
    const data = await fetchTimeframeData(ticker, config.interval, config.range);
    if (data) {
      timeframeData[key] = data;
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  // Analyze each timeframe
  const analyses = {};
  for (const [key, data] of Object.entries(timeframeData)) {
    if (data) {
      analyses[key] = analyzeTimeframe(data);
    }
  }
  
  // Calculate confluence
  const confluence = calculateConfluence(analyses);
  
  // Build summary
  const summary = {
    ticker,
    timestamp: Date.now(),
    timeframes: {},
    confluence
  };
  
  for (const [key, analysis] of Object.entries(analyses)) {
    if (analysis) {
      summary.timeframes[key] = {
        label: TIMEFRAMES[key].label,
        trend: analysis.trend,
        rsi: analysis.rsi.toFixed(1),
        macd: analysis.macd.trend,
        price: analysis.price.toFixed(2),
        priceChange: analysis.priceChange.toFixed(2),
        volumeRatio: analysis.volumeRatio.toFixed(2)
      };
    }
  }
  
  return summary;
}

/**
 * Batch analyze multiple tickers
 */
export async function batchAnalyzeMultiTimeframe(tickers) {
  const results = {};
  
  for (const ticker of tickers) {
    try {
      results[ticker] = await analyzeMultiTimeframe(ticker);
      // Delay between tickers to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error analyzing ${ticker}:`, error.message);
      results[ticker] = { error: error.message };
    }
  }
  
  return results;
}

/**
 * Format multi-timeframe summary for display
 */
export function formatMultiTimeframeSummary(mtfAnalysis) {
  if (!mtfAnalysis) return 'N/A';
  
  const { timeframes, confluence } = mtfAnalysis;
  
  let output = `\n**Multi-Timeframe Confluence:**\n`;
  output += `Direction: ${confluence.direction.toUpperCase()} | `;
  output += `Confidence: ${confluence.confidence}/10 | `;
  output += `Alignment: ${confluence.alignment.toUpperCase()}\n`;
  output += `Scores: Bull ${confluence.bullishScore}% / Bear ${confluence.bearishScore}%\n\n`;
  
  output += `**Timeframe Breakdown:**\n`;
  for (const [key, tf] of Object.entries(timeframes)) {
    const icon = tf.trend === 'bullish' ? '🟢' : tf.trend === 'bearish' ? '🔴' : '⚪';
    output += `${icon} ${tf.label}: ${tf.trend.toUpperCase()} | `;
    output += `RSI ${tf.rsi} | MACD ${tf.macd} | `;
    output += `Vol ${tf.volumeRatio}x\n`;
  }
  
  output += `\n**Key Signals:**\n`;
  confluence.signals.slice(0, 5).forEach(signal => {
    output += `• ${signal}\n`;
  });
  
  return output;
}
