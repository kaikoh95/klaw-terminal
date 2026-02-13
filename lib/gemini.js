// Gemini 2.5 Pro AI Analysis Integration
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf8');
    const match = envFile.match(/GEMINI_API_KEY=(.+)/);
    return match ? match[1].trim() : null;
  } catch { return null; }
}

const GEMINI_API_KEY = loadApiKey();
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-latest:generateContent';

// Response caching to reduce API costs and improve speed
const ANALYSIS_CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes - balance between freshness and cost
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

/**
 * Generate cache key from market data and technicals
 */
function generateCacheKey(marketData, technicals, multiTimeframe) {
  const price = marketData.price.toFixed(2);
  const rsi = technicals.rsi?.toFixed(0) || 'N/A';
  const trend = technicals.trend;
  const mtfKey = multiTimeframe?.confluence?.direction || 'none';
  
  return `${marketData.symbol}-${price}-${rsi}-${trend}-${mtfKey}`;
}

/**
 * Clean up expired cache entries
 */
function cleanupCache() {
  const now = Date.now();
  for (const [key, entry] of ANALYSIS_CACHE.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      ANALYSIS_CACHE.delete(key);
    }
  }
}

// Run cache cleanup every minute
setInterval(cleanupCache, 60000);

/**
 * Analyze market data and technicals with Gemini AI (with caching and retry logic)
 */
export async function analyzeWithGemini(marketData, technicals, multiTimeframe = null, useCache = true) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not found in environment');
  }
  
  // Check cache first
  if (useCache) {
    const cacheKey = generateCacheKey(marketData, technicals, multiTimeframe);
    const cached = ANALYSIS_CACHE.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`📦 Using cached analysis for ${marketData.symbol} (${Math.floor((Date.now() - cached.timestamp) / 1000)}s old)`);
      return { ...cached.data, fromCache: true };
    }
  }
  
  const prompt = buildAnalysisPrompt(marketData, technicals, multiTimeframe);
  
  // Retry logic for transient errors
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048
          }
        })
      });
      
      // Handle rate limiting (429) and server errors (5xx)
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        console.warn(`⚠️ Rate limited by Gemini API. Waiting ${retryAfter}s before retry ${attempt}/${MAX_RETRIES}...`);
        
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      if (response.status >= 500) {
        console.warn(`⚠️ Gemini API server error (${response.status}). Retry ${attempt}/${MAX_RETRIES}...`);
        
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
          continue;
        }
      }
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }
      
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('No response from Gemini');
      }
      
      const analysis = parseGeminiResponse(text, marketData);
      
      // Cache successful response
      if (useCache) {
        const cacheKey = generateCacheKey(marketData, technicals, multiTimeframe);
        ANALYSIS_CACHE.set(cacheKey, {
          data: analysis,
          timestamp: Date.now()
        });
        console.log(`💾 Cached analysis for ${marketData.symbol}`);
      }
      
      return analysis;
      
    } catch (error) {
      console.error(`Gemini analysis error (attempt ${attempt}/${MAX_RETRIES}):`, error.message);
      
      // If final retry failed, throw
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
    }
  }
  
  throw new Error('Failed to analyze after maximum retries');
}

/**
 * Build optimized analysis prompt (reduced token usage, improved signal quality)
 */
