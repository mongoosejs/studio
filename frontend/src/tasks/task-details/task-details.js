'use strict';

const template = require('./task-details.html');
const api = require('../../api');

module.exports = app => app.component('task-details', {
  props: ['taskGroup'],
  data: () => ({
    showCreateTaskModal: false,
    newTask: {
      name: '',
      scheduledAt: '',
      parameters: ''
    }
  }),
  computed: {
    sortedTasks() {
      return [...this.taskGroup.tasks].sort((a, b) => {
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
    async createTask() {
      try {
        let parameters = {};
        if (this.newTask.parameters.trim()) {
          try {
            parameters = JSON.parse(this.newTask.parameters);
          } catch (e) {
            console.error('Invalid JSON in parameters field:', e);
            // TODO: Add proper validation feedback
            return;
          }
        }

        const taskData = {
          name: this.newTask.name || this.taskGroup.name,
          scheduledAt: this.newTask.scheduledAt,
          parameters: parameters
        };

        // TODO: Implement create task API call
        console.log('Creating task:', taskData);
        // await api.Task.createTask(taskData);

        // Reset form and close modal
        this.newTask = {
          name: '',
          scheduledAt: '',
          parameters: ''
        };
        this.showCreateTaskModal = false;

        // Emit event to refresh parent data
        this.$emit('task-created');
      } catch (error) {
        console.error('Error creating task:', error);
        // TODO: Add proper error handling/notification
      }
    }
  },
  mounted() {
    // Set default values
    this.newTask.name = this.taskGroup.name;
    
    // Set default scheduled time to 1 hour from now
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1);
    this.newTask.scheduledAt = defaultTime.toISOString().slice(0, 16);
  },
  template: template
});
