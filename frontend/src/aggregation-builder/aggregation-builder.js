'use strict';

const api = require('../api');
const template = require('./aggregation-builder.html');

const appendCSS = require('../appendCSS');
appendCSS(require('./aggregation-builder.css'));

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
const AUTO_RUN_DEBOUNCE_MS = 450;
const RESULT_PAGE_SIZE = 20;

function createDefaultStage() {
  return {
    id: Math.random().toString(36).slice(2),
    operator: '$match',
    bodyText: '{}',
    previewDocs: [],
    previewError: '',
    previewLoading: false,
    previewExpanded: false
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
    resultExpandedState: {},
    autoRunTimer: null,
    previewRefreshTimer: null,
    activeRunId: 0
  }),
  computed: {
    hasPipelineErrors() {
      return this.stages.some(stage => this.getStageError(stage) != null);
    },
    pipelineSignature() {
      return this.stages.map(stage => `${stage.operator}::${stage.bodyText || ''}`).join('||');
    },
    pipelinePreview() {
      return JSON.stringify(this.buildPipeline(), null, 2);
    },
    visibleResults() {
      return this.results.slice(0, this.visibleResultsCount);
    },
    hasMoreResults() {
      return this.visibleResultsCount < this.results.length;
    }
  },
  beforeUnmount() {
    if (this.autoRunTimer != null) {
      clearTimeout(this.autoRunTimer);
      this.autoRunTimer = null;
    }
    if (this.previewRefreshTimer != null) {
      clearTimeout(this.previewRefreshTimer);
      this.previewRefreshTimer = null;
    }
  },
  async mounted() {
    const { models } = await api.Model.listModels();
    this.models = models || [];
    if (this.models.length > 0) {
      this.selectedModel = this.models[0];
      this.scheduleAutoRun();
      this.scheduleAllStagePreviewsRefresh();
    }
  },
  methods: {
    addStage() {
      this.stages.push(createDefaultStage());
    },
    removeStage(index) {
      if (this.stages.length <= 1) {
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
        parsedBody = JSON.parse(text);
      } catch (err) {
        return err.message;
      }
      if (parsedBody == null || Array.isArray(parsedBody) || typeof parsedBody !== 'object') {
        return 'Stage body must be a JSON object';
      }
      return null;
    },
    buildPipeline() {
      return this.stages.map(stage => {
        const text = typeof stage.bodyText === 'string' ? stage.bodyText.trim() : '';
        let parsedBody = {};
        if (text) {
          try {
            parsedBody = JSON.parse(text);
          } catch (err) {
            parsedBody = {};
          }
        }
        return { [stage.operator]: parsedBody };
      });
    },
    formatDoc(doc) {
      return JSON.stringify(doc, null, 2);
    },
    toggleResult(index) {
      this.resultExpandedState[index] = !this.resultExpandedState[index];
    },
    isResultExpanded(index) {
      return !!this.resultExpandedState[index];
    },
    loadMoreResults() {
      this.visibleResultsCount = Math.min(this.visibleResultsCount + RESULT_PAGE_SIZE, this.results.length);
    },
    toggleStagePreview(stage) {
      stage.previewExpanded = !stage.previewExpanded;
      if (stage.previewExpanded) {
        const stageIndex = this.stages.findIndex(s => s.id === stage.id);
        this.loadSingleStagePreview(stageIndex);
      }
    },
    /**
     * Keep every stage’s sample in sync (including while collapsed) so the header
     * count and expand content match the current pipeline.
     */
    scheduleAllStagePreviewsRefresh() {
      if (this.previewRefreshTimer != null) {
        clearTimeout(this.previewRefreshTimer);
      }
      this.previewRefreshTimer = setTimeout(() => {
        this.refreshAllStagePreviews();
        this.previewRefreshTimer = null;
      }, AUTO_RUN_DEBOUNCE_MS);
    },
    refreshAllStagePreviews() {
      if (!this.selectedModel || this.stages.length === 0) {
        return;
      }
      for (let i = 0; i < this.stages.length; i++) {
        this.loadSingleStagePreview(i);
      }
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
        const { docs } = await api.Model.aggregate({
          model: this.selectedModel,
          pipeline: partialPipeline,
          limit: STAGE_PREVIEW_LIMIT,
          roles: this.roles
        });
        if (token !== stage._previewRequestId) {
          return;
        }
        stage.previewDocs = docs || [];
      } catch (err) {
        if (token !== stage._previewRequestId) {
          return;
        }
        stage.previewError = err?.response?.data?.message || err.message || 'Could not preview this stage';
        stage.previewDocs = [];
      } finally {
        if (token === stage._previewRequestId) {
          stage.previewLoading = false;
        }
      }
    },
    scheduleAutoRun() {
      if (this.autoRunTimer != null) {
        clearTimeout(this.autoRunTimer);
      }
      this.autoRunTimer = setTimeout(() => {
        this.runAggregation({ isAutoRun: true });
      }, AUTO_RUN_DEBOUNCE_MS);
    },
    async runAggregation(options = {}) {
      const isAutoRun = !!options.isAutoRun;
      this.errorMessage = '';
      this.results = [];
      this.resultExpandedState = {};
      this.visibleResultsCount = RESULT_PAGE_SIZE;
      const pipeline = this.buildPipeline();
      if (this.hasPipelineErrors) {
        if (!isAutoRun) {
          this.errorMessage = 'Fix invalid stage JSON before running.';
        }
        return;
      }
      if (!this.selectedModel) {
        return;
      }
      const runId = ++this.activeRunId;
      this.isRunning = true;
      try {
        const { docs } = await api.Model.aggregate({
          model: this.selectedModel,
          pipeline,
          limit: this.resultLimit,
          roles: this.roles
        });
        if (runId !== this.activeRunId) {
          return;
        }
        this.results = docs || [];
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
      this.scheduleAutoRun();
      this.scheduleAllStagePreviewsRefresh();
    },
    selectedModel() {
      this.scheduleAutoRun();
      this.scheduleAllStagePreviewsRefresh();
    },
    resultLimit() {
      this.scheduleAutoRun();
    }
  }
});
