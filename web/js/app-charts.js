// Enhanced Multi-Panel Chart Implementation for Klaw Terminal

// Load price chart for ticker with technical indicator panels
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
    const volumes = historicalData.map(d => d.volume);
    
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
    
    // Calculate RSI for each historical point
    const rsiValues = calculateHistoricalRSI(closes, 14);
    
    // Calculate MACD for each historical point
    const macdData = calculateHistoricalMACD(closes);
    
    // Destroy existing charts if any
    if (window.priceChart) window.priceChart.destroy();
    if (window.rsiChart) window.rsiChart.destroy();
    if (window.macdChart) window.macdChart.destroy();
    if (window.volumeChart) window.volumeChart.destroy();
    
    // Common chart options
    const commonOptions = {
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
          displayColors: true
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
            color: '#6b7280',
            display: false // Hide x-axis labels on indicator panels
          }
        }
      }
    };
    
    // 1. Price Chart
    const priceCtx = document.getElementById('priceChart').getContext('2d');
    window.priceChart = new Chart(priceCtx, {
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
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          x: {
            ...commonOptions.scales.x,
            ticks: {
              color: '#6b7280',
              display: true
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
        },
        plugins: {
          ...commonOptions.plugins,
          tooltip: {
            ...commonOptions.plugins.tooltip,
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
        }
      }
    });
    
    // 2. RSI Chart
    const rsiCtx = document.getElementById('rsiChart').getContext('2d');
    window.rsiChart = new Chart(rsiCtx, {
      type: 'line',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'RSI(14)',
            data: rsiValues,
            borderColor: '#a855f7',
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 3
          }
        ]
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            min: 0,
            max: 100,
            grid: {
              color: 'rgba(42, 49, 80, 0.3)'
            },
            ticks: {
              color: '#6b7280',
              stepSize: 25
            }
          }
        },
        plugins: {
          ...commonOptions.plugins,
          annotation: {
            annotations: {
              overbought: {
                type: 'line',
                yMin: 70,
                yMax: 70,
                borderColor: 'rgba(239, 68, 68, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5]
              },
              oversold: {
                type: 'line',
                yMin: 30,
                yMax: 30,
                borderColor: 'rgba(34, 197, 94, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5]
              },
              midline: {
                type: 'line',
                yMin: 50,
                yMax: 50,
                borderColor: 'rgba(156, 163, 175, 0.3)',
                borderWidth: 1
              }
            }
          },
          tooltip: {
            ...commonOptions.plugins.tooltip,
            callbacks: {
              title: function(context) {
                const date = new Date(context[0].parsed.x);
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                });
              },
              label: function(context) {
                return 'RSI: ' + context.parsed.y.toFixed(2);
              }
            }
          }
        }
      }
    });
    
    // 3. MACD Chart
    const macdCtx = document.getElementById('macdChart').getContext('2d');
    window.macdChart = new Chart(macdCtx, {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'Histogram',
            data: macdData.histogram,
            backgroundColor: macdData.histogram.map(v => v >= 0 ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)'),
            borderWidth: 0,
            type: 'bar'
          },
          {
            label: 'MACD',
            data: macdData.macd,
            borderColor: '#3b82f6',
            borderWidth: 2,
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 3,
            type: 'line'
          },
          {
            label: 'Signal',
            data: macdData.signal,
            borderColor: '#eab308',
            borderWidth: 2,
            fill: false,
            tension: 0.2,
            pointRadius: 0,
            pointHoverRadius: 3,
            type: 'line'
          }
        ]
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          y: {
            grid: {
              color: 'rgba(42, 49, 80, 0.3)'
            },
            ticks: {
              color: '#6b7280'
            }
          }
        },
        plugins: {
          ...commonOptions.plugins,
          tooltip: {
            ...commonOptions.plugins.tooltip,
            callbacks: {
              title: function(context) {
                const date = new Date(context[0].label);
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                });
              },
              label: function(context) {
                const label = context.dataset.label || '';
                const value = context.parsed.y.toFixed(4);
                return label + ': ' + value;
              }
            }
          }
        }
      }
    });
    
    // 4. Volume Chart
    const volumeCtx = document.getElementById('volumeChart').getContext('2d');
    window.volumeChart = new Chart(volumeCtx, {
      type: 'bar',
      data: {
        labels: dates,
        datasets: [
          {
            label: 'Volume',
            data: volumes,
            backgroundColor: volumes.map((v, i) => {
              if (i === 0) return 'rgba(156, 163, 175, 0.5)';
              return closes[i] >= closes[i-1] ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)';
            }),
            borderWidth: 0
          }
        ]
      },
      options: {
        ...commonOptions,
        scales: {
          ...commonOptions.scales,
          x: {
            ...commonOptions.scales.x,
            ticks: {
              color: '#6b7280',
              display: true
            }
          },
          y: {
            grid: {
              color: 'rgba(42, 49, 80, 0.3)'
            },
            ticks: {
              color: '#6b7280',
              callback: function(value) {
                if (value >= 1000000) {
                  return (value / 1000000).toFixed(1) + 'M';
                } else if (value >= 1000) {
                  return (value / 1000).toFixed(0) + 'K';
                }
                return value;
              }
            }
          }
        },
        plugins: {
          ...commonOptions.plugins,
          tooltip: {
            ...commonOptions.plugins.tooltip,
            callbacks: {
              title: function(context) {
                const date = new Date(context[0].label);
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                });
              },
              label: function(context) {
                const vol = context.parsed.y;
                let formatted;
                if (vol >= 1000000) {
                  formatted = (vol / 1000000).toFixed(2) + 'M';
                } else if (vol >= 1000) {
                  formatted = (vol / 1000).toFixed(2) + 'K';
                } else {
                  formatted = vol.toString();
                }
                return 'Volume: ' + formatted;
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

// Calculate historical RSI values
function calculateHistoricalRSI(closes, period = 14) {
  const rsi = [];
  const changes = [];
  
  // Calculate price changes
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  
  // Calculate RSI for each point
  for (let i = 0; i < changes.length; i++) {
    if (i < period - 1) {
      rsi.push(null);
      continue;
    }
    
    const slice = changes.slice(i - period + 1, i + 1);
    const gains = slice.filter(c => c > 0);
    const losses = slice.filter(c => c < 0).map(c => Math.abs(c));
    
    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;
    
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  
  // Prepend null for first data point (no change)
  rsi.unshift(null);
  
  return rsi;
}

// Calculate historical MACD values
function calculateHistoricalMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const emaFast = calculateEMA(closes, fastPeriod);
  const emaSlow = calculateEMA(closes, slowPeriod);
  
  const macdLine = emaFast.map((fast, i) => {
    if (fast === null || emaSlow[i] === null) return null;
    return fast - emaSlow[i];
  });
  
  const signalLine = calculateEMA(macdLine.filter(v => v !== null), signalPeriod, true);
  
  // Pad signal line with nulls to match macd length
  const paddedSignal = [];
  let signalIndex = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null) {
      paddedSignal.push(null);
    } else {
      paddedSignal.push(signalLine[signalIndex] || null);
      signalIndex++;
    }
  }
  
  const histogram = macdLine.map((macd, i) => {
    if (macd === null || paddedSignal[i] === null) return null;
    return macd - paddedSignal[i];
  });
  
  return {
    macd: macdLine,
    signal: paddedSignal,
    histogram: histogram
  };
}

// Calculate EMA (Exponential Moving Average)
function calculateEMA(data, period, skipNulls = false) {
  const ema = [];
  const multiplier = 2 / (period + 1);
  
  let validData = skipNulls ? data : data;
  let startIndex = 0;
  
  // Find first valid data point
  for (let i = 0; i < validData.length; i++) {
    if (validData[i] !== null) {
      startIndex = i;
      break;
    }
  }
  
  // Calculate initial SMA
  let sum = 0;
  let count = 0;
  for (let i = startIndex; i < startIndex + period && i < validData.length; i++) {
    if (validData[i] !== null) {
      sum += validData[i];
      count++;
    }
  }
  
  // Fill initial values with null
  for (let i = 0; i < startIndex + period - 1; i++) {
    ema.push(null);
  }
  
  // Initial EMA is the SMA
  let previousEma = sum / count;
  ema.push(previousEma);
  
  // Calculate EMA for remaining points
  for (let i = startIndex + period; i < validData.length; i++) {
    if (validData[i] === null) {
      ema.push(null);
      continue;
    }
    
    const currentEma = (validData[i] - previousEma) * multiplier + previousEma;
    ema.push(currentEma);
    previousEma = currentEma;
  }
  
  return ema;
}

// Export for use in main app
if (typeof window !== 'undefined') {
  window.loadChart = loadChart;
}
