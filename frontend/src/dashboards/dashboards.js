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
      const searchText = this.searchText.trim().toLowerCase();
      if (!searchText) {
        return this.dashboards;
      }

      return this.dashboards.filter(dashboard => {
        return (dashboard.title || '').toLowerCase().includes(searchText) ||
          (dashboard.description || '').toLowerCase().includes(searchText);
      });
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
      const searchText = this.searchText.trim();
      if (!searchText) {
        return escapeHtml(text);
      }

      const pattern = new RegExp(escapeRegExp(searchText), 'ig');
      let html = '';
      let lastIndex = 0;
      let match = pattern.exec(text);
      while (match != null) {
        html += escapeHtml(text.slice(lastIndex, match.index));
        html += `<span class="${className}">${escapeHtml(match[0])}</span>`;
        lastIndex = match.index + match[0].length;
        match = pattern.exec(text);
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
