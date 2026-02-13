// Advanced TradingView-style Charts for Klaw Terminal
// Using lightweight-charts library for professional charting

let priceChart, volumeChart, rsiChart, macdChart;
let priceSeries, volumeSeries, rsiSeries, macdSeries, signalSeries, histogramSeries;
let indicatorSeries = {};
let currentTicker = '';
let currentPeriod = 50;
let activeIndicators = new Set(['sma20', 'sma50']);

// Chart color scheme
const colors = {
  background: 'transparent',
  textColor: '#d1d4dc',
  gridColor: 'rgba(255, 255, 255, 0.05)',
  upColor: '#10b981',
  downColor: '#ef4444',
  volumeUpColor: 'rgba(16, 185, 129, 0.5)',
  volumeDownColor: 'rgba(239, 68, 68, 0.5)',
  sma20: '#667eea',
  sma50: '#f59e0b',
  ema9: '#ec4899',
  ema21: '#8b5cf6',
  vwap: '#06b6d4',
  bb: 'rgba(156, 163, 175, 0.3)'
};

// Initialize charts
function initCharts() {
  // Common layout options
  const layoutOptions = {
    background: { color: colors.background },
    textColor: colors.textColor,
    fontSize: 12,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
  };
  
  const gridOptions = {
    vertLines: { color: colors.gridColor },
    horzLines: { color: colors.gridColor }
  };
  
  const timeScaleOptions = {
    borderColor: 'rgba(255, 255, 255, 0.1)',
    timeVisible: true,
    secondsVisible: false
  };
  
  // Price Chart
  priceChart = LightweightCharts.createChart(document.getElementById('priceChart'), {
    layout: layoutOptions,
    grid: gridOptions,
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { color: 'rgba(255, 255, 255, 0.3)', width: 1, style: 3 },
      horzLine: { color: 'rgba(255, 255, 255, 0.3)', width: 1, style: 3 }
    },
    rightPriceScale: {
      borderColor: 'rgba(255, 255, 255, 0.1)',
      scaleMargins: { top: 0.1, bottom: 0.2 }
    },
    timeScale: timeScaleOptions,
    handleScroll: { mouseWheel: true, pressedMouseMove: true },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true }
  });
  
  priceSeries = priceChart.addCandlestickSeries({
    upColor: colors.upColor,
    downColor: colors.downColor,
    borderVisible: false,
    wickUpColor: colors.upColor,
    wickDownColor: colors.downColor
  });
  
  // Volume Chart
  volumeChart = LightweightCharts.createChart(document.getElementById('volumeChart'), {
    layout: layoutOptions,
    grid: gridOptions,
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { color: 'rgba(255, 255, 255, 0.3)', width: 1, style: 3 },
      horzLine: { visible: false }
    },
    rightPriceScale: {
      borderColor: 'rgba(255, 255, 255, 0.1)',
      scaleMargins: { top: 0.1, bottom: 0 }
    },
    timeScale: { ...timeScaleOptions, visible: false },
    handleScroll: { mouseWheel: false, pressedMouseMove: false },
    handleScale: { axisPressedMouseMove: false, mouseWheel: false, pinch: false }
  });
  
  volumeSeries = volumeChart.addHistogramSeries({
    color: colors.volumeUpColor,
    priceFormat: { type: 'volume' },
    priceScaleId: ''
  });
  
  // RSI Chart
  rsiChart = LightweightCharts.createChart(document.getElementById('rsiChart'), {
    layout: layoutOptions,
    grid: gridOptions,
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { color: 'rgba(255, 255, 255, 0.3)', width: 1, style: 3 },
      horzLine: { color: 'rgba(255, 255, 255, 0.3)', width: 1, style: 3 }
    },
    rightPriceScale: {
      borderColor: 'rgba(255, 255, 255, 0.1)',
      scaleMargins: { top: 0.1, bottom: 0.1 }
    },
    timeScale: { ...timeScaleOptions, visible: false },
    handleScroll: { mouseWheel: false, pressedMouseMove: false },
    handleScale: { axisPressedMouseMove: false, mouseWheel: false, pinch: false }
  });
  
  rsiSeries = rsiChart.addLineSeries({
    color: '#667eea',
    lineWidth: 2,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius: 4
  });
  
  // Add RSI reference lines (overbought/oversold)
  const rsiOverbought = rsiChart.addLineSeries({
    color: 'rgba(239, 68, 68, 0.5)',
    lineWidth: 1,
    lineStyle: 2,
    crosshairMarkerVisible: false
  });
  
  const rsiOversold = rsiChart.addLineSeries({
    color: 'rgba(16, 185, 129, 0.5)',
    lineWidth: 1,
    lineStyle: 2,
    crosshairMarkerVisible: false
  });
  
  // MACD Chart
  macdChart = LightweightCharts.createChart(document.getElementById('macdChart'), {
    layout: layoutOptions,
    grid: gridOptions,
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { color: 'rgba(255, 255, 255, 0.3)', width: 1, style: 3 },
      horzLine: { color: 'rgba(255, 255, 255, 0.3)', width: 1, style: 3 }
    },
    rightPriceScale: {
      borderColor: 'rgba(255, 255, 255, 0.1)',
      scaleMargins: { top: 0.1, bottom: 0.1 }
    },
    timeScale: timeScaleOptions,
    handleScroll: { mouseWheel: false, pressedMouseMove: false },
    handleScale: { axisPressedMouseMove: false, mouseWheel: false, pinch: false }
  });
  
  histogramSeries = macdChart.addHistogramSeries({
    color: colors.upColor,
    priceFormat: { type: 'price', precision: 4 }
  });
  
  macdSeries = macdChart.addLineSeries({
    color: '#667eea',
    lineWidth: 2
  });
  
  signalSeries = macdChart.addLineSeries({
    color: '#f59e0b',
    lineWidth: 2
  });
  
  // Sync time scales
  priceChart.timeScale().subscribeVisibleTimeRangeChange(() => {
    const timeRange = priceChart.timeScale().getVisibleRange();
    volumeChart.timeScale().setVisibleRange(timeRange);
    rsiChart.timeScale().setVisibleRange(timeRange);
    macdChart.timeScale().setVisibleRange(timeRange);
  });
  
  // Resize charts on window resize
  window.addEventListener('resize', () => {
    priceChart.applyOptions({ width: document.getElementById('priceChart').clientWidth });
    volumeChart.applyOptions({ width: document.getElementById('volumeChart').clientWidth });
    rsiChart.applyOptions({ width: document.getElementById('rsiChart').clientWidth });
    macdChart.applyOptions({ width: document.getElementById('macdChart').clientWidth });
  });
}

