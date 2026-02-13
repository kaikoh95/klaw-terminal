// Gemini 2.5 Pro AI Analysis Integration

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

/**
 * Analyze market data and technicals with Gemini AI
 */
export async function analyzeWithGemini(marketData, technicals) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not found in environment');
  }
  
  const prompt = buildAnalysisPrompt(marketData, technicals);
  
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
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error('No response from Gemini');
    }
    
    return parseGeminiResponse(text, marketData);
  } catch (error) {
    console.error('Gemini analysis error:', error.message);
    throw error;
  }
}

/**
 * Build optimized analysis prompt (reduced token usage, improved signal quality)
 */
function buildAnalysisPrompt(marketData, technicals) {
  const { symbol, price, change, changePercent, volume, volumeRatio } = marketData;
  const { movingAverages, rsi, mfi, macd, stochastic, bollingerBands, vwap, obv, obvDivergence, atr, adx, fibonacci, nearestFib, supportResistance, trend, candlestickPatterns, volumeProfile, heikinAshi } = technicals;
  
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

**Momentum:**
• RSI ${rsi?.toFixed(0)} ${rsi > 70 ? '🔴OB' : rsi < 30 ? '🟢OS' : rsi > 60 ? 'Strong' : rsi < 40 ? 'Weak' : 'Neutral'}
• MFI ${mfi?.value.toFixed(0)} ${mfi.signal.toUpperCase()} (${mfi.strength}) ${mfi.value > 80 ? '🔴OB' : mfi.value < 20 ? '🟢OS' : ''}
• Stoch %K${stochastic.k.toFixed(0)}/%D${stochastic.d.toFixed(0)} ${stochastic.signal.toUpperCase()} ${stochastic.k > stochastic.d ? '↑' : '↓'}
• MACD ${macd.macd.toFixed(3)}/Sig ${macd.signal.toFixed(3)}/Hist ${macd.histogram.toFixed(3)} (${macdTrend})
• OBV ${(obv.current/1000000).toFixed(1)}M ${obv.trend.toUpperCase().replace('_', ' ')} ${obv.trend.includes('bullish') ? '✅ACC' : obv.trend.includes('bearish') ? '⚠️DIST' : ''}

**Trend Strength:**
• ADX ${adx.adx.toFixed(0)} (${adx.strength}) ${adx.trending ? '✅TREND' : '❌CHOP'} | +DI ${adx.plusDI.toFixed(0)} / -DI ${adx.minusDI.toFixed(0)}
• Quality: ${adx.adx >= 25 ? '🟢HIGH' : adx.adx >= 20 ? '🟡MOD' : '🔴LOW'}

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

**Heikin-Ashi Trend (Noise Filter):**
${heikinAshi ? `${heikinAshi.currentColor === 'green' ? '🟢' : '🔴'} ${heikinAshi.trend.toUpperCase().replace('_', ' ')} (${heikinAshi.strength}) Conf: ${heikinAshi.confidence}/10
Consecutive: ${heikinAshi.consecutiveBullish > 0 ? `${heikinAshi.consecutiveBullish} green` : `${heikinAshi.consecutiveBearish} red`} | Body/Wick: ${heikinAshi.bodyToWickRatio.toFixed(1)}x
Signals: ${heikinAshi.signals.strongTrend ? '✅STRONG TREND' : heikinAshi.signals.trendContinuation ? '✓TREND' : heikinAshi.signals.indecision ? '⚠️INDECISION' : ''}${heikinAshi.reversal ? `\n🔄 ${heikinAshi.reversal.type.toUpperCase()} REVERSAL: ${heikinAshi.reversal.signal} (Conf: ${heikinAshi.reversal.confidence}/10)` : ''}` : 'N/A'}
${obvDivergence ? `\n⚠️ **${obvDivergence.type.toUpperCase()} OBV DIVERGENCE!** ${obvDivergence.strength.toUpperCase()} (Conf: ${obvDivergence.confidence}/10) - ${obvDivergence.signal}` : ''}

**LONG/SHORT Requirements:**
• ADX ≥20 (≥25 for trend trades; <20 OK for mean reversion/OBV divergence)
• 2+ confirming indicators (trend+momentum)
• Entry near S/R, 2:1+ R:R, volume >1.2x (breakouts)
• +DI/-DI alignment matches direction

**High-Confidence Signals (boost confidence):**
• Volume Profile: POC/VAH/VAL +price action (+1.5-2)
• OBV Divergence: Strong reversal signal (+2, can override ADX <20)
• MFI/RSI Divergence: Volume-backed shift (+1.5-2)
• Candlestick Patterns: Very strong at S/R (+1-2)
• Heikin-Ashi: Strong trend (5+ consecutive) OR reversal signal (+1-2)
• Fibonacci 61.8% + RSI/MFI extreme: High prob bounce (+1.5)
• Triple confluence (VP POC + Fib + Pattern + HA): Ultra setup (+3-4)

**NEUTRAL if:** ADX <20 + no setup, conflicting signals, choppy, low volume

**Confidence (1-10):** 8-10=aligned+volume+pattern | 6-7=most agree | 4-5=slight edge | 1-3=weak

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
  "reasoning": "Concise 1-2 sentence setup explanation with specific technical confluence",
  "pattern": "Breakout" | "Reversal" | "Consolidation" | "Trend Continuation" | "Mean Reversion" | "Squeeze" | "Other",
  "timeframe": "Scalp (minutes)" | "Intraday (hours)" | "Swing (days)",
  "alerts": [
    "Action trigger: e.g., 'Enter on break above $XXX with volume'",
    "Confirmation: e.g., 'RSI hold above 50'",
    "Risk note: e.g., 'Invalidated below VWAP'"
  ]
}

**Critical:** Return ONLY the JSON object. No markdown, no extra text, just pure JSON.`;
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
    return {
      ticker: marketData.symbol,
      signal: analysis.signal || 'NEUTRAL',
      confidence: Math.min(10, Math.max(1, analysis.confidence || 5)),
      entry: analysis.entry || marketData.price,
      targets: analysis.targets || { t1: 0, t2: 0, t3: 0 },
      stopLoss: analysis.stopLoss || 0,
      riskReward: analysis.riskReward || 0,
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
 * Batch analyze multiple tickers
 */
export async function batchAnalyze(marketDataMap, technicalsMap) {
  const results = {};
  
  for (const [ticker, marketData] of Object.entries(marketDataMap)) {
    const technicals = technicalsMap[ticker];
    
    if (!technicals) {
      console.log(`Skipping ${ticker} - no technical analysis available`);
      continue;
    }
    
    console.log(`Analyzing ${ticker} with Gemini AI...`);
    
    try {
      const analysis = await analyzeWithGemini(marketData, technicals);
      results[ticker] = analysis;
      
      // Rate limiting - wait between API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
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
