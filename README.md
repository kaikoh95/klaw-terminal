# 🐾 Klaw Terminal

**AI-Powered Trading Terminal** by Maine Klaw

Real-time market scanning, technical analysis, and AI-powered trade signal generation using Gemini 2.5 Pro.

## Features

- **Market Scanner** - Real-time data from Yahoo Finance + Google Finance
- **Technical Analysis** - RSI, MACD, Bollinger Bands, VWAP, Support/Resistance
- **AI Analysis** - Gemini 2.5 Pro for trade setup detection and pattern recognition
- **Signal Tracking** - Complete trade history with P&L tracking
- **Performance Analytics** - Hit rate, win streaks, profit factor, expectancy
- **Risk Management** - Position sizing calculator, portfolio heat tracking, Kelly Criterion, correlation matrix
- **Social Sentiment** - StockTwits integration for real-time retail trader sentiment analysis
- **Web Dashboard** - Clean, dark-themed trading terminal interface
- **Market Heatmap** - Visual color-coded grid showing relative strength across all tickers
- **Multi-Panel Charts** - Professional 4-panel layout with Price, RSI, MACD, and Volume charts
- **Live WebSocket Updates** - Real-time price updates with visual flash animations
- **Signal Performance Tracker** - Track actual vs predicted outcomes, identify best-performing patterns
- **CSV Export** - Export signals, performance data, and technical analysis to CSV for Excel/external analysis
- **Price Alerts** - Set custom price alerts with real-time notifications when levels are breached

## Supported Tickers

- SPY, SPX, QQQ, ONDS, USAR, HOVR, RDDT
- Easy to add more in `lib/market-data.js`

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

4. **Run market scan:**
   ```bash
   npm run scan
   # or: node bin/scan.js
   ```

5. **Run AI analysis:**
   ```bash
   npm run analyze
   # or: node bin/analyze.js
   ```

6. **(Optional) Fetch social sentiment:**
   ```bash
   npm run sentiment
   # or: node bin/sentiment.js
   ```

7. **Start web UI:**
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
