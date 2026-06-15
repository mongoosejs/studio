'use strict';

const template = require('./custom-date-picker.html');
const {
  dateToDatetimeLocal,
  dateToDateOnly,
  parseValueToDate,
  buildCalendarDays,
  clampInt,
  isSameDay,
  pad2,
  WEEKDAY_LABELS,
  MONTH_LABELS
} = require('../_util/calendar');

const WHEEL_PAD = 2;
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);
const SECOND_OPTIONS = Array.from({ length: 60 }, (_, i) => i);

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
    },
    horizontal: {
      type: Boolean,
      default: false
    },
    embedded: {
      type: Boolean,
      default: false
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
      pendingValue: null,
      wheelScrollLock: false,
      timeApplyTimer: null,
      hourOptions: HOUR_OPTIONS,
      minuteOptions: MINUTE_OPTIONS,
      secondOptions: SECOND_OPTIONS
    };
  },
  watch: {
    value() {
      this.syncFromValue();
    },
    horizontal() {
      this.$nextTick(() => this.scrollWheelsToValues());
    }
  },
  computed: {
    rootClasses() {
      const sizeClass = this.mini
        ? 'p-0.5 text-[10px]'
        : (this.compact ? 'p-2 text-xs' : 'p-3 text-sm');
      const chromeClass = this.embedded
        ? ''
        : (this.mini ? '' : 'bg-surface border border-edge-strong rounded-md shadow-sm');
      return [sizeClass, chromeClass];
    },
    timeSectionClasses() {
      if (this.horizontal) {
        return 'flex-1 min-w-0 border-l border-edge-strong pl-2';
      }
      return [
        'border-t border-edge-strong',
        this.mini ? 'mt-1 pt-1' : 'mt-3 pt-3'
      ];
    },
    wheelPadCount() {
      return this.horizontal ? 1 : WHEEL_PAD;
    },
    wheelVisibleRows() {
      return this.horizontal ? 3 : 5;
    },
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
    dayCellClass() {
      if (this.mini) {
        return 'h-6';
      }
      if (this.compact) {
        return 'h-7';
      }
      return 'aspect-square';
    },
    wheelItemPx() {
      if (this.mini) {
        return 32;
      }
      if (this.compact) {
        return 36;
      }
      return 40;
    },
    wheelListClass() {
      return [
        'overflow-y-auto overscroll-y-contain snap-y snap-mandatory',
        '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      ];
    },
    wheelListStyle() {
      return {
        height: `${this.wheelItemPx * this.wheelVisibleRows}px`
      };
    },
    wheelItemClass() {
      return [
        'snap-center shrink-0 w-full flex items-center justify-center font-mono transition-colors',
        this.mini ? 'h-8 text-sm' : (this.compact ? 'h-9 text-sm' : 'h-10 text-base')
      ];
    },
    wheelHighlightClass() {
      return this.mini ? 'h-8' : (this.compact ? 'h-9' : 'h-10');
    },
    wheelColumnClass() {
      return this.mini ? 'w-11' : (this.compact ? 'w-12' : 'w-14');
    }
  },
  mounted() {
    this.$nextTick(() => this.scrollWheelsToValues());
  },
  beforeUnmount() {
    if (this.timeApplyTimer) {
      clearTimeout(this.timeApplyTimer);
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
      this.$nextTick(() => this.scrollWheelsToValues());
    },
    clampedTimeParts() {
      return {
        hour: clampInt(this.hour, 0, 23),
        minute: clampInt(this.minute, 0, 59),
        second: clampInt(this.second, 0, 59),
        millisecond: clampInt(this.millisecond, 0, 999)
      };
    },
    formatWheelValue(value) {
      return pad2(value);
    },
    wheelItemClasses(value, selectedValue) {
      return value === selectedValue
        ? 'text-content-primary font-semibold'
        : 'text-content-tertiary hover:text-content-secondary';
    },
    wheelIndexFromScroll(el, max) {
      return clampInt(Math.round(el.scrollTop / this.wheelItemPx), 0, max);
    },
    scrollWheelTo(el, index) {
      if (!el) {
        return;
      }
      el.scrollTop = index * this.wheelItemPx;
    },
    scrollWheelsToValues() {
      this.wheelScrollLock = true;
      this.scrollWheelTo(this.$refs.hourWheel, this.hour);
      this.scrollWheelTo(this.$refs.minuteWheel, this.minute);
      this.scrollWheelTo(this.$refs.secondWheel, this.second);
      requestAnimationFrame(() => {
        this.wheelScrollLock = false;
      });
    },
    scheduleTimeApply() {
      if (this.timeApplyTimer) {
        clearTimeout(this.timeApplyTimer);
      }
      this.timeApplyTimer = setTimeout(() => {
        this.timeApplyTimer = null;
        this.applyTimeToSelection();
      }, 120);
    },
    onHourWheelScroll(event) {
      if (this.wheelScrollLock) {
        return;
      }
      const hour = this.wheelIndexFromScroll(event.target, 23);
      if (hour === this.hour) {
        return;
      }
      this.hour = hour;
      this.scheduleTimeApply();
    },
    onMinuteWheelScroll(event) {
      if (this.wheelScrollLock) {
        return;
      }
      const minute = this.wheelIndexFromScroll(event.target, 59);
      if (minute === this.minute) {
        return;
      }
      this.minute = minute;
      this.scheduleTimeApply();
    },
    onSecondWheelScroll(event) {
      if (this.wheelScrollLock) {
        return;
      }
      const second = this.wheelIndexFromScroll(event.target, 59);
      if (second === this.second) {
        return;
      }
      this.second = second;
      this.scheduleTimeApply();
    },
    selectHour(hour) {
      this.hour = hour;
      this.scrollWheelTo(this.$refs.hourWheel, hour);
      this.applyTimeToSelection();
    },
    selectMinute(minute) {
      this.minute = minute;
      this.scrollWheelTo(this.$refs.minuteWheel, minute);
      this.applyTimeToSelection();
    },
    selectSecond(second) {
      this.second = second;
      this.scrollWheelTo(this.$refs.secondWheel, second);
      this.applyTimeToSelection();
    },
    dayClasses(day) {
      const selected = this.selectedDate;
      const isSelected = selected && isSameDay(day.date, selected);
      const isToday = isSameDay(day.date, this.today);
      return {
        'text-content-tertiary': !day.inMonth,
        'bg-merlot-700 text-white hover:bg-merlot-800': isSelected,
        'hover:bg-surface-hover': day.inMonth && !isSelected,
        'ring-1 ring-merlot-700 ring-inset': isToday && !isSelected && day.inMonth,
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
