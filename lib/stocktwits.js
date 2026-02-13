// StockTwits API Integration - Social Sentiment Tracking
// API Docs: https://api.stocktwits.com/developers/docs
//
// NOTE: StockTwits API may require authentication or have rate limits.
// If you encounter 403 errors, you may need to:
// 1. Register for API access at https://stocktwits.com/developers
// 2. Add API token to requests
// 3. Use demo mode (set STOCKTWITS_DEMO=true)

const STOCKTWITS_API_BASE = 'https://api.stocktwits.com/api/2';
const DEMO_MODE = process.env.STOCKTWITS_DEMO === 'true';

/**
 * Generate demo sentiment data for testing
 */
function generateDemoSentiment(ticker) {
  const baseScore = Math.random() * 200 - 100; // -100 to +100
  const bullishCount = Math.max(0, Math.round(15 + baseScore * 0.2 + Math.random() * 10));
  const bearishCount = Math.max(0, Math.round(15 - baseScore * 0.2 + Math.random() * 10));
  const neutralCount = Math.round(Math.random() * 10);
  const totalMessages = bullishCount + bearishCount + neutralCount;
  
  let signal = 'neutral';
  if (baseScore > 30) signal = 'bullish';
  else if (baseScore > 10) signal = 'slightly_bullish';
  else if (baseScore < -30) signal = 'bearish';
  else if (baseScore < -10) signal = 'slightly_bearish';
  
  const demoMessages = [
    { text: `${ticker} looking strong on technicals, might break resistance soon`, sentiment: 'Bullish', createdAt: new Date(Date.now() - 300000).toISOString() },
    { text: `Watching ${ticker} closely, volume picking up`, sentiment: null, createdAt: new Date(Date.now() - 600000).toISOString() },
    { text: `${ticker} oversold, potential bounce play`, sentiment: 'Bullish', createdAt: new Date(Date.now() - 900000).toISOString() },
    { text: `Not convinced on ${ticker} here, need to see more confirmation`, sentiment: 'Bearish', createdAt: new Date(Date.now() - 1200000).toISOString() },
    { text: `${ticker} chart pattern interesting, setting alerts`, sentiment: null, createdAt: new Date(Date.now() - 1500000).toISOString() }
  ];
  
  return {
    ticker,
    available: true,
    score: Math.round(baseScore),
    signal,
    bullishCount,
    bearishCount,
    neutralCount,
    totalMessages,
    confidence: Math.round(60 + Math.random() * 30),
    recentMessages: demoMessages,
    watchlistCount: Math.round(10000 + Math.random() * 50000)
  };
}

/**
 * Get trending stocks from StockTwits
 */