function buildAnalysisPrompt(marketData, technicals, multiTimeframe = null) {
  const { symbol, price, change, changePercent, volume, volumeRatio } = marketData;
  const { movingAverages, vwma, rsi, mfi, macd, stochastic, bollingerBands, vwap, obv, obvDivergence, cmf, atr, superTrend, adx, fibonacci, nearestFib, supportResistance, trend, candlestickPatterns, priceActionPatterns, volumeProfile, heikinAshi, ichimoku, volumeDelta } = technicals;
  
  // Concise context helpers
  const priceVsVWAP = vwap ? ((price - vwap) / vwap * 100).toFixed(2) : null;
  const bbPosition = bollingerBands ? 
    ((price - bollingerBands.lower) / (bollingerBands.upper - bollingerBands.lower) * 100).toFixed(0) : null;
  
  const macdTrend = macd ? 
    (macd.histogram > 0 ? 'bullish' : 'bearish') + 
    (Math.abs(macd.histogram) > Math.abs(macd.signal) * 0.1 ? ' (strengthening)' : ' (weakening)') : 'N/A';
  
  const volumeCtx = volumeRatio >= 3 ? 'EXTREME' : volumeRatio >= 2 ? 'VERY HIGH' :
                    volumeRatio >= 1.5 ? 'ELEVATED' : volumeRatio >= 1.2 ? 'ABOVE AVG' :
                    volumeRatio < 0.7 ? 'LOW' : 'NORMAL';
  
  return `Systematic trader analysis for ${symbol}. Generate a precise trade signal with JSON output.

## SNAPSHOT
${symbol}: $${price.toFixed(2)} ${change >= 0 ? '+' : ''}${changePercent.toFixed(2)}% | Vol: ${volumeCtx} (${volumeRatio.toFixed(2)}x) | Trend: ${trend.toUpperCase().replace('_', ' ')}

## TECHNICALS

**Price Structure:** VWAP $${vwap?.toFixed(2) || 'N/A'} (${priceVsVWAP > 0 ? '+' : ''}${priceVsVWAP}%) | BB ${bbPosition}% ${bbPosition < 20 ? '⚠️OVERSOLD' : bbPosition > 80 ? '⚠️OVERBOUGHT' : ''}

**MAs:** EMA9 $${movingAverages.ema9?.toFixed(2)} ${price > movingAverages.ema9 ? '✓' : '✗'} | EMA21 $${movingAverages.ema21?.toFixed(2)} ${price > movingAverages.ema21 ? '✓' : '✗'} | SMA50 $${movingAverages.sma50?.toFixed(2)} ${price > movingAverages.sma50 ? '✓' : '✗'} | SMA200 $${movingAverages.sma200?.toFixed(2)} ${price > movingAverages.sma200 ? '✓BULL' : '✗BEAR'}

**Volume-Weighted MAs (Institutional Flow Tracking):**
${vwma ? `VWMA20 $${vwma.vwma20?.toFixed(2)} ${price > vwma.vwma20 ? '✅' : '⚠️'} | VWMA50 $${vwma.vwma50?.toFixed(2) || 'N/A'} ${vwma.vwma50 && price > vwma.vwma50 ? '✅' : vwma.vwma50 ? '⚠️' : ''}
Signal: ${vwma.signal.toUpperCase()} (${vwma.strength}) ${vwma.volumeConfirmation ? '✅VOLUME CONFIRMED' : '⚪NO VOLUME EDGE'}
VWMA vs SMA20: ${vwma.vwmaVsSmaSpread20}% ${Math.abs(parseFloat(vwma.vwmaVsSmaSpread20)) > 1 ? (parseFloat(vwma.vwmaVsSmaSpread20) > 0 ? '🟢INSTITUTIONAL ACCUMULATION' : '🔴INSTITUTIONAL DISTRIBUTION') : '⚪BALANCED'}
Price vs VWMA20: ${vwma.priceVsVwma20}% | Trend Aligned: ${vwma.trendAligned === true ? '✅YES' : vwma.trendAligned === false ? '⚠️NO' : 'N/A'}
${vwma.description}` : 'N/A'}

**Momentum:**
• RSI ${rsi?.toFixed(0)} ${rsi > 70 ? '🔴OB' : rsi < 30 ? '🟢OS' : rsi > 60 ? 'Strong' : rsi < 40 ? 'Weak' : 'Neutral'}
• MFI ${mfi?.value.toFixed(0)} ${mfi.signal.toUpperCase()} (${mfi.strength}) ${mfi.value > 80 ? '🔴OB' : mfi.value < 20 ? '🟢OS' : ''}
• Stoch %K${stochastic.k.toFixed(0)}/%D${stochastic.d.toFixed(0)} ${stochastic.signal.toUpperCase()} ${stochastic.k > stochastic.d ? '↑' : '↓'}
• MACD ${macd.macd.toFixed(3)}/Sig ${macd.signal.toFixed(3)}/Hist ${macd.histogram.toFixed(3)} (${macdTrend})
• OBV ${(obv.current/1000000).toFixed(1)}M ${obv.trend.toUpperCase().replace('_', ' ')} ${obv.trend.includes('bullish') ? '✅ACC' : obv.trend.includes('bearish') ? '⚠️DIST' : ''}
• CMF(21) ${cmf?.value.toFixed(3)} ${cmf?.signal.toUpperCase().replace('_', ' ')} (${cmf?.strength}) ${cmf?.value > 0.25 ? '🟢STRONG BUY' : cmf?.value > 0.15 ? '✅BUY' : cmf?.value > 0.05 ? '↗️ACCUM' : cmf?.value < -0.25 ? '🔴STRONG SELL' : cmf?.value < -0.15 ? '⚠️SELL' : cmf?.value < -0.05 ? '↘️DIST' : '⚪NEUTRAL'}

**Volume Delta (Professional Order Flow - 20p):**
${volumeDelta ? `Delta: ${(volumeDelta.cumulativeDelta / 1000000).toFixed(2)}M | Buy: ${volumeDelta.buyPercentage.toFixed(1)}% | Sell: ${volumeDelta.sellPercentage.toFixed(1)}%
Signal: ${volumeDelta.signal.toUpperCase().replace('_', ' ')} (${volumeDelta.strength}) ${volumeDelta.signal.includes('accumulation') ? '✅ SMART MONEY BUYING' : volumeDelta.signal.includes('distribution') ? '⚠️ SMART MONEY SELLING' : '⚪ BALANCED'}
${volumeDelta.description}${volumeDelta.divergence ? `\n🚨 ${volumeDelta.divergence.type.toUpperCase()} DELTA DIVERGENCE! ${volumeDelta.divergence.signal} (Conf: ${volumeDelta.divergence.confidence}/10)` : ''}` : 'N/A'}

**Trend Strength:**
• ADX ${adx.adx.toFixed(0)} (${adx.strength}) ${adx.trending ? '✅TREND' : '❌CHOP'} | +DI ${adx.plusDI.toFixed(0)} / -DI ${adx.minusDI.toFixed(0)}
• Quality: ${adx.adx >= 25 ? '🟢HIGH' : adx.adx >= 20 ? '🟡MOD' : '🔴LOW'}
• SuperTrend: ${superTrend ? `$${superTrend.value.toFixed(2)} ${superTrend.trend.toUpperCase()} ${superTrend.signal === 'buy' ? '🟢BUY' : '🔴SELL'} (${superTrend.strength})${superTrend.trendChange ? ' 🔄NEW SIGNAL!' : ''} | Distance: ${superTrend.distance.toFixed(2)}% | Bands: $${superTrend.lowerBand.toFixed(2)}-$${superTrend.upperBand.toFixed(2)}` : 'N/A'}

**Volatility:** ATR $${atr.toFixed(2)} (${(atr/price*100).toFixed(1)}%) | BB Width ${bollingerBands.bandwidth.toFixed(1)}% ${bollingerBands.bandwidth > 10 ? 'WIDE' : bollingerBands.bandwidth < 3 ? '⚠️SQUEEZE' : ''}

**Levels:** R: ${supportResistance.resistance.map(r => '$' + r.toFixed(2)).join(', ')} | S: ${supportResistance.support.map(s => '$' + s.toFixed(2)).join(', ')}

**Volume Profile${volumeProfile ? ` (${volumeProfile.lookback}p)` : ''}:**
${volumeProfile ? `POC $${volumeProfile.poc.toFixed(2)} ${Math.abs(price - volumeProfile.poc) / volumeProfile.poc < 0.005 ? '🎯AT' : ''} | VAH $${volumeProfile.vah.toFixed(2)} ${price >= volumeProfile.vah ? '⬆️' : ''} | VAL $${volumeProfile.val.toFixed(2)} ${price <= volumeProfile.val ? '⬇️' : ''}
Position: ${volumeProfile.position.toUpperCase().replace('_', ' ')} ${volumeProfile.position === 'above_value_area' ? '⚠️ Mean revert risk' : volumeProfile.position === 'below_value_area' ? '⚠️ Bounce potential' : volumeProfile.position === 'at_poc' ? '🎯 Critical zone' : '✅ Fair value'}` : 'N/A'}

**Fibonacci${fibonacci ? ` (${fibonacci.lookback}p)` : ''}:**
${fibonacci ? `Range $${fibonacci.swingLow.toFixed(2)}-$${fibonacci.swingHigh.toFixed(2)} ($${fibonacci.range.toFixed(2)})
Retracements: 23.6% $${fibonacci.retracements['23.6'].toFixed(2)} | 38.2% $${fibonacci.retracements['38.2'].toFixed(2)} | 50% $${fibonacci.retracements['50.0'].toFixed(2)} | 61.8% $${fibonacci.retracements['61.8'].toFixed(2)}⭐ | 78.6% $${fibonacci.retracements['78.6'].toFixed(2)}
Extensions: 127% $${fibonacci.extensions['127.2'].toFixed(2)} | 162% $${fibonacci.extensions['161.8'].toFixed(2)} | 200% $${fibonacci.extensions['200.0'].toFixed(2)} | 262% $${fibonacci.extensions['261.8'].toFixed(2)}` : 'N/A'}
${nearestFib ? `⚠️ Near ${nearestFib.level} ${nearestFib.type} at $${nearestFib.price.toFixed(2)} (${nearestFib.distance.toFixed(1)}% away)${nearestFib.level === '61.8%' ? ' 🌟GOLDEN' : ''}` : ''}

**Candlestick Patterns:**
${candlestickPatterns && candlestickPatterns.primary ? `🕯️ ${candlestickPatterns.primary.pattern} - ${candlestickPatterns.primary.signal.toUpperCase()} (${candlestickPatterns.primary.strength.replace('_', ' ')})${candlestickPatterns.count > 1 ? ` +${candlestickPatterns.count - 1} more` : ''}
Priority: ${candlestickPatterns.primary.strength === 'very_strong' ? 'HIGH' : candlestickPatterns.primary.strength === 'strong' ? 'MOD-HIGH' : 'MOD'}` : 'None'}

**Price Action Patterns (Chart Patterns):**
${priceActionPatterns && priceActionPatterns.primary ? `📈 ${priceActionPatterns.primary.pattern.toUpperCase()} - ${priceActionPatterns.primary.type.replace('_', ' ').toUpperCase()} (Conf: ${priceActionPatterns.primary.confidence}/10)
Signal: ${priceActionPatterns.primary.signal} | ${priceActionPatterns.primary.description}
Formation: ${priceActionPatterns.primary.formation}
Trade Setup: Entry $${priceActionPatterns.primary.entry.toFixed(2)} | Target $${priceActionPatterns.primary.target.toFixed(2)} | Stop $${priceActionPatterns.primary.stopLoss.toFixed(2)}
${priceActionPatterns.primary.neckline ? `Neckline: $${priceActionPatterns.primary.neckline.toFixed(2)}` : ''}${priceActionPatterns.count > 1 ? ` | +${priceActionPatterns.count - 1} more patterns detected` : ''}
🌟 **MAJOR PATTERN - High probability setup!**` : 'None detected'}

**Heikin-Ashi Trend (Noise Filter):**
${heikinAshi ? `${heikinAshi.currentColor === 'green' ? '🟢' : '🔴'} ${heikinAshi.trend.toUpperCase().replace('_', ' ')} (${heikinAshi.strength}) Conf: ${heikinAshi.confidence}/10
Consecutive: ${heikinAshi.consecutiveBullish > 0 ? `${heikinAshi.consecutiveBullish} green` : `${heikinAshi.consecutiveBearish} red`} | Body/Wick: ${heikinAshi.bodyToWickRatio.toFixed(1)}x
Signals: ${heikinAshi.signals.strongTrend ? '✅STRONG TREND' : heikinAshi.signals.trendContinuation ? '✓TREND' : heikinAshi.signals.indecision ? '⚠️INDECISION' : ''}${heikinAshi.reversal ? `\n🔄 ${heikinAshi.reversal.type.toUpperCase()} REVERSAL: ${heikinAshi.reversal.signal} (Conf: ${heikinAshi.reversal.confidence}/10)` : ''}` : 'N/A'}

**Ichimoku Cloud (Japanese Trend System):**
${ichimoku ? `Signal: ${ichimoku.signal.toUpperCase().replace('_', ' ')} (Conf: ${ichimoku.confidence}/10) | Price: ${ichimoku.pricePosition.toUpperCase().replace('_', ' ')}
Tenkan (9): $${ichimoku.tenkanSen.toFixed(2)} | Kijun (26): $${ichimoku.kijunSen.toFixed(2)} | TK Cross: ${ichimoku.tkCross.toUpperCase()} ${ichimoku.tkCross === 'bullish' ? '✅' : ichimoku.tkCross === 'bearish' ? '⚠️' : ''}
Cloud: ${ichimoku.cloud.color.toUpperCase()} ${ichimoku.cloud.color === 'bullish' ? '🟢' : '🔴'} | Top: $${ichimoku.cloud.top.toFixed(2)} | Bottom: $${ichimoku.cloud.bottom.toFixed(2)} | Thickness: ${ichimoku.cloud.thicknessPercent.toFixed(2)}%
Senkou A: $${ichimoku.senkouSpanA.toFixed(2)} | Senkou B: $${ichimoku.senkouSpanB.toFixed(2)}
${ichimoku.signals && ichimoku.signals.length > 0 ? `🎯 ${ichimoku.signals.join(' | ')}` : ''}` : 'N/A'}
${obvDivergence ? `\n⚠️ **${obvDivergence.type.toUpperCase()} OBV DIVERGENCE!** ${obvDivergence.strength.toUpperCase()} (Conf: ${obvDivergence.confidence}/10) - ${obvDivergence.signal}` : ''}

**Multi-Timeframe Confluence Analysis:**
${multiTimeframe ? formatMultiTimeframeSection(multiTimeframe) : '⚠️ Not available (single timeframe analysis only)'}

**SIGNAL GENERATION RULES:**

**MANDATORY LONG Requirements (ALL must be met):**
1. Price Structure: Above EMA21 OR bouncing from strong support with volume
2. Momentum: RSI >40 OR bullish divergence with Volume Delta/OBV confirmation
3. Trend Strength: ADX ≥20 (≥25 for trend continuation; <20 OK ONLY if OBV/Volume Delta divergence OR major pattern setup)
4. Directional Alignment: +DI > -DI OR recent TK bullish cross with Ichimoku confirmation
5. Volume: >1.2x average (breakouts) OR >0.8x (mean reversion from oversold with accumulation signs)
6. Risk/Reward: Minimum 2:1 (entry to T2 vs entry to stop) - NO EXCEPTIONS

**MANDATORY SHORT Requirements (ALL must be met):**
1. Price Structure: Below EMA21 OR rejecting from strong resistance with volume
2. Momentum: RSI <60 OR bearish divergence with Volume Delta/OBV confirmation
3. Trend Strength: ADX ≥20 (≥25 for trend continuation; <20 OK ONLY if OBV/Volume Delta divergence OR major pattern setup)
4. Directional Alignment: -DI > +DI OR recent TK bearish cross with Ichimoku confirmation
5. Volume: >1.2x average (breakdowns) OR >0.8x (mean reversion from overbought with distribution signs)
6. Risk/Reward: Minimum 2:1 (entry to T2 vs entry to stop) - NO EXCEPTIONS

**AUTOMATIC NEUTRAL (Do NOT Trade):**
• ADX <20 AND no divergence/pattern setup
• Conflicting indicators: Trend says one thing, momentum says another, volume doesn't confirm
• Price chopping between EMA9/EMA21 with no clear bias
• Volume <0.6x average AND no major pattern
• BB squeeze (<3% width) without clear directional bias
• Price stuck in middle of value area with no catalyst
• Risk/Reward <1.8:1 after accounting for realistic stops at S/R levels

**Confidence Scoring Framework (1-10 Scale):**

**Score 9-10 (ULTRA-HIGH - Elite Setups Only):**
• Multi-Timeframe Confluence (≥7/10) + Volume Delta/CMF strong alignment (≥70% directional)
• Major Price Action Pattern (H&S conf ≥8, Double Top/Bottom conf ≥7) + MTF + Volume confirmation
• Ichimoku perfect setup (price above cloud + bullish TK cross + bullish cloud) + ADX ≥25 + Volume Delta accumulation
• Multi-System Confluence: MTF + Ichimoku + Volume Profile POC + Fib golden ratio + Strong HA trend + Volume Delta
• Base confidence: 9 | Cap at 10 for absolute perfection

**Score 7-8 (HIGH - Strong Probability):**
• Multi-Timeframe Confluence (≥6/10) OR Strong Volume Delta/CMF (≥65%) + price action pattern
• OBV Divergence (strong) + RSI/MFI extreme + ADX ≥20 + volume confirmation
• Ichimoku bullish/bearish + ADX ≥25 + Volume Profile support
• Major candlestick pattern at key S/R + volume + trend alignment
• Price Action Pattern (conf ≥6) + volume + trend confirmation
• Base confidence: 7 | Add +1 for each major confluence factor (max 8)

**Score 5-6 (MODERATE - Decent Edge):**
• ADX ≥25 + trend indicators align + momentum agrees + volume >1.2x
• Strong Heikin-Ashi trend (5+ consecutive) + price at S/R + volume
• Fibonacci 61.8% bounce + RSI extreme + some volume
• 2-3 solid confirming indicators + acceptable volume + trend
• Base confidence: 5 | Add +1 if volume strong or at key level (max 6)

**Score 3-4 (LOW - Weak Setup):**
• ADX 20-25 + some agreement but weak volume or conflicting signals
• Single indicator extreme (RSI/MFI) without confirmation
• Pattern setup without volume or trend confirmation
• Acceptable but not compelling - consider passing
• Base confidence: 3 | Add +1 if at least 1 strong factor (max 4)

**Score 1-2 (VERY WEAK - Usually NEUTRAL):**
• ADX <20 + no divergence + no pattern
• Conflicting signals dominate
• Weak volume + choppy price action
• Should almost always be NEUTRAL - only signal if extraordinary divergence/pattern
• Base confidence: 1-2 (rarely assign directional signal)

**CRITICAL FILTERS (Override to NEUTRAL):**
1. If Risk/Reward calculation shows <1.8:1 → NEUTRAL (stop too close or targets unrealistic)
2. If ADX <20 AND no divergence AND no major pattern → NEUTRAL (chop zone)
3. If volume <0.6x AND no accumulation/distribution signs → NEUTRAL (no conviction)
4. If 3+ indicators conflict AND no clear confluence → NEUTRAL (market uncertainty)
5. If price in middle 50% of BB AND ADX <25 → NEUTRAL (consolidation, wait for breakout)

**High-Confidence Boosters (Apply After Base Score):**
• Multi-Timeframe Strong Confluence (≥7/10): +2 to +3
• Volume Delta + CMF + OBV Triple Alignment: +2 to +3
• VWMA Strong Institutional Confirmation (VWMA vs SMA >1.5% spread + volume confirmed): +1.5 to +2
• Major Price Action Pattern (H&S ≥8, Dbl Top/Bot ≥7): +2
• Ichimoku Perfect Setup (all signals aligned): +2
• Volume Delta Divergence (strong): +1.5 to +2
• OBV Divergence (strong, overrides ADX): +1.5 to +2
• VWMA Trend Aligned + Volume Confirmation: +1
• At Volume Profile POC/VAH/VAL with pattern: +1
• At Fibonacci 61.8% with RSI/MFI extreme: +1
• Heikin-Ashi strong trend (5+) OR reversal: +1

**NOTE:** Always cap final confidence at 10. Be conservative - it's better to miss a trade than take a bad one.

## REQUIRED JSON OUTPUT

{
  "signal": "LONG" | "SHORT" | "NEUTRAL",
  "confidence": 1-10,
  "entry": precise_entry_price,
  "targets": {
    "t1": first_target (conservative, 1R),
    "t2": second_target (balanced, 2R),
    "t3": third_target (aggressive, 3R+)
  },
  "stopLoss": logical_stop_below_support_or_above_resistance,
  "riskReward": (avg_target - entry) / (entry - stop),
  "positionSizing": {
    "riskPerShare": Math.abs(entry - stopLoss),
    "recommendedRiskPercent": confidence >= 8 ? 2.0 : confidence >= 6 ? 1.5 : 1.0,
    "scalingPlan": {
      "initialEntry": 50-70% of position (higher confidence = higher initial %),
      "scaleIn": "On confirmation (e.g., break above resistance, volume surge)",
      "scaleOut": "T1: 33% | T2: 33% | T3: 34% (let winners run)"
    }
  },
  "reasoning": "Concise 1-2 sentence setup explanation with specific technical confluence",
  "pattern": "Breakout" | "Reversal" | "Consolidation" | "Trend Continuation" | "Mean Reversion" | "Squeeze" | "Other",
  "timeframe": "Scalp (minutes)" | "Intraday (hours)" | "Swing (days)",
  "alerts": [
    "Action trigger: e.g., 'Enter on break above $XXX with volume'",
    "Confirmation: e.g., 'RSI hold above 50'",
    "Risk note: e.g., 'Invalidated below VWAP'"
  ]
}

**Position Sizing Guidelines:**
- High confidence (8-10): 2% risk, 60-70% initial entry
- Medium confidence (6-7): 1.5% risk, 50-60% initial entry  
- Lower confidence (4-5): 1% risk, 40-50% initial entry
- Scale out at targets to lock profits and reduce risk
- Risk per share = |entry - stopLoss|

**Critical:** Return ONLY the JSON object. No markdown, no extra text, just pure JSON.`;
}

