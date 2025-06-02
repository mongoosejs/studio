'use strict';

if (typeof process === 'undefined') {
  global.process = { env: {} }; // To make `util` package work
}

const api = require('./api');
const mothership = require('./mothership');
const vanillatoasts = require('vanillatoasts');

const app = Vue.createApp({
  template: '<app-component />'
});

require('./async-button/async-button')(app);
require('./clone-document/clone-document')(app);
require('./create-dashboard/create-dashboard')(app);
require('./create-document/create-document')(app);
require('./dashboards/dashboards')(app);
require('./dashboard/dashboard')(app);
require('./dashboard-result/dashboard-result')(app);
require('./dashboard-result/dashboard-chart/dashboard-chart')(app);
require('./dashboard-result/dashboard-document/dashboard-document')(app);
require('./dashboard-result/dashboard-primitive/dashboard-primitive')(app);
require('./dashboard-result/dashboard-text/dashboard-text')(app);
require('./dashboard/edit-dashboard/edit-dashboard')(app)
require('./detail-array/detail-array')(app);
require('./detail-default/detail-default')(app);
require('./document/document')(app);
require('./document/confirm-changes/confirm-changes')(app);
require('./document/confirm-delete/confirm-delete')(app);
require('./document-details/document-details')(app);
require('./document-details/document-property/document-property')(app);
require('./edit-array/edit-array')(app);
require('./edit-default/edit-default')(app);
require('./edit-number/edit-number')(app);
require('./edit-date/edit-date')(app);
require('./edit-subdocument/edit-subdocument')(app);
require('./export-query-results/export-query-results')(app);
require('./list-array/list-array')(app);
require('./list-default/list-default')(app);
require('./list-json/list-json')(app)
require('./list-mixed/list-mixed')(app);
require('./list-string/list-string')(app);
require('./list-subdocument/list-subdocument')(app);
require('./modal/modal')(app);
require('./models/models')(app);
require('./navbar/navbar')(app);
require('./splash/splash')(app);
require('./team/team')(app);
require('./team/new-invitation/new-invitation')(app);
require('./update-document/update-document')(app);

app.component('app-component', {
  template: `
  <div>
    <div v-if="hasAPIKey && (user == null || status === 'init')">
      <splash :loading="status === 'init'" />
    </div>
    <div v-else-if="!hasAPIKey || user">
      <navbar :user="user" :roles="roles" />
      <div class="view">
        <router-view :key="$route.fullPath" :user="user" :roles="roles" :hasAPIKey="hasAPIKey" />
      </div>
    </div>
  </div>
  `,
  errorCaptured(err) {
    vanillatoasts.create({
      title: `Error: ${err?.response?.data?.message || err.message}`,
      icon: 'images/failure.jpg',
      timeout: 10000,
      positionClass: 'bottomRight'
    });
  },
  computed: {
    hasAPIKey() {
      return mothership.hasAPIKey;
    }
  },
  async mounted() {
    window.$router = this.$router;
    window.state = this;

    if (mothership.hasAPIKey) {
      const href = window.location.href;
      if (href.match(/\?code=([a-zA-Z0-9]+)$/)) {
        const code = href.match(/\?code=([a-zA-Z0-9]+)$/)[1];
        try {
          const { accessToken, user, roles } = await mothership.github(code);
          if (roles == null) {
            this.authError = 'You are not authorized to access this workspace';
            return;
          }
          this.user = user;
          this.roles = roles;
          window.localStorage.setItem('_mongooseStudioAccessToken', accessToken._id);
        } catch (err) {
          this.authError = 'An error occurred while logging in. Please try again.';
          this.status = 'loaded';
          return;
        } finally {
          setTimeout(() => {
            this.$router.replace(this.$router.currentRoute.value.path);
          }, 0);
        }

        const { nodeEnv } = await api.status();
        this.nodeEnv = nodeEnv;
      } else {
        const token = window.localStorage.getItem('_mongooseStudioAccessToken');
        if (token) {
          const { user, roles } = await mothership.me();
          this.user = user;
          this.roles = roles;

          const { nodeEnv } = await api.status();
          this.nodeEnv = nodeEnv;
        }
      }
    } else {
      const { nodeEnv } = await api.status();
      this.nodeEnv = nodeEnv;
    }
    this.status = 'loaded';
  },
  setup() {
    const user = Vue.ref(null);
    const roles = Vue.ref(null);
    const status = Vue.ref('init');
    const nodeEnv = Vue.ref(null);
    const authError = Vue.ref(null);

    const state = Vue.reactive({ user, roles, status, nodeEnv, authError });
    Vue.provide('state', state);

    return state;
  }
});

const { routes } = require('./routes');
const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes: routes.map(route => ({
    ...route,
    component: app.component(route.component),
    props: (route) => route.params
  }))
});

app.use(router);

app.mount('#content');
