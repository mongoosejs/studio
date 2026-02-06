'use strict';

// Page: one task by id. Dedicated single-task detail UI (not the list).
const template = require('./task-single.html');
const api = require('../api');

module.exports = app => app.component('task-single', {
  template,
  data: () => ({
    status: 'init',
    task: null,
    errorMessage: '',
    showRescheduleModal: false,
    showRunModal: false,
    showCancelModal: false,
    selectedTask: null,
    newScheduledTime: ''
  }),
  computed: {
    taskId() {
      return this.$route.params.id || '';
    },
    taskByNamePath() {
      return { path: `/task/${this.$route.params.name}` };
    },
    taskPayload() {
      if (!this.task) return null;
      const p = this.task.payload ?? this.task.parameters;
      return p && typeof p === 'object' ? p : null;
    }
  },
  watch: {
    '$route.params': {
      deep: true,
      handler() {
        this.loadTask();
      }
    }
  },
  methods: {
    getStatusColor(status) {
      if (status === 'succeeded') return 'bg-green-100 text-green-800';
      if (status === 'pending') return 'bg-yellow-100 text-yellow-800';
      if (status === 'cancelled') return 'bg-gray-100 text-gray-800';
      if (status === 'failed') return 'bg-red-100 text-red-800';
      if (status === 'in_progress') return 'bg-blue-100 text-blue-800';
      return 'bg-slate-100 text-slate-800';
    },
    formatDate(dateString) {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleString();
    },
    async loadTask() {
      if (!this.taskId) return;
      this.status = 'init';
      this.task = null;
      this.errorMessage = '';
      try {
        const { task } = await api.Task.getTask({ taskId: this.taskId });
        this.task = task;
        this.status = 'loaded';
      } catch (err) {
        const status = err?.response?.status;
        const notFound = status === 404 || err?.response?.data?.name === 'DocumentNotFoundError';
        this.status = notFound ? 'notfound' : 'error';
        this.errorMessage = notFound ? '' : (err?.response?.data?.message || err.message || 'Failed to load task');
      }
    },
    showRescheduleConfirmation(task) {
      this.selectedTask = task;
      const defaultTime = new Date();
      defaultTime.setHours(defaultTime.getHours() + 1);
      this.newScheduledTime = defaultTime.toISOString().slice(0, 16);
      this.showRescheduleModal = true;
    },
    showRunConfirmation(task) {
      this.selectedTask = task;
      this.showRunModal = true;
    },
    showCancelConfirmation(task) {
      this.selectedTask = task;
      this.showCancelModal = true;
    },
    async confirmRescheduleTask() {
      if (!this.newScheduledTime) return;
      try {
        await api.Task.rescheduleTask({ taskId: this.selectedTask.id, scheduledAt: this.newScheduledTime });
        this.$toast.create({ title: 'Task Rescheduled', text: `Task ${this.selectedTask.id} has been rescheduled`, type: 'success', timeout: 3000, positionClass: 'bottomRight' });
        this.showRescheduleModal = false;
        this.selectedTask = null;
        this.newScheduledTime = '';
        await this.loadTask();
      } catch (err) {
        this.$toast.create({ title: 'Failed to Reschedule', text: err?.response?.data?.message || err.message || 'An unexpected error occurred', type: 'error', timeout: 5000, positionClass: 'bottomRight' });
      }
    },
    async confirmRunTask() {
      try {
        await api.Task.runTask({ taskId: this.selectedTask.id });
        this.$toast.create({ title: 'Task Started', text: `Task ${this.selectedTask.id} is now running`, type: 'success', timeout: 3000, positionClass: 'bottomRight' });
        this.showRunModal = false;
        this.selectedTask = null;
        await this.loadTask();
      } catch (err) {
        this.$toast.create({ title: 'Failed to Run Task', text: err?.response?.data?.message || err.message || 'An unexpected error occurred', type: 'error', timeout: 5000, positionClass: 'bottomRight' });
      }
    },
    goBack() {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        this.$router.push(this.taskByNamePath);
      }
    },
    async confirmCancelTask() {
      try {
        await api.Task.cancelTask({ taskId: this.selectedTask.id });
        this.$toast.create({ title: 'Task Cancelled', text: `Task ${this.selectedTask.id} has been cancelled`, type: 'success', timeout: 3000, positionClass: 'bottomRight' });
        this.showCancelModal = false;
        this.selectedTask = null;
        this.goBack();
      } catch (err) {
        this.$toast.create({ title: 'Failed to Cancel Task', text: err?.response?.data?.message || err.message || 'An unexpected error occurred', type: 'error', timeout: 5000, positionClass: 'bottomRight' });
      }
    }
  },
  mounted() {
    this.loadTask();
  }
});
