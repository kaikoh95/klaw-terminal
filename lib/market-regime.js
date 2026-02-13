// Market Regime Detection - Identify market environment and adjust trading strategies
import { calculateSMA, calculateEMA, calculateRSI, calculateATR, calculateADX } from './technicals.js';

/**
 * Detect current market regime across multiple dimensions
 * Helps filter signals and adjust strategies based on market conditions
 */
export function detectMarketRegime(marketData, technicals, multiTimeframe = null) {
  const regime = {
    timestamp: new Date().toISOString(),
    overall: 'UNKNOWN',
    confidence: 0,
    dimensions: {},
    recommendations: [],
    riskLevel: 'MODERATE'
  };

  // 1. TREND REGIME (Trending vs Ranging)
  regime.dimensions.trend = detectTrendRegime(technicals);
  
  // 2. VOLATILITY REGIME (High vs Low vol)
  regime.dimensions.volatility = detectVolatilityRegime(marketData, technicals);
  
  // 3. MOMENTUM REGIME (Strong vs Weak momentum)
  regime.dimensions.momentum = detectMomentumRegime(technicals);
  
  // 4. VOLUME REGIME (High participation vs Low participation)
  regime.dimensions.volume = detectVolumeRegime(marketData);
  
  // 5. RISK APPETITE (Risk-On vs Risk-Off) - based on market breadth
  regime.dimensions.riskAppetite = detectRiskAppetite(marketData, technicals);
  
  // 6. MARKET PHASE (Accumulation, Markup, Distribution, Markdown)
  regime.dimensions.phase = detectMarketPhase(technicals);

  // Combine dimensions to determine overall regime
  regime.overall = determineOverallRegime(regime.dimensions);
  regime.confidence = calculateRegimeConfidence(regime.dimensions);
  regime.riskLevel = determineRiskLevel(regime.dimensions);
  regime.recommendations = generateRecommendations(regime);

  return regime;
}

/**
 * Detect trend regime: Strong Trend, Weak Trend, or Range-Bound
 */
function detectTrendRegime(technicals) {
  const { adx, movingAverages } = technicals;
  
  let regime = 'RANGING';
  let strength = 'WEAK';
  let direction = 'NEUTRAL';
  
  // ADX-based trend detection
  if (adx && adx.adx >= 25) {
    regime = 'TRENDING';
    strength = adx.adx >= 40 ? 'STRONG' : adx.adx >= 30 ? 'MODERATE' : 'WEAK';
    direction = adx.plusDI > adx.minusDI ? 'BULLISH' : 'BEARISH';
  } else if (adx && adx.adx >= 20) {
    regime = 'WEAK_TREND';
    strength = 'WEAK';
    direction = adx.plusDI > adx.minusDI ? 'BULLISH' : 'BEARISH';
  }
  
  // MA slope confirmation
  const maAlignment = checkMAAlignment(movingAverages);
  
  return {
    regime,
    strength,
    direction,
    adxValue: adx?.adx || null,
    maAlignment,
    tradingStyle: regime === 'TRENDING' ? 'Trend Following' : regime === 'WEAK_TREND' ? 'Cautious Trend/Breakout' : 'Mean Reversion',
    confidence: adx ? (adx.adx >= 25 ? 8 : adx.adx >= 20 ? 6 : 4) : 3
  };
}

/**
 * Check moving average alignment for trend confirmation
 */
function checkMAAlignment(mas) {
  if (!mas.ema9 || !mas.ema21 || !mas.sma50 || !mas.sma200) {
    return { aligned: false, direction: 'NEUTRAL' };
  }
  
  const bullishAlignment = mas.ema9 > mas.ema21 && mas.ema21 > mas.sma50 && mas.sma50 > mas.sma200;
  const bearishAlignment = mas.ema9 < mas.ema21 && mas.ema21 < mas.sma50 && mas.sma50 < mas.sma200;
  
  return {
    aligned: bullishAlignment || bearishAlignment,
    direction: bullishAlignment ? 'BULLISH' : bearishAlignment ? 'BEARISH' : 'MIXED',
    strength: bullishAlignment || bearishAlignment ? 'STRONG' : 'WEAK'
  };
}

/**
 * Detect volatility regime: High, Normal, or Low volatility
 */
