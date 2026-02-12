// Market Sentiment Analysis
// Aggregates technical indicators across all tickers to provide overall market health

/**
 * Calculate market sentiment score from technical analysis
 * Returns a score from -100 (extreme bearish) to +100 (extreme bullish)
 */
export function calculateMarketSentiment(technicalsMap) {
  if (!technicalsMap || Object.keys(technicalsMap).length === 0) {
    return {
      score: 0,
      sentiment: 'NEUTRAL',
      confidence: 0,
      breakdown: {}
    };
  }
  
  const tickers = Object.keys(technicalsMap);
  const scores = [];
  const breakdown = {
    bullish: [],
    bearish: [],
    neutral: []
  };
  
  for (const ticker of tickers) {
    const tech = technicalsMap[ticker];
    if (!tech) continue;
    
    const tickerScore = calculateTickerSentiment(tech);
    scores.push(tickerScore);
    
    // Categorize by score
    if (tickerScore.score > 30) {
      breakdown.bullish.push({ ticker, score: tickerScore.score, signals: tickerScore.signals });
    } else if (tickerScore.score < -30) {
      breakdown.bearish.push({ ticker, score: tickerScore.score, signals: tickerScore.signals });
    } else {
      breakdown.neutral.push({ ticker, score: tickerScore.score, signals: tickerScore.signals });
    }
  }
  
  // Calculate aggregate score
  const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
  
  // Determine overall sentiment
  let sentiment = 'NEUTRAL';
  let emoji = '😐';
  
  if (avgScore >= 60) {
    sentiment = 'EXTREME BULLISH';
    emoji = '🚀';
  } else if (avgScore >= 30) {
    sentiment = 'BULLISH';
    emoji = '📈';
  } else if (avgScore >= 10) {
    sentiment = 'SLIGHTLY BULLISH';
    emoji = '🙂';
  } else if (avgScore <= -60) {
    sentiment = 'EXTREME BEARISH';
    emoji = '💥';
  } else if (avgScore <= -30) {
    sentiment = 'BEARISH';
    emoji = '📉';
  } else if (avgScore <= -10) {
    sentiment = 'SLIGHTLY BEARISH';
    emoji = '😟';
  }
  
  // Calculate confidence based on consensus
  const bullishCount = breakdown.bullish.length;
  const bearishCount = breakdown.bearish.length;
  const neutralCount = breakdown.neutral.length;
  const total = tickers.length;
  
  // High confidence if most tickers agree
  const maxCategory = Math.max(bullishCount, bearishCount, neutralCount);
  const confidence = Math.round((maxCategory / total) * 100);
  
  return {
    score: Math.round(avgScore),
    sentiment,
    emoji,
    confidence,
    breakdown,
    tickerCount: total,
    summary: generateSentimentSummary(avgScore, breakdown, confidence)
  };
}

/**
 * Calculate sentiment score for a single ticker
 */
