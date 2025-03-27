'use strict';

const api = require('../api');
const mothership = require('../mothership');
const template = require('./navbar.html');
const routes = require('../routes');

const appendCSS = require('../appendCSS');

appendCSS(require('./navbar.css'));

module.exports = app => app.component('navbar', {
  template: template,
  props: ['user', 'roles'],
  inject: ['state'],
  data: () => ({ showFlyout: false }),
  mounted: function() {
    console.log('user', this.user, 'roles', this.roles, 'state', this.state);
    // Redirect to first allowed route if current route is not allowed
    if (!this.hasAccess(this.roles, this.$route.name)) {
      const firstAllowedRoute = this.allowedRoutes[0];
      if (firstAllowedRoute) {
        this.$router.push({ name: firstAllowedRoute.name });
      }
    }
  },
  computed: {
    dashboardView() {
      return routes.routes.filter(x => x.name.startsWith('dashboard')).map(x => x.name).includes(this.$route.name)
    },
    documentView() {
      return ['root', 'model', 'document'].includes(this.$route.name);
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
    allowedRoutes() {
      return routes.routes.filter(route => this.hasAccess(this.roles, route.name));
    },
    defaultRoute() {
      return this.allowedRoutes[0]?.name || 'dashboards';
    }
  },
  methods: {
    hasAccess(roles, routeName) {
      return routes.hasAccess(roles, routeName);
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