function detectVolatilityRegime(marketData, technicals) {
  const { atr, bollingerBands } = technicals;
  const price = marketData.price;
  
  let regime = 'NORMAL';
  let level = 'MODERATE';
  
  // ATR as % of price
  const atrPercent = atr ? (atr / price * 100) : null;
  
  // Bollinger Band width
  const bbWidth = bollingerBands?.bandwidth || null;
  
  // Determine regime
  if (atrPercent && bbWidth) {
    if (atrPercent > 5 || bbWidth > 10) {
      regime = 'HIGH_VOLATILITY';
      level = atrPercent > 7 || bbWidth > 15 ? 'EXTREME' : 'HIGH';
    } else if (atrPercent < 2 || bbWidth < 3) {
      regime = 'LOW_VOLATILITY';
      level = atrPercent < 1.5 || bbWidth < 2 ? 'VERY_LOW' : 'LOW';
    }
  }
  
  return {
    regime,
    level,
    atrPercent: atrPercent?.toFixed(2) || null,
    bbWidth: bbWidth?.toFixed(2) || null,
    signal: regime === 'LOW_VOLATILITY' ? 'Breakout potential (volatility compression)' : 
            regime === 'HIGH_VOLATILITY' ? 'Expect mean reversion or continuation' : 
            'Normal volatility - standard strategies apply',
    confidence: (atrPercent && bbWidth) ? 8 : 5
  };
}

/**
 * Detect momentum regime: Strong, Moderate, or Weak momentum
 */
function detectMomentumRegime(technicals) {
  const { rsi, mfi, macd, stochastic } = technicals;
  
  let regime = 'MODERATE';
  let direction = 'NEUTRAL';
  let strength = 'MODERATE';
  
  // Count bullish and bearish momentum indicators
  let bullishSignals = 0;
  let bearishSignals = 0;
  let totalIndicators = 0;
  
  if (rsi) {
    totalIndicators++;
    if (rsi > 60) bullishSignals++;
    else if (rsi < 40) bearishSignals++;
  }
  
  if (mfi) {
    totalIndicators++;
    if (mfi.value > 60) bullishSignals++;
    else if (mfi.value < 40) bearishSignals++;
  }
  
  if (macd) {
    totalIndicators++;
    if (macd.histogram > 0) bullishSignals++;
    else bearishSignals++;
  }
  
  if (stochastic) {
    totalIndicators++;
    if (stochastic.k > 50) bullishSignals++;
    else bearishSignals++;
  }
  
  // Determine regime
  const bullishPercent = bullishSignals / totalIndicators;
  const bearishPercent = bearishSignals / totalIndicators;
  
  if (bullishPercent >= 0.75) {
    regime = 'STRONG_BULLISH';
    direction = 'BULLISH';
    strength = 'STRONG';
  } else if (bearishPercent >= 0.75) {
    regime = 'STRONG_BEARISH';
    direction = 'BEARISH';
    strength = 'STRONG';
  } else if (bullishPercent >= 0.5) {
    regime = 'MODERATE_BULLISH';
    direction = 'BULLISH';
    strength = 'MODERATE';
  } else if (bearishPercent >= 0.5) {
    regime = 'MODERATE_BEARISH';
    direction = 'BEARISH';
    strength = 'MODERATE';
  } else {
    regime = 'WEAK';
    direction = 'NEUTRAL';
    strength = 'WEAK';
  }
  
  return {
    regime,
    direction,
    strength,
    bullishSignals,
    bearishSignals,
    totalIndicators,
    alignment: bullishPercent >= 0.75 || bearishPercent >= 0.75 ? 'STRONG' : 'WEAK',
    confidence: totalIndicators >= 3 ? 8 : 6
  };
}

/**
 * Detect volume regime: High participation, Normal, or Low participation
 */
function detectVolumeRegime(marketData) {
  const { volumeRatio } = marketData;
  
  let regime = 'NORMAL';
  let level = 'MODERATE';
  let signal = '';
  
  if (volumeRatio >= 3) {
    regime = 'EXTREME_VOLUME';
    level = 'EXTREME';
    signal = 'Major institutional activity - significant move likely';
  } else if (volumeRatio >= 2) {
    regime = 'HIGH_VOLUME';
    level = 'HIGH';
    signal = 'Strong conviction - trust the move';
  } else if (volumeRatio >= 1.5) {
    regime = 'ELEVATED_VOLUME';
    level = 'ABOVE_AVERAGE';
    signal = 'Decent participation - signals more reliable';
  } else if (volumeRatio >= 0.8) {
    regime = 'NORMAL';
    level = 'MODERATE';
    signal = 'Average participation - standard conditions';
  } else if (volumeRatio >= 0.5) {
    regime = 'LOW_VOLUME';
    level = 'BELOW_AVERAGE';
    signal = 'Low conviction - be cautious with signals';
  } else {
    regime = 'VERY_LOW_VOLUME';
    level = 'VERY_LOW';
    signal = 'Minimal participation - avoid trading, signals unreliable';
  }
  
  return {
    regime,
    level,
    volumeRatio: volumeRatio.toFixed(2),
    signal,
    reliable: volumeRatio >= 0.8,
    confidence: 9 // Volume is very reliable indicator
  };
}

