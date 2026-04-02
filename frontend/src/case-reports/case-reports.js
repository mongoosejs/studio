'use strict';

const api = require('../api');
const template = require('./case-reports.html');

module.exports = app => app.component('case-reports', {
  template: template,
  data: () => ({
    status: 'loading',
    caseReports: [],
    showConfirmModal: false,
    confirmAction: null,
    confirmCaseReportId: null,
    confirmMessage: '',
    confirmButtonText: '',
    confirmButtonClass: ''
  }),
  methods: {
    formatDate(date) {
      if (!date) return 'N/A';
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
      } catch (e) {
        return 'N/A';
      }
    },
    formatStatus(status) {
      if (!status) return 'Unknown';
      const statusMap = {
        created: 'Created',
        in_progress: 'In Progress',
        cancelled: 'Cancelled',
        resolved: 'Resolved',
        archived: 'Archived'
      };
      return statusMap[status] || status;
    },
    getStatusClass(status) {
      if (!status) return 'bg-gray-100 text-gray-800';
      const classMap = {
        created: 'bg-blue-100 text-blue-800',
        in_progress: 'bg-yellow-100 text-yellow-800',
        cancelled: 'bg-red-100 text-red-800',
        resolved: 'bg-green-100 text-green-800',
        archived: 'bg-gray-100 text-gray-800'
      };
      return classMap[status] || 'bg-gray-100 text-gray-800';
    },
    openCancelConfirm(caseReportId) {
      this.confirmCaseReportId = caseReportId;
      this.confirmAction = 'cancel';
      this.confirmMessage = 'Are you sure you want to cancel this case report?';
      this.confirmButtonText = 'Cancel Case Report';
      this.confirmButtonClass = 'bg-red-600 hover:bg-red-500 focus-visible:outline-red-600';
      this.showConfirmModal = true;
    },
    openArchiveConfirm(caseReportId) {
      this.confirmCaseReportId = caseReportId;
      this.confirmAction = 'archive';
      this.confirmMessage = 'Are you sure you want to archive this case report?';
      this.confirmButtonText = 'Archive Case Report';
      this.confirmButtonClass = 'bg-gray-600 hover:bg-gray-500 focus-visible:outline-gray-600';
      this.showConfirmModal = true;
    },
    closeConfirmModal() {
      this.showConfirmModal = false;
      this.confirmCaseReportId = null;
      this.confirmAction = null;
      this.confirmMessage = '';
      this.confirmButtonText = '';
      this.confirmButtonClass = '';
    },
    async executeConfirmAction() {
      if (!this.confirmCaseReportId || !this.confirmAction) {
        return;
      }

      try {
        let status;
        let successMessage;
        
        if (this.confirmAction === 'cancel') {
          status = 'cancelled';
          successMessage = 'Case report cancelled';
        } else if (this.confirmAction === 'archive') {
          status = 'archived';
          successMessage = 'Case report archived';
        } else {
          return;
        }

        await api.CaseReport.updateCaseReport({
          caseReportId: this.confirmCaseReportId,
          status
        });
        
        this.$toast.success(successMessage);
        this.closeConfirmModal();
        
        // Reload case reports
        const { caseReports } = await api.CaseReport.getCaseReports();
        this.caseReports = caseReports;
      } catch (error) {
        console.error(`Error ${this.confirmAction}ing case report`, error);
        this.$toast.error(error?.message || `Error ${this.confirmAction}ing case report`);
      }
    }
  },
  async mounted() {
    try {
      const { caseReports } = await api.CaseReport.getCaseReports();
      this.caseReports = caseReports;
      this.status = 'loaded';
    } catch (error) {
      console.error('Error loading case reports', error);
      this.status = 'loaded';
    }
  }
});
