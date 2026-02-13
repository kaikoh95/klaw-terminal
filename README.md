# 🐾 Klaw Terminal

**AI-Powered Trading Terminal** by Maine Klaw

Real-time market scanning, technical analysis, and AI-powered trade signal generation using Gemini 2.5 Pro.

## Features

- **Market Scanner** - Real-time data from Yahoo Finance + Google Finance
- **Technical Analysis** - RSI, MACD, Bollinger Bands, VWAP, Support/Resistance
- **AI Analysis** - Gemini 2.5 Pro for trade setup detection and pattern recognition
- **Signal Tracking** - Complete trade history with P&L tracking
- **Performance Analytics** - Hit rate, win streaks, profit factor, expectancy
- **Web Dashboard** - Clean, dark-themed trading terminal interface
- **Market Heatmap** - Visual color-coded grid showing relative strength across all tickers

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

3. **Run market scan:**
   ```bash
   npm run scan
   # or: node bin/scan.js
   ```

4. **Run AI analysis:**
   ```bash
   npm run analyze
   # or: node bin/analyze.js
   ```

5. **Start web UI:**
   ```bash
   npm start
   # or: node bin/server.js
   ```

   Open http://localhost:3847 in your browser

## Usage

### CLI Commands

- `npm run scan` - Fetch market data and run technical analysis
- `npm run analyze` - Run AI analysis on scanned data and generate signals
- `npm start` - Start web UI server on port 3847
- `npm run dev` - Start server with auto-reload

### Web UI

- **Dashboard** (`/`) - Watchlist, active signals, performance stats
- **Signals** (`/signals.html`) - Complete signal history with filtering
- **Analysis** (`/analysis.html`) - Detailed technical analysis for all tickers
- **Heatmap** (`/heatmap.html`) - Visual market heatmap with color-coded performance

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