// Calculate SMA
function calculateSMA(data, period) {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b.close, 0);
    result.push({
      time: data[i].time,
      value: sum / period
    });
  }
  return result;
}

// Calculate EMA
function calculateEMA(data, period) {
  const k = 2 / (period + 1);
  const result = [];
  let ema = data.slice(0, period).reduce((a, b) => a + b.close, 0) / period;
  
  result.push({ time: data[period - 1].time, value: ema });
  
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close * k) + (ema * (1 - k));
    result.push({ time: data[i].time, value: ema });
  }
  return result;
}

// Calculate VWAP
function calculateVWAP(data) {
  const result = [];
  let cumulativePV = 0;
  let cumulativeV = 0;
  
  for (let i = 0; i < data.length; i++) {
    const typical = (data[i].high + data[i].low + data[i].close) / 3;
    cumulativePV += typical * data[i].volume;
    cumulativeV += data[i].volume;
    
    result.push({
      time: data[i].time,
      value: cumulativePV / cumulativeV
    });
  }
  return result;
}

// Calculate Bollinger Bands
function calculateBollingerBands(data, period = 20, stdDev = 2) {
  const result = { upper: [], middle: [], lower: [] };
  
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const sma = slice.reduce((a, b) => a + b.close, 0) / period;
    
    const variance = slice.reduce((sum, candle) => {
      return sum + Math.pow(candle.close - sma, 2);
    }, 0) / period;
    
    const std = Math.sqrt(variance);
    
    result.upper.push({ time: data[i].time, value: sma + (stdDev * std) });
    result.middle.push({ time: data[i].time, value: sma });
    result.lower.push({ time: data[i].time, value: sma - (stdDev * std) });
  }
  
  return result;
}

// Calculate RSI
function calculateRSI(data, period = 14) {
  const result = [];
  const gains = [];
  const losses = [];
  
  for (let i = 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }
  
  for (let i = period - 1; i < gains.length; i++) {
    const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    result.push({
      time: data[i + 1].time,
      value: rsi
    });
  }
  
  return result;
}

// Calculate MACD
function calculateMACD(data) {
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  
  const macdLine = [];
  const minLength = Math.min(ema12.length, ema26.length);
  
  for (let i = 0; i < minLength; i++) {
    macdLine.push({
      time: ema12[i].time,
      value: ema12[i].value - ema26[i].value
    });
  }
  
  // Calculate signal line (9-period EMA of MACD)
  const k = 2 / (9 + 1);
  let signal = macdLine.slice(0, 9).reduce((a, b) => a + b.value, 0) / 9;
  const signalLine = [{ time: macdLine[8].time, value: signal }];
  
  for (let i = 9; i < macdLine.length; i++) {
    signal = (macdLine[i].value * k) + (signal * (1 - k));
    signalLine.push({ time: macdLine[i].time, value: signal });
  }
  
  // Calculate histogram
  const histogram = [];
  for (let i = 0; i < signalLine.length; i++) {
    const histValue = macdLine[i + 8].value - signalLine[i].value;
    histogram.push({
      time: signalLine[i].time,
      value: histValue,
      color: histValue >= 0 ? colors.upColor : colors.downColor
    });
  }
  
  return {
    macd: macdLine.slice(8),
    signal: signalLine,
    histogram: histogram
  };
}

