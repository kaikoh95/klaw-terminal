# 🐾 Klaw Terminal

**AI-Powered Trading Terminal** by Maine Klaw

Real-time market scanning, technical analysis, and AI-powered trade signal generation using Gemini 2.5 Pro.

## Features

- **Market Scanner** - Real-time data from Yahoo Finance + Google Finance
- **Technical Analysis** - RSI, MACD, Bollinger Bands, VWAP, Support/Resistance
- **AI Analysis** - Gemini 2.5 Pro for trade setup detection and pattern recognition
- **Market Regime Detection** - Professional-grade regime analysis across 6 dimensions (trend, volatility, momentum, volume, risk appetite, market phase) with automated signal filtering and strategy recommendations
- **Signal Tracking** - Complete trade history with P&L tracking
- **Performance Analytics** - Hit rate, win streaks, profit factor, expectancy
- **Risk Management** - Position sizing calculator, portfolio heat tracking, Kelly Criterion, correlation matrix
- **Social Sentiment** - StockTwits integration for real-time retail trader sentiment analysis
- **News Feed** - Real-time market news and sentiment analysis from Alpha Vantage
- **Options Chain Analysis** - Max pain calculation, put/call ratios, gamma walls, unusual options activity detection
- **Earnings Calendar** - Upcoming earnings dates with alerts for imminent reports, automatic tracking across all watchlist tickers
- **Dynamic Watchlist** - Add/remove custom tickers on the fly with persistent storage, quick-add popular stocks
- **Web Dashboard** - Clean, dark-themed trading terminal interface
- **Market Heatmap** - Visual color-coded grid showing relative strength across all tickers
- **Multi-Panel Charts** - Professional 4-panel layout with Price, RSI, MACD, and Volume charts
- **Live WebSocket Updates** - Real-time price updates with visual flash animations
- **Signal Performance Tracker** - Track actual vs predicted outcomes, identify best-performing patterns
- **CSV Export** - Export signals, performance data, and technical analysis to CSV for Excel/external analysis
- **Price Alerts** - Set custom price alerts with real-time notifications when levels are breached
- **Smart Caching** - Intelligent Gemini analysis caching (5-min TTL) + Market data caching (30-sec TTL) to reduce API costs and improve speed
- **Real-Time Signal Notifications** - Instant WebSocket notifications for high-confidence AI signals (7+) with browser alerts and history tracking
- **Trade Journal** - Log actual trades, track execution vs signals, learn from outcomes with comprehensive statistics and CSV export

## Dynamic Watchlist

- **Default tickers**: SPY, QQQ, ONDS, USAR, RDDT, UUUU, HOVR
- **Add any ticker** via the Watchlist Manager UI (`/watchlist.html`)
- **Quick-add popular stocks**: AAPL, TSLA, NVDA, MSFT, AMZN, GOOGL, META, and more
- **Persistent storage**: Custom watchlist saved to `data/watchlist.json`
- **Reset anytime**: Restore default tickers with one click

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set Gemini API key:**
   ```bash
   export GEMINI_API_KEY="your-api-key-here"
   ```

3. **(Optional) Configure StockTwits:**
   ```bash
   # Use demo mode if you don't have StockTwits API access
   export STOCKTWITS_DEMO=true
   ```
   
   Or create a `.env` file (see `.env.example`)

4. **(Optional) Configure Alpha Vantage for News Feed:**
   ```bash
   export ALPHA_VANTAGE_API_KEY="your-api-key-here"
   ```
   
   Get a free API key at https://www.alphavantage.co/support/#api-key
   
   Free tier: 25 API calls per day. If not configured, uses demo key with limited access.

5. **Run market scan:**
   ```bash
   npm run scan
   # or: node bin/scan.js
   ```

6. **Run AI analysis:**
   ```bash
   npm run analyze
   # or: node bin/analyze.js
   ```

7. **(Optional) Fetch social sentiment:**
   ```bash
   npm run sentiment
   # or: node bin/sentiment.js
   ```

8. **Start web UI:**
   ```bash
   npm start
   # or: node bin/server.js
   ```

   Open http://localhost:3847 in your browser

## Usage

### CLI Commands

- `npm run scan` - Fetch market data and run technical analysis
- `npm run analyze` - Run AI analysis on scanned data and generate signals
- `npm run sentiment` - Fetch social sentiment from StockTwits (optional: specify tickers)
- `npm start` - Start web UI server on port 3847
- `npm run dev` - Start server with auto-reload

