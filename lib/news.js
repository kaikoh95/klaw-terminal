// News Feed Integration for Klaw Terminal
// Uses Alpha Vantage News & Sentiment API (free tier: 25 calls/day)

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

function loadApiKey() {
  if (process.env.ALPHA_VANTAGE_API_KEY) return process.env.ALPHA_VANTAGE_API_KEY;
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const envFile = readFileSync(join(__dirname, '..', '.env'), 'utf8');
    const match = envFile.match(/ALPHA_VANTAGE_API_KEY=(.+)/);
    return match ? match[1].trim() : null;
  } catch { 
    // Default to demo key if not configured (limited to 25 calls/day)
    return 'demo';
  }
}

const ALPHA_VANTAGE_API_KEY = loadApiKey();
const NEWS_CACHE = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch news and sentiment for a ticker from Alpha Vantage
 */
export async function fetchTickerNews(ticker, limit = 10) {
  const cacheKey = `${ticker}-${limit}`;
  const cached = NEWS_CACHE.get(cacheKey);
  
  // Return cached data if still fresh
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  try {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${ticker}&limit=${limit}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Handle API error responses
    if (data.Note || data['Error Message']) {
      throw new Error(data.Note || data['Error Message']);
    }
    
    if (!data.feed || data.feed.length === 0) {
      return {
        ticker,
        articles: [],
        sentiment: {
          score: 0,
          label: 'Neutral',
          bullishCount: 0,
          bearishCount: 0,
          neutralCount: 0
        },
        timestamp: Date.now()
      };
    }
    
    // Process articles and calculate aggregate sentiment
    const articles = data.feed.map(article => {
      // Find sentiment for this specific ticker
      const tickerSentiment = article.ticker_sentiment?.find(
        t => t.ticker === ticker
      ) || { ticker_sentiment_score: '0', ticker_sentiment_label: 'Neutral', relevance_score: '0' };
      
      return {
        title: article.title,
        url: article.url,
        source: article.source,
        timePublished: article.time_published,
        summary: article.summary,
        sentiment: {
          score: parseFloat(tickerSentiment.ticker_sentiment_score) || 0,
          label: tickerSentiment.ticker_sentiment_label,
          relevance: parseFloat(tickerSentiment.relevance_score) || 0
        },
        overallSentiment: {
          score: parseFloat(article.overall_sentiment_score) || 0,
          label: article.overall_sentiment_label
        },
        topics: article.topics || []
      };
    });
    
    // Calculate aggregate sentiment from all articles
    const sentimentScores = articles
      .filter(a => a.sentiment.relevance > 0.3) // Only count relevant articles
      .map(a => a.sentiment.score);
    
    const avgSentiment = sentimentScores.length > 0
      ? sentimentScores.reduce((sum, score) => sum + score, 0) / sentimentScores.length
      : 0;
    
    const bullishCount = articles.filter(a => a.sentiment.score > 0.15).length;
    const bearishCount = articles.filter(a => a.sentiment.score < -0.15).length;
    const neutralCount = articles.length - bullishCount - bearishCount;
    
    const sentimentLabel = avgSentiment > 0.15 ? 'Bullish' :
                          avgSentiment < -0.15 ? 'Bearish' :
                          avgSentiment > 0.05 ? 'Somewhat-Bullish' :
                          avgSentiment < -0.05 ? 'Somewhat-Bearish' :
                          'Neutral';
    
    const result = {
      ticker,
      articles,
      sentiment: {
        score: avgSentiment,
        label: sentimentLabel,
        bullishCount,
        bearishCount,
        neutralCount
      },
      timestamp: Date.now()
    };
    
    // Cache the result
    NEWS_CACHE.set(cacheKey, { data: result, timestamp: Date.now() });
    
    return result;
  } catch (error) {
    console.error(`Error fetching news for ${ticker}:`, error.message);
    
    // Return empty result on error
    return {
      ticker,
      articles: [],
      sentiment: {
        score: 0,
        label: 'Unknown',
        bullishCount: 0,
        bearishCount: 0,
        neutralCount: 0
      },
      error: error.message,
      timestamp: Date.now()
    };
  }
}

/**
 * Batch fetch news for multiple tickers
 */
export async function batchFetchNews(tickers, limit = 10) {
  const results = {};
  
  for (const ticker of tickers) {
    console.log(`Fetching news for ${ticker}...`);
    results[ticker] = await fetchTickerNews(ticker, limit);
    
    // Rate limiting: 75 calls/min max for free tier
    // Add 1 second delay between calls to be safe
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

/**
 * Get news summary across all tickers
 */
export function getNewsSummary(newsData) {
  const tickers = Object.keys(newsData);
  const totalArticles = tickers.reduce((sum, ticker) => sum + newsData[ticker].articles.length, 0);
  
  const avgSentiment = tickers.reduce((sum, ticker) => {
    return sum + (newsData[ticker].sentiment?.score || 0);
  }, 0) / tickers.length;
  
  const sentimentLabel = avgSentiment > 0.15 ? 'Bullish' :
                        avgSentiment < -0.15 ? 'Bearish' :
                        avgSentiment > 0.05 ? 'Somewhat-Bullish' :
                        avgSentiment < -0.05 ? 'Somewhat-Bearish' :
                        'Neutral';
  
  // Count most mentioned topics
  const allTopics = tickers.flatMap(ticker => 
    newsData[ticker].articles.flatMap(a => a.topics || [])
  );
  
  const topicCounts = {};
  allTopics.forEach(topic => {
    const label = topic.topic || topic;
    topicCounts[label] = (topicCounts[label] || 0) + 1;
  });
  
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic]) => topic);
  
  return {
    totalArticles,
    avgSentiment,
    sentimentLabel,
    topTopics,
    tickerBreakdown: tickers.map(ticker => ({
      ticker,
      articles: newsData[ticker].articles.length,
      sentiment: newsData[ticker].sentiment
    }))
  };
}

/**
 * Format time published string to relative time
 */
export function formatTimeAgo(timePublished) {
  // Alpha Vantage format: YYYYMMDDTHHMMSS
  const year = timePublished.slice(0, 4);
  const month = timePublished.slice(4, 6);
  const day = timePublished.slice(6, 8);
  const hour = timePublished.slice(9, 11);
  const minute = timePublished.slice(11, 13);
  
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}