/**
 * Detect risk appetite: Risk-On, Risk-Off, or Neutral
 */
function detectRiskAppetite(marketData, technicals) {
  const { changePercent } = marketData;
  const { rsi, volumeProfile, obv } = technicals;
  
  let regime = 'NEUTRAL';
  let level = 'MODERATE';
  
  // Simplified risk appetite based on price action and volume
  const strongUp = changePercent > 2 && rsi && rsi > 60;
  const strongDown = changePercent < -2 && rsi && rsi < 40;
  
  if (strongUp && obv?.trend.includes('bullish')) {
    regime = 'RISK_ON';
    level = 'HIGH';
  } else if (changePercent > 1) {
    regime = 'RISK_ON';
    level = 'MODERATE';
  } else if (strongDown && obv?.trend.includes('bearish')) {
    regime = 'RISK_OFF';
    level = 'HIGH';
  } else if (changePercent < -1) {
    regime = 'RISK_OFF';
    level = 'MODERATE';
  }
  
  return {
    regime,
    level,
    signal: regime === 'RISK_ON' ? 'Bullish bias - favor longs' : 
            regime === 'RISK_OFF' ? 'Bearish bias - favor shorts or cash' : 
            'Neutral - trade both directions based on technicals',
    confidence: 6
  };
}

/**
 * Detect market phase: Accumulation, Markup, Distribution, or Markdown (Wyckoff)
 */
function detectMarketPhase(technicals) {
  const { trend, volumeProfile, obv, rsi, adx, volumeDelta } = technicals;
  
  let phase = 'UNKNOWN';
  let description = '';
  
  // Simplified Wyckoff phase detection
  if (trend === 'ranging' && obv?.trend === 'bullish_accumulation') {
    phase = 'ACCUMULATION';
    description = 'Smart money buying - prepare for markup';
  } else if ((trend === 'uptrend' || trend === 'strong_uptrend') && adx?.adx >= 25) {
    phase = 'MARKUP';
    description = 'Trending higher - ride the trend';
  } else if (trend === 'ranging' && obv?.trend === 'bearish_distribution') {
    phase = 'DISTRIBUTION';
    description = 'Smart money selling - prepare for markdown';
  } else if ((trend === 'downtrend' || trend === 'strong_downtrend') && adx?.adx >= 25) {
    phase = 'MARKDOWN';
    description = 'Trending lower - short or stay out';
  } else {
    phase = 'TRANSITION';
    description = 'Unclear phase - wait for clarity';
  }
  
  // Volume Delta confirmation
  const volumeConfirms = volumeDelta && 
    ((phase === 'ACCUMULATION' && volumeDelta.signal.includes('accumulation')) ||
     (phase === 'DISTRIBUTION' && volumeDelta.signal.includes('distribution')));
  
  return {
    phase,
    description,
    volumeConfirmation: volumeConfirms || false,
    confidence: volumeConfirms ? 8 : trend !== 'ranging' ? 7 : 5
  };
}

/**
 * Determine overall regime from all dimensions
 */
function determineOverallRegime(dimensions) {
  const { trend, volatility, momentum, volume, phase } = dimensions;
  
  // Priority logic for overall regime
  if (volume.regime === 'VERY_LOW_VOLUME') {
    return 'AVOID_TRADING'; // Low volume = unreliable
  }
  
  if (trend.regime === 'TRENDING' && trend.strength === 'STRONG' && momentum.strength === 'STRONG') {
    return trend.direction === 'BULLISH' ? 'STRONG_BULL_TREND' : 'STRONG_BEAR_TREND';
  }
  
  if (trend.regime === 'TRENDING' && momentum.alignment === 'STRONG') {
    return trend.direction === 'BULLISH' ? 'BULL_TREND' : 'BEAR_TREND';
  }
  
  if (volatility.regime === 'LOW_VOLATILITY' && trend.regime === 'RANGING') {
    return 'CONSOLIDATION'; // Potential breakout setup
  }
  
  if (trend.regime === 'RANGING') {
    return phase.phase === 'ACCUMULATION' ? 'ACCUMULATION_PHASE' : 
           phase.phase === 'DISTRIBUTION' ? 'DISTRIBUTION_PHASE' : 
           'RANGE_BOUND';
  }
  
  if (volatility.regime === 'HIGH_VOLATILITY') {
    return 'HIGH_VOLATILITY_CHOP';
  }
  
  return 'MIXED_SIGNALS';
}