### Web UI

- **Dashboard** (`/`) - Watchlist, active signals, performance stats
  - Multi-panel technical charts with synchronized zoom/pan
  - Panel 1: Price action with MA, Bollinger Bands, VWAP overlays
  - Panel 2: RSI(14) with overbought/oversold zones
  - Panel 3: MACD with histogram and signal line
  - Panel 4: Volume bars color-coded by price direction
- **Signals** (`/signals.html`) - Complete signal history with filtering
- **Analysis** (`/analysis.html`) - Detailed technical analysis for all tickers
- **Heatmap** (`/heatmap.html`) - Visual market heatmap with color-coded performance
- **Performance** (`/performance.html`) - Signal performance tracking & pattern analysis
  - Win rate, profit factor, average returns
  - Best performing patterns, timeframes, and tickers
  - Confidence level correlation analysis
  - Recent closed signal outcomes
- **Risk Management** (`/risk.html`) - Position sizing & portfolio risk tools
  - Position size calculator based on account size and risk %
  - Portfolio heat tracker (total risk across all positions)
  - Kelly Criterion for optimal position sizing
  - Correlation matrix to identify concentration risk
  - Real-time risk status monitoring (SAFE/HEALTHY/ELEVATED/WARNING/DANGER)
- **Market Regime** (`/regime.html`) - Professional market environment detection
  - 6-dimensional regime analysis: Trend, Volatility, Momentum, Volume, Risk Appetite, Market Phase
  - Overall regime classification with confidence scoring
  - Risk level assessment (VERY HIGH/HIGH/MODERATE/LOW)
  - Actionable trading recommendations based on current regime
  - Detailed breakdown of each dimension with supporting metrics
  - Auto-refresh every 2 minutes for real-time regime tracking
- **Price Alerts** (`/alerts.html`) - Custom price level monitoring
  - Set alerts for any ticker above/below specific prices
  - Real-time WebSocket notifications when alerts trigger
  - Track triggered alerts history
  - Optional notes for each alert
- **Social Sentiment** (`/sentiment.html`) - StockTwits sentiment tracking
  - Real-time sentiment scores from retail trader community
  - Bullish/bearish breakdown with confidence levels
  - Recent message feed for each ticker
  - Trending stocks discovery
  - Refresh sentiment data on demand
- **Trade Journal** (`/journal.html`) - Track actual trading performance
  - Log real trades with entry/exit prices, P&L, and position sizes
  - Link trades to original AI signals for accuracy tracking
  - Add notes, lessons learned, and trade tags
  - Track execution quality (slippage, timing delays)
  - Comprehensive statistics: win rate, profit factor, expectancy, streaks
  - Performance breakdown by pattern, ticker, and timeframe
  - Filter trades by status, direction, outcome
  - Export complete trading history to CSV for analysis
- **News Feed** (`/news.html`) - Market news and sentiment from Alpha Vantage
  - Real-time news articles for each ticker
  - News sentiment analysis (bullish/bearish/neutral)
  - Article relevance scoring
  - Top trending topics across all tickers
  - Source attribution and timestamps
  - Refresh on demand (25 API calls/day on free tier)
- **Options Chain** (`/options.html`) - Options flow and positioning analysis
  - Max pain calculation (where most options expire worthless)
  - Put/call ratio tracking (volume and open interest)
  - Gamma walls identification (major support/resistance from options)
  - Unusual activity detection (high volume/OI ratios)
  - Key strike levels and sentiment signals
  - Refresh on demand for real-time options data
- **Earnings Calendar** (`/earnings.html`) - Upcoming earnings dates and alerts
  - Automatic earnings tracking for all watchlist tickers
  - Imminent earnings alerts (≤7 days)
  - Summary view: this week, next week, this month
  - Estimated EPS and fiscal period information
  - Visual timeline organized by urgency
  - Alpha Vantage integration (free tier: 25 calls/day)
  - Demo mode when API key not configured
- **Cache Manager** (`/cache.html`) - Gemini analysis cache monitoring and control
  - Real-time cache statistics (size, fresh/stale entries, TTL)
  - View all cached analyses with age and signal details
  - Manual cache clearing for troubleshooting
  - Auto-refresh every 10 seconds
  - Monitor API cost savings from cache hits