/**
 * Format multi-timeframe data for prompt
 */
function formatMultiTimeframeSection(mtf) {
  if (!mtf || !mtf.confluence) return 'N/A';
  
  const { timeframes, confluence } = mtf;
  
  let section = `Direction: ${confluence.direction.toUpperCase()} (${confluence.alignment} alignment) | Conf: ${confluence.confidence}/10\n`;
  section += `Bull ${confluence.bullishScore}% / Bear ${confluence.bearishScore}%\n\n`;
  
  section += `Timeframes:\n`;
  for (const [key, tf] of Object.entries(timeframes)) {
    const icon = tf.trend === 'bullish' ? '🟢' : tf.trend === 'bearish' ? '🔴' : '⚪';
    section += `${icon} ${tf.label}: ${tf.trend.toUpperCase()} | RSI ${tf.rsi} | MACD ${tf.macd} | Vol ${tf.volumeRatio}x | ${tf.priceChange > 0 ? '+' : ''}${tf.priceChange}%\n`;
  }
  
  if (confluence.signals && confluence.signals.length > 0) {
    section += `\n🎯 Key Confluence Signals:\n`;
    confluence.signals.slice(0, 4).forEach(signal => {
      section += `• ${signal}\n`;
    });
  }
  
  return section;
}

/**
 * Parse Gemini response and extract structured data
 */
