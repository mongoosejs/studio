'use strict';

const api = require('../api');
const template = require('./dashboards.html');


module.exports = app => app.component('dashboards', {
  template: template,
  data: () => ({
    status: 'loading',
    dashboards: [],
    searchText: '',
    showCreateDashboardModal: false,
    showDeleteDashboardModal: null,
    openMenuId: null
  }),
  computed: {
    filteredDashboards() {
      const searchWords = getSearchWords(this.searchText);
      let dashboards = this.dashboards;
      if (searchWords.length === 0) {
        return sortPinnedFirst(dashboards);
      }
      const searchPatterns = searchWords.map(word => new RegExp(escapeRegExp(word), 'i'));

      dashboards = dashboards.filter(dashboard => {
        const searchableText = `${dashboard.title || ''} ${dashboard.description || ''}`;
        return searchPatterns.every(pattern => pattern.test(searchableText));
      });

      return sortPinnedFirst(dashboards);
    }
  },
  methods: {
    highlightTitle(value) {
      return this.highlightSearchText(value, 'underline decoration-primary underline-offset-2');
    },
    highlightDescription(value) {
      return this.highlightSearchText(value, 'font-semibold text-content-secondary');
    },
    highlightSearchText(value, className) {
      const text = value || '';
      const searchWords = getSearchWords(this.searchText);
      if (searchWords.length === 0) {
        return escapeHtml(text);
      }
      const searchPattern = new RegExp(searchWords.map(escapeRegExp).join('|'), 'ig');

      let html = '';
      let lastIndex = 0;
      let match = searchPattern.exec(text);
      while (match != null) {
        html += escapeHtml(text.slice(lastIndex, match.index));
        html += `<span class="${className}">${escapeHtml(match[0])}</span>`;
        lastIndex = match.index + match[0].length;
        match = searchPattern.exec(text);
      }
      html += escapeHtml(text.slice(lastIndex));
      return html;
    },
    formatDate(value) {
      if (!value) {
        return '-';
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return '-';
      }
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(date);
    },
    formatUser(dashboard) {
      return dashboard.createdBy?.name ||
        dashboard.createdBy?.email ||
        (dashboard.createdById ? dashboard.createdById.toString() : '-');
    },
    toggleMenu(id) {
      this.openMenuId = this.openMenuId === id ? null : id;
    },
    closeMenu(id) {
      if (this.openMenuId === id) {
        this.openMenuId = null;
      }
    },
    async deleteDashboard(dashboard) {
      if (!dashboard) {
        return;
      }
      await api.Dashboard.deleteDashboard({ dashboardId: dashboard._id });
      const removedDashboard = this.dashboards.findIndex(x => x._id.toString() === dashboard._id.toString());
      this.dashboards.splice(removedDashboard, 1);
      this.showDeleteDashboardModal = null;
      this.$toast.success('Dashboard deleted!');
    },
    insertNewDashboard(dashboard) {
      this.dashboards.unshift(dashboard);
      this.showCreateDashboardModal = false;
    },
    async togglePin(dashboard) {
      if (!dashboard) {
        return;
      }

      const { doc } = await api.Dashboard.updateDashboard({
        dashboardId: dashboard._id,
        isPinned: !dashboard.isPinned
      });
      dashboard.isPinned = doc.isPinned;
    }
  },
  directives: {
    clickOutside: {
      beforeMount(el, binding) {
        el._clickOutside = (event) => {
          if (!(event.target === el || el.contains(event.target))) {
            binding.value();
          }
        };
        document.body.addEventListener('click', el._clickOutside);
      },
      unmounted(el) {
        document.body.removeEventListener('click', el._clickOutside);
      }
    }
  },
  async mounted() {
    const { dashboards } = await api.Dashboard.getDashboards();
    this.dashboards = dashboards;
    this.status = 'loaded';
  }
});

function escapeHtml(value) {
  return value.toString().
    replace(/&/g, '&amp;').
    replace(/</g, '&lt;').
    replace(/>/g, '&gt;').
    replace(/"/g, '&quot;').
    replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSearchWords(searchText) {
  return Array.from(new Set(searchText.trim().split(/\s+/).filter(Boolean))).
    sort((a, b) => b.length - a.length);
}

function sortPinnedFirst(dashboards) {
  return dashboards.slice().sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)));
}
