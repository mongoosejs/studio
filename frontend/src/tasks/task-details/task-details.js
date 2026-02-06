'use strict';

const template = require('./task-details.html');
const api = require('../../api');
const { taskNameToSlug } = require('../../_util/taskRoute');

const STATUS_ORDER = ['pending', 'succeeded', 'failed', 'cancelled'];
const PIE_COLORS = ['#eab308', '#22c55e', '#ef4444', '#6b7280'];
const PIE_HOVER = ['#ca8a04', '#16a34a', '#dc2626', '#4b5563'];

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
    newScheduledTime: '',
    statusView: 'summary',
    statusChart: null
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
    },
    pieChartData() {
      const counts = this.taskGroup?.statusCounts || {};
      return {
        labels: ['Pending', 'Succeeded', 'Failed', 'Cancelled'],
        datasets: [{
          data: STATUS_ORDER.map(s => counts[s] || 0),
          backgroundColor: PIE_COLORS,
          hoverBackgroundColor: PIE_HOVER,
          borderWidth: STATUS_ORDER.map(s => (this.currentFilter === s ? 4 : 2)),
          borderColor: '#fff'
        }]
      };
    },
    statusOrderForDisplay() {
      return STATUS_ORDER;
    }
  },
  watch: {
    statusView(val) {
      if (val !== 'chart') this.destroyStatusChart();
      else {
        this.$nextTick(() => {
          requestAnimationFrame(() => this.ensureStatusChart());
        });
      }
    },
    taskGroup: {
      deep: true,
      handler() {
        this.$nextTick(() => {
          requestAnimationFrame(() => this.ensureStatusChart());
        });
      }
    },
    currentFilter() {
      this.updateStatusChartSelection();
    }
  },
  methods: {
    destroyStatusChart() {
      if (this.statusChart) {
        try {
          this.statusChart.destroy();
        } catch (_) {
          // ignore Chart.js teardown errors
        }
        this.statusChart = null;
      }
    },
    isChartCanvasReady(canvas) {
      return canvas && typeof canvas.getContext === 'function' && canvas.isConnected && canvas.offsetParent != null;
    },
    ensureStatusChart() {
      if (this.statusView !== 'chart' || !this.taskGroup || this.taskGroup.totalCount === 0) {
        this.destroyStatusChart();
        return;
      }
      const canvas = this.$refs.statusPieChart;
      if (!canvas || !this.isChartCanvasReady(canvas)) return;
      const Chart = typeof window !== 'undefined' && window.Chart;
      if (!Chart) return;
      const data = this.pieChartData;
      if (this.statusChart) {
        try {
          this.statusChart.data.labels = data.labels;
          this.statusChart.data.datasets[0].data = data.datasets[0].data;
          this.statusChart.data.datasets[0].borderWidth = data.datasets[0].borderWidth;
          this.statusChart.update('none');
        } catch (_) {
          this.destroyStatusChart();
        }
        return;
      }
      try {
        this.statusChart = new Chart(canvas, {
          type: 'doughnut',
          data,
          options: {
            responsive: false,
            maintainAspectRatio: false,
            animation: false,
            layout: {
              padding: 8
            },
            onClick: (_evt, elements) => {
              if (elements && elements.length > 0) {
                const status = STATUS_ORDER[elements[0].index];
                this.filterByStatus(status);
              }
            },
            plugins: {
              legend: {
                display: true,
                position: 'bottom'
              }
            }
          }
        });
      } catch (_) {
        this.statusChart = null;
      }
    },
    updateStatusChartSelection() {
      if (!this.statusChart || !this.statusChart.data?.datasets?.[0]) return;
      const borderWidths = STATUS_ORDER.map(s => (this.currentFilter === s ? 4 : 2));
      this.statusChart.data.datasets[0].borderWidth = borderWidths;
    },
    statusLabel(status) {
      return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
    },
    getStatusPillClass(status) {
      const classes = {
        pending: 'bg-yellow-200 text-yellow-900 ring-2 ring-yellow-500',
        succeeded: 'bg-green-200 text-green-900 ring-2 ring-green-500',
        failed: 'bg-red-200 text-red-900 ring-2 ring-red-500',
        cancelled: 'bg-gray-200 text-gray-900 ring-2 ring-gray-500'
      };
      return classes[status] || 'bg-slate-200 text-slate-900 ring-2 ring-slate-500';
    },
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
  beforeUnmount() {
    this.destroyStatusChart();
  },
  template: template
});
