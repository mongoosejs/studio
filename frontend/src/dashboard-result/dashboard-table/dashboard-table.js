/* global Blob, URL, document */
'use strict';

const template = require('./dashboard-table.html');

module.exports = app => app.component('dashboard-table', {
  template,
  props: ['value'],
  data() {
    return {
      showDropdown: false
    };
  },
  computed: {
    columns() {
      return Array.isArray(this.value?.$table?.columns) ? this.value.$table.columns : [];
    },
    rows() {
      return Array.isArray(this.value?.$table?.rows) ? this.value.$table.rows : [];
    },
    hasColumns() {
      return this.columns.length > 0;
    },
    hasRows() {
      return this.rows.length > 0;
    }
  },
  methods: {
    toggleDropdown() {
      this.showDropdown = !this.showDropdown;
    },
    handleBodyClick(event) {
      const dropdown = this.$refs.dropdown;
      if (dropdown && typeof dropdown.contains === 'function' && !dropdown.contains(event.target)) {
        this.showDropdown = false;
      }
    },
    neutralizeCsvCell(cell) {
      const value = this.displayValue(cell);
      return /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
    },
    escapeCsvCell(cell) {
      const escapedCell = this.neutralizeCsvCell(cell).replaceAll('"', '""');
      return `"${escapedCell}"`;
    },
    downloadCsv() {
      const header = this.columns.map(this.escapeCsvCell).join(',');
      const rows = this.rows
        .map(row => row.map(this.escapeCsvCell).join(','))
        .join('\n');

      const csv = [header, rows].filter(v => v.length > 0).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'table.csv';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      this.$toast.success('CSV downloaded!');
    },
    displayValue(cell) {
      if (cell == null) {
        return '';
      }
      if (typeof cell === 'object') {
        try {
          return JSON.stringify(cell);
        } catch (err) {
          return String(cell);
        }
      }
      return String(cell);
    }
  },
  mounted() {
    document.body.addEventListener('click', this.handleBodyClick);
  },
  unmounted() {
    document.body.removeEventListener('click', this.handleBodyClick);
  }
});
