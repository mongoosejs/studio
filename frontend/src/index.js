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
const { routes, hasAccess } = require('./routes');
const Toast = require('vue-toastification').default;
const { useToast } = require('vue-toastification');
const appendCSS = require('./appendCSS');
appendCSS(require('vue-toastification/dist/index.css'));

const app = Vue.createApp({
  template: '<app-component />'
});

window.drawArrowTo = function drawArrowTo(elementOrSelector) {
  const element = typeof elementOrSelector === 'string' ?
    document.querySelector(elementOrSelector) :
    elementOrSelector;

  if (!element || typeof element.getBoundingClientRect !== 'function') {
    throw new Error('window.drawArrowTo() requires a DOM element or selector');
  }

  const existingArrow = document.getElementById('mongoose-studio-screenshot-arrow');
  if (existingArrow) {
    existingArrow.remove();
  }

  const rect = element.getBoundingClientRect();
  const arrowLength = 140;
  const arrowRise = 80;
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const startX = Math.max(24, Math.min(window.innerWidth - 24, centerX - arrowLength));
  const startY = Math.max(24, Math.min(window.innerHeight - 24, centerY - arrowRise));
  const targetX = Math.max(rect.left, Math.min(rect.right, startX));
  const targetY = Math.max(rect.top, Math.min(rect.bottom, startY));
  const controlX = startX + (targetX - startX) * 0.6;
  const controlY = startY + (targetY - startY) * 0.15;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  const defs = document.createElementNS(svgNS, 'defs');
  const marker = document.createElementNS(svgNS, 'marker');
  const markerPath = document.createElementNS(svgNS, 'path');
  const path = document.createElementNS(svgNS, 'path');

  svg.setAttribute('id', 'mongoose-studio-screenshot-arrow');
  svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
  svg.setAttribute('width', '100vw');
  svg.setAttribute('height', '100vh');
  svg.style.position = 'fixed';
  svg.style.left = '0';
  svg.style.top = '0';
  svg.style.zIndex = '2147483647';
  svg.style.pointerEvents = 'none';

  marker.setAttribute('id', 'mongoose-studio-screenshot-arrow-head');
  marker.setAttribute('markerWidth', '14');
  marker.setAttribute('markerHeight', '14');
  marker.setAttribute('refX', '12');
  marker.setAttribute('refY', '7');
  marker.setAttribute('orient', 'auto');
  marker.setAttribute('markerUnits', 'userSpaceOnUse');

  markerPath.setAttribute('d', 'M 0 0 L 14 7 L 0 14 z');
  markerPath.setAttribute('fill', '#dc2626');

  path.setAttribute('d', `M ${startX} ${startY} Q ${controlX} ${controlY} ${targetX} ${targetY}`);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', '#dc2626');
  path.setAttribute('stroke-width', '5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('marker-end', 'url(#mongoose-studio-screenshot-arrow-head)');

  marker.appendChild(markerPath);
  defs.appendChild(marker);
  svg.appendChild(defs);
  svg.appendChild(path);
  document.body.appendChild(svg);

  return {
    element: svg,
    remove() {
      svg.remove();
    }
  };
};

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

// Add global navigation guard
router.beforeEach((to, from, next) => {
  // Skip auth check for authorized (public) routes
  if (to.meta.authorized) {
    next();
    return;
  }

  // Get roles from the app state
  const roles = window.state?.roles;

  // Check if user has access to the route
  if (!hasAccess(roles, to.name)) {
    // Find all routes the user has access to
    const allowedRoutes = routes.filter(route => hasAccess(roles, route.name));

    // If user has no allowed routes, redirect to splash/login
    if (allowedRoutes.length === 0) {
      next({ name: 'root' });
      return;
    }

    // Redirect to first allowed route
    const firstAllowedRoute = allowedRoutes[0].name;
    next({ name: firstAllowedRoute });
    return;
  }

  if (to.name === 'root' && roles && roles[0] === 'dashboards') {
    return next({ name: 'dashboards' });
  }

  next();
});

router.beforeEach((to, from, next) => {
  if (['chat index', 'chat'].includes(to.name) && !window.MONGOOSE_STUDIO_CONFIG.hasLLMAPIKey) {
    next({ name: 'root' });
    return;
  }

  if (to.name === 'root' && window.state.roles && window.state.roles[0] === 'dashboards') {
    return next({ name: 'dashboards' });
  } else {
    next();
  }
});

app.config.globalProperties = { format, arrayUtils, $toast: toast };
app.use(router);

app.mount('#content');
