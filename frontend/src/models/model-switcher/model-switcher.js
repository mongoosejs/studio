'use strict';

const template = require('./model-switcher.html');

module.exports = app => app.component('model-switcher', {
  template: template,
  props: ['show', 'models', 'recentlyViewedModels', 'modelDocumentCounts'],
  emits: ['close', 'select'],
  data: () => ({
    search: '',
    selectedIndex: 0
  }),
  mounted() {
    this.lastMouseMove = 0;
    this.trackLastMouseMove = () => {
      this.lastMouseMove = Date.now();
    };

    window.addEventListener('mousemove', this.trackLastMouseMove);
  },
  beforeUnmount() {
    window.removeEventListener('mousemove', this.trackLastMouseMove);
  },
  watch: {
    search() {
      this.selectedIndex = 0;
    },
    show(val) {
      if (val) {
        this.search = '';
        this.selectedIndex = 0;
        this.$nextTick(() => {
          if (this.$refs.searchInput) this.$refs.searchInput.focus();
        });
      }
    }
  },
  computed: {
    items() {
      const items = [];
      const search = this.search.trim().toLowerCase();
      const recent = (this.recentlyViewedModels || []).filter(m => this.models.includes(m));

      if (!search && recent.length > 0) {
        for (const model of recent) {
          items.push({ model, section: 'Recently Viewed' });
        }
      }

      const filtered = search
        ? this.models.filter(m => m.toLowerCase().includes(search))
        : this.models;

      for (const model of filtered) {
        items.push({ model, section: search ? 'Search Results' : 'All Models' });
      }

      return items;
    }
  },
  methods: {
    selectModel(model) {
      this.$emit('select', model);
    },
    onMouseEnter(index) {
      // If user hasn't moved mouse recently, then this event was likely triggered by scroll
      if (this.lastMouseMove <= Date.now() - 500) {
        return;
      }
      this.selectedIndex = index;
    },
    handleKeydown(event) {
      const items = this.items;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
        this.scrollSelectedIntoView();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.scrollSelectedIntoView();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (items.length > 0 && items[this.selectedIndex]) {
          this.selectModel(items[this.selectedIndex].model);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.$emit('close');
      }
    },
    scrollSelectedIntoView() {
      this.$nextTick(() => {
        const container = this.$refs.list;
        if (!container) return;
        const selected = container.querySelector('[data-selected="true"]');
        if (selected) selected.scrollIntoView({ block: 'nearest' });
      });
    },
    highlightMatch(model) {
      const search = this.search.trim();
      if (!search) return model;
      const idx = model.toLowerCase().indexOf(search.toLowerCase());
      if (idx === -1) return model;
      const before = model.slice(0, idx);
      const match = model.slice(idx, idx + search.length);
      const after = model.slice(idx + search.length);
      return `${before}<strong>${match}</strong>${after}`;
    },
    formatCompactCount(value) {
      if (typeof value !== 'number') return '—';
      if (value < 1000) return `${value}`;
      const formatValue = (number, suffix) => {
        const rounded = (Math.round(number * 10) / 10).toFixed(1).replace(/\.0$/, '');
        return `${rounded}${suffix}`;
      };
      if (value < 1000000) return formatValue(value / 1000, 'k');
      if (value < 1000000000) return formatValue(value / 1000000, 'M');
      return formatValue(value / 1000000000, 'B');
    }
  }
});
