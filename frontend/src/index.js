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

const RECENT_PAGES_STORAGE_KEY = 'studio:recent-pages-history';
const MAX_RECENT_PAGES = 10;

function formatHistoryLabel(route) {
  if (!route || typeof route.path !== 'string') {
    return 'Unknown page';
  }
  if (route.name === 'root') {
    return 'Home';
  }
  if (route.name === 'model') {
    return route.params?.model ? `Model: ${route.params.model}` : 'Model';
  }
  if (route.name === 'document') {
    const model = route.params?.model ? `${route.params.model} ` : '';
    const documentId = route.params?.documentId ? String(route.params.documentId) : '';
    const shortDocumentId = documentId ? documentId.slice(0, 8) : '';
    return `Document: ${model}${shortDocumentId}`.trim();
  }
  if (route.name === 'dashboard') {
    return route.params?.dashboardId ? `Dashboard: ${route.params.dashboardId}` : 'Dashboard';
  }
  if (route.name === 'dashboards') {
    return 'Dashboards';
  }
  if (route.name === 'tasks') {
    return 'Tasks';
  }
  if (route.name === 'taskByName') {
    return route.params?.name ? `Task: ${route.params.name}` : 'Task';
  }
  if (route.name === 'taskSingle') {
    const taskName = route.params?.name ? `${route.params.name} ` : '';
    const taskId = route.params?.id ? String(route.params.id) : '';
    return `Task: ${taskName}${taskId}`.trim();
  }
  if (route.name === 'team') {
    return 'Team';
  }
  if (route.name === 'chat' || route.name === 'chat index') {
    return route.params?.threadId ? `Chat: ${route.params.threadId}` : 'Chat';
  }
  const normalizedPath = route.path.replace(/^\//, '');
  return normalizedPath || 'Home';
}

function safeReadRecentPages() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(RECENT_PAGES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(entry =>
      entry &&
      typeof entry.path === 'string' &&
      typeof entry.label === 'string' &&
      typeof entry.visitedAt === 'number'
    ).slice(0, MAX_RECENT_PAGES);
  } catch (err) {
    return [];
  }
}

function saveRecentPages(entries) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(
    RECENT_PAGES_STORAGE_KEY,
    JSON.stringify(entries.slice(0, MAX_RECENT_PAGES))
  );
}

function trackRecentPage(route) {
  if (!route || typeof route.path !== 'string') {
    return;
  }
  // Ignore auth callback state because it is transient and not useful history.
  if (typeof route.path === 'string' && route.path.includes('code=')) {
    return;
  }
  const path = route.fullPath || route.path;
  const label = formatHistoryLabel(route);
  const visitedAt = Date.now();

  const existing = safeReadRecentPages();
  const deduped = existing.filter(entry => entry.path !== path);
  const next = [{ path, label, visitedAt }, ...deduped].slice(0, MAX_RECENT_PAGES);
  saveRecentPages(next);
}

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
      <div class="fixed right-3 bottom-6 z-[9999] flex items-end">
        <button
          type="button"
          class="mr-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-text shadow-lg hover:bg-primary-hover"
          @click="toggleHistoryDrawer"
          :aria-expanded="showRecentPagesDrawer ? 'true' : 'false'"
          aria-controls="recent-pages-drawer"
          title="Recent pages"
        >
          History
        </button>
        <aside
          id="recent-pages-drawer"
          class="border border-edge bg-surface shadow-2xl transition-all duration-200 ease-in-out overflow-hidden rounded-md"
          :class="showRecentPagesDrawer ? 'w-80 opacity-100' : 'w-0 opacity-0 pointer-events-none'"
        >
          <div class="w-80 max-h-[70vh] flex flex-col">
            <div class="flex items-center justify-between border-b border-edge px-3 py-2">
              <div class="text-sm font-semibold text-content">Recent pages</div>
              <button
                type="button"
                class="rounded px-2 py-1 text-xs text-content-secondary hover:bg-muted"
                @click="clearRecentPages"
                :disabled="recentPages.length === 0"
              >
                Clear
              </button>
            </div>
            <div class="overflow-y-auto p-2">
              <div
                v-if="recentPages.length === 0"
                class="rounded border border-dashed border-edge px-3 py-4 text-sm text-content-tertiary"
              >
                No recent pages yet.
              </div>
              <button
                v-for="entry in recentPages"
                :key="entry.path + '-' + entry.visitedAt"
                type="button"
                class="mb-1 w-full rounded px-2 py-2 text-left hover:bg-muted"
                :class="entry.path === $route.fullPath ? 'bg-primary-subtle' : ''"
                @click="goToRecentPage(entry)"
              >
                <div class="truncate text-sm font-medium text-content">{{ entry.label }}</div>
                <div class="truncate text-xs text-content-tertiary">{{ entry.path }}</div>
              </button>
            </div>
          </div>
        </aside>
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
  watch: {
    '$route.fullPath': function() {
      this.recentPages = safeReadRecentPages();
    }
  },
  methods: {
    toggleHistoryDrawer() {
      this.showRecentPagesDrawer = !this.showRecentPagesDrawer;
      if (this.showRecentPagesDrawer) {
        this.recentPages = safeReadRecentPages();
      }
    },
    clearRecentPages() {
      this.recentPages = [];
      saveRecentPages([]);
    },
    goToRecentPage(entry) {
      if (!entry || !entry.path) {
        return;
      }
      this.showRecentPagesDrawer = false;
      if (entry.path === this.$route.fullPath) {
        return;
      }
      this.$router.push(entry.path);
    }
  },
  setup() {
    const user = Vue.ref(null);
    const roles = Vue.ref(null);
    const status = Vue.ref('init');
    const nodeEnv = Vue.ref(null);
    const authError = Vue.ref(null);
    const modelSchemaPaths = Vue.ref(null);
    const recentPages = Vue.ref(safeReadRecentPages());
    const showRecentPagesDrawer = Vue.ref(false);

    const state = Vue.reactive({
      user,
      roles,
      status,
      nodeEnv,
      authError,
      modelSchemaPaths,
      recentPages,
      showRecentPagesDrawer
    });
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
  if (to.name === 'root' && window.state.roles && window.state.roles[0] === 'dashboards') {
    return next({ name: 'dashboards' });
  } else {
    next();
  }
});

router.afterEach((to) => {
  trackRecentPage(to);
});

app.config.globalProperties = { format, arrayUtils, $toast: toast };
app.use(router);

app.mount('#content');
