'use strict';

const api = require('../api');
const template = require('./dashboards.html');


module.exports = app => app.component('dashboards', {
  template: template,
  data: () => ({
    status: 'loading',
    dashboards: [],
    showCreateDashboardModal: false,
    showDeleteDashboardModal: null,
    openMenuId: null
  }),
  methods: {
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
      this.dashboards.push(dashboard);
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
  computed: {
    dashboardSections() {
      const pinned = this.dashboards.filter(dashboard => dashboard.isPinned);
      const other = this.dashboards.filter(dashboard => !dashboard.isPinned);
      const sections = [];

      if (pinned.length > 0) {
        sections.push({
          key: 'pinned',
          title: 'Pinned',
          dashboards: pinned,
          pinned: true
        });
      }

      if (other.length > 0) {
        sections.push({
          key: 'other',
          title: pinned.length > 0 ? 'All Dashboards' : null,
          dashboards: other,
          pinned: false
        });
      }

      return sections;
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