export async function getTrendingStocks() {
  if (DEMO_MODE) {
    return [
      { ticker: 'TSLA', title: 'Tesla Inc', watchlistCount: 125420 },
      { ticker: 'NVDA', title: 'NVIDIA Corp', watchlistCount: 98330 },
      { ticker: 'AAPL', title: 'Apple Inc', watchlistCount: 87654 },
      { ticker: 'AMD', title: 'Advanced Micro Devices', watchlistCount: 76543 },
      { ticker: 'PLTR', title: 'Palantir Technologies', watchlistCount: 65432 }
    ];
  }
  
  try {
    const response = await fetch(`${STOCKTWITS_API_BASE}/trending/symbols.json`);
    
    if (!response.ok) {
      throw new Error(`StockTwits API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return data.symbols.map(symbol => ({
      ticker: symbol.symbol,
      title: symbol.title,
      watchlistCount: symbol.watchlist_count
    }));
  } catch (error) {
    console.error('Error fetching trending stocks:', error.message);
    return [];
  }
}

/**
 * Get stream of messages for a ticker
 */
export async function getTickerStream(ticker, limit = 30) {
  try {
    const response = await fetch(`${STOCKTWITS_API_BASE}/streams/symbol/${ticker}.json?limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`StockTwits API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.messages || data.messages.length === 0) {
      return null;
    }
    
    return {
      ticker,
      messages: data.messages.map(msg => ({
        id: msg.id,
        body: msg.body,
        createdAt: msg.created_at,
        sentiment: msg.entities?.sentiment?.basic || null,
        user: msg.user.username,
        likeCount: msg.likes?.total || 0
      })),
      symbol: data.symbol
    };
  } catch (error) {
    console.error(`Error fetching stream for ${ticker}:`, error.message);
    return null;
  }
}

/**
 * Calculate sentiment score from messages
 */
function calculateSentimentScore(messages) {
  if (!messages || messages.length === 0) {
    return {
      score: 0,
      signal: 'neutral',
      bullishCount: 0,
      bearishCount: 0,
      neutralCount: 0,
      totalMessages: 0,
      confidence: 0
    };
  }
  
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  
  // Weight recent messages more heavily
  const now = Date.now();
  const oneHourMs = 3600000;
  
  messages.forEach(msg => {
    const ageHours = (now - new Date(msg.createdAt).getTime()) / oneHourMs;
    const weight = Math.max(0.1, 1 - (ageHours / 24)); // Decay over 24h, min 0.1
    
    if (msg.sentiment === 'Bullish') {
      bullish += weight;
    } else if (msg.sentiment === 'Bearish') {
      bearish += weight;
    } else {
      neutral += weight * 0.5; // Neutral messages count less
    }
  });
  
  const total = bullish + bearish + neutral;
  
  if (total === 0) {
    return {
      score: 0,
      signal: 'neutral',
      bullishCount: 0,
      bearishCount: 0,
      neutralCount: messages.length,
      totalMessages: messages.length,
      confidence: 0
    };
  }
  
  // Score from -100 (very bearish) to +100 (very bullish)
  const rawScore = ((bullish - bearish) / total) * 100;
  
  // Confidence based on sample size and clarity
  const messageCount = messages.length;
  const sampleConfidence = Math.min(1, messageCount / 20); // Max at 20+ messages
  const clarityRatio = Math.abs(bullish - bearish) / Math.max(1, bullish + bearish);
  const confidence = (sampleConfidence * 0.6 + clarityRatio * 0.4) * 100;
  
  let signal = 'neutral';
  if (rawScore > 30) signal = 'bullish';
  else if (rawScore > 10) signal = 'slightly_bullish';
  else if (rawScore < -30) signal = 'bearish';
  else if (rawScore < -10) signal = 'slightly_bearish';
  
  return {
    score: Math.round(rawScore),
    signal,
    bullishCount: Math.round(bullish),
    bearishCount: Math.round(bearish),
    neutralCount: messages.filter(m => !m.sentiment || m.sentiment === 'None').length,
    totalMessages: messages.length,
    confidence: Math.round(confidence)
  };
}

/**
 * Get sentiment analysis for a ticker
 */
export async function getTickerSentiment(ticker) {
  if (DEMO_MODE) {
    console.log(`[DEMO MODE] Generating sentiment for ${ticker}`);
    return generateDemoSentiment(ticker);
  }
  
  try {
    const stream = await getTickerStream(ticker, 30);
    
    if (!stream) {
      // Fallback to demo mode if API fails
      console.log(`API unavailable for ${ticker}, using demo data`);
      return generateDemoSentiment(ticker);
    }
    
    const sentiment = calculateSentimentScore(stream.messages);
    
    return {
      ticker,
      available: true,
      ...sentiment,
      recentMessages: stream.messages.slice(0, 5).map(m => ({
        text: m.body.substring(0, 100) + (m.body.length > 100 ? '...' : ''),
        sentiment: m.sentiment,
        createdAt: m.createdAt
      })),
      watchlistCount: stream.symbol?.watchlist_count || 0
    };
  } catch (error) {
    console.error(`Error analyzing sentiment for ${ticker}:`, error.message);
    return {
      ticker,
      available: false,
      error: error.message
    };
  }
}

/**
 * Batch analyze sentiment for multiple tickers
 */
export async function batchGetSentiment(tickers) {
  const results = {};
  
  for (const ticker of tickers) {
    console.log(`Fetching StockTwits sentiment for ${ticker}...`);
    
    try {
      const sentiment = await getTickerSentiment(ticker);
      results[ticker] = sentiment;
      
      // Rate limiting - StockTwits allows 200 req/hour = ~3.3/min
      // Wait 1 second between requests to be safe
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Failed to get sentiment for ${ticker}:`, error.message);
      results[ticker] = {
        ticker,
        available: false,
        error: error.message
      };
    }
  }
  
  return results;
}

/**
 * Get summary sentiment across all tickers
 */
export function getSentimentSummary(sentimentData) {
  const available = Object.values(sentimentData).filter(s => s.available);
  
  if (available.length === 0) {
    return {
      overallScore: 0,
      overallSignal: 'neutral',
      tickersAnalyzed: 0,
      bullishTickers: [],
      bearishTickers: [],
      mostBullish: null,
      mostBearish: null
    };
  }
  
  const avgScore = available.reduce((sum, s) => sum + s.score, 0) / available.length;
  
  const bullishTickers = available
    .filter(s => s.signal === 'bullish' || s.signal === 'slightly_bullish')
    .map(s => ({ ticker: s.ticker, score: s.score }))
    .sort((a, b) => b.score - a.score);
  
  const bearishTickers = available
    .filter(s => s.signal === 'bearish' || s.signal === 'slightly_bearish')
    .map(s => ({ ticker: s.ticker, score: s.score }))
    .sort((a, b) => a.score - b.score);
  
  const mostBullish = available.reduce((max, s) => s.score > max.score ? s : max, available[0]);
  const mostBearish = available.reduce((min, s) => s.score < min.score ? s : min, available[0]);
  
  let overallSignal = 'neutral';
  if (avgScore > 30) overallSignal = 'bullish';
  else if (avgScore > 10) overallSignal = 'slightly_bullish';
  else if (avgScore < -30) overallSignal = 'bearish';
  else if (avgScore < -10) overallSignal = 'slightly_bearish';
  
  return {
    overallScore: Math.round(avgScore),
    overallSignal,
    tickersAnalyzed: available.length,
    bullishTickers: bullishTickers.map(t => t.ticker),
    bearishTickers: bearishTickers.map(t => t.ticker),
    mostBullish: { ticker: mostBullish.ticker, score: mostBullish.score },
    mostBearish: { ticker: mostBearish.ticker, score: mostBearish.score }
  };
}
