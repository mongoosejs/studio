'use strict';

const template = require('./date-range-filter.html');

const MS_DAY = 24 * 60 * 60 * 1000;

function intFromNumberInput(v) {
  if (v === '' || v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))) {
    return NaN;
  }
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

/**
 * Anchor from typed parts interpreted as UTC (calendar + clock in Z).
 * The emitted filter uses toISOString(), so the numbers you type match that string (no local TZ shift).
 */
function utcDateFromParts(year, month, day, hour, minute) {
  const y = intFromNumberInput(year);
  const mo = intFromNumberInput(month);
  const d = intFromNumberInput(day);
  const h = intFromNumberInput(hour);
  const mi = intFromNumberInput(minute);
  if (![y, mo, d, h, mi].every(n => Number.isFinite(n))) {
    return null;
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h < 0 || h > 23 || mi < 0 || mi > 59) {
    return null;
  }
  const t = Date.UTC(y, mo - 1, d, h, mi, 0, 0);
  const dt = new Date(t);
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d ||
    dt.getUTCHours() !== h ||
    dt.getUTCMinutes() !== mi
  ) {
    return null;
  }
  return dt;
}

/** Replace the filter bar entirely with this single-field date criterion. */
function buildDateFilterSearchText(fieldPath, filterValueFragment) {
  const key = JSON.stringify(fieldPath);
  return `{ ${key}: ${filterValueFragment} }`;
}

function buildMongoDateRangeClause(start, end) {
  const a = start.toISOString();
  const b = end.toISOString();
  return `{ $gte: new Date(${JSON.stringify(a)}), $lt: new Date(${JSON.stringify(b)}) }`;
}

/** @param {'$gt' | '$lt'} op */
function buildMongoCompareClause(op, instant) {
  const iso = instant.toISOString();
  return `{ ${op}: new Date(${JSON.stringify(iso)}) }`;
}

