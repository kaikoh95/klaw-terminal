#!/usr/bin/env node
// StockTwits Sentiment Scanner CLI
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { batchGetSentiment, getSentimentSummary, getTrendingStocks } from '../lib/stocktwits.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Default watchlist (same as market-data.js)
const DEFAULT_TICKERS = ['SPY', 'QQQ', 'ONDS', 'USAR', 'HOVR', 'RDDT', 'UUUU'];

async function main() {
  console.log('\n🐾 Klaw Terminal - Social Sentiment Scanner');
  console.log('═══════════════════════════════════════════════\n');
  
  const tickers = process.argv.slice(2);
  const targetTickers = tickers.length > 0 ? tickers : DEFAULT_TICKERS;
  
  console.log(`📊 Analyzing sentiment for: ${targetTickers.join(', ')}\n`);
  
  // Fetch trending stocks
  console.log('🔥 Fetching trending stocks from StockTwits...');
  const trending = await getTrendingStocks();
  
  if (trending.length > 0) {
    console.log(`Found ${trending.length} trending stocks:\n`);
    trending.slice(0, 10).forEach((stock, i) => {
      console.log(`${i + 1}. ${stock.ticker} - ${stock.title} (${stock.watchlistCount} watchers)`);
    });
    console.log('');
  }
  
  // Fetch sentiment for our watchlist
  console.log('💭 Fetching sentiment data...\n');
  const sentimentData = await batchGetSentiment(targetTickers);
  
  // Display results
  console.log('\n📈 SENTIMENT ANALYSIS RESULTS');
  console.log('═══════════════════════════════════════════════\n');
  
  for (const [ticker, data] of Object.entries(sentimentData)) {
    if (!data.available) {
      console.log(`${ticker}: ❌ ${data.error}`);
      continue;
    }
    
    const emoji = data.score > 30 ? '🟢' : 
                  data.score > 10 ? '🟡' :
                  data.score < -30 ? '🔴' :
                  data.score < -10 ? '🟠' : '⚪';
    
    console.log(`${ticker}: ${emoji} ${data.signal.toUpperCase().replace('_', ' ')}`);
    console.log(`  Score: ${data.score > 0 ? '+' : ''}${data.score}/100 | Confidence: ${data.confidence}%`);
    console.log(`  Messages: ${data.totalMessages} (🟢${data.bullishCount} 🔴${data.bearishCount} ⚪${data.neutralCount})`);
    console.log(`  Watchers: ${data.watchlistCount.toLocaleString()}`);
    
    if (data.recentMessages && data.recentMessages.length > 0) {
      console.log('  Recent messages:');
      data.recentMessages.forEach((msg, i) => {
        const msgEmoji = msg.sentiment === 'Bullish' ? '🟢' :
                        msg.sentiment === 'Bearish' ? '🔴' : '⚪';
        console.log(`    ${i + 1}. ${msgEmoji} ${msg.text}`);
      });
    }
    
    console.log('');
  }
  
  // Summary
  const summary = getSentimentSummary(sentimentData);
  
  console.log('📊 MARKET SENTIMENT SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log(`Overall Score: ${summary.overallScore > 0 ? '+' : ''}${summary.overallScore}/100`);
  console.log(`Signal: ${summary.overallSignal.toUpperCase().replace('_', ' ')}`);
  console.log(`Tickers Analyzed: ${summary.tickersAnalyzed}/${targetTickers.length}`);
  
  if (summary.bullishTickers.length > 0) {
    console.log(`🟢 Bullish: ${summary.bullishTickers.join(', ')}`);
  }
  
  if (summary.bearishTickers.length > 0) {
    console.log(`🔴 Bearish: ${summary.bearishTickers.join(', ')}`);
  }
  
  if (summary.mostBullish) {
    console.log(`📈 Most Bullish: ${summary.mostBullish.ticker} (+${summary.mostBullish.score})`);
  }
  
  if (summary.mostBearish) {
    console.log(`📉 Most Bearish: ${summary.mostBearish.ticker} (${summary.mostBearish.score})`);
  }
  
  // Save to file
  const outputPath = join(__dirname, '..', 'data', 'sentiment.json');
  writeFileSync(outputPath, JSON.stringify({
    timestamp: Date.now(),
    tickers: sentimentData,
    summary,
    trending: trending.slice(0, 20)
  }, null, 2));
  
  console.log(`\n✅ Sentiment data saved to ${outputPath}`);
  console.log('');
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