// Update indicator overlays on price chart
function updateIndicators(candleData) {
  // Clear existing indicator series
  for (const key in indicatorSeries) {
    priceChart.removeSeries(indicatorSeries[key]);
  }
  indicatorSeries = {};
  
  // Add active indicators
  if (activeIndicators.has('sma20')) {
    const sma20 = calculateSMA(candleData, 20);
    indicatorSeries.sma20 = priceChart.addLineSeries({
      color: colors.sma20,
      lineWidth: 2,
      title: 'SMA 20'
    });
    indicatorSeries.sma20.setData(sma20);
  }
  
  if (activeIndicators.has('sma50')) {
    const sma50 = calculateSMA(candleData, 50);
    indicatorSeries.sma50 = priceChart.addLineSeries({
      color: colors.sma50,
      lineWidth: 2,
      title: 'SMA 50'
    });
    indicatorSeries.sma50.setData(sma50);
  }
  
  if (activeIndicators.has('ema9')) {
    const ema9 = calculateEMA(candleData, 9);
    indicatorSeries.ema9 = priceChart.addLineSeries({
      color: colors.ema9,
      lineWidth: 2,
      title: 'EMA 9'
    });
    indicatorSeries.ema9.setData(ema9);
  }
  
  if (activeIndicators.has('ema21')) {
    const ema21 = calculateEMA(candleData, 21);
    indicatorSeries.ema21 = priceChart.addLineSeries({
      color: colors.ema21,
      lineWidth: 2,
      title: 'EMA 21'
    });
    indicatorSeries.ema21.setData(ema21);
  }
  
  if (activeIndicators.has('vwap')) {
    const vwap = calculateVWAP(candleData);
    indicatorSeries.vwap = priceChart.addLineSeries({
      color: colors.vwap,
      lineWidth: 2,
      lineStyle: 2,
      title: 'VWAP'
    });
    indicatorSeries.vwap.setData(vwap);
  }
  
  if (activeIndicators.has('bb')) {
    const bb = calculateBollingerBands(candleData);
    indicatorSeries.bbUpper = priceChart.addLineSeries({
      color: colors.bb,
      lineWidth: 1,
      lineStyle: 2
    });
    indicatorSeries.bbMiddle = priceChart.addLineSeries({
      color: colors.bb,
      lineWidth: 1
    });
    indicatorSeries.bbLower = priceChart.addLineSeries({
      color: colors.bb,
      lineWidth: 1,
      lineStyle: 2
    });
    indicatorSeries.bbUpper.setData(bb.upper);
    indicatorSeries.bbMiddle.setData(bb.middle);
    indicatorSeries.bbLower.setData(bb.lower);
  }
}

