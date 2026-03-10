'use strict';

const template = require('./dashboard-chart.html');

function getChartThemeColor(cssVar, fallback) {
  if (typeof document === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(cssVar)?.trim();
  return val || fallback;
}

function getThemeColors() {
  return {
    tickColor: getChartThemeColor('--studio-text-primary', '#111827'),
    gridColor: getChartThemeColor('--studio-border', '#e5e7eb')
  };
}

const SCALELESS_TYPES = ['pie', 'doughnut', 'polarArea', 'radar'];

function applyThemeChartOptions(config) {
  const { tickColor, gridColor } = getThemeColors();
  const type = config.type || '';
  const options = config.options || {};
  const plugins = { ...options.plugins };
  const legend = plugins.legend || {};
  plugins.legend = {
    ...legend,
    labels: { ...legend.labels, color: tickColor }
  };

  // Pie/doughnut/polarArea/radar don't use cartesian scales
  if (SCALELESS_TYPES.includes(type)) {
    return {
      ...config,
      options: { ...options, plugins }
    };
  }

  const scales = { ...options.scales };
  const applyScaleTheme = (id) => {
    const scale = scales[id] || {};
    scales[id] = {
      ...scale,
      ticks: { ...scale.ticks, color: tickColor },
      grid: { ...scale.grid, color: gridColor }
    };
  };
  ['x', 'y'].forEach(id => {
    if (!scales[id]) scales[id] = {};
    applyScaleTheme(id);
  });
  Object.keys(scales).forEach(id => {
    if (id !== 'x' && id !== 'y') applyScaleTheme(id);
  });
  return {
    ...config,
    options: {
      ...options,
      scales,
      plugins
    }
  };
}

function recreateChartWithTheme(component) {
  if (!component.$refs.chart || !component.value?.$chart) return;
  const canvas = component.$refs.chart;
  const Chart = typeof window !== 'undefined' && window.Chart;
  if (!Chart) return;
  const existing = Chart.getChart(canvas);
  if (existing) {
    try {
      existing.destroy();
    } catch (_) { /* ignore teardown errors */ }
  }
  component.chart = null;
  try {
    const config = applyThemeChartOptions(component.value.$chart);
    component.chart = new Chart(canvas, config);
  } catch (err) {
    console.warn('Dashboard chart recreate failed:', err);
  }
}

module.exports = app => app.component('dashboard-chart', {
  template: template,
  props: ['value', 'fullscreen'],
  emits: ['fullscreen'],
  data: () => ({
    chart: null,
    showDetailModal: false
  }),
  mounted() {
    const config = applyThemeChartOptions(this.value.$chart);
    this.chart = new Chart(this.$refs.chart, config);
    this._onStudioThemeChanged = () => recreateChartWithTheme(this);
    document.documentElement.addEventListener('studio-theme-changed', this._onStudioThemeChanged);
  },
  beforeUnmount() {
    document.documentElement.removeEventListener('studio-theme-changed', this._onStudioThemeChanged);
    const existing = typeof window !== 'undefined' && window.Chart && window.Chart.getChart(this.$refs.chart);
    if (existing) {
      try {
        existing.destroy();
      } catch (_) { /* ignore */ }
    }
    this.chart = null;
  },
  methods: {
    exportPNG() {
      if (this.chart == null) {
        return;
      }
      const dataUrl = this.chart.toBase64Image();
      const anchor = document.createElement('a');
      anchor.href = dataUrl;
      anchor.download = 'chart.png';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  },
  computed: {
    header() {
      if (this.value != null && this.value.$chart.header) {
        return this.value.$chart.header;
      }
      return null;
    },
    showControls() {
      return this.fullscreen !== undefined;
    }
  }
});
