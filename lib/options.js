// Options Chain Analysis - Max Pain, P/C Ratios, Unusual Activity, Gamma Walls
import { fetchOptionsChain } from './market-data.js';

/**
 * Analyze options chain for a ticker
 */
export async function analyzeOptionsChain(ticker, currentPrice) {
  try {
    const chainData = await fetchOptionsChain(ticker);
    
    if (!chainData || !chainData.options || chainData.options.length === 0) {
      return {
        ticker,
        error: 'No options data available',
        timestamp: Date.now()
      };
    }
    
    // Get the nearest expiration (most liquid, most relevant for short-term trading)
    const nearestExpiry = chainData.options[0];
    const calls = nearestExpiry.calls || [];
    const puts = nearestExpiry.puts || [];
    
    // Calculate max pain
    const maxPain = calculateMaxPain(calls, puts);
    
    // Calculate put/call ratios
    const pcRatios = calculatePutCallRatios(calls, puts);
    
    // Find unusual activity
    const unusualActivity = findUnusualActivity(calls, puts, currentPrice);
    
    // Identify gamma walls (strike clusters)
    const gammaWalls = identifyGammaWalls(calls, puts, currentPrice);
    
    // Calculate total greeks and positioning
    const greeks = calculateTotalGreeks(calls, puts, currentPrice);
    
    // Determine sentiment
    const sentiment = determineSentiment(pcRatios, maxPain, currentPrice, gammaWalls);
    
    // Calculate key levels
    const keyLevels = calculateKeyLevels(maxPain, gammaWalls, currentPrice);
    
    return {
      ticker,
      currentPrice,
      expirationDate: new Date(nearestExpiry.expirationDate * 1000).toISOString().split('T')[0],
      daysToExpiry: Math.ceil((nearestExpiry.expirationDate * 1000 - Date.now()) / (1000 * 60 * 60 * 24)),
      maxPain: {
        strike: maxPain.strike,
        pain: maxPain.totalPain,
        distance: ((currentPrice - maxPain.strike) / currentPrice * 100),
        signal: maxPain.strike > currentPrice ? 'BULLISH_PULL' : maxPain.strike < currentPrice ? 'BEARISH_PULL' : 'NEUTRAL'
      },
      putCallRatios: pcRatios,
      unusualActivity,
      gammaWalls,
      greeks,
      sentiment,
      keyLevels,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error(`Options analysis error for ${ticker}:`, error.message);
    return {
      ticker,
      error: error.message,
      timestamp: Date.now()
    };
  }
}

/**
 * Calculate Max Pain - the strike where most options expire worthless
 * Theory: Market makers hedge, pushing price toward max pain before expiry
 */
function calculateMaxPain(calls, puts) {
  if (calls.length === 0 && puts.length === 0) {
    return { strike: 0, totalPain: 0 };
  }
  
  // Get all unique strikes
  const strikes = [...new Set([
    ...calls.map(c => c.strike),
    ...puts.map(p => p.strike)
  ])].sort((a, b) => a - b);
  
  let maxPainStrike = 0;
  let minPain = Infinity;
  
  // For each strike, calculate total pain if price settles there
  for (const testStrike of strikes) {
    let totalPain = 0;
    
    // Calculate pain from calls (ITM calls = loss for sellers)
    for (const call of calls) {
      if (call.strike < testStrike) {
        const intrinsicValue = testStrike - call.strike;
        totalPain += intrinsicValue * (call.openInterest || 0) * 100; // *100 for contract multiplier
      }
    }
    
    // Calculate pain from puts (ITM puts = loss for sellers)
    for (const put of puts) {
      if (put.strike > testStrike) {
        const intrinsicValue = put.strike - testStrike;
        totalPain += intrinsicValue * (put.openInterest || 0) * 100;
      }
    }
    
    if (totalPain < minPain) {
      minPain = totalPain;
      maxPainStrike = testStrike;
    }
  }
  
  return {
    strike: maxPainStrike,
    totalPain: minPain
  };
}

/**
 * Calculate Put/Call Ratios (Volume and Open Interest)
 */
function calculatePutCallRatios(calls, puts) {
  const totalCallVolume = calls.reduce((sum, c) => sum + (c.volume || 0), 0);
  const totalPutVolume = puts.reduce((sum, p) => sum + (p.volume || 0), 0);
  const totalCallOI = calls.reduce((sum, c) => sum + (c.openInterest || 0), 0);
  const totalPutOI = puts.reduce((sum, p) => sum + (p.openInterest || 0), 0);
  
  const volumeRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0;
  const oiRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;
  
  // P/C ratio interpretation
  // < 0.7 = Extremely bullish (more calls)
  // 0.7-1.0 = Bullish
  // 1.0-1.5 = Neutral
  // 1.5-2.0 = Bearish
  // > 2.0 = Extremely bearish (more puts, could be protective or bearish)
  
  const volumeSentiment = 
    volumeRatio < 0.7 ? 'EXTREMELY_BULLISH' :
    volumeRatio < 1.0 ? 'BULLISH' :
    volumeRatio < 1.5 ? 'NEUTRAL' :
    volumeRatio < 2.0 ? 'BEARISH' : 'EXTREMELY_BEARISH';
  
  const oiSentiment = 
    oiRatio < 0.7 ? 'EXTREMELY_BULLISH' :
    oiRatio < 1.0 ? 'BULLISH' :
    oiRatio < 1.5 ? 'NEUTRAL' :
    oiRatio < 2.0 ? 'BEARISH' : 'EXTREMELY_BEARISH';
  
  return {
    volume: {
      ratio: volumeRatio,
      calls: totalCallVolume,
      puts: totalPutVolume,
      sentiment: volumeSentiment
    },
    openInterest: {
      ratio: oiRatio,
      calls: totalCallOI,
      puts: totalPutOI,
      sentiment: oiSentiment
    }
  };
}

/**
 * Find unusual options activity (high volume relative to OI)
 */
function findUnusualActivity(calls, puts, currentPrice) {
  const unusual = [];
  
  // Check calls
  for (const call of calls) {
    if (!call.volume || !call.openInterest) continue;
    
    const volumeOIRatio = call.volume / Math.max(call.openInterest, 1);
    
    // Volume > 2x OI = unusual activity
    if (volumeOIRatio > 2 && call.volume > 100) {
      const distancePercent = ((call.strike - currentPrice) / currentPrice * 100);
      unusual.push({
        type: 'CALL',
        strike: call.strike,
        volume: call.volume,
        openInterest: call.openInterest,
        volumeOIRatio: volumeOIRatio,
        impliedVolatility: call.impliedVolatility,
        distance: distancePercent,
        signal: distancePercent > 0 ? 'BULLISH' : 'VERY_BULLISH'
      });
    }
  }
  
  // Check puts
  for (const put of puts) {
    if (!put.volume || !put.openInterest) continue;
    
    const volumeOIRatio = put.volume / Math.max(put.openInterest, 1);
    
    if (volumeOIRatio > 2 && put.volume > 100) {
      const distancePercent = ((put.strike - currentPrice) / currentPrice * 100);
      unusual.push({
        type: 'PUT',
        strike: put.strike,
        volume: put.volume,
        openInterest: put.openInterest,
        volumeOIRatio: volumeOIRatio,
        impliedVolatility: put.impliedVolatility,
        distance: distancePercent,
        signal: distancePercent < 0 ? 'BEARISH' : 'PROTECTIVE'
      });
    }
  }
  
  // Sort by volume (most unusual first)
  unusual.sort((a, b) => b.volume - a.volume);
  
  return unusual.slice(0, 10); // Top 10 unusual activity
}

/**
 * Identify gamma walls - strikes with high open interest (support/resistance)
 */
function identifyGammaWalls(calls, puts, currentPrice) {
  const strikes = {};
  
  // Aggregate OI by strike
  for (const call of calls) {
    if (!strikes[call.strike]) {
      strikes[call.strike] = { strike: call.strike, callOI: 0, putOI: 0 };
    }
    strikes[call.strike].callOI += (call.openInterest || 0);
  }
  
  for (const put of puts) {
    if (!strikes[put.strike]) {
      strikes[put.strike] = { strike: put.strike, callOI: 0, putOI: 0 };
    }
    strikes[put.strike].putOI += (put.openInterest || 0);
  }
  
  // Calculate total OI and find significant walls
  const walls = Object.values(strikes).map(s => ({
    strike: s.strike,
    callOI: s.callOI,
    putOI: s.putOI,
    totalOI: s.callOI + s.putOI,
    netGamma: s.callOI - s.putOI, // Positive = more calls (resistance), Negative = more puts (support)
    distance: ((s.strike - currentPrice) / currentPrice * 100)
  }));
  
  // Sort by total OI
  walls.sort((a, b) => b.totalOI - a.totalOI);
  
  // Identify key walls (top 5)
  const keyWalls = walls.slice(0, 5).map(w => ({
    ...w,
    type: Math.abs(w.distance) < 2 ? 'PINNING_ZONE' :
          w.distance > 0 && w.callOI > w.putOI ? 'RESISTANCE' :
          w.distance > 0 && w.putOI > w.callOI ? 'RESISTANCE_SUPPORT' :
          w.distance < 0 && w.putOI > w.callOI ? 'SUPPORT' :
          w.distance < 0 && w.callOI > w.putOI ? 'SUPPORT_RESISTANCE' : 'NEUTRAL',
    strength: w.totalOI > 10000 ? 'VERY_STRONG' :
              w.totalOI > 5000 ? 'STRONG' :
              w.totalOI > 2000 ? 'MODERATE' : 'WEAK'
  }));
  
  return keyWalls;
}

/**
 * Calculate total greeks and positioning
 */
function calculateTotalGreeks(calls, puts, currentPrice) {
  // Simplified greeks calculation (approximation)
  let totalCallGamma = 0;
  let totalPutGamma = 0;
  let totalCallDelta = 0;
  let totalPutDelta = 0;
  
  for (const call of calls) {
    // Approximate gamma (highest ATM)
    const moneyness = call.strike / currentPrice;
    const approxGamma = moneyness > 0.95 && moneyness < 1.05 ? 
      (call.openInterest || 0) * 0.05 : (call.openInterest || 0) * 0.01;
    totalCallGamma += approxGamma;
    
    // Approximate delta (ITM calls have delta ~1, OTM ~0)
    const approxDelta = call.strike < currentPrice ? 0.7 : 0.3;
    totalCallDelta += approxDelta * (call.openInterest || 0);
  }
  
  for (const put of puts) {
    const moneyness = put.strike / currentPrice;
    const approxGamma = moneyness > 0.95 && moneyness < 1.05 ? 
      (put.openInterest || 0) * 0.05 : (put.openInterest || 0) * 0.01;
    totalPutGamma += approxGamma;
    
    const approxDelta = put.strike > currentPrice ? -0.7 : -0.3;
    totalPutDelta += approxDelta * (put.openInterest || 0);
  }
  
  return {
    gamma: {
      calls: totalCallGamma,
      puts: totalPutGamma,
      net: totalCallGamma - totalPutGamma,
      signal: totalCallGamma > totalPutGamma ? 'POSITIVE_GAMMA' : 'NEGATIVE_GAMMA'
    },
    delta: {
      calls: totalCallDelta,
      puts: totalPutDelta,
      net: totalCallDelta + totalPutDelta,
      signal: (totalCallDelta + totalPutDelta) > 0 ? 'NET_LONG' : 'NET_SHORT'
    }
  };
}

/**
 * Determine overall sentiment from options data
 */
function determineSentiment(pcRatios, maxPain, currentPrice, gammaWalls) {
  const signals = [];
  let bullishScore = 0;
  let bearishScore = 0;
  
  // P/C Ratio signals
  if (pcRatios.volume.sentiment.includes('BULLISH')) {
    bullishScore += 2;
    signals.push('Low P/C ratio (volume)');
  } else if (pcRatios.volume.sentiment.includes('BEARISH')) {
    bearishScore += 2;
    signals.push('High P/C ratio (volume)');
  }
  
  // Max pain signal
  const maxPainDistance = Math.abs((currentPrice - maxPain.strike) / currentPrice * 100);
  if (maxPainDistance > 3) {
    if (maxPain.strike > currentPrice) {
      bullishScore += 1.5;
      signals.push(`Max pain ${maxPainDistance.toFixed(1)}% above (bullish pull)`);
    } else {
      bearishScore += 1.5;
      signals.push(`Max pain ${maxPainDistance.toFixed(1)}% below (bearish pull)`);
    }
  }
  
  // Gamma wall signals
  const nearestWall = gammaWalls.find(w => Math.abs(w.distance) < 5);
  if (nearestWall) {
    if (nearestWall.type === 'RESISTANCE' && nearestWall.distance > 0) {
      bearishScore += 1;
      signals.push(`Gamma wall resistance at $${nearestWall.strike}`);
    } else if (nearestWall.type === 'SUPPORT' && nearestWall.distance < 0) {
      bullishScore += 1;
      signals.push(`Gamma wall support at $${nearestWall.strike}`);
    }
  }
  
  // Overall sentiment
  const netScore = bullishScore - bearishScore;
  const sentiment = 
    netScore > 3 ? 'VERY_BULLISH' :
    netScore > 1 ? 'BULLISH' :
    netScore < -3 ? 'VERY_BEARISH' :
    netScore < -1 ? 'BEARISH' : 'NEUTRAL';
  
  const confidence = Math.min(10, Math.max(1, Math.abs(netScore)));
  
  return {
    sentiment,
    confidence,
    bullishScore,
    bearishScore,
    signals
  };
}

/**
 * Calculate key price levels from options data
 */
function calculateKeyLevels(maxPain, gammaWalls, currentPrice) {
  const levels = {
    maxPain: maxPain.strike,
    resistance: [],
    support: []
  };
  
  // Extract resistance and support from gamma walls
  for (const wall of gammaWalls) {
    if (wall.strike > currentPrice && (wall.type.includes('RESISTANCE') || wall.type === 'PINNING_ZONE')) {
      levels.resistance.push({
        price: wall.strike,
        strength: wall.strength,
        distance: wall.distance
      });
    } else if (wall.strike < currentPrice && (wall.type.includes('SUPPORT') || wall.type === 'PINNING_ZONE')) {
      levels.support.push({
        price: wall.strike,
        strength: wall.strength,
        distance: wall.distance
      });
    }
  }
  
  // Sort by distance from current price
  levels.resistance.sort((a, b) => a.distance - b.distance);
  levels.support.sort((a, b) => b.distance - a.distance);
  
  return levels;
}

/**
 * Batch analyze multiple tickers
 */
export async function batchAnalyzeOptions(tickers, priceMap) {
  const results = {};
  
  for (const ticker of tickers) {
    const currentPrice = priceMap[ticker];
    
    if (!currentPrice) {
      console.log(`Skipping ${ticker} - no price data`);
      continue;
    }
    
    console.log(`Analyzing options for ${ticker}...`);
    
    try {
      const analysis = await analyzeOptionsChain(ticker, currentPrice);
      results[ticker] = analysis;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to analyze options for ${ticker}:`, error.message);
      results[ticker] = {
        ticker,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  return results;
}
