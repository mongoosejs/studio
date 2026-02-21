'use strict';

// Page: all tasks with a given name. Reuses task-details to render the list (many tasks).
const template = require('./task-by-name.html');
const api = require('../api');

function buildTaskGroup(name, tasks) {
  const statusCounts = { pending: 0, succeeded: 0, failed: 0, cancelled: 0, in_progress: 0, unknown: 0 };
  let lastRun = null;
  tasks.forEach(task => {
    const status = task.status || 'unknown';
    if (Object.prototype.hasOwnProperty.call(statusCounts, status)) {
      statusCounts[status]++;
    } else {
      statusCounts.unknown++;
    }
    const taskTime = new Date(task.scheduledAt || task.createdAt || 0);
    if (!lastRun || taskTime > lastRun) lastRun = taskTime;
  });
  return {
    name,
    tasks,
    statusCounts,
    totalCount: tasks.length,
    lastRun
  };
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

const DATE_FILTERS = [
  { value: 'last_hour', label: 'Last Hour' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'lastWeek', label: 'Last Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' }
];
const DATE_FILTER_VALUES = DATE_FILTERS.map(f => f.value);

function getDateRangeForRange(selectedRange) {
  const now = new Date();
  let start, end;
  switch (selectedRange) {
    case 'last_hour':
      start = new Date();
      start.setHours(start.getHours() - 1);
      end = new Date();
      break;
    case 'today':
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
      break;
    case 'yesterday':
      start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
      break;
    case 'thisWeek':
      start = new Date(now.getTime() - (7 * 86400000));
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
      break;
    case 'lastWeek':
      start = new Date(now.getTime() - (14 * 86400000));
      start.setHours(0, 0, 0, 0);
      end = new Date(now.getTime() - (7 * 86400000));
      end.setHours(23, 59, 59, 999);
      break;
    case 'thisMonth': {
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
      break;
    }
    case 'lastMonth': {
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth();
      start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      break;
    }
    default:
      start = new Date();
      start.setHours(start.getHours() - 1);
      end = new Date();
      break;
  }
  return { start, end };
}

module.exports = app => app.component('task-by-name', {
  template,
  data: () => ({
    status: 'init',
    taskGroup: null,
    errorMessage: '',
    selectedRange: 'last_hour',
    start: null,
    end: null,
    dateFilters: DATE_FILTERS,
    page: 1,
    pageSize: 50,
    numDocs: 0,
    pageSizeOptions: PAGE_SIZE_OPTIONS
  }),
  computed: {
    taskName() {
      return this.$route.params.name || '';
    }
  },
  created() {
    const fromQuery = this.$route.query.dateRange;
    this.selectedRange = (fromQuery && DATE_FILTER_VALUES.includes(fromQuery)) ? fromQuery : 'last_hour';
    if (!this.$route.query.dateRange) {
      this.$router.replace({
        path: this.$route.path,
        query: { ...this.$route.query, dateRange: this.selectedRange }
      });
    }
  },
  watch: {
    taskName: {
      immediate: true,
      handler() {
        this.page = 1;
        this.loadTasks();
      }
    },
    '$route.query': {
      handler(query) {
        const dateRange = query.dateRange;
        if (dateRange && DATE_FILTER_VALUES.includes(dateRange) && this.selectedRange !== dateRange) {
          this.selectedRange = dateRange;
        }
      },
      deep: true
    }
  },
  methods: {
    updateDateRange() {
      this.page = 1;
      this.$router.replace({
        path: this.$route.path,
        query: { ...this.$route.query, dateRange: this.selectedRange }
      });
    },
    goToPage(page) {
      const maxPage = Math.max(1, Math.ceil(this.numDocs / this.pageSize));
      const next = Math.max(1, Math.min(page, maxPage));
      if (next === this.page) return;
      this.page = next;
      this.loadTasks();
    },
    onPageSizeChange() {
      this.page = 1;
      this.loadTasks();
    },
    async loadTasks() {
      if (!this.taskName) return;
      this.status = 'init';
      this.taskGroup = null;
      this.errorMessage = '';
      const dateRangeFromQuery = this.$route.query.dateRange;
      const dateRange = (dateRangeFromQuery && DATE_FILTER_VALUES.includes(dateRangeFromQuery))
        ? dateRangeFromQuery
        : (this.selectedRange || 'last_hour');
      this.selectedRange = dateRange;
      const { start, end } = getDateRangeForRange(dateRange);
      this.start = start;
      this.end = end;
      const skip = (this.page - 1) * this.pageSize;
      const params = {
        name: this.taskName,
        start: start instanceof Date ? start.toISOString() : start,
        end: end instanceof Date ? end.toISOString() : end,
        skip,
        limit: this.pageSize
      };
      const statusFromQuery = this.$route.query.status;
      if (statusFromQuery) params.status = statusFromQuery;
      try {
        const { tasks, numDocs } = await api.Task.getTasks(params);
        this.numDocs = numDocs ?? tasks.length;
        this.taskGroup = buildTaskGroup(this.taskName, tasks);
        this.taskGroup.totalCount = this.numDocs;
        this.status = 'loaded';
      } catch (err) {
        this.status = 'error';
        this.errorMessage = err?.response?.data?.message || err.message || 'Failed to load tasks';
      }
    },
    async onTaskCreated() {
      await this.loadTasks();
    },
    async onTaskCancelled() {
      await this.loadTasks();
    }
  }
});
