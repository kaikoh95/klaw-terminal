// Klaw Terminal - Frontend JavaScript

// WebSocket connection for real-time updates
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

// Price tracking for animations
const previousPrices = {};

// Initialize WebSocket connection
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  try {
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts = 0;
      updateConnectionStatus('connected');
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'market-update') {
          handleMarketUpdate(message.data, message.timestamp);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      updateConnectionStatus('error');
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      updateConnectionStatus('disconnected');
      
      // Attempt reconnection
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Reconnecting... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(initWebSocket, RECONNECT_DELAY);
      } else {
        console.log('Max reconnection attempts reached. Falling back to polling.');
        // Fall back to polling
        setInterval(loadWatchlist, 30000);
      }
    };
  } catch (error) {
    console.error('Failed to initialize WebSocket:', error);
    updateConnectionStatus('error');
  }
}

// Handle real-time market data update
function handleMarketUpdate(marketData, timestamp) {
  // Update watchlist with new data
  const container = document.getElementById('watchlist');
  if (!container || !marketData) return;
  
  let html = '';
  
  for (const [ticker, data] of Object.entries(marketData)) {
    if (!data) continue;
    
    const changeClass = data.change >= 0 ? 'positive' : 'negative';
    const changeSymbol = data.change >= 0 ? '+' : '';
    const volumeIndicator = data.volumeRatio >= 1.5 ? ' 📊' : '';
    
    // Determine if price increased or decreased for animation
    let flashClass = '';
    let priceAnimClass = '';
    
    if (previousPrices[ticker] !== undefined && previousPrices[ticker] !== data.price) {
      if (data.price > previousPrices[ticker]) {
        flashClass = 'flash-up';
        priceAnimClass = 'animate-up';
      } else {
        flashClass = 'flash-down';
        priceAnimClass = 'animate-down';
      }
    }
    
    // Store current price for next comparison
    previousPrices[ticker] = data.price;
    
    // Add high-volume class if volume is elevated
    const volumeClass = data.volumeRatio >= 1.5 ? 'high-volume' : '';
    
    html += `
      <div class="watchlist-item ${flashClass}" data-ticker="${ticker}">
        <div class="ticker-info">
          <h3>${ticker}</h3>
          <div class="ticker-volume ${volumeClass}">
            Vol: ${formatVolume(data.volume)}${volumeIndicator}
          </div>
        </div>
        <div class="ticker-price ${changeClass}">
          <div class="price ${priceAnimClass}">$${data.price.toFixed(2)}</div>
          <div class="change">${changeSymbol}${data.changePercent.toFixed(2)}%</div>
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  // Clean up animation classes after animation completes
  setTimeout(() => {
    const items = container.querySelectorAll('.watchlist-item');
    items.forEach(item => {
      item.classList.remove('flash-up', 'flash-down');
      const priceEl = item.querySelector('.price');
      if (priceEl) {
        priceEl.classList.remove('animate-up', 'animate-down');
      }
    });
  }, 1000);
  
  // Update timestamp
  const timestampEl = document.getElementById('lastUpdate');
  if (timestampEl) {
    const date = new Date(timestamp);
    timestampEl.textContent = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  
  // Update top movers
  updateTopMovers(marketData);
}

// Update Top Movers widget
function updateTopMovers(marketData) {
  if (!marketData) return;
  
  // Convert to array and sort by change percent
  const tickers = Object.entries(marketData)
    .filter(([_, data]) => data && data.changePercent !== undefined)
    .map(([ticker, data]) => ({
      ticker,
      price: data.price,
      change: data.change,
      changePercent: data.changePercent,
      volume: data.volume,
      volumeRatio: data.volumeRatio || 1
    }))
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  
  // Top 3 gainers
  const gainers = tickers
    .filter(t => t.changePercent > 0)
    .slice(0, 3);
  
  // Top 3 losers
  const losers = tickers
    .filter(t => t.changePercent < 0)
    .slice(0, 3);
  
  // Render gainers
  const gainersContainer = document.getElementById('topGainers');
  if (gainersContainer) {
    if (gainers.length === 0) {
      gainersContainer.innerHTML = '<div class="loading-small">No gainers today</div>';
    } else {
      gainersContainer.innerHTML = gainers.map(t => `
        <div class="mover-item ${t.volumeRatio >= 1.5 ? 'high-volume' : ''}">
          <div class="mover-info">
            <div class="mover-ticker">${t.ticker}</div>
            <div class="mover-volume ${t.volumeRatio >= 1.5 ? 'high' : ''}">
              ${t.volumeRatio >= 1.5 ? '🔥 ' : ''}Vol: ${formatVolume(t.volume)} (${t.volumeRatio.toFixed(1)}x)
            </div>
          </div>
          <div class="mover-change positive">
            <div class="mover-price">$${t.price.toFixed(2)}</div>
            <div class="mover-percent">+${t.changePercent.toFixed(2)}%</div>
          </div>
        </div>
      `).join('');
    }
  }
  
  // Render losers
  const losersContainer = document.getElementById('topLosers');
  if (losersContainer) {
    if (losers.length === 0) {
      losersContainer.innerHTML = '<div class="loading-small">No losers today</div>';
    } else {
      losersContainer.innerHTML = losers.map(t => `
        <div class="mover-item ${t.volumeRatio >= 1.5 ? 'high-volume' : ''}">
          <div class="mover-info">
            <div class="mover-ticker">${t.ticker}</div>
            <div class="mover-volume ${t.volumeRatio >= 1.5 ? 'high' : ''}">
              ${t.volumeRatio >= 1.5 ? '🔥 ' : ''}Vol: ${formatVolume(t.volume)} (${t.volumeRatio.toFixed(1)}x)
            </div>
          </div>
          <div class="mover-change negative">
            <div class="mover-price">$${t.price.toFixed(2)}</div>
            <div class="mover-percent">${t.changePercent.toFixed(2)}%</div>
          </div>
        </div>
      `).join('');
    }
  }
}

// Update connection status indicator
function updateConnectionStatus(status) {
  let statusIndicator = document.getElementById('connectionStatus');
  
  // Create status indicator if it doesn't exist
  if (!statusIndicator) {
    const header = document.querySelector('header h1');
    if (header) {
      statusIndicator = document.createElement('span');
      statusIndicator.id = 'connectionStatus';
      statusIndicator.className = 'connection-status';
      header.appendChild(statusIndicator);
    } else {
      return;
    }
  }
  
  statusIndicator.className = `connection-status ${status}`;
  
  switch (status) {
    case 'connected':
      statusIndicator.textContent = '🟢 LIVE';
      statusIndicator.title = 'Real-time updates active';
      break;
    case 'disconnected':
      statusIndicator.textContent = '🟡 RECONNECTING';
      statusIndicator.title = 'Attempting to reconnect...';
      break;
    case 'error':
      statusIndicator.textContent = '🔴 OFFLINE';
      statusIndicator.title = 'Connection error';
      break;
  }
}

// Update timestamp display
function updateTimestamp() {
  const now = new Date();
  const formatted = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  const timestampEl = document.getElementById('lastUpdate');
  if (timestampEl) {
    timestampEl.textContent = formatted;
  }
}

// Load dashboard data
async function loadDashboard() {
  await Promise.all([
    loadSentiment(),
    loadPerformance(),
    loadWatchlist(),
    loadActiveSignals(),
    loadRecentSignals()
  ]);
  updateTimestamp();
}

// Load performance stats
async function loadPerformance() {
  try {
    const response = await fetch('/api/performance/summary');
    const result = await response.json();
    
    if (result.success && result.data.overview) {
      const { overview, streaks } = result.data;
      
      document.getElementById('hitRate').textContent = overview.hitRate || '--';
      document.getElementById('totalReturn').textContent = overview.totalReturn || '--';
      document.getElementById('avgReturn').textContent = overview.avgReturn || '--';
      document.getElementById('winStreak').textContent = streaks.bestWin || '--';
      
      // Color code returns
      const totalReturnEl = document.getElementById('totalReturn');
      if (overview.totalReturn && overview.totalReturn.includes('+')) {
        totalReturnEl.classList.add('positive');
      } else if (overview.totalReturn && overview.totalReturn.includes('-')) {
        totalReturnEl.classList.add('negative');
      }
      
      const avgReturnEl = document.getElementById('avgReturn');
      if (overview.avgReturn && overview.avgReturn.includes('+')) {
        avgReturnEl.classList.add('positive');
      } else if (overview.avgReturn && overview.avgReturn.includes('-')) {
        avgReturnEl.classList.add('negative');
      }
    }
  } catch (error) {
    console.error('Failed to load performance:', error);
  }
}

// Load market sentiment
async function loadSentiment() {
  try {
    const response = await fetch('/api/latest-scan');
    const result = await response.json();
    
    if (result.success && result.data.sentiment) {
      const sentiment = result.data.sentiment;
      
      // Update sentiment display
      document.getElementById('sentimentEmoji').textContent = sentiment.emoji;
      document.getElementById('sentimentScore').textContent = sentiment.score > 0 ? `+${sentiment.score}` : sentiment.score;
      document.getElementById('sentimentLabel').textContent = sentiment.sentiment;
      document.getElementById('sentimentConfidence').textContent = `${sentiment.confidence}%`;
      document.getElementById('sentimentSummary').textContent = sentiment.summary;
      
      // Color code the score
      const scoreEl = document.getElementById('sentimentScore');
      let color = '#fbbf24'; // Yellow/neutral
      
      if (sentiment.score >= 60) color = '#00ff88';
      else if (sentiment.score >= 30) color = '#4ade80';
      else if (sentiment.score >= 10) color = '#86efac';
      else if (sentiment.score <= -60) color = '#ff4444';
      else if (sentiment.score <= -30) color = '#ef4444';
      else if (sentiment.score <= -10) color = '#fca5a5';
      
      scoreEl.style.color = color;
      
      // Update ticker breakdown
      const bullishTickers = sentiment.breakdown.bullish.map(t => t.ticker).join(', ') || 'None';
      const bearishTickers = sentiment.breakdown.bearish.map(t => t.ticker).join(', ') || 'None';
      const neutralTickers = sentiment.breakdown.neutral.map(t => t.ticker).join(', ') || 'None';
      
      document.getElementById('bullishTickers').textContent = bullishTickers;
      document.getElementById('bearishTickers').textContent = bearishTickers;
      document.getElementById('neutralTickers').textContent = neutralTickers;
    }
  } catch (error) {
    console.error('Failed to load sentiment:', error);
    document.getElementById('sentimentSummary').textContent = 'Failed to load sentiment data. Run a market scan first.';
  }
}

// Load watchlist
async function loadWatchlist() {
  const container = document.getElementById('watchlist');
  if (!container) return;
  
  try {
    const response = await fetch('/api/market-data');
    const result = await response.json();
    
    if (result.success && result.data) {
      const marketData = result.data;
      let html = '';
      
      for (const [ticker, data] of Object.entries(marketData)) {
        if (!data) continue;
        
        // Store initial prices (no animation on first load)
        if (previousPrices[ticker] === undefined) {
          previousPrices[ticker] = data.price;
        }
        
        const changeClass = data.change >= 0 ? 'positive' : 'negative';
        const changeSymbol = data.change >= 0 ? '+' : '';
        const volumeIndicator = data.volumeRatio >= 1.5 ? ' 📊' : '';
        const volumeClass = data.volumeRatio >= 1.5 ? 'high-volume' : '';
        
        html += `
          <div class="watchlist-item" data-ticker="${ticker}">
            <div class="ticker-info">
              <h3>${ticker}</h3>
              <div class="ticker-volume ${volumeClass}">
                Vol: ${formatVolume(data.volume)}${volumeIndicator}
              </div>
            </div>
            <div class="ticker-price ${changeClass}">
              <div class="price">$${data.price.toFixed(2)}</div>
              <div class="change">${changeSymbol}${data.changePercent.toFixed(2)}%</div>
            </div>
          </div>
        `;
      }
      
      container.innerHTML = html;
    }
  } catch (error) {
    console.error('Failed to load watchlist:', error);
    container.innerHTML = '<div class="empty-state">Failed to load market data</div>';
  }
}

// Load active signals
async function loadActiveSignals() {
  const container = document.getElementById('activeSignals');
  const countEl = document.getElementById('activeCount');
  if (!container) return;
  
  try {
    const response = await fetch('/api/signals');
    const result = await response.json();
    
    if (result.success && result.data.openSignals) {
      const signals = result.data.openSignals;
      
      if (countEl) {
        countEl.textContent = signals.length;
      }
      
      if (signals.length === 0) {
        container.innerHTML = '<div class="empty-state">No active signals</div>';
        return;
      }
      
      let html = '';
      
      signals.slice(0, 5).forEach(signal => {
        const directionClass = signal.direction === 'LONG' ? 'long' : 'short';
        
        html += `
          <div class="signal-item ${directionClass}">
            <div class="signal-header">
              <div>
                <strong>${signal.ticker}</strong>
                <span class="badge ${directionClass}">${signal.direction}</span>
              </div>
              <div class="signal-meta">
                Confidence: ${signal.confidence}/10
              </div>
            </div>
            <div class="signal-body">
              Entry: $${signal.entry.toFixed(2)} | 
              Target: $${signal.targets.t1.toFixed(2)} | 
              Stop: $${signal.stopLoss.toFixed(2)}
            </div>
          </div>
        `;
      });
      
      container.innerHTML = html;
    }
  } catch (error) {
    console.error('Failed to load active signals:', error);
  }
}

// Load recent signals
async function loadRecentSignals() {
  const container = document.getElementById('recentSignals');
  if (!container) return;
  
  try {
    const response = await fetch('/api/signals/recent?count=5');
    const result = await response.json();
    
    if (result.success && result.data) {
      const signals = result.data;
      
      if (signals.length === 0) {
        container.innerHTML = '<div class="empty-state">No signals yet</div>';
        return;
      }
      
      let html = '';
      
      signals.forEach(signal => {
        const directionClass = signal.direction === 'LONG' ? 'long' : 'short';
        const statusBadge = signal.status === 'OPEN' ? 
          '<span class="badge open">OPEN</span>' : 
          `<span class="badge closed">${signal.result}</span>`;
        
        const pnlText = signal.pnlPercent !== null ? 
          `<span class="${signal.pnlPercent > 0 ? 'positive' : 'negative'}">
            ${signal.pnlPercent > 0 ? '+' : ''}${signal.pnlPercent.toFixed(2)}%
          </span>` : 
          '';
        
        html += `
          <div class="signal-item ${directionClass}">
            <div class="signal-header">
              <div>
                <strong>${signal.ticker}</strong>
                <span class="badge ${directionClass}">${signal.direction}</span>
                ${statusBadge}
              </div>
              <div class="signal-meta">
                ${pnlText}
              </div>
            </div>
            <div class="signal-body">
              ${signal.reasoning}
            </div>
          </div>
        `;
      });
      
      container.innerHTML = html;
    }
  } catch (error) {
    console.error('Failed to load recent signals:', error);
  }
}

// Refresh market data
async function refreshMarket() {
  await loadWatchlist();
  updateTimestamp();
}

// Format volume
function formatVolume(volume) {
  if (volume >= 1000000) {
    return (volume / 1000000).toFixed(2) + 'M';
  } else if (volume >= 1000) {
    return (volume / 1000).toFixed(2) + 'K';
  }
  return volume.toString();
}

// Chart instances
let priceChart = null;
let rsiChart = null;
let macdChart = null;
let volumeChart = null;

// Load price chart for ticker
async function loadChart(ticker) {
  if (!ticker) return;
  
  try {
    // Fetch market data and technicals for the selected ticker
    const [marketRes, techRes] = await Promise.all([
      fetch('/api/market-data'),
      fetch('/api/technicals')
    ]);
    
    const marketData = await marketRes.json();
    const techData = await techRes.json();
    
    if (!marketData.success || !techData.success) {
      console.error('Failed to load chart data');
      return;
    }
    
    const tickerMarketData = marketData.data[ticker];
    const tickerTechData = techData.data[ticker];
    
    if (!tickerMarketData || !tickerTechData || !tickerMarketData.historicalData) {
      console.error('No data available for', ticker);
      return;
    }
    
    // Prepare chart data
    const historicalData = tickerMarketData.historicalData;
    const dates = historicalData.map(d => new Date(d.date));
    const closes = historicalData.map(d => d.close);
    const highs = historicalData.map(d => d.high);
    const lows = historicalData.map(d => d.low);
    
    // Calculate moving averages for display
    const ma20 = historicalData.map((d, i) => {
      if (i < 19) return null;
      const slice = closes.slice(i - 19, i + 1);
      return slice.reduce((a, b) => a + b, 0) / 20;
    });
    
    const ma50 = historicalData.map((d, i) => {
      if (i < 49) return null;
      const slice = closes.slice(i - 49, i + 1);
      return slice.reduce((a, b) => a + b, 0) / 50;
    });
    
    // Bollinger Bands
    const bbUpper = historicalData.map(d => tickerTechData.bollingerBands?.upper);
    const bbLower = historicalData.map(d => tickerTechData.bollingerBands?.lower);
    
    // VWAP
    const vwap = historicalData.map(d => tickerTechData.vwap);
    
    // Destroy existing chart if any
    if (priceChart) {
      priceChart.destroy();
    }
    
    // Create new chart
    const ctx = document.getElementById('priceChart').getContext('2d');
    priceChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'Price',
            data: closes,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.1,
            pointRadius: 0,
            pointHoverRadius: 4,
            order: 1
          },
          {
            label: 'MA(20)',
            data: ma20,
            borderColor: '#22c55e',
            borderWidth: 1.5,
            borderDash: [5, 5],
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            order: 2
          },
          {
            label: 'MA(50)',
            data: ma50,
            borderColor: '#a855f7',
            borderWidth: 1.5,
            borderDash: [5, 5],
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            order: 3
          },
          {
            label: 'BB Upper',
            data: Array(closes.length).fill(tickerTechData.bollingerBands?.upper),
            borderColor: 'rgba(239, 68, 68, 0.5)',
            borderWidth: 1,
            borderDash: [2, 2],
            fill: false,
            pointRadius: 0,
            order: 4
          },
          {
            label: 'BB Lower',
            data: Array(closes.length).fill(tickerTechData.bollingerBands?.lower),
            borderColor: 'rgba(239, 68, 68, 0.5)',
            borderWidth: 1,
            borderDash: [2, 2],
            fill: false,
            pointRadius: 0,
            order: 5
          },
          {
            label: 'VWAP',
            data: Array(closes.length).fill(tickerTechData.vwap),
            borderColor: '#eab308',
            borderWidth: 1.5,
            fill: false,
            pointRadius: 0,
            order: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(26, 31, 58, 0.95)',
            titleColor: '#e8eaf0',
            bodyColor: '#9ca3af',
            borderColor: '#2a3150',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              title: function(context) {
                const date = new Date(context[0].parsed.x);
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
              },
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += '$' + context.parsed.y.toFixed(2);
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              displayFormats: {
                day: 'MMM dd'
              }
            },
            grid: {
              color: 'rgba(42, 49, 80, 0.3)'
            },
            ticks: {
              color: '#6b7280'
            }
          },
          y: {
            grid: {
              color: 'rgba(42, 49, 80, 0.3)'
            },
            ticks: {
              color: '#6b7280',
              callback: function(value) {
                return '$' + value.toFixed(2);
              }
            }
          }
        }
      }
    });
    
    // Update legend
    updateChartLegend(ticker, tickerMarketData, tickerTechData);
    
  } catch (error) {
    console.error('Failed to load chart:', error);
  }
}

// Update chart legend with key metrics
function updateChartLegend(ticker, marketData, techData) {
  const legendEl = document.getElementById('chartLegend');
  if (!legendEl) return;
  
  const currentPrice = marketData.price;
  const ma20 = techData.movingAverages?.sma20;
  const ma50 = techData.movingAverages?.sma50;
  const vwap = techData.vwap;
  const rsi = techData.rsi;
  const bbUpper = techData.bollingerBands?.upper;
  const bbLower = techData.bollingerBands?.lower;
  
  legendEl.innerHTML = `
    <div class="legend-item">
      <div class="legend-color" style="background: #3b82f6;"></div>
      <span class="legend-label">Price:</span>
      <span class="legend-value">$${currentPrice.toFixed(2)}</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: #22c55e;"></div>
      <span class="legend-label">MA(20):</span>
      <span class="legend-value">$${ma20?.toFixed(2) || 'N/A'}</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: #a855f7;"></div>
      <span class="legend-label">MA(50):</span>
      <span class="legend-value">$${ma50?.toFixed(2) || 'N/A'}</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: #eab308;"></div>
      <span class="legend-label">VWAP:</span>
      <span class="legend-value">$${vwap?.toFixed(2) || 'N/A'}</span>
    </div>
    <div class="legend-item">
      <div class="legend-color" style="background: #ef4444;"></div>
      <span class="legend-label">BB:</span>
      <span class="legend-value">$${bbUpper?.toFixed(2) || 'N/A'} / $${bbLower?.toFixed(2) || 'N/A'}</span>
    </div>
    <div class="legend-item">
      <span class="legend-label">RSI(14):</span>
      <span class="legend-value ${rsi > 70 ? 'negative' : rsi < 30 ? 'positive' : ''}">${rsi?.toFixed(2) || 'N/A'}</span>
    </div>
    <div class="legend-item">
      <span class="legend-label">Trend:</span>
      <span class="legend-value">${techData.trend?.replace('_', ' ').toUpperCase() || 'N/A'}</span>
    </div>
  `;
}

// Populate chart ticker dropdown
async function populateChartTickers() {
  try {
    const response = await fetch('/api/market-data');
    const result = await response.json();
    
    if (result.success && result.data) {
      const select = document.getElementById('chartTicker');
      if (!select) return;
      
      // Clear existing options except the first placeholder
      while (select.options.length > 1) {
        select.remove(1);
      }
      
      // Add ticker options
      for (const ticker of Object.keys(result.data)) {
        const option = document.createElement('option');
        option.value = ticker;
        option.textContent = ticker;
        select.appendChild(option);
      }
      
      // Auto-select first ticker
      if (select.options.length > 1) {
        select.selectedIndex = 1;
        loadChart(select.options[1].value);
      }
    }
  } catch (error) {
    console.error('Failed to populate chart tickers:', error);
  }
}

// Run AI Analysis from web UI
async function runAIAnalysis() {
  const btn = document.getElementById('analyzeBtn');
  const statusEl = document.getElementById('analysisStatus');
  
  if (!btn || !statusEl) return;
  
  try {
    // Disable button and show loading state
    btn.disabled = true;
    btn.textContent = '🔄 Analyzing...';
    statusEl.innerHTML = '<div class="analysis-loading">🤖 Running Gemini AI analysis on all tickers...</div>';
    statusEl.className = 'analysis-status loading';
    
    // Trigger analysis
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Success feedback
      const signalCount = result.data.signalsGenerated || 0;
      statusEl.innerHTML = `
        <div class="analysis-success">
          ✅ Analysis complete! Generated ${signalCount} signal${signalCount !== 1 ? 's' : ''}.
        </div>
      `;
      statusEl.className = 'analysis-status success';
      
      // Refresh signals to show new data
      setTimeout(() => {
        loadActiveSignals();
        loadRecentSignals();
        loadPerformance();
        
        // Clear status after a few seconds
        setTimeout(() => {
          statusEl.innerHTML = '';
          statusEl.className = 'analysis-status';
        }, 5000);
      }, 500);
    } else {
      // Error feedback
      const errorMsg = result.hint || result.error || 'Unknown error';
      statusEl.innerHTML = `
        <div class="analysis-error">
          ❌ Analysis failed: ${errorMsg}
        </div>
      `;
      statusEl.className = 'analysis-status error';
      
      // Clear error after 10 seconds
      setTimeout(() => {
        statusEl.innerHTML = '';
        statusEl.className = 'analysis-status';
      }, 10000);
    }
  } catch (error) {
    console.error('Failed to run AI analysis:', error);
    statusEl.innerHTML = `
      <div class="analysis-error">
        ❌ Network error: ${error.message}
      </div>
    `;
    statusEl.className = 'analysis-status error';
    
    setTimeout(() => {
      statusEl.innerHTML = '';
      statusEl.className = 'analysis-status';
    }, 10000);
  } finally {
    // Re-enable button
    btn.disabled = false;
    btn.textContent = '🤖 Run AI Analysis';
  }
}

// Export functions for use in HTML
window.loadDashboard = loadDashboard;
window.refreshMarket = refreshMarket;
window.updateTimestamp = updateTimestamp;
window.loadChart = loadChart;
window.runAIAnalysis = runAIAnalysis;
