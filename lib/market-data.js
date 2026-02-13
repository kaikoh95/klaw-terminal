// Market Data Fetcher - Yahoo Finance + Google Finance
import * as cheerio from 'cheerio';
import { getWatchlist } from './watchlist.js';

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const GOOGLE_BASE = 'https://www.google.com/finance/quote';

// Market data cache to reduce API calls
const MARKET_DATA_CACHE = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds - balance between freshness and API efficiency

/**
 * Clean up expired cache entries
 */
function cleanupCache() {
  const now = Date.now();
  for (const [key, entry] of MARKET_DATA_CACHE.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      MARKET_DATA_CACHE.delete(key);
    }
  }
}

// Run cache cleanup every minute
setInterval(cleanupCache, 60000);

// Get tickers from dynamic watchlist
export function getTickers() {
  return getWatchlist();
}

// Legacy export for backwards compatibility
export const TICKERS = getTickers();

/**
 * Get market data cache statistics
 */
export function getCacheStats() {
  const now = Date.now();
  let fresh = 0;
  let stale = 0;
  
  for (const [key, entry] of MARKET_DATA_CACHE.entries()) {
    if (now - entry.timestamp < CACHE_TTL) {
      fresh++;
    } else {
      stale++;
    }
  }
  
  return {
    size: MARKET_DATA_CACHE.size,
    fresh,
    stale,
    ttl: CACHE_TTL,
    entries: Array.from(MARKET_DATA_CACHE.entries()).map(([key, entry]) => ({
      ticker: key,
      age: now - entry.timestamp,
      price: entry.data.price,
      source: entry.data.source
    }))
  };
}

/**
 * Clear the market data cache (useful for testing or explicit refresh)
 */
export function clearCache() {
  const size = MARKET_DATA_CACHE.size;
  MARKET_DATA_CACHE.clear();
  console.log(`🗑️ Cleared ${size} cached market data entries`);
  return { cleared: size };
}

/**
 * Fetch from Yahoo Finance
 */
export async function fetchYahoo(ticker) {
  if (!ticker) return null;
  
  try {
    const url = `${YAHOO_BASE}/${ticker}?interval=1d&range=1y`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    
    if (!result) return null;
    
    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];
    const timestamps = result.timestamp;
    
    if (!meta || !quote || !timestamps) return null;
    
    // Get latest values
    const latestIdx = timestamps.length - 1;
    const previousIdx = latestIdx - 1;
    
    const currentPrice = meta.regularMarketPrice || quote.close[latestIdx];
    const previousClose = meta.chartPreviousClose || quote.close[previousIdx];
    const change = currentPrice - previousClose;
    const changePercent = (change / previousClose) * 100;
    
    // Calculate 52-week range
    const closes = quote.close.filter(c => c !== null);
    const high52w = Math.max(...quote.high.filter(h => h !== null));
    const low52w = Math.min(...quote.low.filter(l => l !== null));
    
    // Calculate day range
    const dayHigh = meta.regularMarketDayHigh || quote.high[latestIdx];
    const dayLow = meta.regularMarketDayLow || quote.low[latestIdx];
    
    // Get recent volume data for analysis
    const volumes = quote.volume.filter(v => v !== null).slice(-20);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const currentVolume = quote.volume[latestIdx];
    
    // Historical data for technical analysis
    const historicalData = timestamps.map((ts, i) => ({
      timestamp: ts,
      open: quote.open[i],
      high: quote.high[i],
      low: quote.low[i],
      close: quote.close[i],
      volume: quote.volume[i]
    })).filter(d => d.close !== null);
    
    return {
      source: 'yahoo',
      ticker: ticker,
      price: currentPrice,
      change: change,
      changePercent: changePercent,
      volume: currentVolume,
      avgVolume: avgVolume,
      volumeRatio: currentVolume / avgVolume,
      dayRange: { low: dayLow, high: dayHigh },
      range52w: { low: low52w, high: high52w },
      historicalData: historicalData,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error(`Yahoo fetch error for ${ticker}:`, error.message);
    return null;
  }
}