function parseIso8601Like(raw) {
  if (typeof raw !== 'string') {
    return null;
  }
  const t = raw.trim();
  if (!t) {
    return null;
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function collectDatePathsFromSchema(schemaPaths) {
  if (!Array.isArray(schemaPaths)) {
    return [];
  }
  const out = [];
  for (const p of schemaPaths) {
    if (!p || typeof p.path !== 'string') {
      continue;
    }
    if (p.instance === 'Date') {
      out.push(p.path);
    }
    if (p.schema && typeof p.schema === 'object') {
      for (const subKey of Object.keys(p.schema)) {
        const sub = p.schema[subKey];
        if (sub && sub.instance === 'Date') {
          out.push(`${p.path}.${subKey}`);
        }
      }
    }
  }
  const scorePath = path => {
    const p = String(path).toLowerCase();
    if (p === 'createdat') {
      return 0;
    }
    if (p === 'updatedat') {
      return 1;
    }
    if (p.endsWith('.createdat')) {
      return 2;
    }
    if (p.endsWith('.updatedat')) {
      return 3;
    }
    return 10;
  };
  out.sort((a, b) => {
    const ds = scorePath(a) - scorePath(b);
    if (ds !== 0) {
      return ds;
    }
    return a.localeCompare(b);
  });
  return out;
}

module.exports = app => app.component('date-range-filter', {
  template,
  props: {
    schemaPaths: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      panelOpen: false,
      selectedPath: '',
      customPath: '',
      anchorYear: null,
      anchorMonth: null,
      anchorDay: null,
      anchorHour: null,
      anchorMinute: null,
      anchorSeededOnce: false,
      anchorIsoMode: false,
      isoAnchorInput: '',
      _onPointerDownOutside: null
    };
  },
  computed: {
    datePaths() {
      return collectDatePathsFromSchema(this.schemaPaths);
    },
    useCustomPath() {
      return this.datePaths.length === 0;
    },
    effectiveFieldPath() {
      if (this.useCustomPath) {
        return typeof this.customPath === 'string' ? this.customPath.trim() : '';
      }
      return typeof this.selectedPath === 'string' ? this.selectedPath.trim() : '';
    }
  },
  watch: {
    datePaths: {
      handler(paths) {
        if (paths.length === 0) {
          return;
        }
        if (!paths.includes(this.selectedPath)) {
          this.selectedPath = paths[0];
        }
      },
      immediate: true
    },
    schemaPaths() {
      if (this.datePaths.length > 0 && !this.selectedPath) {
        this.selectedPath = this.datePaths[0];
      }
    }
  },
  methods: {
    populateAnchorFromDate(dt) {
      this.anchorYear = dt.getUTCFullYear();
      this.anchorMonth = dt.getUTCMonth() + 1;
      this.anchorDay = dt.getUTCDate();
      this.anchorHour = dt.getUTCHours();
      this.anchorMinute = dt.getUTCMinutes();
    },
    onIsoAnchorPaste(ev) {
      const text = (ev.clipboardData && ev.clipboardData.getData('text/plain')) || '';
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }
      ev.preventDefault();
      this.isoAnchorInput = trimmed;
      const d = parseIso8601Like(trimmed);
      if (d) {
        this.populateAnchorFromDate(d);
        this.anchorSeededOnce = true;
      }
    },
    togglePanel(ev) {
      ev?.preventDefault?.();
      this.panelOpen = !this.panelOpen;
      if (this.panelOpen && !this.anchorSeededOnce) {
        this.populateAnchorFromDate(new Date());
        this.anchorSeededOnce = true;
      }
      this.attachOutsideListener();
    },
    closePanel() {
      this.panelOpen = false;
      this.detachOutsideListener();
    },
    attachOutsideListener() {
      this.detachOutsideListener();
      if (!this.panelOpen) {
        return;
      }
      this._onPointerDownOutside = ev => {
        const root = this.$refs.root;
        if (!root || root.contains(ev.target)) {
          return;
        }
        this.closePanel();
      };
      document.addEventListener('pointerdown', this._onPointerDownOutside, true);
    },
    detachOutsideListener() {
      if (this._onPointerDownOutside) {
        document.removeEventListener('pointerdown', this._onPointerDownOutside, true);
        this._onPointerDownOutside = null;
      }
    },
    resolveAnchorDate() {
      let dt = null;
      if (this.anchorIsoMode) {
        dt = parseIso8601Like(this.isoAnchorInput);
        if (!dt && this.$toast) {
          this.$toast.error('Could not parse ISO 8601. Example: 2026-05-08T14:30:00.000Z');
        }
      } else {
        dt = utcDateFromParts(
          this.anchorYear,
          this.anchorMonth,
          this.anchorDay,
          this.anchorHour,
          this.anchorMinute
        );
        if (!dt && this.$toast) {
          this.$toast.error('Enter a valid UTC date and time using the number fields.');
        }
      }
      return dt;
    },
    validateField() {
      if (!this.effectiveFieldPath) {
        if (this.$toast) {
          this.$toast.error('Choose or enter a date field path.');
        }
        return false;
      }
      return true;
    },
    syncNumbersFromResolvedAnchor(anchor) {
      if (this.anchorIsoMode && anchor) {
        this.populateAnchorFromDate(anchor);
      }
    },
    commitDateRange(start, end) {
      const clause = buildMongoDateRangeClause(start, end);
      const nextFilter = buildDateFilterSearchText(this.effectiveFieldPath, clause);
      this.$emit('apply', nextFilter);
      this.closePanel();
    },
    applyAnchorComparison(op) {
      if (op !== '$gt' && op !== '$lt') {
        return;
      }
      if (!this.validateField()) {
        return;
      }
      const anchor = this.resolveAnchorDate();
      if (!anchor) {
        return;
      }
      this.syncNumbersFromResolvedAnchor(anchor);
      const clause = buildMongoCompareClause(op, anchor);
      const nextFilter = buildDateFilterSearchText(this.effectiveFieldPath, clause);
      this.$emit('apply', nextFilter);
      this.closePanel();
    },
    presetRangeNextDays(days) {
      if (!this.validateField()) {
        return;
      }
      const anchor = this.resolveAnchorDate();
      if (!anchor) {
        return;
      }
      this.syncNumbersFromResolvedAnchor(anchor);
      const start = anchor;
      const end = new Date(anchor.getTime() + days * MS_DAY);
      this.commitDateRange(start, end);
    },
    presetRangePreviousDays(days) {
      if (!this.validateField()) {
        return;
      }
      const anchor = this.resolveAnchorDate();
      if (!anchor) {
        return;
      }
      this.syncNumbersFromResolvedAnchor(anchor);
      const start = new Date(anchor.getTime() - days * MS_DAY);
      const end = anchor;
      this.commitDateRange(start, end);
    },
    presetRangeNextWeeks(weeks) {
      this.presetRangeNextDays(weeks * 7);
    },
    presetRangePreviousWeeks(weeks) {
      this.presetRangePreviousDays(weeks * 7);
    }
  },
  beforeUnmount() {
    this.detachOutsideListener();
  }
});