function parseGeminiResponse(text, marketData) {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = text.trim();
    
    // Remove markdown code fences if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/, '');
    }
    
    const analysis = JSON.parse(jsonText);
    
    // Validate and enrich the response
    const positionSizing = analysis.positionSizing || {
      riskPerShare: analysis.stopLoss ? Math.abs(analysis.entry - analysis.stopLoss) : 0,
      recommendedRiskPercent: analysis.confidence >= 8 ? 2.0 : analysis.confidence >= 6 ? 1.5 : 1.0,
      scalingPlan: {
        initialEntry: '50-60%',
        scaleIn: 'On confirmation',
        scaleOut: 'T1: 33% | T2: 33% | T3: 34%'
      }
    };
    
    return {
      ticker: marketData.symbol,
      signal: analysis.signal || 'NEUTRAL',
      confidence: Math.min(10, Math.max(1, analysis.confidence || 5)),
      entry: analysis.entry || marketData.price,
      targets: analysis.targets || { t1: 0, t2: 0, t3: 0 },
      stopLoss: analysis.stopLoss || 0,
      riskReward: analysis.riskReward || 0,
      positionSizing: positionSizing,
      reasoning: analysis.reasoning || 'No reasoning provided',
      pattern: analysis.pattern || 'Other',
      timeframe: analysis.timeframe || 'Intraday (hours)',
      alerts: analysis.alerts || [],
      timestamp: Date.now(),
      raw: text
    };
  } catch (error) {
    console.error('Failed to parse Gemini response:', error.message);
    console.error('Raw response:', text);
    
    // Return a neutral signal if parsing fails
    return {
      ticker: marketData.symbol,
      signal: 'NEUTRAL',
      confidence: 1,
      entry: marketData.price,
      targets: { t1: 0, t2: 0, t3: 0 },
      stopLoss: 0,
      riskReward: 0,
      reasoning: 'Failed to parse AI response',
      pattern: 'Other',
      timeframe: 'Unknown',
      alerts: ['AI analysis parsing error'],
      timestamp: Date.now(),
      error: error.message,
      raw: text
    };
  }
}

