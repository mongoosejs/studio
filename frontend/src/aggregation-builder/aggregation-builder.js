'use strict';

const api = require('../api');
const template = require('./aggregation-builder.html');
const { BSON, EJSON } = require('mongodb/lib/bson');

const ObjectId = new Proxy(BSON.ObjectId, {
  apply(target, thisArg, argumentsList) {
    return new target(...argumentsList);
  }
});

/**
 * Serialize a pipeline for the API — same EJSON round-trip as Model.createDocument.
 */
function serializePipelineForWire(pipeline) {
  return EJSON.serialize(pipeline);
}

/**
 * Parse a stage body as JSON, or as a JavaScript object literal like the
 * create-document modal (unquoted keys, ObjectId(), new Date(), RegExp, etc.)
 * via a controlled Function scope.
 */
function parseStageBody(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    return {};
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    // Not strict JSON — try a JS expression in a controlled scope.
  }
  try {
    const fn = new Function(
      'ObjectId',
      'Date',
      'Math',
      'RegExp',
      `return (${trimmed});`
    );
    return fn(ObjectId, Date, Math, RegExp);
  } catch (err) {
    throw new Error(err.message || String(err));
  }
}

const STAGE_OPERATORS = [
  '$match',
  '$project',
  '$group',
  '$sort',
  '$limit',
  '$skip',
  '$unwind',
  '$lookup',
  '$addFields',
  '$set',
  '$unset',
  '$count',
  '$facet'
];
const RESULT_PAGE_SIZE = 20;

function createDefaultStage() {
  return {
    id: Math.random().toString(36).slice(2),
    operator: '$match',
    bodyText: '{}',
    expanded: true,
    showBodyError: false,
    frozenBodyError: null
  };
}

function cloneStageFrom(source) {
  return {
    id: Math.random().toString(36).slice(2),
    operator: source.operator,
    bodyText: source.bodyText,
    expanded: true,
    showBodyError: false,
    frozenBodyError: null
  };
}

