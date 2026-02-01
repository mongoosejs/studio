'use strict';

if (typeof process === 'undefined') {
  global.process = { env: {} }; // To make `util` package work
}

const { version } = require('../../package.json');
console.log(`Mongoose Studio Version ${version}`);

const api = require('./api');
const format = require('./format');
const arrayUtils = require('./array-utils');
const mothership = require('./mothership');
const { routes } = require('./routes');
const Toast = require('vue-toastification').default;
const { useToast } = require('vue-toastification');
const appendCSS = require('./appendCSS');
appendCSS(require('vue-toastification/dist/index.css'));

const app = Vue.createApp({
  template: '<app-component />'
});

// https://github.com/Maronato/vue-toastification/tree/main?tab=readme-ov-file#toast-types
app.use(Toast, { position: 'bottom-right', timeout: 3000 });

// Create a global toast instance for convenience (must be after app.use)
const toast = useToast();

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
    if (typeof components[directoryName] === 'function') {
      components[directoryName](app);
    } else {
      app.component(directoryName, components[directoryName]);
    }
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
    this.$toast.error(`Error: ${err?.response?.data?.message || err.message}`, {
      timeout: 10000
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

        let user;
        let accessToken;
        let roles;
        try {
          ({ accessToken, user, roles } = provider === 'github' ? await mothership.github(code) : await mothership.google(code));
          if (roles == null) {
            this.authError = 'You are not authorized to access this workspace';
            this.status = 'loaded';
            return;
          }
        } catch (err) {
          this.authError = 'An error occurred while logging in. Please try again.';
          this.status = 'loaded';
          return;
        }

        window.localStorage.setItem('_mongooseStudioAccessToken', accessToken._id);

        try {
          const { nodeEnv } = await api.status();
          this.nodeEnv = nodeEnv;
        } catch (err) {
          this.authError = 'Error connecting to Mongoose Studio API: ' + err.response?.data?.message ?? err.message;
          this.status = 'loaded';
          window.localStorage.setItem('_mongooseStudioAccessToken', '');
          return;
        }

        this.user = user;
        this.roles = roles;

        setTimeout(() => {
          this.$router.replace(this.$router.currentRoute.value.path);
        }, 0);
      } else {
        const token = window.localStorage.getItem('_mongooseStudioAccessToken');
        if (token) {
          const { user, roles } = await mothership.me();

          try {
            const [{ nodeEnv }, { modelSchemaPaths }] = await Promise.all([
              api.status(),
              api.Model.listModels()
            ]);
            this.nodeEnv = nodeEnv;
            this.modelSchemaPaths = modelSchemaPaths;
          } catch (err) {
            this.authError = 'Error connecting to Mongoose Studio API: ' + (err.response?.data?.message ?? err.message);
            this.status = 'loaded';
            return;
          }

          this.user = user;
          this.roles = roles;
        }
      }
    } else {
      try {
        const [{ nodeEnv }, { modelSchemaPaths }] = await Promise.all([
          api.status(),
          api.Model.listModels()
        ]);
        this.nodeEnv = nodeEnv;
        this.modelSchemaPaths = modelSchemaPaths;
      } catch (err) {
        this.authError = 'Error connecting to Mongoose Studio API: ' + (err.response?.data?.message ?? err.message);
      }
    }

    this.status = 'loaded';
  },
  setup() {
    const user = Vue.ref(null);
    const roles = Vue.ref(null);
    const status = Vue.ref('init');
    const nodeEnv = Vue.ref(null);
    const authError = Vue.ref(null);
    const modelSchemaPaths = Vue.ref(null);

    const state = Vue.reactive({ user, roles, status, nodeEnv, authError, modelSchemaPaths });
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

app.config.globalProperties = { format, arrayUtils, $toast: toast };
app.use(router);

app.mount('#content');