/**
 * Batch analyze multiple tickers (with optional multi-timeframe data)
 */
export async function batchAnalyze(marketDataMap, technicalsMap, multiTimeframeMap = {}, useCache = true) {
  const results = {};
  
  for (const [ticker, marketData] of Object.entries(marketDataMap)) {
    const technicals = technicalsMap[ticker];
    
    if (!technicals) {
      console.log(`Skipping ${ticker} - no technical analysis available`);
      continue;
    }
    
    const multiTimeframe = multiTimeframeMap[ticker] || null;
    
    console.log(`Analyzing ${ticker} with Gemini AI${multiTimeframe ? ' (multi-timeframe enabled)' : ''}...`);
    
    try {
      const analysis = await analyzeWithGemini(marketData, technicals, multiTimeframe, useCache);
      results[ticker] = analysis;
      
      // Only wait if we actually called the API (not cached)
      if (!analysis.fromCache) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Failed to analyze ${ticker}:`, error.message);
      results[ticker] = {
        ticker,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  return results;
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const now = Date.now();
  let fresh = 0;
  let stale = 0;
  
  for (const [key, entry] of ANALYSIS_CACHE.entries()) {
    if (now - entry.timestamp < CACHE_TTL) {
      fresh++;
    } else {
      stale++;
    }
  }
  
  return {
    size: ANALYSIS_CACHE.size,
    fresh,
    stale,
    ttl: CACHE_TTL,
    entries: Array.from(ANALYSIS_CACHE.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      ticker: entry.data.ticker,
      signal: entry.data.signal,
      confidence: entry.data.confidence
    }))
  };
}

/**
 * Clear the analysis cache
 */
export function clearCache() {
  const size = ANALYSIS_CACHE.size;
  ANALYSIS_CACHE.clear();
  console.log(`🗑️ Cleared ${size} cached analysis entries`);
  return { cleared: size };
}
