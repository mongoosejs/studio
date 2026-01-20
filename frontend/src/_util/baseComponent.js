'use strict';

module.exports = {
  destroyed() {
    this.$parent.$options.$children = this.$parent.$options.$children.filter(
      (el) => el !== this
    );
  },
  created() {
    this.$parent.$options.$children = this.$parent.$options.$children || [];
    this.$parent.$options.$children.push(this);
  },
  mounted() {
    this.isMounted = true;
  },
  unmounted() {
    this.isMounted = false;
  }
};
