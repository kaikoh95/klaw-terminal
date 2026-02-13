// Risk Management & Position Sizing Module

/**
 * Calculate position size based on risk parameters
 * @param {number} accountSize - Total account value
 * @param {number} riskPercent - Risk per trade (e.g., 1 for 1%)
 * @param {number} entryPrice - Entry price
 * @param {number} stopLoss - Stop loss price
 * @param {number} commission - Commission per share (default 0)
 * @returns {object} Position sizing details
 */
export function calculatePositionSize(accountSize, riskPercent, entryPrice, stopLoss, commission = 0) {
  // Validate inputs
  if (accountSize <= 0 || riskPercent <= 0 || entryPrice <= 0 || stopLoss <= 0) {
    throw new Error('Invalid input: all values must be positive');
  }
  
  if (entryPrice === stopLoss) {
    throw new Error('Entry price and stop loss cannot be equal');
  }
  
  // Calculate risk amount in dollars
  const riskAmount = accountSize * (riskPercent / 100);
  
  // Calculate risk per share
  const riskPerShare = Math.abs(entryPrice - stopLoss);
  
  // Calculate position size in shares
  const shares = Math.floor(riskAmount / (riskPerShare + commission));
  
  // Calculate actual position value
  const positionValue = shares * entryPrice;
  
  // Calculate actual risk (accounting for rounding)
  const actualRisk = (shares * riskPerShare) + (shares * commission);
  const actualRiskPercent = (actualRisk / accountSize) * 100;
  
  // Calculate max loss scenario
  const maxLoss = shares * riskPerShare;
  
  // Position as % of account
  const positionPercent = (positionValue / accountSize) * 100;
  
  return {
    shares,
    positionValue,
    positionPercent,
    riskAmount,
    actualRisk,
    actualRiskPercent,
    riskPerShare,
    maxLoss,
    commission: shares * commission,
    valid: shares > 0 && positionPercent <= 100
  };
}

/**
 * Calculate portfolio heat (total risk across all positions)
 * @param {Array} positions - Array of position objects
 * @param {number} accountSize - Total account value
 * @returns {object} Portfolio heat analysis
 */
export function calculatePortfolioHeat(positions, accountSize) {
  if (!positions || positions.length === 0) {
    return {
      totalRisk: 0,
      totalRiskPercent: 0,
      positionCount: 0,
      avgRiskPerPosition: 0,
      maxConcurrentRisk: 0,
      status: 'SAFE',
      recommendation: 'No active positions'
    };
  }
  
  // Calculate total risk
  const totalRisk = positions.reduce((sum, pos) => sum + (pos.risk || 0), 0);
  const totalRiskPercent = (totalRisk / accountSize) * 100;
  
  // Average risk per position
  const avgRiskPerPosition = totalRisk / positions.length;
  
  // Max concurrent risk (worst case if all hit stops)
  const maxConcurrentRisk = totalRiskPercent;
  
  // Determine status based on total risk
  let status = 'SAFE';
  let recommendation = 'Portfolio risk is within healthy limits';
  
  if (totalRiskPercent > 20) {
    status = 'DANGER';
    recommendation = '⚠️ CRITICAL: Reduce positions immediately! Risk exceeds 20%';
  } else if (totalRiskPercent > 10) {
    status = 'WARNING';
    recommendation = '⚠️ High risk exposure. Consider reducing position sizes or closing weak trades.';
  } else if (totalRiskPercent > 6) {
    status = 'ELEVATED';
    recommendation = 'Moderate risk. Monitor closely and avoid adding new positions.';
  } else if (totalRiskPercent > 3) {
    status = 'HEALTHY';
    recommendation = 'Good risk management. Room for selective new positions.';
  }
  
  return {
    totalRisk,
    totalRiskPercent,
    positionCount: positions.length,
    avgRiskPerPosition,
    maxConcurrentRisk,
    status,
    recommendation,
    positions: positions.map(p => ({
      ticker: p.ticker,
      risk: p.risk,
      riskPercent: (p.risk / accountSize) * 100,
      shares: p.shares,
      entry: p.entry,
      stopLoss: p.stopLoss
    }))
  };
}

/**
 * Calculate Kelly Criterion for optimal position sizing
 * @param {number} winRate - Win rate (0-1, e.g., 0.6 for 60%)
 * @param {number} avgWin - Average win amount
 * @param {number} avgLoss - Average loss amount
 * @returns {object} Kelly position sizing recommendation
 */