/**
 * Calculate overall confidence in regime detection (1-10)
 */
function calculateRegimeConfidence(dimensions) {
  const confidences = Object.values(dimensions).map(d => d.confidence || 5);
  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  
  // Boost confidence if dimensions agree
  const { trend, momentum, volume } = dimensions;
  const alignment = 
    (trend.direction === momentum.direction) && 
    volume.reliable;
  
  return Math.min(10, Math.round(avgConfidence + (alignment ? 1 : 0)));
}

/**
 * Determine risk level based on market regime
 */
function determineRiskLevel(dimensions) {
  const { volatility, volume, trend } = dimensions;
  
  if (volume.regime === 'VERY_LOW_VOLUME') return 'VERY_HIGH';
  if (volatility.regime === 'HIGH_VOLATILITY' && volatility.level === 'EXTREME') return 'HIGH';
  if (trend.regime === 'RANGING' && volatility.regime === 'HIGH_VOLATILITY') return 'HIGH';
  if (trend.regime === 'TRENDING' && trend.strength === 'STRONG' && volume.reliable) return 'LOW';
  if (trend.regime === 'TRENDING') return 'MODERATE';
  
  return 'MODERATE';
}

/**
 * Generate actionable recommendations based on regime
 */
function generateRecommendations(regime) {
  const { overall, dimensions } = regime;
  const recommendations = [];
  
  switch (overall) {
    case 'STRONG_BULL_TREND':
    case 'BULL_TREND':
      recommendations.push('✅ LONG bias - Trend following strategies recommended');
      recommendations.push('🎯 Buy dips to support/moving averages');
      recommendations.push('📊 Higher confidence for LONG signals');
      if (dimensions.volume.reliable) {
        recommendations.push('💪 Volume confirms - trust the trend');
      }
      break;
      
    case 'STRONG_BEAR_TREND':
    case 'BEAR_TREND':
      recommendations.push('⚠️ SHORT bias - Trend following strategies recommended');
      recommendations.push('🎯 Sell rallies to resistance/moving averages');
      recommendations.push('📊 Higher confidence for SHORT signals');
      if (dimensions.volume.reliable) {
        recommendations.push('💪 Volume confirms - trust the trend');
      }
      break;
      
    case 'CONSOLIDATION':
      recommendations.push('⏳ BREAKOUT setup - Wait for volatility expansion');
      recommendations.push('🎯 Set alerts at range boundaries');
      recommendations.push('⚠️ Avoid low confidence signals inside range');
      recommendations.push('📊 Prepare for big move when breakout occurs');
      break;
      
    case 'RANGE_BOUND':
      recommendations.push('🔄 MEAN REVERSION strategies preferred');
      recommendations.push('🎯 Buy support, sell resistance');
      recommendations.push('⚠️ Avoid trend-following signals');
      recommendations.push('📊 Use tight stops at range boundaries');
      break;
      
    case 'ACCUMULATION_PHASE':
      recommendations.push('📥 ACCUMULATION detected - Prepare for upside');
      recommendations.push('🎯 Look for LONG entries on weakness');
      recommendations.push('⏳ Be patient - wait for markup phase');
      break;
      
    case 'DISTRIBUTION_PHASE':
      recommendations.push('📤 DISTRIBUTION detected - Prepare for downside');
      recommendations.push('🎯 Look for SHORT entries on strength');
      recommendations.push('⏳ Be patient - wait for markdown phase');
      break;
      
    case 'HIGH_VOLATILITY_CHOP':
      recommendations.push('⚠️ HIGH VOLATILITY - Reduce position sizes');
      recommendations.push('🎯 Wider stops required');
      recommendations.push('📊 Only take highest confidence signals (8+)');
      recommendations.push('⏳ Consider waiting for volatility to normalize');
      break;
      
    case 'AVOID_TRADING':
      recommendations.push('🛑 LOW VOLUME - Avoid trading');
      recommendations.push('⏳ Wait for volume to return');
      recommendations.push('📊 Signals unreliable in low volume');
      break;
      
    case 'MIXED_SIGNALS':
    default:
      recommendations.push('⚠️ MIXED signals - Exercise caution');
      recommendations.push('📊 Only take signals with strong confluence');
      recommendations.push('🎯 Smaller positions, tighter stops');
      recommendations.push('⏳ Wait for clearer market direction');
      break;
  }
  
  // Add volatility-specific recommendations
  if (dimensions.volatility.regime === 'HIGH_VOLATILITY') {
    recommendations.push('💥 High volatility - Widen stops or reduce size');
  } else if (dimensions.volatility.regime === 'LOW_VOLATILITY') {
    recommendations.push('🔒 Low volatility - Potential expansion coming');
  }
  
  return recommendations;
}

