'use strict';

const template = require('./task-details.html');
const api = require('../../api');

module.exports = app => app.component('task-details', {
  props: ['taskGroup', 'currentFilter'],
  data: () => ({
    showRescheduleModal: false,
    showRunModal: false,
    selectedTask: null
  }),
  computed: {
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
      try {
        // TODO: Implement reschedule API call
        console.log('Rescheduling task:', task.id);
        // await api.Task.rescheduleTask(task.id);
      } catch (error) {
        console.error('Error rescheduling task:', error);
        // TODO: Add proper error handling/notification
      }
    },
    async runTask(task) {
      try {
        // TODO: Implement run task API call
        console.log('Running task:', task.id);
        // await api.Task.runTask(task.id);
      } catch (error) {
        console.error('Error running task:', error);
        // TODO: Add proper error handling/notification
      }
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
    showRescheduleConfirmation(task) {
      this.selectedTask = task;
      this.showRescheduleModal = true;
    },
    showRunConfirmation(task) {
      this.selectedTask = task;
      this.showRunModal = true;
    },
    async confirmRescheduleTask() {
      try {
        await this.rescheduleTask(this.selectedTask);
        this.showRescheduleModal = false;
        this.selectedTask = null;
      } catch (error) {
        console.error('Error in confirmRescheduleTask:', error);
      }
    },
    async confirmRunTask() {
      try {
        await this.runTask(this.selectedTask);
        this.showRunModal = false;
        this.selectedTask = null;
      } catch (error) {
        console.error('Error in confirmRunTask:', error);
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
