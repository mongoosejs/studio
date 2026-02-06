'use strict';

const template = require('./task-details.html');
const api = require('../../api');
const { taskNameToSlug } = require('../../_util/taskRoute');

module.exports = app => app.component('task-details', {
  props: {
    taskGroup: { type: Object, required: true },
    currentFilter: { type: String, default: null },
    backTo: { type: Object, default: null }
  },
  data: () => ({
    showRescheduleModal: false,
    showRunModal: false,
    showCancelModal: false,
    selectedTask: null,
    newScheduledTime: ''
  }),
  computed: {
    backLabel() {
      if (this.backTo?.path?.startsWith('/task/') || this.backTo?.name === 'taskByName') return `Back to ${this.taskGroup?.name || 'tasks'}`;
      return 'Back to Task Groups';
    },
    sortedTasks() {
      let tasks = this.taskGroup.tasks;

      // Apply filter if one is set
      if (this.currentFilter) {
        tasks = tasks.filter(task => task.status === this.currentFilter);
      }

      return tasks.sort((a, b) => {
        const dateA = new Date(a.scheduledAt || a.createdAt || 0);
        const dateB = new Date(b.scheduledAt || b.createdAt || 0);
        return dateB - dateA; // Most recent first
      });
    }
  },
  methods: {
    getStatusColor(status) {
      if (status === 'succeeded') {
        return 'bg-green-100 text-green-800';
      } else if (status === 'pending') {
        return 'bg-yellow-100 text-yellow-800';
      } else if (status === 'cancelled') {
        return 'bg-gray-100 text-gray-800';
      } else if (status === 'failed') {
        return 'bg-red-100 text-red-800';
      } else if (status === 'in_progress') {
        return 'bg-blue-100 text-blue-800';
      } else {
        return 'bg-slate-100 text-slate-800';
      }
    },
    formatDate(dateString) {
      if (!dateString) return 'N/A';
      return new Date(dateString).toLocaleString();
    },
    async rescheduleTask(task) {
      if (!this.newScheduledTime) {
        return;
      }
      console.log('Rescheduling task:', task.id, 'to:', this.newScheduledTime);
      await api.Task.rescheduleTask({ taskId: task.id, scheduledAt: this.newScheduledTime });
    },
    async runTask(task) {
      console.log('Running task:', task.id);
      await api.Task.runTask({ taskId: task.id });
    },
    async cancelTask(task) {
      await api.Task.cancelTask({ taskId: task.id });
      // Refresh the task data by emitting an event to the parent
      this.$emit('task-cancelled');
    },
    filterByStatus(status) {
      // If clicking the same status, clear the filter
      if (this.currentFilter === status) {
        this.$emit('update:currentFilter', null);
      } else {
        this.$emit('update:currentFilter', status);
      }
    },
    clearFilter() {
      this.$emit('update:currentFilter', null);
    },
    goBack() {
      if (this.backTo) {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          this.$router.push(this.backTo);
        }
      } else {
        this.$emit('back');
      }
    },
    taskDetailRoute(task) {
      const id = String(task.id || task._id);
      return { path: `/task/${taskNameToSlug(this.taskGroup.name)}/${id}` };
    },
    showRescheduleConfirmation(task) {
      this.selectedTask = task;
      // Set default time to 1 hour from now
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
      try {
        await this.rescheduleTask(this.selectedTask);

        // Show success message
        this.$toast.create({
          title: 'Task Rescheduled Successfully!',
          text: `Task ${this.selectedTask.id} has been rescheduled`,
          type: 'success',
          timeout: 3000,
          positionClass: 'bottomRight'
        });

        this.showRescheduleModal = false;
        this.selectedTask = null;
        this.newScheduledTime = '';
      } catch (error) {
        console.error('Error in confirmRescheduleTask:', error);
        this.$toast.create({
          title: 'Failed to Reschedule Task',
          text: error?.response?.data?.message || error.message || 'An unexpected error occurred',
          type: 'error',
          timeout: 5000,
          positionClass: 'bottomRight'
        });
      }
    },
    async confirmRunTask() {
      try {
        await this.runTask(this.selectedTask);

        // Show success message
        this.$toast.create({
          title: 'Task Started Successfully!',
          text: `Task ${this.selectedTask.id} is now running`,
          type: 'success',
          timeout: 3000,
          positionClass: 'bottomRight'
        });

        this.showRunModal = false;
        this.selectedTask = null;
      } catch (error) {
        console.error('Error in confirmRunTask:', error);
        this.$toast.create({
          title: 'Failed to Run Task',
          text: error?.response?.data?.message || error.message || 'An unexpected error occurred',
          type: 'error',
          timeout: 5000,
          positionClass: 'bottomRight'
        });
      }
    },
    async confirmCancelTask() {
      try {
        await this.cancelTask(this.selectedTask);

        // Show success message
        this.$toast.create({
          title: 'Task Cancelled Successfully!',
          text: `Task ${this.selectedTask.id} has been cancelled`,
          type: 'success',
          timeout: 3000,
          positionClass: 'bottomRight'
        });

        this.showCancelModal = false;
        this.selectedTask = null;
      } catch (error) {
        console.error('Error in confirmCancelTask:', error);
        this.$toast.create({
          title: 'Failed to Cancel Task',
          text: error?.response?.data?.message || error.message || 'An unexpected error occurred',
          type: 'error',
          timeout: 5000,
          positionClass: 'bottomRight'
        });
      }
    }

  },
  mounted() {
    // Check if the task group was already filtered when passed from parent
    if (this.taskGroup.filteredStatus && !this.currentFilter) {
      this.$emit('update:currentFilter', this.taskGroup.filteredStatus);
    }
  },
  template: template
});