// Load and display chart data
async function loadChartData(ticker) {
  if (!ticker) return;
  
  showLoading(true);
  currentTicker = ticker;
  
  try {
    const [marketRes, techRes] = await Promise.all([
      fetch('/api/market-data'),
      fetch('/api/technicals')
    ]);
    
    if (!marketRes.ok || !techRes.ok) {
      throw new Error('Failed to fetch data');
    }
    
    const marketData = await marketRes.json();
    const techData = await techRes.json();
    
    if (!marketData.success || !techData.success) {
      throw new Error('API returned error');
    }
    
    const tickerData = marketData.data[ticker];
    const tickerTech = techData.data[ticker];
    
    if (!tickerData || !tickerData.historicalData) {
      throw new Error(`No data for ${ticker}`);
    }
    
    // Update header info
    document.getElementById('chartTickerSymbol').textContent = ticker;
    document.getElementById('chartPrice').textContent = `$${tickerData.price.toFixed(2)}`;
    
    const changeClass = tickerData.change >= 0 ? 'positive' : 'negative';
    const changeSign = tickerData.change >= 0 ? '+' : '';
    document.getElementById('chartChange').textContent = `${changeSign}${tickerData.changePercent.toFixed(2)}%`;
    document.getElementById('chartChange').className = changeClass;
    document.getElementById('chartPrice').className = changeClass;
    
    // Prepare candle data
    const historicalData = tickerData.historicalData.slice(-currentPeriod);
    const candleData = historicalData.map(d => ({
      time: d.date.split('T')[0],
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume
    }));
    
    // Update price chart
    priceSeries.setData(candleData);
    
    // Update volume chart
    const volumeData = candleData.map((d, i) => ({
      time: d.time,
      value: d.volume,
      color: i > 0 && d.close >= candleData[i - 1].close 
        ? colors.volumeUpColor 
        : colors.volumeDownColor
    }));
    volumeSeries.setData(volumeData);
    
    // Update indicators
    updateIndicators(candleData);
    
    // Update RSI chart
    const rsiData = calculateRSI(candleData);
    rsiSeries.setData(rsiData);
    
    // Update MACD chart
    const macdData = calculateMACD(candleData);
    macdSeries.setData(macdData.macd);
    signalSeries.setData(macdData.signal);
    histogramSeries.setData(macdData.histogram);
    
    // Update info cards
    updateInfoCards(tickerData, tickerTech);
    
    // Fit content
    priceChart.timeScale().fitContent();
    
  } catch (error) {
    console.error('Error loading chart:', error);
    alert(`Failed to load chart for ${ticker}: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

// Update info cards with current data
function updateInfoCards(tickerData, tickerTech) {
  document.getElementById('infoPrice').textContent = `$${tickerData.price.toFixed(2)}`;
  document.getElementById('infoPrice').className = 'value ' + (tickerData.change >= 0 ? 'positive' : 'negative');
  
  const changeSign = tickerData.change >= 0 ? '+' : '';
  document.getElementById('infoChange').textContent = `${changeSign}${tickerData.changePercent.toFixed(2)}%`;
  document.getElementById('infoChange').className = 'value ' + (tickerData.change >= 0 ? 'positive' : 'negative');
  
  const volumeM = (tickerData.volume / 1000000).toFixed(2);
  document.getElementById('infoVolume').textContent = `${volumeM}M`;
  
  if (tickerTech) {
    document.getElementById('infoRSI').textContent = tickerTech.rsi ? tickerTech.rsi.toFixed(1) : '--';
    document.getElementById('infoRSI').className = 'value ' + 
      (tickerTech.rsi > 70 ? 'negative' : tickerTech.rsi < 30 ? 'positive' : '');
    
    document.getElementById('infoMACD').textContent = tickerTech.macd ? 
      tickerTech.macd.histogram.toFixed(3) : '--';
    document.getElementById('infoMACD').className = 'value ' + 
      (tickerTech.macd && tickerTech.macd.histogram > 0 ? 'positive' : 'negative');
    
    document.getElementById('infoATR').textContent = tickerTech.atr ? 
      `$${tickerTech.atr.toFixed(2)}` : '--';
    
    document.getElementById('infoADX').textContent = tickerTech.adx ? 
      tickerTech.adx.adx.toFixed(1) : '--';
    
    document.getElementById('infoTrend').textContent = tickerTech.trend ? 
      tickerTech.trend.replace('_', ' ').toUpperCase() : '--';
    document.getElementById('infoTrend').className = 'value ' + 
      (tickerTech.trend?.includes('bullish') ? 'positive' : 
       tickerTech.trend?.includes('bearish') ? 'negative' : '');
  }
}

// Show/hide loading overlay
function showLoading(show) {
  document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
}

// Load tickers into dropdown
async function loadTickers() {
  try {
    const res = await fetch('/api/watchlist/symbols');
    const data = await res.json();
    
    if (data.success && data.data.length > 0) {
      const select = document.getElementById('tickerSelect');
      select.innerHTML = '<option value="">Select ticker...</option>';
      
      data.data.forEach(ticker => {
        const option = document.createElement('option');
        option.value = ticker;
        option.textContent = ticker;
        select.appendChild(option);
      });
      
      // Auto-load first ticker
      select.value = data.data[0];
      loadChartData(data.data[0]);
    }
  } catch (error) {
    console.error('Error loading tickers:', error);
  }
}

// Event listeners
document.getElementById('tickerSelect').addEventListener('change', (e) => {
  if (e.target.value) {
    loadChartData(e.target.value);
  }
});

document.querySelectorAll('.timeframe-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = parseInt(btn.dataset.period);
    if (currentTicker) {
      loadChartData(currentTicker);
    }
  });
});

document.querySelectorAll('.indicator-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const indicator = btn.dataset.indicator;
    
    if (activeIndicators.has(indicator)) {
      activeIndicators.delete(indicator);
      btn.classList.remove('active');
    } else {
      activeIndicators.add(indicator);
      btn.classList.add('active');
    }
    
    if (currentTicker) {
      loadChartData(currentTicker);
    }
  });
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  loadTickers();
});