/**
 * Fetch from Google Finance (scraping)
 */
export async function fetchGoogle(tickerCode) {
  if (!tickerCode) return null;
  
  try {
    const url = `${GOOGLE_BASE}/${tickerCode}`;
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return null;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract price from Google Finance page structure
    const priceText = $('div[class*="YMlKec fxKbKc"]').first().text().trim();
    const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
    
    // Extract change
    const changeText = $('div[class*="JwB6zf"]').first().text().trim();
    const changeMatch = changeText.match(/([-+]?[0-9.]+).*\(([-+]?[0-9.]+)%\)/);
    
    let change = 0;
    let changePercent = 0;
    
    if (changeMatch) {
      change = parseFloat(changeMatch[1]);
      changePercent = parseFloat(changeMatch[2]);
    }
    
    if (isNaN(price)) return null;
    
    return {
      source: 'google',
      ticker: tickerCode.split(':')[0],
      price: price,
      change: change,
      changePercent: changePercent,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error(`Google fetch error for ${tickerCode}:`, error.message);
    return null;
  }
}

/**
 * Fetch market data for a ticker (tries Yahoo first, falls back to Google)
 * @param {string} ticker - Ticker symbol
 * @param {boolean} useCache - Whether to use cached data (default: true)
 */
export async function fetchTicker(ticker, useCache = true) {
  const tickers = getTickers();
  const config = tickers[ticker];
  if (!config) {
    console.error(`Unknown ticker: ${ticker}`);
    return null;
  }
  
  // Check cache first
  if (useCache) {
    const cached = MARKET_DATA_CACHE.get(ticker);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { ...cached.data, fromCache: true };
    }
  }
  
  // Try Yahoo first (if available)
  if (config.yahoo) {
    const yahooData = await fetchYahoo(config.yahoo);
    if (yahooData) {
      yahooData.symbol = ticker;
      
      // Cache successful response
      if (useCache) {
        MARKET_DATA_CACHE.set(ticker, {
          data: yahooData,
          timestamp: Date.now()
        });
      }
      
      return yahooData;
    }
  }
  
  // Fallback to Google
  if (config.google) {
    const googleData = await fetchGoogle(config.google);
    if (googleData) {
      googleData.symbol = ticker;
      
      // Cache successful response
      if (useCache) {
        MARKET_DATA_CACHE.set(ticker, {
          data: googleData,
          timestamp: Date.now()
        });
      }
      
      return googleData;
    }
  }
  
  return null;
}

/**
 * Fetch all configured tickers
 * @param {boolean} useCache - Whether to use cached data (default: true)
 */
export async function fetchAllTickers(useCache = true) {
  const results = {};
  const tickers = getTickers();
  let cacheHits = 0;
  let apiCalls = 0;
  
  for (const ticker of Object.keys(tickers)) {
    const data = await fetchTicker(ticker, useCache);
    if (data) {
      results[ticker] = data;
      
      if (data.fromCache) {
        cacheHits++;
      } else {
        apiCalls++;
        console.log(`Fetching ${ticker}...`);
        // Small delay to avoid rate limits (only for actual API calls)
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
  }
  
  if (useCache && cacheHits > 0) {
    console.log(`📦 Cache: ${cacheHits} hits, ${apiCalls} API calls`);
  }
  
  return results;
}

/**
 * Fetch options chain from Yahoo Finance
 */
export async function fetchOptionsChain(ticker) {
  if (!ticker) return null;
  
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/options/${ticker}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.optionChain?.result?.[0];
    
    if (!result) return null;
    
    return {
      ticker: ticker,
      expirationDates: result.expirationDates,
      strikes: result.strikes,
      options: result.options,
      timestamp: Date.now()
    };
  } catch (error) {
    console.error(`Options chain error for ${ticker}:`, error.message);
    return null;
  }
}
