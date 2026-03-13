'use strict';

const template = require('./tasks.html');
const api = require('../api');
const { DATE_FILTERS, getDateRangeForRange } = require('../_util/dateRange');

module.exports = app => app.component('tasks', {
  data: () => ({
    status: 'init',
    statusCounts: { pending: 0, succeeded: 0, failed: 0, cancelled: 0 },
    tasksByName: [],
    selectedRange: 'last_hour',
    start: null,
    end: null,
    dateFilters: DATE_FILTERS,
    selectedStatus: 'all',
    statusFilters: [
      { label: 'All', value: 'all' },
      { label: 'Pending', value: 'pending' },
      // { label: 'In Progress', value: 'in_progress' },
      { label: 'Succeeded', value: 'succeeded' },
      { label: 'Failed', value: 'failed' },
      { label: 'Cancelled', value: 'cancelled' }
    ],
    searchQuery: '',
    searchTimeout: null,
    // Create task modal state
    showCreateTaskModal: false,
    newTask: {
      name: '',
      scheduledAt: '',
      parameters: '',
      repeatInterval: ''
    }
  }),
  methods: {
    async getTasks() {
      const params = {};
      if (this.selectedStatus == 'all') {
        params.status = null;
      } else {
        params.status = this.selectedStatus;
      }

      if (this.start != null && this.end != null) {
        params.start = this.start instanceof Date ? this.start.toISOString() : this.start;
        params.end = this.end instanceof Date ? this.end.toISOString() : this.end;
      } else if (this.start != null) {
        params.start = this.start instanceof Date ? this.start.toISOString() : this.start;
      }

      if (this.searchQuery.trim()) {
        params.name = this.searchQuery.trim();
      }

      const { statusCounts, tasksByName } = await api.Task.getTaskOverview(params);
      this.statusCounts = statusCounts || this.statusCounts;
      this.tasksByName = tasksByName || [];
    },
    openTaskGroupDetails(group) {
      const query = { dateRange: this.selectedRange || 'last_hour' };
      if (this.selectedStatus && this.selectedStatus !== 'all') query.status = this.selectedStatus;
      this.$router.push({ path: `/tasks/${encodeURIComponent(group.name || '')}`, query });
    },
    openTaskGroupDetailsWithFilter(group, status) {
      const query = { dateRange: this.selectedRange || 'last_hour' };
      if (status) query.status = status;
      else if (this.selectedStatus && this.selectedStatus !== 'all') query.status = this.selectedStatus;
      this.$router.push({ path: `/tasks/${encodeURIComponent(group.name || '')}`, query });
    },
    async onTaskCreated() {
      // Refresh the task data when a new task is created
      await this.getTasks();
    },
    formatDate(dateString) {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleString();
    },
    async createTask() {
      try {
        let parameters = {};
        const parametersText = this.newTask.parameters || '';
        if (parametersText.trim()) {
          try {
            parameters = JSON.parse(parametersText);
          } catch (e) {
            console.error('Invalid JSON in parameters field:', e);
            this.$toast.create({
              title: 'Invalid JSON Parameters',
              text: 'Please check your JSON syntax in the parameters field',
              type: 'error',
              timeout: 5000,
              positionClass: 'bottomRight'
            });
            return;
          }
        }

        // Validate repeat interval
        let repeatInterval = null;
        if (this.newTask.repeatInterval && this.newTask.repeatInterval.trim()) {
          const interval = parseInt(this.newTask.repeatInterval);
          if (isNaN(interval) || interval < 0) {
            console.error('Invalid repeat interval. Must be a positive number.');
            this.$toast.create({
              title: 'Invalid Repeat Interval',
              text: 'Repeat interval must be a positive number (in milliseconds)',
              type: 'error',
              timeout: 5000,
              positionClass: 'bottomRight'
            });
            return;
          }
          repeatInterval = interval;
        }

        const taskData = {
          name: this.newTask.name,
          scheduledAt: this.newTask.scheduledAt,
          payload: parameters,
          repeatAfterMS: repeatInterval
        };

        console.log('Creating task:', taskData);
        await api.Task.createTask(taskData);

        // Show success message
        this.$toast.create({
          title: 'Task Created Successfully!',
          text: `Task "${taskData.name}" has been scheduled`,
          type: 'success',
          timeout: 3000,
          positionClass: 'bottomRight'
        });

        // Close modal (which will reset form)
        this.closeCreateTaskModal();

        // Refresh the task data
        await this.getTasks();
      } catch (error) {
        console.error('Error creating task:', error);
        this.$toast.create({
          title: 'Failed to Create Task',
          text: error?.response?.data?.message || error.message || 'An unexpected error occurred',
          type: 'error',
          timeout: 5000,
          positionClass: 'bottomRight'
        });
      }
    },
    resetCreateTaskForm() {
      this.newTask = {
        name: '',
        scheduledAt: '',
        parameters: '',
        repeatInterval: ''
      };
    },
    setDefaultCreateTaskValues() {
      // Set default scheduled time to 1 hour from now
      const defaultTime = new Date();
      defaultTime.setHours(defaultTime.getHours() + 1);
      this.newTask.scheduledAt = defaultTime.toISOString().slice(0, 16);
    },
    closeCreateTaskModal() {
      this.showCreateTaskModal = false;
      this.resetCreateTaskForm();
      this.setDefaultCreateTaskValues();
    },
    openCreateTaskModal() {
      this.showCreateTaskModal = true;
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
      this.selectedRange = 'today';
      this.searchQuery = '';
      await this.updateDateRange();
    },
    async setStatusFilter(status) {
      this.selectedStatus = status;
      await this.getTasks();
    },
    async onSearchInput() {
      // Debounce the search to avoid too many API calls
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(async() => {
        await this.getTasks();
      }, 300);
    },
    async updateDateRange() {
      const { start, end } = getDateRangeForRange(this.selectedRange);
      this.start = start;
      this.end = end;
      await this.getTasks();
    }
  },
  computed: {
    pendingCount() {
      return this.statusCounts.pending || 0;
    },
    succeededCount() {
      return this.statusCounts.succeeded || 0;
    },
    failedCount() {
      return this.statusCounts.failed || 0;
    },
    cancelledCount() {
      return this.statusCounts.cancelled || 0;
    }
  },
  mounted: async function() {
    await this.updateDateRange();
    await this.getTasks();
    this.status = 'loaded';
    this.setDefaultCreateTaskValues();
  },
  template: template
});
