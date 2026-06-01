'use strict';

const template = require('./custom-date-picker.html');
const {
  dateToDatetimeLocal,
  dateToDateOnly,
  parseValueToDate,
  buildCalendarDays,
  clampInt,
  isSameDay,
  WEEKDAY_LABELS,
  MONTH_LABELS
} = require('../_util/calendar');

function timePartsFromDate(date) {
  if (!date) {
    return { hour: 0, minute: 0, second: 0, millisecond: 0 };
  }
  return {
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
    millisecond: date.getMilliseconds()
  };
}

module.exports = app => app.component('custom-date-picker', {
  template,
  props: {
    value: {
      default: null
    },
    mode: {
      type: String,
      default: 'datetime' // 'date' | 'datetime'
    },
    compact: {
      type: Boolean,
      default: false
    },
    mini: {
      type: Boolean,
      default: false
    },
    immediate: {
      type: Boolean,
      default: true
    }
  },
  emits: ['input', 'commit'],
  data() {
    const selected = parseValueToDate(this.value);
    const anchor = selected || new Date();
    const time = timePartsFromDate(selected);
    return {
      viewYear: anchor.getFullYear(),
      viewMonth: anchor.getMonth(),
      selectedDate: selected,
      hour: time.hour,
      minute: time.minute,
      second: time.second,
      millisecond: time.millisecond,
      pendingValue: null
    };
  },
  watch: {
    value() {
      this.syncFromValue();
    }
  },
  computed: {
    weekdayLabels() {
      return WEEKDAY_LABELS;
    },
    monthLabel() {
      return `${MONTH_LABELS[this.viewMonth]} ${this.viewYear}`;
    },
    calendarDays() {
      return buildCalendarDays(this.viewYear, this.viewMonth);
    },
    today() {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    },
    showTime() {
      return this.mode === 'datetime';
    },
    timeInputClass() {
      return [
        'w-10 min-w-0 rounded border border-edge-strong bg-surface px-0.5 font-mono text-center outline-edge-strong focus:ring-1 focus:ring-primary-subtle',
        this.mini ? 'h-6 text-[10px]' : 'h-8 text-sm'
      ];
    }
  },
  methods: {
    syncFromValue() {
      const selected = parseValueToDate(this.value);
      this.selectedDate = selected;
      if (selected) {
        this.viewYear = selected.getFullYear();
        this.viewMonth = selected.getMonth();
        const time = timePartsFromDate(selected);
        this.hour = time.hour;
        this.minute = time.minute;
        this.second = time.second;
        this.millisecond = time.millisecond;
      }
    },
    clampedTimeParts() {
      return {
        hour: clampInt(this.hour, 0, 23),
        minute: clampInt(this.minute, 0, 59),
        second: clampInt(this.second, 0, 59),
        millisecond: clampInt(this.millisecond, 0, 999)
      };
    },
    dayClasses(day) {
      const selected = this.selectedDate;
      const isSelected = selected && isSameDay(day.date, selected);
      const isToday = isSameDay(day.date, this.today);
      return {
        'text-content-tertiary': !day.inMonth,
        'bg-teal-600 text-white hover:bg-teal-700': isSelected,
        'hover:bg-surface-hover': day.inMonth && !isSelected,
        'ring-1 ring-teal-600 ring-inset': isToday && !isSelected && day.inMonth,
        'font-medium': day.inMonth
      };
    },
    prevMonth() {
      if (this.viewMonth === 0) {
        this.viewMonth = 11;
        this.viewYear -= 1;
      } else {
        this.viewMonth -= 1;
      }
    },
    nextMonth() {
      if (this.viewMonth === 11) {
        this.viewMonth = 0;
        this.viewYear += 1;
      } else {
        this.viewMonth += 1;
      }
    },
    goToToday() {
      const now = new Date();
      this.viewYear = now.getFullYear();
      this.viewMonth = now.getMonth();
      this.selectDay({
        date: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        inMonth: true
      });
    },
    selectDay(day) {
      const { hour, minute, second, millisecond } = this.clampedTimeParts();
      const next = new Date(day.date);
      if (this.showTime) {
        next.setHours(hour, minute, second, millisecond);
      } else {
        next.setHours(0, 0, 0, 0);
      }
      this.selectedDate = next;
      if (!day.inMonth) {
        this.viewYear = next.getFullYear();
        this.viewMonth = next.getMonth();
      }
      this.emitValue(next);
    },
    applyTimeToSelection() {
      const { hour, minute, second, millisecond } = this.clampedTimeParts();
      this.hour = hour;
      this.minute = minute;
      this.second = second;
      this.millisecond = millisecond;

      if (!this.selectedDate) {
        const now = new Date();
        this.selectedDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          hour,
          minute,
          second,
          millisecond
        );
        this.viewYear = this.selectedDate.getFullYear();
        this.viewMonth = this.selectedDate.getMonth();
      } else {
        this.selectedDate = new Date(
          this.selectedDate.getFullYear(),
          this.selectedDate.getMonth(),
          this.selectedDate.getDate(),
          hour,
          minute,
          second,
          millisecond
        );
      }
      this.emitValue(this.selectedDate);
    },
    valuePayload(date) {
      if (this.mode === 'date') {
        return dateToDateOnly(date);
      }
      return dateToDatetimeLocal(date);
    },
    emitValue(date) {
      const payload = this.valuePayload(date);
      if (!this.immediate) {
        this.pendingValue = payload;
        return;
      }
      this.$emit('input', payload);
    },
    commit() {
      const payload = this.pendingValue != null
        ? this.pendingValue
        : (this.selectedDate ? this.valuePayload(this.selectedDate) : null);
      if (payload == null) {
        return;
      }
      this.$emit('commit', payload);
      this.pendingValue = null;
    },
    isSelectedDay(day) {
      return this.selectedDate && isSameDay(day.date, this.selectedDate);
    }
  }
});