function calculateTickerSentiment(technicals) {
  let score = 0;
  const signals = [];
  const { price, movingAverages, rsi, macd, adx, trend, obv, obvDivergence } = technicals;
  
  // 1. Trend Analysis (±30 points)
  if (trend === 'strong_uptrend') {
    score += 30;
    signals.push('Strong uptrend');
  } else if (trend === 'uptrend') {
    score += 15;
    signals.push('Uptrend');
  } else if (trend === 'strong_downtrend') {
    score -= 30;
    signals.push('Strong downtrend');
  } else if (trend === 'downtrend') {
    score -= 15;
    signals.push('Downtrend');
  }
  
  // 2. Moving Average Alignment (±20 points)
  if (movingAverages) {
    let maScore = 0;
    
    // Price vs key MAs
    if (movingAverages.ema9 && price > movingAverages.ema9) maScore += 5;
    if (movingAverages.ema9 && price < movingAverages.ema9) maScore -= 5;
    
    if (movingAverages.sma50 && price > movingAverages.sma50) maScore += 7;
    if (movingAverages.sma50 && price < movingAverages.sma50) maScore -= 7;
    
    if (movingAverages.sma200 && price > movingAverages.sma200) {
      maScore += 8;
      signals.push('Above 200 SMA');
    }
    if (movingAverages.sma200 && price < movingAverages.sma200) {
      maScore -= 8;
      signals.push('Below 200 SMA');
    }
    
    score += maScore;
  }
  
  // 3. RSI Momentum (±15 points)
  if (rsi) {
    if (rsi > 70) {
      score -= 10;
      signals.push('Overbought RSI');
    } else if (rsi > 60) {
      score += 8;
      signals.push('Strong RSI');
    } else if (rsi > 50) {
      score += 5;
    } else if (rsi < 30) {
      score += 10; // Oversold = reversal opportunity
      signals.push('Oversold RSI');
    } else if (rsi < 40) {
      score -= 8;
      signals.push('Weak RSI');
    } else if (rsi < 50) {
      score -= 5;
    }
  }
  
  // 4. MACD Signal (±15 points)
  if (macd) {
    if (macd.histogram > 0) {
      score += 10;
      signals.push('MACD bullish');
    } else if (macd.histogram < 0) {
      score -= 10;
      signals.push('MACD bearish');
    }
    
    // Histogram strengthening
    if (Math.abs(macd.histogram) > Math.abs(macd.signal) * 0.1) {
      score += macd.histogram > 0 ? 5 : -5;
    }
  }
  
  // 5. OBV Divergence (±20 points - powerful signal)
  if (obvDivergence) {
    if (obvDivergence.type === 'bullish') {
      score += obvDivergence.strength === 'strong' ? 20 : 12;
      signals.push(`Bullish OBV divergence (${obvDivergence.strength})`);
    } else if (obvDivergence.type === 'bearish') {
      score -= obvDivergence.strength === 'strong' ? 20 : 12;
      signals.push(`Bearish OBV divergence (${obvDivergence.strength})`);
    }
  } else if (obv && obv.trend) {
    // Regular OBV trend (±10 points)
    if (obv.trend === 'strong_bullish') {
      score += 10;
      signals.push('Strong accumulation');
    } else if (obv.trend === 'bullish') {
      score += 5;
    } else if (obv.trend === 'strong_bearish') {
      score -= 10;
      signals.push('Strong distribution');
    } else if (obv.trend === 'bearish') {
      score -= 5;
    }
  }
  
  // 6. Trend Strength (ADX) - confidence multiplier
  if (adx && adx.adx >= 25) {
    // Strong trend = amplify the score
    const multiplier = 1 + (adx.adx - 25) / 100;
    score *= multiplier;
    
    if (adx.trending) {
      signals.push(`Strong trend (ADX ${adx.adx.toFixed(0)})`);
    }
  } else if (adx && adx.adx < 20) {
    // Weak trend = dampen the score
    score *= 0.7;
    signals.push('Choppy market');
  }
  
  // Normalize score to -100 to +100 range
  score = Math.max(-100, Math.min(100, score));
  
  return {
    score,
    signals: signals.slice(0, 3) // Top 3 signals
  };
}

/**
 * Generate a human-readable summary
 */
function generateSentimentSummary(score, breakdown, confidence) {
  const { bullish, bearish, neutral } = breakdown;
  
  let summary = '';
  
  if (score >= 60) {
    summary = `Strong bullish momentum across ${bullish.length} ticker${bullish.length !== 1 ? 's' : ''}. `;
  } else if (score >= 30) {
    summary = `Bullish bias with ${bullish.length} ticker${bullish.length !== 1 ? 's' : ''} showing strength. `;
  } else if (score <= -60) {
    summary = `Strong bearish pressure across ${bearish.length} ticker${bearish.length !== 1 ? 's' : ''}. `;
  } else if (score <= -30) {
    summary = `Bearish bias with ${bearish.length} ticker${bearish.length !== 1 ? 's' : ''} under pressure. `;
  } else {
    summary = `Mixed signals. ${neutral.length} ticker${neutral.length !== 1 ? 's' : ''} in neutral territory. `;
  }
  
  if (confidence >= 80) {
    summary += 'High confidence - strong consensus.';
  } else if (confidence >= 60) {
    summary += 'Moderate confidence.';
  } else {
    summary += 'Low confidence - divergent signals.';
  }
  
  return summary;
}

/**
 * Get sentiment color for UI
 */
export function getSentimentColor(score) {
  if (score >= 60) return '#00ff88'; // Bright green
  if (score >= 30) return '#4ade80'; // Green
  if (score >= 10) return '#86efac'; // Light green
  if (score <= -60) return '#ff4444'; // Bright red
  if (score <= -30) return '#ef4444'; // Red
  if (score <= -10) return '#fca5a5'; // Light red
  return '#fbbf24'; // Yellow/neutral
}
