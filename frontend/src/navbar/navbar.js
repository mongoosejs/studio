'use strict';

const api = require('../api');
const mothership = require('../mothership');
const template = require('./navbar.html');
const { routes, hasAccess } = require('../routes');

const appendCSS = require('../appendCSS');

appendCSS(require('./navbar.css'));

module.exports = app => app.component('navbar', {
  template: template,
  props: ['user', 'roles'],
  inject: ['state'],
  data: () => ({
    showFlyout: false,
    darkMode: typeof localStorage !== 'undefined' && localStorage.getItem('studio-theme') === 'dark'
  }),
  mounted: function () {
    window.navbar = this;
    const mobileMenuMask = document.querySelector('#mobile-menu-mask');
    const mobileMenu = document.querySelector('#mobile-menu');
    const openBtn = document.querySelector('#open-mobile-menu');

    if (openBtn && mobileMenuMask && mobileMenu) {
      openBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        mobileMenuMask.style.display = 'block';
        mobileMenu.classList.remove('translate-x-full');
        mobileMenu.classList.add('translate-x-0');
      });

      document.querySelector('body').addEventListener('click', () => {
        mobileMenuMask.style.display = 'none';
        mobileMenu.classList.remove('translate-x-0');
        mobileMenu.classList.add('translate-x-full');
      });
    }
  },
  computed: {
    dashboardView() {
      return routes.filter(x => x.name.startsWith('dashboard')).map(x => x.name).includes(this.$route.name);
    },
    documentView() {
      return ['root', 'model', 'document'].includes(this.$route.name);
    },
    chatView() {
      return ['chat index', 'chat'].includes(this.$route.name);
    },
    taskView() {
      return ['tasks', 'taskByName', 'taskSingle'].includes(this.$route.name);
    },
    routeName() {
      return this.$route.name;
    },
    warnEnv() {
      return this.state.nodeEnv === 'prod' || this.state.nodeEnv === 'production';
    },
    hasAPIKey() {
      return mothership.hasAPIKey;
    },
    canViewTeam() {
      return this.hasAccess(this.roles, 'team');
    },
    defaultRoute() {
      return this.roles && this.roles[0] === 'dashboards' ? 'dashboards' : 'root';
    },
    hasTaskVisualizer() {
      if (window.MONGOOSE_STUDIO_CONFIG.enableTaskVisualizer) {
        return '#/tasks';
      } else {
        return 'https://www.npmjs.com/package/@mongoosejs/task';
      }

    }
  },
  methods: {
    hasAccess(roles, routeName) {
      return hasAccess(roles, routeName);
    },
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
    toggleDarkMode() {
      this.darkMode = !this.darkMode;
      const theme = this.darkMode ? 'dark' : 'light';
      window.localStorage.setItem('studio-theme', theme);
      if (this.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', this.darkMode ? '#0f0f0f' : '#ffffff');
      document.documentElement.dispatchEvent(new CustomEvent('studio-theme-changed', { detail: { dark: this.darkMode } }));
    }
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
