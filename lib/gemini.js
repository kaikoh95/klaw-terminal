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
  const { movingAverages, rsi, macd, bollingerBands, vwap, supportResistance, trend } = technicals;
  
  return `You are an expert day trader analyzing ${symbol} for potential trading opportunities.

## Current Market Data
- Price: $${price.toFixed(2)}
- Change: ${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent.toFixed(2)}%)
- Volume Ratio: ${volumeRatio.toFixed(2)}x average (${volumeRatio >= 1.5 ? 'UNUSUAL' : 'normal'})

## Technical Indicators
- RSI(14): ${rsi?.toFixed(2) || 'N/A'}
- MACD: ${macd ? `${macd.macd.toFixed(2)} (Signal: ${macd.signal.toFixed(2)}, Histogram: ${macd.histogram.toFixed(2)})` : 'N/A'}
- Bollinger Bands: Upper ${bollingerBands?.upper.toFixed(2)}, Middle ${bollingerBands?.middle.toFixed(2)}, Lower ${bollingerBands?.lower.toFixed(2)}
- VWAP: $${vwap?.toFixed(2) || 'N/A'}
- Trend: ${trend}

## Moving Averages
- SMA(20): $${movingAverages.sma20?.toFixed(2) || 'N/A'}
- SMA(50): $${movingAverages.sma50?.toFixed(2) || 'N/A'}
- SMA(200): $${movingAverages.sma200?.toFixed(2) || 'N/A'}
- EMA(9): $${movingAverages.ema9?.toFixed(2) || 'N/A'}
- EMA(21): $${movingAverages.ema21?.toFixed(2) || 'N/A'}

## Support & Resistance
- Resistance: ${supportResistance.resistance.map(r => '$' + r.toFixed(2)).join(', ') || 'None identified'}
- Support: ${supportResistance.support.map(s => '$' + s.toFixed(2)).join(', ') || 'None identified'}

## Your Task
Analyze this data and provide a structured trading recommendation in JSON format:

{
  "signal": "LONG" | "SHORT" | "NEUTRAL",
  "confidence": 1-10 (integer),
  "entry": entry_price (number),
  "targets": {
    "t1": target_1_price (number),
    "t2": target_2_price (number),
    "t3": target_3_price (number)
  },
  "stopLoss": stop_loss_price (number),
  "riskReward": calculated_ratio (number),
  "reasoning": "Brief explanation of setup and pattern",
  "pattern": "Breakout" | "Reversal" | "Consolidation" | "Trend Continuation" | "Other",
  "timeframe": "Scalp (minutes)" | "Intraday (hours)" | "Swing (days)",
  "alerts": ["Key level: $XXX", "Watch for volume confirmation", etc.]
}

Be specific with price levels. Consider:
- RSI overbought (>70) or oversold (<30)
- MACD crossovers and divergences
- Price position relative to Bollinger Bands and VWAP
- Support/resistance levels for entries and exits
- Volume confirmation
- Overall trend alignment

Return ONLY valid JSON, no additional text.`;
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
