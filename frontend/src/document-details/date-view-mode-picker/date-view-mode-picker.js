'use strict';

const template = require('./date-view-mode-picker.html');

module.exports = app => app.component('date-view-mode-picker', {
  template,
  props: ['viewMode', 'path'],
  emits: ['update:viewMode'],
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
    timezoneDatalistId() {
      return `timezone-options-${String(this.path?.path || '').replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    },
    timezones() {
      return Intl.supportedValuesOf('timeZone');
    }
  },
  methods: {
    onFormatChange(newFormat) {
      if (newFormat === 'custom_tz') {
        this.$emit('update:viewMode', { format: 'custom_tz', timezone: this.timezone });
      } else {
        this.$emit('update:viewMode', newFormat);
      }
    },
    onTimezoneChange(newTimezone) {
      this.$emit('update:viewMode', { format: 'custom_tz', timezone: newTimezone });
    }
  }
});
