'use strict';

const template = require('./tooltip.html');

let nextTooltipId = 0;

module.exports = app => app.component('tooltip', {
  props: {
    text: {
      type: String,
      required: true
    }
  },
  template,
  data() {
    return {
      isOpen: false,
      isPinned: false,
      placement: 'bottom',
      tooltipId: `tooltip-${++nextTooltipId}`,
      tooltipStyle: {
        visibility: 'hidden'
      }
    };
  },
  mounted() {
    document.addEventListener('click', this.handleOutsideClick);
    window.addEventListener('resize', this.updatePosition);
    window.addEventListener('scroll', this.updatePosition, true);
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleOutsideClick);
    window.removeEventListener('resize', this.updatePosition);
    window.removeEventListener('scroll', this.updatePosition, true);
  },
  methods: {
    show() {
      this.isOpen = true;
      this.tooltipStyle = { visibility: 'hidden' };
      this.$nextTick(this.updatePosition);
    },
    hide() {
      this.isOpen = false;
      this.isPinned = false;
    },
    hideUnlessPinned() {
      if (!this.isPinned) {
        this.isOpen = false;
      }
    },
    toggle() {
      if (this.isPinned) {
        this.hide();
        return;
      }

      this.isPinned = true;
      this.show();
    },
    handleFocusOut(event) {
      if (!this.$el.contains(event.relatedTarget)) {
        this.hideUnlessPinned();
      }
    },
    handleOutsideClick(event) {
      if (!this.$el.contains(event.target)) {
        this.hide();
      }
    },
    updatePosition() {
      if (!this.isOpen || !this.$refs.trigger || !this.$refs.tooltip) {
        return;
      }

      const gap = 8;
      const viewportPadding = 8;
      const triggerRect = this.$refs.trigger.getBoundingClientRect();
      const tooltipRect = this.$refs.tooltip.getBoundingClientRect();
      const fitsBelow = triggerRect.bottom + gap + tooltipRect.height <= window.innerHeight - viewportPadding;
      const top = fitsBelow ?
        triggerRect.bottom + gap :
        Math.max(viewportPadding, triggerRect.top - gap - tooltipRect.height);
      const centeredLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
      const maxLeft = Math.max(viewportPadding, window.innerWidth - tooltipRect.width - viewportPadding);
      const left = Math.min(Math.max(viewportPadding, centeredLeft), maxLeft);

      this.placement = fitsBelow ? 'bottom' : 'top';
      this.tooltipStyle = {
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`
      };
    }
  }
});
