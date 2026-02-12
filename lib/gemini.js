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
 * Build comprehensive analysis prompt
 */
function buildAnalysisPrompt(marketData, technicals) {
  const { symbol, price, change, changePercent, volume, volumeRatio } = marketData;
  const { movingAverages, rsi, macd, stochastic, bollingerBands, vwap, obv, obvDivergence, atr, adx, fibonacci, nearestFib, supportResistance, trend } = technicals;
  
  // Enhanced context analysis
  const priceVsVWAP = vwap ? ((price - vwap) / vwap * 100).toFixed(2) : null;
  const bbPosition = bollingerBands ? 
    ((price - bollingerBands.lower) / (bollingerBands.upper - bollingerBands.lower) * 100).toFixed(0) : null;
  
  const macdTrend = macd ? 
    (macd.histogram > 0 ? 'bullish' : 'bearish') + 
    (Math.abs(macd.histogram) > Math.abs(macd.signal) * 0.1 ? ' (strengthening)' : ' (weakening)') : 'N/A';
  
  const volumeContext = volumeRatio >= 3 ? 'EXTREME (3x+)' :
                        volumeRatio >= 2 ? 'VERY HIGH (2x+)' :
                        volumeRatio >= 1.5 ? 'ELEVATED (1.5x+)' :
                        volumeRatio >= 1.2 ? 'ABOVE AVERAGE' :
                        volumeRatio < 0.7 ? 'LOW' : 'NORMAL';
  
  return `You are a professional quantitative trader with 15+ years of experience. Analyze ${symbol} using systematic price action and technical indicators.

## MARKET SNAPSHOT
Price: $${price.toFixed(2)} | Change: ${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent.toFixed(2)}%)
Volume: ${volumeContext} (${volumeRatio.toFixed(2)}x avg)
Trend Classification: ${trend.toUpperCase().replace('_', ' ')}

## TECHNICAL MATRIX

### Price Structure
- Current: $${price.toFixed(2)}
- VWAP: $${vwap?.toFixed(2) || 'N/A'} ${priceVsVWAP ? `(${priceVsVWAP > 0 ? '+' : ''}${priceVsVWAP}%)` : ''}
- BB Position: ${bbPosition ? `${bbPosition}% width` : 'N/A'} ${bbPosition < 20 ? '⚠️ OVERSOLD ZONE' : bbPosition > 80 ? '⚠️ OVERBOUGHT ZONE' : ''}

### Moving Averages (Trend Indicators)
- EMA(9): $${movingAverages.ema9?.toFixed(2) || 'N/A'} ${movingAverages.ema9 ? price > movingAverages.ema9 ? '✓ Above' : '✗ Below' : ''}
- EMA(21): $${movingAverages.ema21?.toFixed(2) || 'N/A'} ${movingAverages.ema21 ? price > movingAverages.ema21 ? '✓ Above' : '✗ Below' : ''}
- SMA(20): $${movingAverages.sma20?.toFixed(2) || 'N/A'}
- SMA(50): $${movingAverages.sma50?.toFixed(2) || 'N/A'} ${movingAverages.sma50 ? price > movingAverages.sma50 ? '✓ Above' : '✗ Below' : ''}
- SMA(200): $${movingAverages.sma200?.toFixed(2) || 'N/A'} ${movingAverages.sma200 ? price > movingAverages.sma200 ? '✓ BULLISH' : '✗ BEARISH' : ''}

### Momentum Oscillators
- RSI(14): ${rsi?.toFixed(2) || 'N/A'} ${rsi ? rsi > 70 ? '🔴 OVERBOUGHT' : rsi < 30 ? '🟢 OVERSOLD' : rsi > 60 ? 'Strong' : rsi < 40 ? 'Weak' : 'Neutral' : ''}
- Stochastic: ${stochastic ? `%K=${stochastic.k.toFixed(2)}, %D=${stochastic.d.toFixed(2)}` : 'N/A'}
  - Signal: ${stochastic ? stochastic.signal.toUpperCase() : 'N/A'} ${stochastic && stochastic.k > stochastic.d ? '(Bullish cross)' : stochastic && stochastic.k < stochastic.d ? '(Bearish cross)' : ''}
- MACD: ${macd ? `${macd.macd.toFixed(3)}` : 'N/A'}
  - Signal: ${macd?.signal.toFixed(3) || 'N/A'}
  - Histogram: ${macd?.histogram.toFixed(3) || 'N/A'} (${macdTrend})
  - Cross: ${macd ? macd.macd > macd.signal ? '🟢 Bullish' : '🔴 Bearish' : 'N/A'}

### Volume Flow Indicators
- OBV (On-Balance Volume): ${obv ? `${(obv.current / 1000000).toFixed(2)}M` : 'N/A'}
  - Trend: ${obv ? obv.trend.toUpperCase().replace('_', ' ') : 'N/A'}
  - ${obv && obv.trend.includes('bullish') ? '✅ Accumulation (buying pressure)' : obv && obv.trend.includes('bearish') ? '⚠️ Distribution (selling pressure)' : 'Neutral flow'}
${obvDivergence ? `
⚠️ **${obvDivergence.type.toUpperCase()} DIVERGENCE DETECTED!**
  - Strength: ${obvDivergence.strength.toUpperCase()}
  - Signal: ${obvDivergence.signal}
  - Confidence: ${obvDivergence.confidence}/10
  - **This is a powerful reversal signal - pay close attention!**
` : ''}

### Trend Strength (ADX)
- ADX(14): ${adx?.adx.toFixed(2) || 'N/A'} ${adx ? `(${adx.strength.toUpperCase().replace('_', ' ')})` : ''}
  - ${adx && adx.trending ? '✅ TRENDING MARKET' : adx ? '❌ CHOPPY/RANGING' : 'N/A'}
  - +DI: ${adx?.plusDI.toFixed(2) || 'N/A'} ${adx && adx.plusDI > adx.minusDI ? '(Bullish pressure)' : ''}
  - -DI: ${adx?.minusDI.toFixed(2) || 'N/A'} ${adx && adx.minusDI > adx.plusDI ? '(Bearish pressure)' : ''}
  - Signal Quality: ${adx ? adx.adx >= 25 ? '🟢 HIGH (Strong trend - reliable signals)' : adx.adx >= 20 ? '🟡 MODERATE (Watch for confirmation)' : '🔴 LOW (Avoid trend trades, range-bound)' : 'N/A'}

### Volatility & Bands
- ATR(14): $${atr?.toFixed(2) || 'N/A'} ${atr ? `(${(atr/price*100).toFixed(2)}% of price)` : ''}
- BB Upper: $${bollingerBands?.upper.toFixed(2) || 'N/A'}
- BB Middle: $${bollingerBands?.middle.toFixed(2) || 'N/A'}
- BB Lower: $${bollingerBands?.lower.toFixed(2) || 'N/A'}
- Bandwidth: ${bollingerBands?.bandwidth.toFixed(2) || 'N/A'}% ${bollingerBands?.bandwidth > 10 ? '(Wide - High Volatility)' : bollingerBands?.bandwidth < 3 ? '(Squeeze - Breakout Pending)' : ''}

### Key Levels
- Resistance: ${supportResistance.resistance.map(r => '$' + r.toFixed(2)).join(' | ') || 'None identified'}
- Support: ${supportResistance.support.map(s => '$' + s.toFixed(2)).join(' | ') || 'None identified'}

### Fibonacci Retracements (${fibonacci ? fibonacci.lookback : 'N/A'}-period)
${fibonacci ? `
- Swing High: $${fibonacci.swingHigh.toFixed(2)}
- Swing Low: $${fibonacci.swingLow.toFixed(2)}
- Range: $${fibonacci.range.toFixed(2)}

**Retracement Levels:**
  - 0.0% (High): $${fibonacci.retracements['0.0'].toFixed(2)}
  - 23.6%: $${fibonacci.retracements['23.6'].toFixed(2)} ${price <= fibonacci.retracements['23.6'] && price >= fibonacci.retracements['38.2'] ? '← CURRENT ZONE' : ''}
  - 38.2%: $${fibonacci.retracements['38.2'].toFixed(2)} ${price <= fibonacci.retracements['38.2'] && price >= fibonacci.retracements['50.0'] ? '← CURRENT ZONE' : ''}
  - 50.0%: $${fibonacci.retracements['50.0'].toFixed(2)} ${price <= fibonacci.retracements['50.0'] && price >= fibonacci.retracements['61.8'] ? '← CURRENT ZONE' : ''}
  - 61.8% (Golden): $${fibonacci.retracements['61.8'].toFixed(2)} ${price <= fibonacci.retracements['61.8'] && price >= fibonacci.retracements['78.6'] ? '← CURRENT ZONE ⭐' : ''}
  - 78.6%: $${fibonacci.retracements['78.6'].toFixed(2)} ${price <= fibonacci.retracements['78.6'] && price >= fibonacci.retracements['100.0'] ? '← CURRENT ZONE' : ''}
  - 100.0% (Low): $${fibonacci.retracements['100.0'].toFixed(2)}

**Extension Targets:**
  - 127.2%: $${fibonacci.extensions['127.2'].toFixed(2)}
  - 161.8%: $${fibonacci.extensions['161.8'].toFixed(2)}
  - 200.0%: $${fibonacci.extensions['200.0'].toFixed(2)}
  - 261.8%: $${fibonacci.extensions['261.8'].toFixed(2)}
` : 'Insufficient data for Fibonacci calculation'}
${nearestFib ? `
⚠️ **Price near ${nearestFib.level} Fibonacci ${nearestFib.type}** at $${nearestFib.price.toFixed(2)} (${nearestFib.distance.toFixed(2)}% away)
${nearestFib.level === '61.8%' ? '🌟 Golden Ratio - Strong support/resistance zone!' : ''}
` : ''}

## ANALYSIS FRAMEWORK

Use this systematic approach:

1. **Trend Confirmation** (35% weight)
   - Price vs MA alignment
   - MACD direction and strength
   - Trend classification
   - OBV trend alignment

2. **Momentum Quality** (30% weight)
   - RSI positioning and divergences
   - Volume confirmation
   - Rate of change
   - **OBV divergences (CRITICAL - can override other signals)**

3. **Entry/Exit Precision** (20% weight)
   - Support/resistance proximity
   - Fibonacci level confluence (especially 38.2%, 50%, 61.8%)
   - Bollinger Band position
   - VWAP relationship

4. **Risk Management** (15% weight)
   - Volatility assessment
   - Stop placement logic
   - R:R ratio validation
   - OBV divergence confirmation

## SIGNAL GENERATION RULES

**ONLY generate LONG/SHORT if:**
- **ADX >= 20** for directional trades (>25 preferred for trend trades)
  - Exception: ADX <20 allowed for mean reversion/range trades only
- Minimum 2 confirming indicators (e.g., trend + momentum)
- Clear entry point near support/resistance
- Achievable 2:1 R:R minimum
- Volume supports the move (>1.2x for breakouts)
- RSI not in extreme territory unless reversal setup
- +DI/-DI alignment matches signal direction

**PRIORITY SIGNALS (High Confidence):**
- **OBV Divergence** = Strong reversal signal (bullish/bearish depending on type)
  - Strong divergence can justify LONG/SHORT even with ADX <20
  - Increases confidence by +2 points
  - Must align with entry near support/resistance
- Fibonacci 61.8% + RSI oversold/overbought = High probability bounce/rejection
- MACD + Stochastic cross in same direction = Strong momentum confirmation
- Volume spike (>2x) + breakout above resistance = Breakout continuation

**Use NEUTRAL when:**
- ADX <20 AND no clear range-bound setup
- Conflicting signals
- Choppy/sideways action
- Low volume/conviction
- Insufficient edge

**Confidence Scoring (1-10):**
- 8-10: All indicators aligned, high volume, clear pattern
- 6-7: Most indicators agree, decent setup
- 4-5: Mixed signals but slight edge
- 1-3: Weak setup or conflict

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
