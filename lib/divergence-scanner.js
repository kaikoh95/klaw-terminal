// RSI Divergence Scanner - Detect hidden opportunities across all tickers
import { calculateRSI } from './technicals.js';

/**
 * Detect RSI divergences for a single ticker
 */
export function detectRSIDivergence(historicalData, ticker, currentPrice) {
  if (!historicalData || historicalData.length < 30) {
    return null;
  }

  const prices = historicalData.map(d => d.close);
  const rsiPeriod = 14;
  const lookbackPeriods = 20; // Look back 20 periods for divergence

  // Calculate RSI for all periods
  const rsiValues = [];
  for (let i = rsiPeriod; i < prices.length; i++) {
    const slice = prices.slice(i - rsiPeriod, i);
    const rsi = calculateRSI(slice);
    rsiValues.push({ rsi, price: prices[i], index: i });
  }

  if (rsiValues.length < lookbackPeriods) {
    return null;
  }

  // Get recent data for divergence detection
  const recentData = rsiValues.slice(-lookbackPeriods);
  const currentRSI = recentData[recentData.length - 1].rsi;

  // Find local price lows and highs
  const priceLows = [];
  const priceHighs = [];

  for (let i = 2; i < recentData.length - 2; i++) {
    const current = recentData[i];
    const prev2 = recentData[i - 2];
    const prev1 = recentData[i - 1];
    const next1 = recentData[i + 1];
    const next2 = recentData[i + 2];

    // Local low (price)
    if (current.price < prev1.price && 
        current.price < prev2.price && 
        current.price < next1.price && 
        current.price < next2.price) {
      priceLows.push({ index: i, price: current.price, rsi: current.rsi });
    }

    // Local high (price)
    if (current.price > prev1.price && 
        current.price > prev2.price && 
        current.price > next1.price && 
        current.price > next2.price) {
      priceHighs.push({ index: i, price: current.price, rsi: current.rsi });
    }
  }

  // Detect bullish divergence (price makes lower low, RSI makes higher low)
  let bullishDivergence = null;
  if (priceLows.length >= 2) {
    const recentLows = priceLows.slice(-2);
    const [older, newer] = recentLows;

    if (newer.price < older.price && newer.rsi > older.rsi) {
      const priceDiff = ((newer.price - older.price) / older.price) * 100;
      const rsiDiff = newer.rsi - older.rsi;
      const strength = Math.min(10, Math.abs(priceDiff) + rsiDiff * 2);
      const daysAgo = recentData.length - 1 - newer.index;

      bullishDivergence = {
        type: 'bullish',
        confidence: Math.round(strength),
        olderLow: { price: older.price.toFixed(2), rsi: older.rsi.toFixed(1) },
        newerLow: { price: newer.price.toFixed(2), rsi: newer.rsi.toFixed(1) },
        priceDiff: priceDiff.toFixed(2),
        rsiDiff: rsiDiff.toFixed(1),
        daysAgo,
        currentRSI: currentRSI.toFixed(1),
        signal: 'BULLISH REVERSAL LIKELY - Price weakness not confirmed by momentum',
        description: `Price made lower low (${older.price.toFixed(2)} → ${newer.price.toFixed(2)}) but RSI made higher low (${older.rsi.toFixed(1)} → ${newer.rsi.toFixed(1)}). ${daysAgo} period(s) ago.`
      };
    }
  }

  // Detect bearish divergence (price makes higher high, RSI makes lower high)
  let bearishDivergence = null;
  if (priceHighs.length >= 2) {
    const recentHighs = priceHighs.slice(-2);
    const [older, newer] = recentHighs;

    if (newer.price > older.price && newer.rsi < older.rsi) {
      const priceDiff = ((newer.price - older.price) / older.price) * 100;
      const rsiDiff = older.rsi - newer.rsi;
      const strength = Math.min(10, Math.abs(priceDiff) + rsiDiff * 2);
      const daysAgo = recentData.length - 1 - newer.index;

      bearishDivergence = {
        type: 'bearish',
        confidence: Math.round(strength),
        olderHigh: { price: older.price.toFixed(2), rsi: older.rsi.toFixed(1) },
        newerHigh: { price: newer.price.toFixed(2), rsi: newer.rsi.toFixed(1) },
        priceDiff: priceDiff.toFixed(2),
        rsiDiff: rsiDiff.toFixed(1),
        daysAgo,
        currentRSI: currentRSI.toFixed(1),
        signal: 'BEARISH REVERSAL LIKELY - Price strength not confirmed by momentum',
        description: `Price made higher high (${older.price.toFixed(2)} → ${newer.price.toFixed(2)}) but RSI made lower high (${older.rsi.toFixed(1)} → ${newer.rsi.toFixed(1)}). ${daysAgo} period(s) ago.`
      };
    }
  }

  // Return the strongest divergence if found
  if (bullishDivergence && bearishDivergence) {
    return bullishDivergence.confidence > bearishDivergence.confidence ? bullishDivergence : bearishDivergence;
  }

  return bullishDivergence || bearishDivergence;
}

/**
 * Scan all tickers for RSI divergences
 */
export function scanAllDivergences(marketDataMap) {
  const divergences = [];

  for (const [ticker, data] of Object.entries(marketDataMap)) {
    if (!data || !data.historicalData || data.historicalData.length < 30) {
      continue;
    }

    const divergence = detectRSIDivergence(data.historicalData, ticker, data.price);

    if (divergence) {
      divergences.push({
        ticker,
        ...divergence,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        volume: data.volume,
        volumeRatio: data.volumeRatio
      });
    }
  }

  // Sort by confidence (highest first)
  divergences.sort((a, b) => b.confidence - a.confidence);

  return {
    total: divergences.length,
    bullish: divergences.filter(d => d.type === 'bullish').length,
    bearish: divergences.filter(d => d.type === 'bearish').length,
    divergences,
    timestamp: Date.now()
  };
}

/**
 * Get divergence summary statistics
 */
export function getDivergenceSummary(scanResult) {
  if (!scanResult || !scanResult.divergences) {
    return null;
  }

  const { divergences } = scanResult;

  const highConfidence = divergences.filter(d => d.confidence >= 7);
  const mediumConfidence = divergences.filter(d => d.confidence >= 5 && d.confidence < 7);
  const recentDivergences = divergences.filter(d => d.daysAgo <= 3);

  return {
    total: divergences.length,
    bullish: scanResult.bullish,
    bearish: scanResult.bearish,
    highConfidence: highConfidence.length,
    mediumConfidence: mediumConfidence.length,
    recent: recentDivergences.length,
    topSetups: divergences.slice(0, 5).map(d => ({
      ticker: d.ticker,
      type: d.type,
      confidence: d.confidence,
      signal: d.signal
    }))
  };
}