export function calculateKellyCriterion(winRate, avgWin, avgLoss) {
  if (winRate <= 0 || winRate >= 1) {
    throw new Error('Win rate must be between 0 and 1');
  }
  
  if (avgWin <= 0 || avgLoss <= 0) {
    throw new Error('Average win and loss must be positive');
  }
  
  // Kelly Formula: f* = (bp - q) / b
  // where:
  // b = avgWin / avgLoss (odds received)
  // p = winRate (probability of win)
  // q = 1 - p (probability of loss)
  
  const b = avgWin / avgLoss;
  const p = winRate;
  const q = 1 - p;
  
  const kellyPercent = ((b * p - q) / b) * 100;
  
  // Half Kelly (more conservative)
  const halfKellyPercent = kellyPercent / 2;
  
  // Quarter Kelly (very conservative)
  const quarterKellyPercent = kellyPercent / 4;
  
  let recommendation = '';
  if (kellyPercent <= 0) {
    recommendation = '❌ Negative edge detected. Do not trade this strategy.';
  } else if (kellyPercent > 25) {
    recommendation = '⚠️ Very high Kelly suggests either exceptional edge or data error. Use fractional Kelly.';
  } else if (kellyPercent > 10) {
    recommendation = 'Strong edge detected. Consider using Half Kelly (more conservative).';
  } else {
    recommendation = 'Moderate edge. Half or Quarter Kelly recommended for safety.';
  }
  
  return {
    fullKelly: kellyPercent,
    halfKelly: halfKellyPercent,
    quarterKelly: quarterKellyPercent,
    winRate,
    avgWin,
    avgLoss,
    payoffRatio: b,
    recommendation,
    valid: kellyPercent > 0
  };
}

/**
 * Calculate correlation between two ticker price series
 * @param {Array} series1 - First price series
 * @param {Array} series2 - Second price series
 * @returns {number} Correlation coefficient (-1 to 1)
 */
export function calculateCorrelation(series1, series2) {
  if (!series1 || !series2 || series1.length !== series2.length || series1.length < 2) {
    return 0;
  }
  
  const n = series1.length;
  
  // Calculate means
  const mean1 = series1.reduce((a, b) => a + b, 0) / n;
  const mean2 = series2.reduce((a, b) => a + b, 0) / n;
  
  // Calculate correlation
  let numerator = 0;
  let sum1Sq = 0;
  let sum2Sq = 0;
  
  for (let i = 0; i < n; i++) {
    const diff1 = series1[i] - mean1;
    const diff2 = series2[i] - mean2;
    numerator += diff1 * diff2;
    sum1Sq += diff1 * diff1;
    sum2Sq += diff2 * diff2;
  }
  
  const denominator = Math.sqrt(sum1Sq * sum2Sq);
  
  if (denominator === 0) {
    return 0;
  }
  
  return numerator / denominator;
}

/**
 * Build correlation matrix for multiple tickers
 * @param {Object} marketDataMap - Map of ticker -> market data with historicalData
 * @returns {Object} Correlation matrix and analysis
 */
export function buildCorrelationMatrix(marketDataMap) {
  const tickers = Object.keys(marketDataMap);
  const matrix = {};
  const highCorrelations = [];
  
  // Build price series for each ticker
  const priceSeries = {};
  for (const ticker of tickers) {
    const data = marketDataMap[ticker];
    if (data && data.historicalData && data.historicalData.length > 0) {
      priceSeries[ticker] = data.historicalData.map(d => d.close);
    }
  }
  
  // Calculate correlations
  for (let i = 0; i < tickers.length; i++) {
    const ticker1 = tickers[i];
    if (!priceSeries[ticker1]) continue;
    
    matrix[ticker1] = {};
    
    for (let j = 0; j < tickers.length; j++) {
      const ticker2 = tickers[j];
      if (!priceSeries[ticker2]) continue;
      
      const correlation = calculateCorrelation(priceSeries[ticker1], priceSeries[ticker2]);
      matrix[ticker1][ticker2] = correlation;
      
      // Track high correlations (excluding self-correlation)
      if (i < j && Math.abs(correlation) > 0.7) {
        highCorrelations.push({
          ticker1,
          ticker2,
          correlation,
          strength: Math.abs(correlation) > 0.9 ? 'very_high' : 'high',
          type: correlation > 0 ? 'positive' : 'negative'
        });
      }
    }
  }
  
  return {
    matrix,
    highCorrelations,
    tickers,
    warning: highCorrelations.length > 0 
      ? `⚠️ Found ${highCorrelations.length} highly correlated pairs. Holding both increases concentration risk.`
      : null
  };
}