module.exports = app => app.component('aggregation-builder', {
  template: template,
  props: ['roles'],
  data: () => ({
    models: [],
    selectedModel: null,
    resultLimit: 20,
    stages: [createDefaultStage()],
    stageOperators: STAGE_OPERATORS,
    isRunning: false,
    errorMessage: '',
    hasRunResult: false,
    resultsPanelVisible: false,
    results: [],
    visibleResultsCount: RESULT_PAGE_SIZE,
    resultsRenderKey: 0,
    activeRunId: 0,
    editingStageId: null,
    pipelineErrorsRevealed: false,
    pipelineErrorsPanelOpen: false,
    dragStageIndex: null,
    dropStageIndex: null
  }),
  computed: {
    hasPipelineErrors() {
      return this.stages.some(stage => this.getStageError(stage) != null);
    },
    hasVisibleErrors() {
      return this.visiblePipelineStageErrors.length > 0 || !!this.errorMessage;
    },
    visibleErrorCount() {
      return this.visiblePipelineStageErrors.length + (this.errorMessage ? 1 : 0);
    },
    visiblePipelineStageErrors() {
      const errors = [];
      for (let i = 0; i < this.stages.length; i++) {
        const message = this.getVisibleStageError(this.stages[i]);
        if (message) {
          errors.push({ stageNumber: i + 1, message });
        }
      }
      return errors;
    },
    visibleResults() {
      return this.results.slice(0, this.visibleResultsCount);
    },
    hasMoreResults() {
      return this.visibleResultsCount < this.results.length;
    },
    nextLoadMoreCount() {
      return Math.min(RESULT_PAGE_SIZE, this.results.length - this.visibleResultsCount);
    },
    visibleResultsExpandedFields() {
      return this.visibleResults.map((_, i) => `root[${i}]`);
    }
  },
  async mounted() {
    const { models } = await api.Model.listModels();
    this.models = models || [];
    if (this.models.length > 0) {
      this.selectedModel = this.models[0];
    }
  },
  methods: {
    addStage() {
      for (const stage of this.stages) {
        stage.expanded = false;
      }
      this.stages.push(createDefaultStage());
      this.$nextTick(() => {
        const rows = this.$refs.workflowStageRows;
        const el = Array.isArray(rows) ? rows[rows.length - 1] : rows;
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      });
    },
    removeStage(index) {
      if (index < 0 || index >= this.stages.length) {
        return;
      }
      const removed = this.stages[index];
      if (removed && this.editingStageId === removed.id) {
        this.editingStageId = null;
      }
      if (this.stages.length === 1) {
        this.stages.splice(0, 1, createDefaultStage());
        return;
      }
      this.stages.splice(index, 1);
    },
    duplicateStage(index) {
      if (index < 0 || index >= this.stages.length) {
        return;
      }
      for (const stage of this.stages) {
        stage.expanded = false;
      }
      const duplicate = cloneStageFrom(this.stages[index]);
      this.stages.splice(index + 1, 0, duplicate);
      this.$nextTick(() => {
        const rows = this.$refs.workflowStageRows;
        const el = Array.isArray(rows) ? rows[index + 1] : rows;
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    },
    moveStage(fromIndex, toIndex) {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= this.stages.length || toIndex >= this.stages.length) {
        return;
      }
      if (fromIndex === toIndex) {
        return;
      }
      const [moved] = this.stages.splice(fromIndex, 1);
      this.stages.splice(toIndex, 0, moved);
    },
    moveStageUp(index) {
      if (index > 0) {
        this.moveStage(index, index - 1);
      }
    },
    moveStageDown(index) {
      if (index < this.stages.length - 1) {
        this.moveStage(index, index + 1);
      }
    },
    onStageDragStart(index, event) {
      this.dragStageIndex = index;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      }
    },
    onStageDragOver(index, event) {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      this.dropStageIndex = index;
    },
    onStageDragEnd() {
      this.dragStageIndex = null;
      this.dropStageIndex = null;
    },
    onStageDrop(index, event) {
      event.preventDefault();
      const fromIndex = this.dragStageIndex;
      this.onStageDragEnd();
      if (fromIndex == null || fromIndex === index) {
        return;
      }
      const [moved] = this.stages.splice(fromIndex, 1);
      let insertIndex = index;
      if (fromIndex < index) {
        insertIndex -= 1;
      }
      this.stages.splice(insertIndex, 0, moved);
    },
    toggleStageExpanded(stage) {
      stage.expanded = !stage.expanded;
    },
    getStageError(stage) {
      const text = typeof stage.bodyText === 'string' ? stage.bodyText.trim() : '';
      if (!text) {
        return null;
      }
      let parsedBody = null;
      try {
        parsedBody = parseStageBody(text);
      } catch (err) {
        return err.message;
      }
      if (parsedBody == null || Array.isArray(parsedBody) || typeof parsedBody !== 'object') {
        return 'Stage body must be a plain object';
      }
      return null;
    },
    getVisibleStageError(stage) {
      if (this.editingStageId === stage.id) {
        return null;
      }
      if (!stage.showBodyError && !this.pipelineErrorsRevealed) {
        return null;
      }
      return stage.frozenBodyError;
    },
    syncStageFrozenError(stage) {
      stage.frozenBodyError = this.getStageError(stage);
    },
    onStageBodyFocus(stage) {
      this.editingStageId = stage.id;
    },
    onStageBodyBlur(stage, event) {
      if (event?.currentTarget?.contains(event.relatedTarget)) {
        return;
      }
      this.editingStageId = null;
      stage.showBodyError = true;
      this.syncStageFrozenError(stage);
    },
    revealAllPipelineErrors() {
      this.pipelineErrorsRevealed = true;
      this.editingStageId = null;
      for (const stage of this.stages) {
        stage.showBodyError = true;
        this.syncStageFrozenError(stage);
        if (stage.frozenBodyError) {
          stage.expanded = true;
        }
      }
      if (this.hasVisibleErrors) {
        this.pipelineErrorsPanelOpen = true;
      }
    },
    clearRevealedPipelineErrors() {
      this.pipelineErrorsRevealed = false;
      this.pipelineErrorsPanelOpen = false;
      for (const stage of this.stages) {
        stage.showBodyError = false;
        stage.frozenBodyError = null;
      }
    },
    togglePipelineErrorsPanel() {
      this.pipelineErrorsPanelOpen = !this.pipelineErrorsPanelOpen;
    },
    closePipelineErrorsPanel() {
      this.pipelineErrorsPanelOpen = false;
    },
    buildPipeline() {
      return this.stages.map(stage => {
        const text = typeof stage.bodyText === 'string' ? stage.bodyText.trim() : '';
        let parsedBody = {};
        if (text) {
          try {
            parsedBody = parseStageBody(text);
          } catch (err) {
            parsedBody = {};
          }
        }
        return { [stage.operator]: parsedBody };
      });
    },
    pipelinePreviewThrough(index) {
      const slice = this.buildPipeline().slice(0, index + 1);
      try {
        return JSON.stringify(serializePipelineForWire(slice), null, 2);
      } catch (err) {
        return `/* Could not serialize pipeline for preview: ${err.message} */\n${JSON.stringify(slice, null, 2)}`;
      }
    },
    loadMoreResults() {
      this.visibleResultsCount = Math.min(this.visibleResultsCount + RESULT_PAGE_SIZE, this.results.length);
    },
    scrollToResults() {
      this.$nextTick(() => {
        const el = this.$refs.resultsSection;
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    },
    copyResults() {
      if (!this.results.length) {
        return;
      }
      const text = JSON.stringify(EJSON.serialize(this.results), null, 2);
      const onSuccess = () => this.$toast.success('Results copied to clipboard');
      const fallbackCopy = () => {
        try {
          const el = document.createElement('textarea');
          el.value = text;
          document.body.appendChild(el);
          el.select();
          document.execCommand('copy');
          document.body.removeChild(el);
          onSuccess();
        } catch {
          this.$toast.error('Copy failed');
        }
      };
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(onSuccess).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
    },
    async runAggregation() {
      this.editingStageId = null;
      this.errorMessage = '';
      this.hasRunResult = false;
      this.resultsPanelVisible = true;
      const pipeline = this.buildPipeline();
      if (this.hasPipelineErrors) {
        this.revealAllPipelineErrors();
        this.errorMessage = 'Fix invalid stage syntax before running.';
        this.scrollToResults();
        return;
      }
      if (!this.selectedModel) {
        return;
      }
      const runId = ++this.activeRunId;
      this.isRunning = true;
      this.scrollToResults();
      try {
        let wirePipeline;
        try {
          wirePipeline = serializePipelineForWire(pipeline);
        } catch (err) {
          this.errorMessage = `Could not serialize pipeline: ${err.message}`;
          this.scrollToResults();
          return;
        }
        const { docs } = await api.Model.aggregate({
          model: this.selectedModel,
          pipeline: wirePipeline,
          limit: this.resultLimit,
          roles: this.roles
        });
        if (runId !== this.activeRunId) {
          return;
        }
        this.results = docs || [];
        this.visibleResultsCount = RESULT_PAGE_SIZE;
        this.resultsRenderKey += 1;
        this.hasRunResult = true;
        this.clearRevealedPipelineErrors();
        this.scrollToResults();
      } catch (err) {
        if (runId !== this.activeRunId) {
          return;
        }
        this.errorMessage = err?.response?.data?.message || err.message || 'Aggregation failed';
        this.hasRunResult = true;
        this.pipelineErrorsPanelOpen = true;
        this.scrollToResults();
      } finally {
        if (runId === this.activeRunId) {
          this.isRunning = false;
        }
      }
    }
  }
});
