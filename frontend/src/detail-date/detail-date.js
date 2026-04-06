'use strict';

const template = require('./detail-date.html');

module.exports = app => app.component('detail-date', {
  template,
  props: ['value', 'viewMode'],
  computed: {
    format() {
      if (this.viewMode != null && typeof this.viewMode === 'object') {
        return this.viewMode.format;
      }
      return this.viewMode;
    },
    timezone() {
      if (this.viewMode != null && typeof this.viewMode === 'object') {
        return this.viewMode.timezone || '';
      }
      return '';
    },
    parsedDate() {
      if (this.value == null) {
        return null;
      }
      const date = new Date(this.value);
      return Number.isNaN(date.getTime()) ? null : date;
    },
    displayValue() {
      if (this.value == null) {
        return String(this.value);
      }
      if (!this.parsedDate) {
        return 'Invalid Date';
      }
      return this.formatDateForDisplay(this.parsedDate);
    }
  },
  methods: {
    formatDateForDisplay(date) {
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return 'Invalid Date';
      }

      if (this.format === 'utc_iso') {
        return date.toISOString();
      }

      if (this.format === 'local_browser') {
        return date.toLocaleString();
      }

      if (this.format === 'unix_ms') {
        return String(date.getTime());
      }

      if (this.format === 'unix_seconds') {
        return String(Math.floor(date.getTime() / 1000));
      }

      if (this.format === 'duration_relative') {
        return this.formatRelativeDuration(date);
      }

      if (this.format === 'custom_tz') {
        return this.formatCustomTimezone(date);
      }

      return date.toISOString();
    },
    formatRelativeDuration(date) {
      const diffMs = date.getTime() - Date.now();
      const absMs = Math.abs(diffMs);
      const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
      const units = [
        { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
        { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
        { unit: 'day', ms: 24 * 60 * 60 * 1000 },
        { unit: 'hour', ms: 60 * 60 * 1000 },
        { unit: 'minute', ms: 60 * 1000 },
        { unit: 'second', ms: 1000 }
      ];

      for (const { unit, ms } of units) {
        if (absMs >= ms || unit === 'second') {
          const value = Math.round(diffMs / ms);
          return rtf.format(value, unit);
        }
      }

      return 'now';
    },
    formatCustomTimezone(date) {
      const tz = (this.timezone || '').trim();
      if (!tz) {
        return `${date.toISOString()} (enter an IANA timezone)`;
      }

      try {
        return new Intl.DateTimeFormat(undefined, {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short'
        }).format(date);
      } catch (err) {
        return `Invalid timezone: ${tz}`;
      }
    }
  }
});