/**
 * Calculate risk metrics for a trading signal
 * @param {Object} signal - Trading signal with entry, targets, stopLoss
 * @param {number} accountSize - Total account value
 * @param {number} riskPercent - Risk per trade (default 1%)
 * @returns {Object} Risk analysis for the signal
 */
export function analyzeSignalRisk(signal, accountSize, riskPercent = 1) {
  const { entry, stopLoss, targets, ticker, confidence } = signal;
  
  // Calculate position sizing
  const positionSize = calculatePositionSize(accountSize, riskPercent, entry, stopLoss);
  
  // Calculate potential outcomes
  const t1Return = ((targets.t1 - entry) / entry) * 100;
  const t2Return = ((targets.t2 - entry) / entry) * 100;
  const t3Return = ((targets.t3 - entry) / entry) * 100;
  const stopReturn = ((stopLoss - entry) / entry) * 100;
  
  const t1Profit = positionSize.shares * (targets.t1 - entry);
  const t2Profit = positionSize.shares * (targets.t2 - entry);
  const t3Profit = positionSize.shares * (targets.t3 - entry);
  const stopLossAmount = positionSize.shares * (stopLoss - entry);
  
  // Risk/Reward ratios
  const rr1 = Math.abs(t1Return / stopReturn);
  const rr2 = Math.abs(t2Return / stopReturn);
  const rr3 = Math.abs(t3Return / stopReturn);
  
  // Expected value calculation (assuming 60% win rate for high confidence, 45% for low)
  const estimatedWinRate = confidence >= 7 ? 0.6 : confidence >= 5 ? 0.5 : 0.45;
  const avgTarget = (t1Profit + t2Profit + t3Profit) / 3;
  const expectedValue = (avgTarget * estimatedWinRate) + (stopLossAmount * (1 - estimatedWinRate));
  
  return {
    ticker,
    confidence,
    position: positionSize,
    outcomes: {
      t1: { return: t1Return, profit: t1Profit, rr: rr1 },
      t2: { return: t2Return, profit: t2Profit, rr: rr2 },
      t3: { return: t3Return, profit: t3Profit, rr: rr3 },
      stop: { return: stopReturn, loss: stopLossAmount }
    },
    expectedValue,
    estimatedWinRate,
    recommendation: expectedValue > 0 
      ? '✅ Positive expectancy - trade has edge'
      : '❌ Negative expectancy - skip this trade'
  };
}

/**
 * Generate detailed position sizing recommendations for a signal
 * @param {object} signal - AI signal with entry, stopLoss, targets, confidence, positionSizing
 * @param {number} accountSize - Total account value (optional, defaults to 10000)
 * @returns {object} Detailed position sizing breakdown with scaling recommendations
 */
