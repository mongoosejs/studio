'use strict';

const api = require('../api');
const template = require('./navbar.html');

const appendCSS = require('../appendCSS');

appendCSS(require('./navbar.css'));

module.exports = app => app.component('navbar', {
  template: template,
  data: () => ({ nodeEnv: null }),
  computed: {
    routeName() {
      return this.$route.name;
    },
    warnEnv() {
      return this.nodeEnv === 'prod' || this.nodeEnv === 'production';
    }
  },
  async mounted() {
    const { nodeEnv } = await api.status();
    console.log('AG', nodeEnv);
    this.nodeEnv = nodeEnv;
  }
});
