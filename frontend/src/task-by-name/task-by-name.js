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

module.exports = app => app.component('task-by-name', {
  template,
  data: () => ({
    status: 'init',
    taskGroup: null,
    errorMessage: ''
  }),
  computed: {
    taskName() {
      return this.$route.params.name || '';
    }
  },
  watch: {
    taskName: {
      immediate: true,
      handler() {
        this.loadTasks();
      }
    }
  },
  methods: {
    async loadTasks() {
      if (!this.taskName) return;
      this.status = 'init';
      this.taskGroup = null;
      this.errorMessage = '';
      try {
        const { tasks } = await api.Task.getTasks({ name: this.taskName });
        this.taskGroup = buildTaskGroup(this.taskName, tasks);
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
