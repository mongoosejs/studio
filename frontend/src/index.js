'use strict';

if (typeof process === 'undefined') {
  global.process = { env: {} }; // To make `util` package work
}

const { version } = require('../../package.json');
console.log(`Mongoose Studio Version ${version}`);

const api = require('./api');
const mothership = require('./mothership');
const { routes } = require('./routes');
const vanillatoasts = require('vanillatoasts');

const app = Vue.createApp({
  template: '<app-component />'
});

// Import all components
const requireComponents = require.context(
  '.', // Relative path (current directory)
  true // Include subdirectories
);
// Object to store the imported modules
const components = {};
// Iterate over the matched keys (file paths)
requireComponents.keys().forEach((filePath) => {
  // Extract directory name and file name from the path
  const pieces = filePath.split('/');
  const directoryName = pieces[pieces.length - 2];
  const fileName = pieces[pieces.length - 1].replace('.js', '');

  // Check if the file name matches the directory name
  if (directoryName === fileName) {
    components[directoryName] = requireComponents(filePath);
    components[directoryName](app);
  }
});

console.log('Loaded components', Object.keys(components).sort());

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
      const hash = window.location.hash.replace(/^#?\/?/, '') || '';
      const hashQuery = hash.split('?')[1] || '';
      const hashParams = new URLSearchParams(hashQuery);
      if (hashParams.has('code')) {
        const code = hashParams.get('code');
        const provider = hashParams.get('provider');
        try {
          const { accessToken, user, roles } = provider === 'github' ? await mothership.github(code) : await mothership.google(code);
          if (roles == null) {
            this.authError = 'You are not authorized to access this workspace';
            this.status = 'loaded';
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

const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes: routes.map(route => ({
    ...route,
    component: app.component(route.component),
    props: (route) => route.params
  }))
});

router.beforeEach((to, from, next) => {
  if (to.name === 'root' && window.state.roles && window.state.roles[0] === 'dashboards') {
    return next({ name: 'dashboards' });
  } else {
    next();
  }
});

app.use(router);

app.mount('#content');
