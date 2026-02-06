'use strict';

const template = require('./tasks.html');
const api = require('../api');
const { taskNameToSlug } = require('../_util/taskRoute');

module.exports = app => app.component('tasks', {
  data: () => ({
    status: 'init',
    tasks: [],
    groupedTasks: {},
    selectedRange: 'today',
    start: null,
    end: null,
    dateFilters: [
      { value: 'all', label: 'All Time' },
      { value: 'today', label: 'Today' },
      { value: 'yesterday', label: 'Yesterday' },
      { value: 'thisWeek', label: 'This Week' },
      { value: 'lastWeek', label: 'Last Week' },
      { value: 'thisMonth', label: 'This Month' },
      { value: 'lastMonth', label: 'Last Month' }
    ],
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
    parametersEditor: null
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
        params.end = this.end;
      } else if (this.start) {
        params.start = this.start;
      }

      if (this.searchQuery.trim()) {
        params.name = this.searchQuery.trim();
      }

      const { tasks, groupedTasks } = await api.Task.getTasks(params);
      this.tasks = tasks;
      this.groupedTasks = groupedTasks;
    },
    openTaskGroupDetails(group) {
      this.$router.push({ path: `/task/${taskNameToSlug(group.name)}` });
    },
    openTaskGroupDetailsWithFilter(group, status) {
      this.$router.push({ path: `/task/${taskNameToSlug(group.name)}`, query: status ? { status } : {} });
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
        const parametersText = this.parametersEditor ? this.parametersEditor.getValue() : '';
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
      if (this.parametersEditor) {
        this.parametersEditor.setValue('');
      }
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
    initializeParametersEditor() {
      if (this.$refs.parametersEditor && !this.parametersEditor) {
        this.parametersEditor = CodeMirror.fromTextArea(this.$refs.parametersEditor, {
          mode: 'javascript',
          lineNumbers: true,
          smartIndent: false,
          theme: 'default'
        });
      }
    },
    openCreateTaskModal() {
      this.showCreateTaskModal = true;
      this.$nextTick(() => {
        this.initializeParametersEditor();
      });
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
      const now = new Date();
      let start, end;

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
          break;
      }

      this.start = start;
      this.end = end;

      await this.getTasks();
    }
  },
  computed: {
    tasksByName() {
      const groups = {};

      // Process tasks from groupedTasks to create name-based groups
      Object.entries(this.groupedTasks).forEach(([status, tasks]) => {
        tasks.forEach(task => {
          if (!groups[task.name]) {
            groups[task.name] = {
              name: task.name,
              tasks: [],
              statusCounts: {
                pending: 0,
                succeeded: 0,
                failed: 0,
                cancelled: 0
              },
              totalCount: 0,
              lastRun: null
            };
          }

          groups[task.name].tasks.push(task);
          groups[task.name].totalCount++;

          // Count status using the status from groupedTasks
          if (groups[task.name].statusCounts.hasOwnProperty(status)) {
            groups[task.name].statusCounts[status]++;
          }

          // Track last run time
          const taskTime = new Date(task.scheduledAt || task.createdAt || 0);
          if (!groups[task.name].lastRun || taskTime > new Date(groups[task.name].lastRun)) {
            groups[task.name].lastRun = taskTime;
          }
        });
      });

      // Convert to array and sort alphabetically by name
      return Object.values(groups).sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
    },
    succeededCount() {
      return this.groupedTasks.succeeded ? this.groupedTasks.succeeded.length : 0;
    },
    failedCount() {
      return this.groupedTasks.failed ? this.groupedTasks.failed.length : 0;
    },
    cancelledCount() {
      return this.groupedTasks.cancelled ? this.groupedTasks.cancelled.length : 0;
    },
    pendingCount() {
      return this.groupedTasks.pending ? this.groupedTasks.pending.length : 0;
    }
  },
  mounted: async function() {
    await this.updateDateRange();
    await this.getTasks();
    this.status = 'loaded';
    this.setDefaultCreateTaskValues();
  },
  beforeDestroy() {
    if (this.parametersEditor) {
      this.parametersEditor.toTextArea();
    }
  },

  template: template
});
