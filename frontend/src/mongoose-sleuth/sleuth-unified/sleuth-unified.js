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
      showCaseNotesPopup: false,
      showInvestigationSettingsMenu: false,
      showAddDocumentsModal: false,
      showCompareModal: false,
      investigationDisplayType: 'json',
      compareDocumentKeys: [],
      timelineDragIndex: null,
      timelineDropIndex: null,
      timelineDidDrag: false,
      bookmarkedDocumentKey: null
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
    },
    activeNotebookDocument() {
      const docs = this.sleuthContext.selectedDocuments || [];
      if (docs.length === 0) {
        return null;
      }
      const key = this.sleuthContext.focusedInvestigationDocumentKey;
      if (key) {
        const found = docs.find(doc => this.sleuthContext.getDocumentKey(doc) === key);
        if (found) {
          return found;
        }
      }
      return docs[0];
    },
    activeNotebookIndex() {
      const doc = this.activeNotebookDocument;
      if (!doc) {
        return -1;
      }
      return this.sleuthContext.selectedDocuments.findIndex(
        d => this.sleuthContext.getDocumentKey(d) === this.sleuthContext.getDocumentKey(doc)
      );
    },
    bookmarkedDocument() {
      const key = this.bookmarkedDocumentKey;
      if (!key) {
        return null;
      }
      const docs = this.sleuthContext.selectedDocuments || [];
      return docs.find(doc => this.sleuthContext.getDocumentKey(doc) === key) || null;
    },
    bookmarkActive() {
      return !!this.bookmarkedDocument;
    },
    browseDocuments() {
      const docs = this.sleuthContext.selectedDocuments || [];
      if (!this.bookmarkActive) {
        return docs;
      }
      const bookmarkKey = this.bookmarkedDocumentKey;
      return docs.filter(doc => this.sleuthContext.getDocumentKey(doc) !== bookmarkKey);
    },
    displayNotebookDocument() {
      if (!this.bookmarkActive) {
        return this.activeNotebookDocument;
      }
      const active = this.activeNotebookDocument;
      if (active && !this.isBookmarked(active)) {
        return active;
      }
      return this.browseDocuments[0] || null;
    },
    displayNotebookIndex() {
      const doc = this.displayNotebookDocument;
      if (!doc) {
        return -1;
      }
      return this.browseDocuments.findIndex(
        d => this.sleuthContext.getDocumentKey(d) === this.sleuthContext.getDocumentKey(doc)
      );
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
        if (this.bookmarkedDocumentKey && !valid.has(this.bookmarkedDocumentKey)) {
          this.bookmarkedDocumentKey = null;
        }
        if (this.showCompareModal && this.compareDocumentKeys.length === 0) {
          this.closeCompareModal();
        }
        this.ensureNotebookFocus();
      }
    }
  },
  mounted() {
    document.addEventListener('click', this.onInvestigationSettingsOutsideClick, true);
    document.addEventListener('click', this.onCaseNotesOutsideClick, true);
    document.addEventListener('keydown', this.onNotebookKeydown);
    this.ensureNotebookFocus();
  },
  beforeDestroy() {
    document.removeEventListener('click', this.onInvestigationSettingsOutsideClick, true);
    document.removeEventListener('click', this.onCaseNotesOutsideClick, true);
    document.removeEventListener('keydown', this.onNotebookKeydown);
  },
  methods: {
    setInvestigationDisplayType(type) {
      if (type === 'json' || type === 'table') {
        this.investigationDisplayType = type;
      }
    },
    ensureNotebookFocus() {
      const docs = this.sleuthContext.selectedDocuments || [];
      if (docs.length === 0) {
        return;
      }
      const key = this.sleuthContext.focusedInvestigationDocumentKey;
      const valid = key && docs.some(doc => this.sleuthContext.getDocumentKey(doc) === key);
      if (!valid) {
        this.sleuthContext.focusInvestigationDocument(docs[0]);
      }
    },
    openCompareModal() {
      const docs = this.sleuthContext.selectedDocuments || [];
      if (docs.length === 0) {
        return;
      }
      if (this.compareDocumentKeys.length === 0) {
        if (docs.length >= 2) {
          this.compareDocumentKeys = docs.slice(0, 2).map(doc => this.sleuthContext.getDocumentKey(doc)).filter(Boolean);
        } else {
          const key = this.sleuthContext.getDocumentKey(docs[0]);
          if (key) {
            this.compareDocumentKeys = [key];
          }
        }
      }
      this.showCompareModal = true;
    },
    closeCompareModal() {
      this.showCompareModal = false;
    },
    isCompareColumn(doc) {
      const key = this.sleuthContext.getDocumentKey(doc);
      return !!key && this.compareDocumentKeys.includes(key);
    },
    isTimelineChipHighlighted(doc) {
      if (this.bookmarkActive && this.isBookmarked(doc)) {
        return false;
      }
      const active = this.displayNotebookDocument;
      if (!active) {
        return false;
      }
      return this.sleuthContext.getDocumentKey(doc) === this.sleuthContext.getDocumentKey(active);
    },
    isTimelineChipBookmarked(doc) {
      return this.bookmarkActive && this.isBookmarked(doc);
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
        if (this.showCompareModal && this.compareDocumentKeys.length === 0) {
          this.closeCompareModal();
        }
      } else {
        this.compareDocumentKeys.push(key);
      }
    },
    clearCompareColumns() {
      this.compareDocumentKeys = [];
      this.closeCompareModal();
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
    hasCaseReportNotes() {
      const n = this.sleuthContext && this.sleuthContext.notes;
      return typeof n === 'string' && n.trim().length > 0;
    },
    toggleCaseReportSection(section) {
      if (typeof section === 'string' && Object.prototype.hasOwnProperty.call(this.caseReportSections, section)) {
        this.caseReportSections[section] = !this.caseReportSections[section];
      }
    },
    toggleCaseNotesPopup() {
      this.showCaseNotesPopup = !this.showCaseNotesPopup;
    },
    closeCaseNotesPopup() {
      this.showCaseNotesPopup = false;
    },
    onCaseNotesOutsideClick(event) {
      if (!this.showCaseNotesPopup || !this.sleuthContext.isCaseReportDetailRoute) {
        return;
      }
      const fab = this.$refs.caseNotesFab;
      const popup = this.$refs.caseNotesPopup;
      if (fab && fab.contains(event.target)) {
        return;
      }
      if (popup && popup.contains(event.target)) {
        return;
      }
      this.closeCaseNotesPopup();
    },
    isCaseReportSectionOpen(section) {
      return !!this.caseReportSections[section];
    },
    focusNotebookDocument(doc) {
      if (this.timelineDidDrag) {
        return;
      }
      if (this.bookmarkActive && this.isBookmarked(doc)) {
        return;
      }
      this.sleuthContext.focusInvestigationDocument(doc);
    },
    goToAdjacentNotebookDocument(delta) {
      const docs = this.browseDocuments;
      if (docs.length === 0) {
        return;
      }
      let idx = this.displayNotebookIndex;
      if (idx < 0) {
        idx = 0;
      }
      const next = docs[idx + delta];
      if (next) {
        this.sleuthContext.focusInvestigationDocument(next);
      }
    },
    isBookmarked(doc) {
      const key = this.sleuthContext.getDocumentKey(doc);
      return !!key && this.bookmarkedDocumentKey === key;
    },
    toggleBookmark(doc) {
      const key = this.sleuthContext.getDocumentKey(doc);
      if (!key) {
        return;
      }
      if (this.bookmarkedDocumentKey === key) {
        this.bookmarkedDocumentKey = null;
        return;
      }
      if (this.bookmarkedDocumentKey) {
        return;
      }
      this.bookmarkedDocumentKey = key;
      if (this.sleuthContext.focusedInvestigationDocumentKey === key) {
        const others = (this.sleuthContext.selectedDocuments || []).filter(
          d => this.sleuthContext.getDocumentKey(d) !== key
        );
        if (others.length > 0) {
          this.sleuthContext.focusInvestigationDocument(others[0]);
        }
      }
    },
    clearBookmark() {
      this.bookmarkedDocumentKey = null;
    },
    onNotebookKeydown(event) {
      if (this.showCompareModal || this.showAddDocumentsModal || this.sleuthContext.shouldShowCaseReportModal) {
        return;
      }
      const target = event.target;
      if (target && typeof target.closest === 'function') {
        if (target.closest('input, textarea, select, [contenteditable="true"]')) {
          return;
        }
      }
      if (event.key === 'ArrowLeft' || event.key === '[') {
        event.preventDefault();
        this.goToAdjacentNotebookDocument(-1);
      } else if (event.key === 'ArrowRight' || event.key === ']') {
        event.preventDefault();
        this.goToAdjacentNotebookDocument(1);
      }
    },
    addActiveDocumentToCompare() {
      const doc = this.displayNotebookDocument;
      if (!doc) {
        return;
      }
      const key = this.sleuthContext.getDocumentKey(doc);
      if (!key) {
        return;
      }
      if (!this.compareDocumentKeys.includes(key)) {
        this.compareDocumentKeys.push(key);
      }
      this.openCompareModal();
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
    }
  }
});