export function generatePositionSizingRecommendations(signal, accountSize = 10000) {
  const { entry, stopLoss, targets, confidence, positionSizing } = signal;
  
  if (!entry || !stopLoss || stopLoss === 0) {
    return {
      error: 'Invalid signal: missing entry or stopLoss',
      canTrade: false
    };
  }
  
  // Get recommended risk % from AI or use confidence-based defaults
  const riskPercent = positionSizing?.recommendedRiskPercent || 
                      (confidence >= 8 ? 2.0 : confidence >= 6 ? 1.5 : 1.0);
  
  // Calculate full position size
  const fullPosition = calculatePositionSize(accountSize, riskPercent, entry, stopLoss);
  
  // Calculate scaling recommendations based on confidence
  const initialPercent = confidence >= 8 ? 65 : confidence >= 6 ? 55 : 45;
  const initialShares = Math.floor(fullPosition.shares * (initialPercent / 100));
  const scaleInShares = fullPosition.shares - initialShares;
  
  // Calculate partial exits at targets
  const t1ExitShares = Math.floor(fullPosition.shares * 0.33);
  const t2ExitShares = Math.floor(fullPosition.shares * 0.33);
  const t3ExitShares = fullPosition.shares - t1ExitShares - t2ExitShares;
  
  // Calculate P&L scenarios
  const maxLoss = fullPosition.shares * Math.abs(entry - stopLoss);
  const t1Profit = fullPosition.shares * Math.abs(targets.t1 - entry);
  const t2Profit = fullPosition.shares * Math.abs(targets.t2 - entry);
  const t3Profit = fullPosition.shares * Math.abs(targets.t3 - entry);
  
  // Scaled exit P&L (more realistic)
  const scaledProfitT1 = t1ExitShares * Math.abs(targets.t1 - entry);
  const scaledProfitT2 = t2ExitShares * Math.abs(targets.t2 - entry);
  const scaledProfitT3 = t3ExitShares * Math.abs(targets.t3 - entry);
  const totalScaledProfit = scaledProfitT1 + scaledProfitT2 + scaledProfitT3;
  
  return {
    accountSize,
    riskPercent,
    riskAmount: fullPosition.riskAmount,
    fullPosition: {
      shares: fullPosition.shares,
      value: fullPosition.positionValue,
      percentOfAccount: fullPosition.positionPercent.toFixed(1)
    },
    scaling: {
      initial: {
        shares: initialShares,
        percent: initialPercent,
        value: (initialShares * entry).toFixed(2),
        description: `Enter ${initialPercent}% (${initialShares} shares) immediately`
      },
      scaleIn: {
        shares: scaleInShares,
        percent: 100 - initialPercent,
        value: (scaleInShares * entry).toFixed(2),
        description: positionSizing?.scalingPlan?.scaleIn || 'On confirmation or better entry'
      }
    },
    exits: {
      t1: {
        shares: t1ExitShares,
        percent: 33,
        price: targets.t1,
        profit: scaledProfitT1.toFixed(2),
        description: `Exit 33% (${t1ExitShares} shares) at T1 $${targets.t1.toFixed(2)}`
      },
      t2: {
        shares: t2ExitShares,
        percent: 33,
        price: targets.t2,
        profit: scaledProfitT2.toFixed(2),
        description: `Exit 33% (${t2ExitShares} shares) at T2 $${targets.t2.toFixed(2)}`
      },
      t3: {
        shares: t3ExitShares,
        percent: 34,
        price: targets.t3,
        profit: scaledProfitT3.toFixed(2),
        description: `Exit 34% (${t3ExitShares} shares) at T3 $${targets.t3.toFixed(2)}`
      }
    },
    scenarios: {
      maxLoss: {
        amount: maxLoss.toFixed(2),
        percent: ((maxLoss / accountSize) * 100).toFixed(2),
        description: `Max loss if stopped out: -$${maxLoss.toFixed(2)} (-${((maxLoss / accountSize) * 100).toFixed(2)}%)`
      },
      targetProfit: {
        full: {
          amount: t2Profit.toFixed(2),
          percent: ((t2Profit / accountSize) * 100).toFixed(2),
          description: `If all shares hit T2: +$${t2Profit.toFixed(2)} (+${((t2Profit / accountSize) * 100).toFixed(2)}%)`
        },
        scaled: {
          amount: totalScaledProfit.toFixed(2),
          percent: ((totalScaledProfit / accountSize) * 100).toFixed(2),
          description: `With scaled exits: +$${totalScaledProfit.toFixed(2)} (+${((totalScaledProfit / accountSize) * 100).toFixed(2)}%)`
        }
      }
    },
    riskReward: {
      t1: (Math.abs(targets.t1 - entry) / Math.abs(entry - stopLoss)).toFixed(2),
      t2: (Math.abs(targets.t2 - entry) / Math.abs(entry - stopLoss)).toFixed(2),
      t3: (Math.abs(targets.t3 - entry) / Math.abs(entry - stopLoss)).toFixed(2)
    },
    recommendation: `Risk ${riskPercent}% ($${fullPosition.riskAmount.toFixed(0)}) on ${fullPosition.shares} shares. Enter ${initialPercent}% now, scale in ${100 - initialPercent}%.`,
    canTrade: fullPosition.shares > 0
  };
}

/**
 * Default export for convenience
 */
export default {
  calculatePositionSize,
  calculatePortfolioHeat,
  calculateKellyCriterion,
  calculateCorrelation,
  buildCorrelationMatrix,
  analyzeSignalRisk,
  generatePositionSizingRecommendations
};
