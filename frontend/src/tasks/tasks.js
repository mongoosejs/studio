'use strict';

const template = require('./tasks.html');
const api = require('../api');
const { DATE_FILTERS, getDateRangeForRange } = require('../_util/dateRange');

/** Returns the bucket size in ms for the given date range. */
function getBucketSizeMs(range) {
  switch (range) {
    case 'last_hour': return 5 * 60 * 1000;        // 5 minutes
    case 'today':
    case 'yesterday': return 60 * 60 * 1000;        // 1 hour
    case 'thisWeek':
    case 'lastWeek': return 24 * 60 * 60 * 1000;    // 1 day
    case 'thisMonth':
    case 'lastMonth': return 24 * 60 * 60 * 1000;   // 1 day
    default: return 5 * 60 * 1000;
  }
}

/** Formats a bucket timestamp for the x-axis label based on the date range. */
function formatBucketLabel(timestamp, range) {
  const date = new Date(timestamp);
  switch (range) {
    case 'last_hour':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case 'today':
    case 'yesterday':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    case 'thisWeek':
    case 'lastWeek':
    case 'thisMonth':
    case 'lastMonth':
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    default:
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

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
    },
    // Chart over time
    overTimeChart: null,
    overTimeBuckets: [],
    // Toggled with v-if on the canvas so Chart.js is torn down and remounted on
    // filter changes. Updating Chart.js in place during a big Vue re-render was
    // freezing the page (dropdowns unresponsive, chart stale).
    showOverTimeChart: true
  }),
  methods: {
    async getTasks() {
      // Hide chart canvas + teardown Chart.js immediately on filter changes
      // (see showOverTimeChart + v-if on the canvas in tasks.html).
      this.showOverTimeChart = false;
      this.destroyOverTimeChart();

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

      const [overviewResult, overTimeResult] = await Promise.all([
        api.Task.getTaskOverview(params),
        api.Task.getTasksOverTime({
          start: params.start,
          end: params.end,
          bucketSizeMs: getBucketSizeMs(this.selectedRange)
        })
      ]);

      this.statusCounts = overviewResult.statusCounts || this.statusCounts;
      this.tasksByName = overviewResult.tasksByName || [];
      this.overTimeBuckets = overTimeResult || [];
      if (this.overTimeBuckets.length === 0) {
        this.showOverTimeChart = false;
        this.destroyOverTimeChart();
      } else {
        this.showOverTimeChart = true;
        await this.$nextTick();
        this.renderOverTimeChart();
      }
    },

    /** Build or update the stacked bar chart showing tasks over time. */
    renderOverTimeChart() {
      const Chart = typeof window !== 'undefined' && window.Chart;
      if (!Chart) return;
      const canvas = this.$refs.overTimeChart;
      if (!canvas || typeof canvas.getContext !== 'function') return;

      const buckets = this.overTimeBuckets;
      const labels = buckets.map(b => formatBucketLabel(b.timestamp, this.selectedRange));
      const succeeded = buckets.map(b => b.succeeded || 0);
      const failed = buckets.map(b => b.failed || 0);
      const cancelled = buckets.map(b => b.cancelled || 0);

      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      const tickColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
      const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

      const chartData = {
        labels,
        datasets: [
          { label: 'Succeeded', data: succeeded, backgroundColor: '#22c55e', stack: 'tasks' },
          { label: 'Failed', data: failed, backgroundColor: '#ef4444', stack: 'tasks' },
          { label: 'Cancelled', data: cancelled, backgroundColor: '#6b7280', stack: 'tasks' }
        ]
      };

      if (this.overTimeChart) {
        try {
          this.overTimeChart.data.labels = labels;
          this.overTimeChart.data.datasets[0].data = succeeded;
          this.overTimeChart.data.datasets[1].data = failed;
          this.overTimeChart.data.datasets[2].data = cancelled;
          this.overTimeChart.update('none');
          return;
        } catch (_) {
          this.destroyOverTimeChart();
        }
      }

      try {
        this.overTimeChart = new Chart(canvas, {
          type: 'bar',
          data: chartData,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
              x: {
                stacked: true,
                ticks: { color: tickColor, maxRotation: 45, minRotation: 0 },
                grid: { color: gridColor }
              },
              y: {
                stacked: true,
                beginAtZero: true,
                ticks: { color: tickColor, precision: 0 },
                grid: { color: gridColor }
              }
            },
            plugins: {
              legend: {
                display: true,
                position: 'top',
                labels: { color: tickColor }
              },
              tooltip: { mode: 'index', intersect: false }
            }
          }
        });
      } catch (_) {
        this.overTimeChart = null;
      }
    },

    destroyOverTimeChart() {
      if (this.overTimeChart) {
        try { this.overTimeChart.destroy(); } catch (_) {}
        this.overTimeChart = null;
      }
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
    this.status = 'loaded';
    this.setDefaultCreateTaskValues();
  },
  beforeUnmount() {
    this.destroyOverTimeChart();
  },
  template: template
});