- **Notifications** (`/notifications.html`) - Real-time AI signal alerts and notification center
  - Instant WebSocket notifications for high-confidence signals (7+)
  - Browser notifications with sound alerts for critical signals (9+)
  - Complete notification history with read/unread tracking
  - Priority-based filtering (critical/high/medium/low)
  - Detailed signal information (entry, targets, stop loss, confidence)
  - Auto-cleanup of old notifications
- **Watchlist Manager** (`/watchlist.html`) - Dynamic ticker watchlist management
  - Add/remove custom tickers with auto-detection of exchange
  - Quick-add buttons for popular stocks (AAPL, TSLA, NVDA, etc.)
  - View full ticker configurations (Yahoo/Google symbols)
  - Reset to default watchlist
  - Changes persist across restarts

## Project Structure

```
klaw-terminal/
├── bin/
│   ├── scan.js          # Market scanner CLI
│   ├── analyze.js       # AI analysis CLI
│   └── server.js        # Web UI server
├── lib/
│   ├── market-data.js   # Yahoo/Google Finance fetchers
│   ├── technicals.js    # Technical indicator calculations
│   ├── gemini.js        # Gemini 2.5 Pro integration
│   ├── signals.js       # Signal generation & tracking
│   └── performance.js   # Performance tracking
├── web/
│   ├── index.html       # Dashboard
│   ├── signals.html     # Signal history
│   ├── analysis.html    # AI analysis view
│   ├── css/style.css    # Dark theme styles
│   └── js/app.js        # Frontend JS
├── data/
│   ├── signals.json     # Signal history
│   └── performance.json # Performance tracking
└── package.json
```

## Technical Indicators

- **RSI(14)** - Relative Strength Index
- **MFI(14)** - Money Flow Index (volume-weighted RSI)
- **MACD** - Moving Average Convergence Divergence
- **Bollinger Bands** - Volatility bands
- **VWAP** - Volume Weighted Average Price
- **SMA** - Simple Moving Averages (20, 50, 200)
- **EMA** - Exponential Moving Averages (9, 21)
- **Support/Resistance** - Key price levels
- **Volume Analysis** - Unusual volume detection
- **OBV** - On-Balance Volume with divergence detection
- **ADX** - Average Directional Index (trend strength)
- **ATR** - Average True Range (volatility)
- **Stochastic** - Stochastic Oscillator
- **Fibonacci** - Retracement and extension levels
- **Candlestick Patterns** - 12+ pattern recognition
- **Parabolic SAR** - Stop and Reverse indicator for trend following with dynamic trailing stops
- **Ichimoku Cloud** - Japanese trend system with Tenkan/Kijun lines, cloud (Kumo), and TK cross signals

## Signal Generation

AI analyzes market data and generates structured signals with:

- **Direction** - LONG/SHORT/NEUTRAL
- **Confidence** - 1-10 scoring
- **Entry Price** - Recommended entry
- **Targets** - T1, T2, T3 price levels
- **Stop Loss** - Risk management level
- **Risk/Reward Ratio** - Expected R:R
- **Pattern** - Breakout, Reversal, Consolidation, etc.
- **Timeframe** - Scalp, Intraday, Swing

## Performance Tracking

Automatic tracking of:

- Win rate and total trades
- Average return per trade
- Best/worst trades
- Win/loss streaks
- Profit factor
- Expectancy
- Breakdown by ticker, pattern, timeframe

## API Endpoints

