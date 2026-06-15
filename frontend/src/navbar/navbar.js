'use strict';

const mothership = require('../mothership');
const template = require('./navbar.html');
const { routes, hasAccess } = require('../routes');
const {
  RECENT_PAGES_STORAGE_KEY,
  RECENT_PAGES_CHANGED_EVENT,
  safeReadRecentPages,
  saveRecentPages,
  withRecentPagesStorageLock
} = require('../_util/recent-pages-history');

const appendCSS = require('../appendCSS');

appendCSS(require('./navbar.css'));

module.exports = app => app.component('navbar', {
  template: template,
  props: ['user', 'roles'],
  inject: ['state'],
  data: () => ({
    showFlyout: false,
    darkMode: typeof localStorage !== 'undefined' && localStorage.getItem('studio-theme') === 'dark',
    showRecentPagesModal: false,
    localRecentPages: []
  }),
  mounted: function() {
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

    this.localRecentPages = safeReadRecentPages();

    this._syncRecentPagesFromOtherTab = ev => {
      if (ev.storageArea !== window.localStorage || ev.key !== RECENT_PAGES_STORAGE_KEY) {
        return;
      }
      this.refreshRecentPagesFromStorage();
    };
    this._syncRecentPagesFromBroadcast = () => this.refreshRecentPagesFromStorage();

    window.addEventListener('storage', this._syncRecentPagesFromOtherTab);
    window.addEventListener(RECENT_PAGES_CHANGED_EVENT, this._syncRecentPagesFromBroadcast);
  },
  beforeUnmount() {
    if (this._syncRecentPagesFromOtherTab) {
      window.removeEventListener('storage', this._syncRecentPagesFromOtherTab);
    }
    if (this._syncRecentPagesFromBroadcast) {
      window.removeEventListener(RECENT_PAGES_CHANGED_EVENT, this._syncRecentPagesFromBroadcast);
    }
  },
  watch: {
    '$route.fullPath'() {
      this.refreshRecentPagesFromStorage();
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
      return !!window.MONGOOSE_STUDIO_CONFIG.enableTaskVisualizer;
    },
    recentPagesList() {
      return this.localRecentPages;
    },
    supportsAI() {
      return this.state.capabilities == null || this.state.capabilities.supportsAI !== false;
    },
    chatDisabledReason() {
      return 'Chat requires an Anthropic, Gemini, or OpenAI API key.';
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
    },
    refreshRecentPagesFromStorage() {
      this.localRecentPages = safeReadRecentPages();
    },
    openRecentPagesModal() {
      this.showRecentPagesModal = true;
      this.refreshRecentPagesFromStorage();
    },
    closeRecentPagesModal() {
      this.showRecentPagesModal = false;
    },
    clearRecentPagesHistory() {
      this.localRecentPages = [];
      void withRecentPagesStorageLock(() => saveRecentPages([]));
    },
    goToRecentPage(entry) {
      if (!entry || !entry.path) {
        return;
      }
      this.showRecentPagesModal = false;
      if (entry.path === this.$route.fullPath) {
        return;
      }
      this.$router.push(entry.path);
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