/**
 * Apply regime filter to a trading signal
 * Returns enhanced signal with regime context and adjusted confidence
 */
export function applyRegimeFilter(signal, regime) {
  const filtered = { ...signal };
  
  // Adjust confidence based on regime alignment
  filtered.originalConfidence = signal.confidence;
  filtered.regime = regime.overall;
  filtered.regimeConfidence = regime.confidence;
  
  const alignment = checkSignalRegimeAlignment(signal, regime);
  filtered.regimeAlignment = alignment;
  
  // Adjust confidence based on alignment
  if (alignment.score >= 8) {
    filtered.confidence = Math.min(10, signal.confidence + 1);
    filtered.regimeBoost = '+1 (Strong alignment)';
  } else if (alignment.score <= 3) {
    filtered.confidence = Math.max(1, signal.confidence - 2);
    filtered.regimeBoost = '-2 (Poor alignment)';
  } else if (alignment.score <= 5) {
    filtered.confidence = Math.max(1, signal.confidence - 1);
    filtered.regimeBoost = '-1 (Weak alignment)';
  } else {
    filtered.regimeBoost = '0 (Neutral)';
  }
  
  filtered.regimeWarnings = alignment.warnings;
  
  return filtered;
}

/**
 * Check how well a signal aligns with current market regime
 */
function checkSignalRegimeAlignment(signal, regime) {
  const warnings = [];
  let score = 5; // Start neutral
  
  const { overall, dimensions, riskLevel } = regime;
  
  // Check direction alignment
  if (signal.signal === 'LONG') {
    if (overall.includes('BULL')) {
      score += 2;
    } else if (overall.includes('BEAR')) {
      score -= 2;
      warnings.push('⚠️ LONG signal against bearish regime');
    } else if (overall === 'RANGE_BOUND') {
      score -= 1;
      warnings.push('⚠️ Trend signal in ranging market');
    }
  } else if (signal.signal === 'SHORT') {
    if (overall.includes('BEAR')) {
      score += 2;
    } else if (overall.includes('BULL')) {
      score -= 2;
      warnings.push('⚠️ SHORT signal against bullish regime');
    } else if (overall === 'RANGE_BOUND') {
      score -= 1;
      warnings.push('⚠️ Trend signal in ranging market');
    }
  }
  
  // Volume regime check
  if (dimensions.volume.regime === 'VERY_LOW_VOLUME') {
    score -= 3;
    warnings.push('🛑 Very low volume - signal unreliable');
  } else if (dimensions.volume.regime === 'LOW_VOLUME') {
    score -= 1;
    warnings.push('⚠️ Below average volume - reduce confidence');
  } else if (dimensions.volume.reliable) {
    score += 1;
  }
  
  // Volatility regime check
  if (dimensions.volatility.regime === 'HIGH_VOLATILITY' && signal.confidence >= 7) {
    warnings.push('💥 High volatility - widen stops');
  }
  
  // Pattern vs regime check
  if (signal.pattern === 'Trend Continuation' && dimensions.trend.regime === 'RANGING') {
    score -= 2;
    warnings.push('⚠️ Trend continuation signal in ranging market');
  }
  
  if (signal.pattern === 'Mean Reversion' && dimensions.trend.regime === 'TRENDING') {
    score -= 1;
    warnings.push('⚠️ Mean reversion in trending market - counter-trend risk');
  }
  
  // Risk level check
  if (riskLevel === 'VERY_HIGH' || riskLevel === 'HIGH') {
    warnings.push(`⚠️ ${riskLevel} market risk - reduce position size`);
  }
  
  return {
    score: Math.max(1, Math.min(10, score)),
    warnings,
    recommendation: score >= 7 ? 'Take signal' : score >= 5 ? 'Cautious entry' : 'Avoid or skip'
  };
}
