'use strict';

const template = require('./tasks.html');
const api = require('../api');

module.exports = app => app.component('tasks', {
  data: () => ({
    status: 'init',
    tasks: [],
    selectedRange: 'all',
    start: null,
    end: null,
    dateFilters: [
      { value: 'all', label: 'All Time' },
      { value: 'today', label: 'Today' },
      { value: 'yesterday', label: 'Yesterday' },
      { value: 'thisWeek', label: 'This Week' },
      { value: 'lastWeek', label: 'Last Week' },
      { value: 'thisMonth', label: 'This Month' },
      { value: 'lastMonth', label: 'Last Month' },
    ],
    selectedStatus: 'all',
    statusFilters: [
      { label: 'All', value: 'all' },
      { label: 'Pending', value: 'pending' },
      { label: 'In Progress', value: 'in_progress' },
      { label: 'Succeeded', value: 'succeeded' },
      { label: 'Failed', value: 'failed' },
      { label: 'Cancelled', value: 'cancelled' }
    ],
    newTask: { status: 'pending' }
  }),
  methods: {
    async getTasks() {
      const params = {};
      if (this.selectedStatus == 'all') {
        params.status = null;
      } else {
        params.status = this.selectedStatus;
      }

      if (this.start && this.end) {
        params.start = this.start;
        params.end = this.end
      } else if (this.start) {
        params.start = this.start;
      }
      const { tasks } = await api.Task.getTasks(params);
      this.tasks = tasks;
    },
    getStatusColor(status) {
      if (status === 'succeeded') {
        // Green (success)
        return 'bg-green-100 text-green-800';
      } else if (status === 'pending') {
        // Yellow (waiting)
        return 'bg-yellow-100 text-yellow-800';
      } else if (status === 'cancelled') {
        // Gray (neutral/aborted)
        return 'bg-gray-100 text-gray-800';
      } else if (status === 'failed') {
        // Red (error)
        return 'bg-red-100 text-red-800';
      } else if (status === 'in_progress') {
        // Blue (active/running)
        return 'bg-blue-100 text-blue-800';
      } else {
        // Default (fallback)
        return 'bg-slate-100 text-slate-800';
      }
    },
    async resetFilters() {
      this.selectedStatus = 'all';
      this.selectedRange = 'all';
      this.start = null;
      this.end = null;
      await this.getTasks();
    },
    async updateDateRange() {
      const now = new Date();
      let start, end;

      const getStartOfWeek = (d) => {
        const date = new Date(d);
        const day = date.getDay();
        date.setDate(date.getDate() - day);
        date.setHours(0, 0, 0, 0);
        return date;
      };

      const getEndOfWeek = (d) => {
        const date = new Date(d);
        const day = date.getDay();
        date.setDate(date.getDate() + (6 - day));
        date.setHours(23, 59, 59, 999);
        return date;
      };

      switch (this.selectedRange) {
        case 'today':
          start = new Date();
          start.setHours(0, 0, 0, 0);
          end = new Date();
          end.setHours(23, 59, 59, 999);
          break;
        case 'yesterday':
          start = new Date();
          start.setDate(start.getDate() - 1);
          start.setHours(0, 0, 0, 0);
          end = new Date();
          end.setDate(end.getDate() - 1);
          end.setHours(23, 59, 59, 999);
          break;
        case 'thisWeek':
          start = getStartOfWeek(now);
          end = getEndOfWeek(now);
          break;
        case 'lastWeek':
          const lastWeekStart = getStartOfWeek(new Date(now.getTime() - 7 * 86400000));
          const lastWeekEnd = getEndOfWeek(new Date(now.getTime() - 7 * 86400000));
          start = lastWeekStart;
          end = lastWeekEnd;
          break;
        case 'thisMonth':
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        case 'lastMonth':
          start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          break;
        case 'all':
        default:
          this.start = null;
          this.end = null;
          return;
      }

      this.start = start;
      this.end = end;

      await this.getTasks();
    }
  },
  computed: {
    canCreateNewTask() {
      if (this.newTask.status && this.newTask.time && this.newTask.name) {
        return true;
      }
      return false;
    },
    succeededCount() {
      return this.tasks.filter(task => task.status === 'succeeded').length;
    },
    failedCount() {
      return this.tasks.filter(task => task.status === 'failed').length;
    },
    cancelledCount() {
      return this.tasks.filter(task => task.status === 'cancelled').length;
    },
    pendingCount() {
      return this.tasks.filter(task => task.status === 'pending').length;
    }
  },
  mounted: async function() {
    await this.getTasks();
  },
  template: template
});