- `GET /api/market-data` - Latest market data
- `GET /api/technicals` - Technical analysis
- `GET /api/market-regime` - Market regime analysis for all tickers
- `GET /api/market-regime?ticker=SPY` - Market regime analysis for specific ticker
- `GET /api/latest-scan` - Last scan results
- `GET /api/signals` - All signals
- `GET /api/signals/recent?count=N` - Recent signals
- `GET /api/performance` - Performance metrics
- `GET /api/performance/summary` - Performance summary
- `GET /api/signal-performance/summary` - Signal accuracy & pattern performance
- `GET /api/signal-performance/active` - Active tracked signals
- `GET /api/signal-performance/closed?limit=N` - Recently closed signals
- `GET /api/signal-performance/best-patterns` - Highest win-rate patterns
- `POST /api/risk/position-size` - Calculate position size (params: accountSize, riskPercent, entryPrice, stopLoss)
- `POST /api/risk/portfolio-heat` - Calculate total portfolio risk (params: positions, accountSize)
- `POST /api/risk/kelly` - Calculate Kelly Criterion (params: winRate, avgWin, avgLoss)
- `GET /api/risk/correlation` - Get ticker correlation matrix
- `POST /api/risk/analyze-signal` - Analyze risk for a specific signal (params: signal, accountSize, riskPercent)
- `GET /api/export/signals` - Export signals to CSV
- `GET /api/export/performance` - Export performance data to CSV
- `GET /api/export/analysis` - Export technical analysis to CSV
- `GET /api/alerts` - Get all price alerts
- `GET /api/alerts/active` - Get active (non-triggered) alerts
- `GET /api/alerts/triggered?limit=N` - Get recently triggered alerts
- `GET /api/alerts/:ticker` - Get alerts for specific ticker
- `POST /api/alerts` - Create new alert (params: ticker, price, condition, note)
- `DELETE /api/alerts/:id` - Delete an alert
- `POST /api/alerts/cleanup` - Clear old triggered alerts (params: daysOld)
- `GET /api/sentiment` - Get cached sentiment data
- `GET /api/sentiment/:ticker` - Get fresh sentiment for specific ticker
- `GET /api/sentiment/trending` - Get trending stocks from StockTwits
- `POST /api/sentiment/refresh` - Refresh sentiment data for all watchlist tickers
- `GET /api/news` - Get cached news data
- `GET /api/news/:ticker?limit=N` - Get news for specific ticker (default limit: 10)
- `POST /api/news/refresh` - Refresh news data for all watchlist tickers (params: tickers, limit)
- `GET /api/options` - Get cached options analysis data
- `GET /api/options/:ticker` - Get fresh options analysis for specific ticker
- `POST /api/options/refresh` - Analyze options for all watchlist tickers (params: tickers)
- `GET /api/earnings` - Get cached earnings calendar data
- `GET /api/earnings/:ticker` - Get earnings calendar for specific ticker
- `GET /api/earnings/summary` - Get earnings summary with alerts and upcoming counts
- `POST /api/earnings/refresh` - Fetch earnings for all watchlist tickers (params: tickers)
- `GET /api/cache/stats` - Get Gemini analysis cache statistics (size, fresh/stale, entries)
- `POST /api/cache/clear` - Clear all cached Gemini analyses
- `GET /api/market-cache/stats` - Get market data cache statistics (size, fresh/stale, entries, cache hit rate)
- `POST /api/market-cache/clear` - Clear all cached market data (forces fresh API calls)
- `GET /api/watchlist` - Get full watchlist with ticker configs
- `GET /api/watchlist/symbols` - Get ticker symbols only (array)
- `POST /api/watchlist/add` - Add ticker to watchlist (params: symbol, exchange, name)
- `DELETE /api/watchlist/remove/:symbol` - Remove ticker from watchlist
- `POST /api/watchlist/reset` - Reset watchlist to defaults
- `GET /api/notifications` - Get all notifications
- `GET /api/notifications/recent?limit=N` - Get recent notifications (default: 20)
- `GET /api/notifications/stats` - Get notification statistics (total, unread, by priority, connected clients)
- `POST /api/notifications/:id/read` - Mark specific notification as read
- `POST /api/notifications/read-all` - Mark all notifications as read
- `POST /api/notifications/cleanup` - Clear old notifications (params: daysOld)
- `POST /api/notifications/send` - Send custom notification (params: title, message, type, priority)
- `GET /api/journal/trades` - Get all trades with optional filters (ticker, status, direction, pattern, outcome, dateRange, limit)
- `GET /api/journal/trades/:id` - Get a single trade by ID
- `POST /api/journal/trades` - Add a new trade to the journal (params: ticker, direction, entryDate, entryPrice, size, exitPrice, stopLoss, targets, status, pattern, timeframe, notes, lessons, tags, executionQuality)
- `PUT /api/journal/trades/:id` - Update an existing trade
- `DELETE /api/journal/trades/:id` - Delete a trade from the journal
- `GET /api/journal/stats` - Get comprehensive journal statistics (win rate, total P&L, avg return, profit factor, expectancy, streaks, execution quality, breakdown by pattern/ticker)
- `GET /api/journal/export` - Export entire journal to CSV for external analysis

## Development

Built with:

- **Backend** - Node.js, Express.js
- **Frontend** - Vanilla HTML/CSS/JS (no frameworks)
- **Data Sources** - Yahoo Finance, Google Finance
- **AI** - Google Gemini 2.5 Pro
- **Port** - 3847

## License

MIT

---

🐾 **Maine Klaw** - Your AI Trading Assistant
