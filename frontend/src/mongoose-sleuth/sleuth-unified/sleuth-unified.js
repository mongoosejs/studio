'use strict';

const marked = require('marked').marked;
const appendCSS = require('../../appendCSS');
const template = require('./sleuth-unified.html');

appendCSS(require('./sleuth-unified.css'));

module.exports = app => app.component('sleuth-unified', {
  template,
  inject: ['sleuthContext'],
  data() {
    return {
      caseReportSections: {
        summary: false
      },
      showInvestigationSettingsMenu: false,
      showAddDocumentsModal: false,
      investigationDisplayType: 'json',
      investigationViewMode: 'list',
      compareDocumentKeys: [],
      timelineDragIndex: null,
      timelineDropIndex: null,
      timelineDidDrag: false
    };
  },
  computed: {
    compareDocuments() {
      if (!this.sleuthContext) {
        return [];
      }
      const keySet = new Set(this.compareDocumentKeys);
      return this.sleuthContext.selectedDocuments.filter(doc => {
        const key = this.sleuthContext.getDocumentKey(doc);
        return key && keySet.has(key);
      });
    }
  },
  watch: {
    'sleuthContext.selectedDocuments': {
      deep: true,
      handler(docs) {
        if (!Array.isArray(docs)) {
          this.compareDocumentKeys = [];
          return;
        }
        const valid = new Set(
          docs.map(doc => this.sleuthContext.getDocumentKey(doc)).filter(Boolean)
        );
        this.compareDocumentKeys = this.compareDocumentKeys.filter(k => valid.has(k));
        if (this.investigationViewMode === 'compare' && this.compareDocumentKeys.length === 0) {
          this.investigationViewMode = 'list';
        }
      }
    }
  },
  mounted() {
    document.addEventListener('click', this.onInvestigationSettingsOutsideClick, true);
  },
  beforeDestroy() {
    document.removeEventListener('click', this.onInvestigationSettingsOutsideClick, true);
  },
  methods: {
    setInvestigationDisplayType(type) {
      if (type === 'json' || type === 'table') {
        this.investigationDisplayType = type;
      }
    },
    setInvestigationViewMode(mode) {
      if (mode !== 'list' && mode !== 'compare') {
        return;
      }
      if (mode === 'list') {
        this.compareDocumentKeys = [];
      }
      this.investigationViewMode = mode;
    },
    openCompareView() {
      if (this.compareDocumentKeys.length === 0) {
        const docs = this.sleuthContext.selectedDocuments || [];
        if (docs.length >= 2) {
          this.compareDocumentKeys = docs.slice(0, 2).map(doc => this.sleuthContext.getDocumentKey(doc)).filter(Boolean);
        } else if (docs.length === 1) {
          const key = this.sleuthContext.getDocumentKey(docs[0]);
          if (key) {
            this.compareDocumentKeys = [key];
          }
        }
      }
      if (this.compareDocumentKeys.length > 0) {
        this.investigationViewMode = 'compare';
      }
    },
    isCompareColumn(doc) {
      const key = this.sleuthContext.getDocumentKey(doc);
      return !!key && this.compareDocumentKeys.includes(key);
    },
    isTimelineChipHighlighted(doc) {
      if (this.investigationViewMode === 'compare') {
        return this.isCompareColumn(doc);
      }
      return this.sleuthContext.isInvestigationDocumentFocused(doc);
    },
    toggleCompareColumn(doc, event) {
      if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
      const key = this.sleuthContext.getDocumentKey(doc);
      if (!key) {
        return;
      }
      const idx = this.compareDocumentKeys.indexOf(key);
      if (idx >= 0) {
        this.compareDocumentKeys.splice(idx, 1);
        if (this.investigationViewMode === 'compare' && this.compareDocumentKeys.length === 0) {
          this.investigationViewMode = 'list';
        }
      } else {
        this.compareDocumentKeys.push(key);
      }
    },
    clearCompareColumns() {
      this.compareDocumentKeys = [];
      if (this.investigationViewMode === 'compare') {
        this.investigationViewMode = 'list';
      }
    },
    openAddDocumentsModal() {
      this.showAddDocumentsModal = true;
      this.$nextTick(() => {
        if (this.sleuthContext && typeof this.sleuthContext.attachScrollListener === 'function') {
          this.sleuthContext.attachScrollListener();
        }
      });
    },
    closeAddDocumentsModal() {
      this.showAddDocumentsModal = false;
    },
    toggleInvestigationSettingsMenu() {
      this.showInvestigationSettingsMenu = !this.showInvestigationSettingsMenu;
    },
    closeInvestigationSettingsMenu() {
      this.showInvestigationSettingsMenu = false;
    },
    onInvestigationSettingsOutsideClick(event) {
      if (!this.showInvestigationSettingsMenu) {
        return;
      }
      const container = this.$refs.investigationSettingsMenu;
      if (container && !container.contains(event.target)) {
        this.closeInvestigationSettingsMenu();
      }
    },
    renderMarkdown(text) {
      if (!text) return '';
      return marked(text);
    },
    hasAiSummary() {
      const s = this.sleuthContext && this.sleuthContext.aiSummary;
      return typeof s === 'string' && s.trim().length > 0;
    },
    toggleCaseReportSection(section) {
      if (typeof section === 'string' && Object.prototype.hasOwnProperty.call(this.caseReportSections, section)) {
        this.caseReportSections[section] = !this.caseReportSections[section];
      }
    },
    isCaseReportSectionOpen(section) {
      return !!this.caseReportSections[section];
    },
    onTimelineDragStart(index, event) {
      this.timelineDragIndex = index;
      this.timelineDidDrag = false;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      }
    },
    onTimelineDragOver(index, event) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      this.timelineDropIndex = index;
    },
    onTimelineDragLeave() {
      this.timelineDropIndex = null;
    },
    async onTimelineDrop(index, event) {
      event.preventDefault();
      const fromIndex = this.timelineDragIndex;
      this.timelineDragIndex = null;
      this.timelineDropIndex = null;
      if (fromIndex == null || fromIndex === index) {
        return;
      }
      this.timelineDidDrag = true;
      this.sleuthContext.reorderSelectedDocuments(fromIndex, index);
      if (this.sleuthContext.currentCaseReportId) {
        await this.sleuthContext.persistCaseReportDocuments({ toast: false });
      }
    },
    onTimelineDragEnd() {
      this.timelineDragIndex = null;
      this.timelineDropIndex = null;
    },
    isTimelineDragging(index) {
      return this.timelineDragIndex === index;
    },
    isTimelineDropTarget(index) {
      return this.timelineDropIndex === index && this.timelineDragIndex !== index;
    },
    scrollToInvestigationDocument(doc) {
      if (this.timelineDidDrag) {
        return;
      }
      this.sleuthContext.focusInvestigationDocument(doc);
      if (this.investigationViewMode === 'list') {
        this.$nextTick(() => {
          const key = this.sleuthContext.getDocumentKey(doc);
          const list = this.$refs.investigationDocList || this.$refs.sidebarDocList;
          if (!list || !key) {
            return;
          }
          const el = list.querySelector(`[data-doc-key="${key}"]`);
          if (el && typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        });
      }
    }
  }
});
