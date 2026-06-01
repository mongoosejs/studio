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
const STAGE_PREVIEW_LIMIT = 3;
const RESULT_PAGE_SIZE = 20;

function createDefaultStage() {
  return {
    id: Math.random().toString(36).slice(2),
    operator: '$match',
    bodyText: '{}',
    previewDocs: [],
    previewError: '',
    previewLoading: false,
    previewExpanded: false,
    previewLoaded: false,
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
    results: [],
    visibleResultsCount: RESULT_PAGE_SIZE,
    resultsRenderKey: 0,
    activeRunId: 0,
    editingStageId: null,
    pipelineErrorsRevealed: false,
    pipelineErrorsPanelOpen: false
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
    pipelineSignature() {
      return this.stages.map(stage => `${stage.operator}::${stage.bodyText || ''}`).join('||');
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
    onStageBodyBlur(stage) {
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
    formatDoc(doc) {
      return JSON.stringify(doc, null, 2);
    },
    loadMoreResults() {
      this.visibleResultsCount = Math.min(this.visibleResultsCount + RESULT_PAGE_SIZE, this.results.length);
    },
    toggleStagePreview(stage) {
      stage.previewExpanded = !stage.previewExpanded;
    },
    pipelineThroughIndexHasErrors(index) {
      for (let i = 0; i <= index; i++) {
        if (this.getStageError(this.stages[i]) != null) {
          return true;
        }
      }
      return false;
    },
    runStagePreview(index) {
      this.editingStageId = null;
      if (index < 0 || index >= this.stages.length || !this.selectedModel) {
        return;
      }
      if (this.pipelineThroughIndexHasErrors(index)) {
        this.revealAllPipelineErrors();
        return;
      }
      const stage = this.stages[index];
      stage.previewExpanded = true;
      this.loadSingleStagePreview(index);
    },
    async loadSingleStagePreview(index) {
      if (index < 0 || index >= this.stages.length) {
        return;
      }
      const stage = this.stages[index];
      if (!this.selectedModel) {
        return;
      }
      const token = (stage._previewRequestId = (stage._previewRequestId || 0) + 1);
      stage.previewLoading = true;
      stage.previewError = '';
      try {
        const partialPipeline = this.buildPipeline().slice(0, index + 1);
        const wirePipeline = serializePipelineForWire(partialPipeline);
        const { docs } = await api.Model.aggregate({
          model: this.selectedModel,
          pipeline: wirePipeline,
          limit: STAGE_PREVIEW_LIMIT,
          roles: this.roles
        });
        if (token !== stage._previewRequestId) {
          return;
        }
        stage.previewDocs = docs || [];
        stage.previewLoaded = true;
      } catch (err) {
        if (token !== stage._previewRequestId) {
          return;
        }
        stage.previewError = err?.response?.data?.message || err.message || 'Could not preview this stage';
        stage.previewDocs = [];
        stage.previewLoaded = true;
      } finally {
        if (token === stage._previewRequestId) {
          stage.previewLoading = false;
        }
      }
    },
    invalidateStagePreviews() {
      for (const stage of this.stages) {
        stage._previewRequestId = (stage._previewRequestId || 0) + 1;
        stage.previewDocs = [];
        stage.previewError = '';
        stage.previewLoading = false;
        stage.previewLoaded = false;
      }
    },
    async runAggregation() {
      this.editingStageId = null;
      this.errorMessage = '';
      const pipeline = this.buildPipeline();
      if (this.hasPipelineErrors) {
        this.revealAllPipelineErrors();
        this.errorMessage = 'Fix invalid stage syntax before running.';
        return;
      }
      if (!this.selectedModel) {
        return;
      }
      const runId = ++this.activeRunId;
      this.isRunning = true;
      try {
        let wirePipeline;
        try {
          wirePipeline = serializePipelineForWire(pipeline);
        } catch (err) {
          this.errorMessage = `Could not serialize pipeline: ${err.message}`;
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
        this.clearRevealedPipelineErrors();
      } catch (err) {
        if (runId !== this.activeRunId) {
          return;
        }
        this.errorMessage = err?.response?.data?.message || err.message || 'Aggregation failed';
      } finally {
        if (runId === this.activeRunId) {
          this.isRunning = false;
        }
      }
    }
  },
  watch: {
    pipelineSignature() {
      this.invalidateStagePreviews();
    },
    selectedModel() {
      this.invalidateStagePreviews();
    }
  }
});
