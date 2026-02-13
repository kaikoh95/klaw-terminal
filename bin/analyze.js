#!/usr/bin/env node
// AI Analysis CLI
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { batchAnalyze } from '../lib/gemini.js';
import { processBatchAnalysis } from '../lib/signals.js';
import { generatePerformanceReport } from '../lib/performance.js';
import { batchAnalyzeMultiTimeframe } from '../lib/multi-timeframe.js';
import { notifySignal } from '../lib/notifications.js';
import { detectMarketRegime, applyRegimeFilter } from '../lib/market-regime.js';
import { generatePositionSizingRecommendations } from '../lib/risk-management.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const scanFile = join(dataDir, 'latest-scan.json');

console.log('🐾 Klaw Terminal - AI Analysis\n');
console.log('═══════════════════════════════════════');

// Load latest scan results
if (!existsSync(scanFile)) {
  console.error('❌ No scan data found. Run `node bin/scan.js` first.\n');
  process.exit(1);
}

const scanData = JSON.parse(readFileSync(scanFile, 'utf8'));
const { marketData, technicals } = scanData;

console.log(`Analyzing ${Object.keys(marketData).length} tickers with Gemini AI...\n`);

// Run AI analysis
try {
  // First, fetch multi-timeframe data for all tickers
  console.log('🔄 Fetching multi-timeframe data...\n');
  const tickers = Object.keys(marketData);
  const multiTimeframeData = await batchAnalyzeMultiTimeframe(tickers);
  
  const analysisResults = await batchAnalyze(marketData, technicals, multiTimeframeData);
  
  // Detect market regime and apply filters
  console.log('\n🔍 Detecting market regimes and applying filters...\n');
  const regimeAnalysis = {};
  const filteredResults = {};
  
  for (const [ticker, analysis] of Object.entries(analysisResults)) {
    if (!analysis.error) {
      const regime = detectMarketRegime(marketData[ticker], technicals[ticker], multiTimeframeData[ticker]);
      regimeAnalysis[ticker] = regime;
      filteredResults[ticker] = applyRegimeFilter(analysis, regime);
    } else {
      filteredResults[ticker] = analysis;
    }
  }
  
  console.log('\n═══════════════════════════════════════');
  console.log('AI ANALYSIS RESULTS (REGIME-FILTERED)');
  console.log('═══════════════════════════════════════\n');
  
  // Display results
  for (const [ticker, analysis] of Object.entries(filteredResults)) {
    if (analysis.error) {
      console.log(`${ticker}: ❌ ${analysis.error}\n`);
      continue;
    }
    
    const signalEmoji = analysis.signal === 'LONG' ? '🟢' : analysis.signal === 'SHORT' ? '🔴' : '⚪';
    const confidenceBar = '█'.repeat(analysis.confidence) + '░'.repeat(10 - analysis.confidence);
    
    console.log(`${ticker} ${signalEmoji} ${analysis.signal}`);
    console.log(`  Confidence: ${confidenceBar} ${analysis.confidence}/10`);
    console.log(`  Pattern: ${analysis.pattern}`);
    console.log(`  Timeframe: ${analysis.timeframe}`);
    console.log(`  Entry: $${analysis.entry.toFixed(2)}`);
    
    if (analysis.targets) {
      console.log(`  Targets: T1 $${analysis.targets.t1.toFixed(2)} | T2 $${analysis.targets.t2.toFixed(2)} | T3 $${analysis.targets.t3.toFixed(2)}`);
    }
    
    if (analysis.stopLoss) {
      console.log(`  Stop Loss: $${analysis.stopLoss.toFixed(2)}`);
    }
    
    if (analysis.riskReward) {
      console.log(`  Risk/Reward: 1:${analysis.riskReward.toFixed(2)}`);
    }
    
    console.log(`  Reasoning: ${analysis.reasoning}`);
    
    // Market regime information
    if (regimeAnalysis[ticker]) {
      const regime = regimeAnalysis[ticker];
      console.log(`  📊 Market Regime: ${regime.overall} (Conf: ${regime.confidence}/10)`);
      console.log(`     Risk Level: ${regime.riskLevel}`);
      
      if (analysis.regimeBoost) {
        console.log(`     Confidence Adj: ${analysis.originalConfidence} → ${analysis.confidence} (${analysis.regimeBoost})`);
      }
      
      if (analysis.regimeWarnings && analysis.regimeWarnings.length > 0) {
        console.log(`     Warnings:`);
        analysis.regimeWarnings.forEach(warning => console.log(`       ${warning}`));
      }
    }
    
    if (analysis.alerts && analysis.alerts.length > 0) {
      console.log(`  Alerts:`);
      analysis.alerts.forEach(alert => console.log(`    • ${alert}`));
    }
    
    // Show position sizing recommendations for tradeable signals
    if (analysis.signal !== 'NEUTRAL' && analysis.confidence >= 6) {
      try {
        const positionRec = generatePositionSizingRecommendations(analysis, 10000);
        if (positionRec.canTrade) {
          console.log(`  💰 Position Sizing (for $10,000 account):`);
          console.log(`     Risk: ${positionRec.riskPercent}% ($${positionRec.riskAmount.toFixed(0)}) | Shares: ${positionRec.fullPosition.shares} (${positionRec.fullPosition.percentOfAccount}% of account)`);
          console.log(`     Entry Plan: ${positionRec.scaling.initial.description}`);
          console.log(`     Scale In: ${positionRec.scaling.scaleIn.description} (${positionRec.scaling.scaleIn.shares} shares)`);
          console.log(`     Exit Plan: T1 ${positionRec.exits.t1.percent}% → T2 ${positionRec.exits.t2.percent}% → T3 ${positionRec.exits.t3.percent}%`);
          console.log(`     Max Loss: $${positionRec.scenarios.maxLoss.amount} (${positionRec.scenarios.maxLoss.percent}%)`);
          console.log(`     Target Profit: $${positionRec.scenarios.targetProfit.scaled.amount} (${positionRec.scenarios.targetProfit.scaled.percent}%) with scaled exits`);
        }
      } catch (err) {
        // Position sizing calculation failed, but that's OK - continue
      }
    }
    
    console.log('');
  }
  
  console.log('═══════════════════════════════════════');
  console.log('SIGNAL GENERATION');
  console.log('═══════════════════════════════════════\n');
  
  // Generate signals and send notifications (using regime-filtered results)
  const newSignals = processBatchAnalysis(filteredResults, marketData);
  
  // Send notifications for high-confidence signals
  let notificationsSent = 0;
  for (const [ticker, analysis] of Object.entries(filteredResults)) {
    if (analysis && !analysis.error && analysis.signal !== 'NEUTRAL' && analysis.confidence >= 7) {
      try {
        notifySignal(analysis);
        notificationsSent++;
      } catch (err) {
        // Notifications might fail if WebSocket server not running, that's OK
        console.warn(`⚠️ Failed to send notification for ${ticker}:`, err.message);
      }
    }
  }
  
  if (newSignals.length === 0) {
    console.log('No high-confidence signals generated.');
  } else {
    console.log(`\n${newSignals.length} signal(s) added to tracking.`);
    if (notificationsSent > 0) {
      console.log(`🔔 ${notificationsSent} notification(s) sent to connected clients.\n`);
    }
  }
  
  console.log('═══════════════════════════════════════');
  console.log('PERFORMANCE OVERVIEW');
  console.log('═══════════════════════════════════════\n');
  
  // Show performance
  const perfReport = generatePerformanceReport();
  console.log(perfReport);
  
} catch (error) {
  console.error('❌ Analysis failed:', error.message);
  
  if (error.message.includes('GEMINI_API_KEY')) {
    console.error('\n💡 Make sure GEMINI_API_KEY is set in your environment:');
    console.error('   export GEMINI_API_KEY="your-api-key"\n');
  }
  
  process.exit(1);
}

console.log('✅ Analysis complete! Start web UI with `node bin/server.js`\n');
