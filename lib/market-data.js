// Market Data Fetcher - Yahoo Finance + Google Finance
import * as cheerio from 'cheerio';

const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const GOOGLE_BASE = 'https://www.google.com/finance/quote';

// Main tickers config
export const TICKERS = {
  SPY: { yahoo: 'SPY', google: 'SPY:NYSEARCA' },
  SPX: { yahoo: '^GSPC', google: '.INX:INDEXSP' },
  QQQ: { yahoo: 'QQQ', google: 'QQQ:NASDAQ' },
  ONDS: { yahoo: 'ONDS', google: 'ONDS:NASDAQ' },
  USAR: { yahoo: 'USAR', google: 'USAR:NYSEARCA' },
  HOVR: { yahoo: 'HOVR', google: 'HOVR:NYSEARCA' }, // Try Yahoo first (NASDAQ listing)
  RDDT: { yahoo: 'RDDT', google: 'RDDT:NYSE' },
  UUUU: { yahoo: 'UUUU', google: 'UUUU:NYSEAMERICAN' }
};

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
 */
export async function fetchTicker(ticker) {
  const config = TICKERS[ticker];
  if (!config) {
    console.error(`Unknown ticker: ${ticker}`);
    return null;
  }
  
  // Try Yahoo first (if available)
  if (config.yahoo) {
    const yahooData = await fetchYahoo(config.yahoo);
    if (yahooData) {
      yahooData.symbol = ticker;
      return yahooData;
    }
  }
  
  // Fallback to Google
  if (config.google) {
    const googleData = await fetchGoogle(config.google);
    if (googleData) {
      googleData.symbol = ticker;
      return googleData;
    }
  }
  
  return null;
}

/**
 * Fetch all configured tickers
 */
export async function fetchAllTickers() {
  const results = {};
  
  for (const ticker of Object.keys(TICKERS)) {
    console.log(`Fetching ${ticker}...`);
    const data = await fetchTicker(ticker);
    if (data) {
      results[ticker] = data;
    }
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 300));
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
