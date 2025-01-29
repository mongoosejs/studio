'use strict';

const api = require('../api');
const mothership = require('../mothership');
const template = require('./navbar.html');

const appendCSS = require('../appendCSS');

appendCSS(require('./navbar.css'));

module.exports = app => app.component('navbar', {
  template: template,
  props: ['user'],
  data: () => ({ nodeEnv: null, showFlyout: false }),
  computed: {
    routeName() {
      return this.$route.name;
    },
    warnEnv() {
      return this.nodeEnv === 'prod' || this.nodeEnv === 'production';
    },
    hasAPIKey() {
      return mothership.hasAPIKey;
    }
  },
  async mounted() {
    const { nodeEnv } = await api.status();
    this.nodeEnv = nodeEnv;
  },
  methods: {
    async loginWithGithub() {
      const { url } = await mothership.githubLogin();
      window.location.href = url;
    },
    hideFlyout() {
      this.showFlyout = false;
    },
    logout() {
      window.localStorage.setItem('_mongooseStudioAccessToken', '');
      window.location.reload();
    },
  },
  directives: {
    clickOutside: {
      beforeMount(el, binding, vnode) {
        el.clickOutsideEvent = (event) => {
          let isOutside = true;
          if (event.target === el || el.contains(event.target)) {
            isOutside = false;
          }
          if (isOutside) {
            binding.value.call();
          }
        };
        document.body.addEventListener('click', el.clickOutsideEvent);
      },
      unmounted(el) {
        document.body.removeEventListener('click', el.clickOutsideEvent);
      }
    }
  }
});
