/* global Prism */
'use strict';

const api = require('../api');
const baseComponent = require('../_util/baseComponent');
const template = require('./script.html');

module.exports = {
  template,
  extends: baseComponent,
  props: ['scriptId'],
  inject: ['state'],
  data() {
    return {
      status: 'loading',
      script: null,
      editedScript: '',
      isEditing: false,
      activeTab: 'code',
      selectedRunMode: 'run',
      showRunDropdown: false
    };
  },
  computed: {
    canUseDryRun() {
      return this.state.capabilities?.supportsTransactions !== false;
    },
    selectedRunLabel() {
      return this.selectedRunMode === 'dryRun' ? 'Dry Run' : 'Run';
    },
    isDryRunResult() {
      return this.script?.executionFinishedAt != null && this.script?.dryRun === true;
    }
  },
  methods: {
    async loadScript() {
      this.status = 'loading';
      try {
        const { script } = await api.Script.getScript({ scriptId: this.scriptId });
        this.script = script;
        this.editedScript = script.script;
        this.activeTab = script.executionResult == null ? 'code' : 'output';
      } finally {
        this.status = 'loaded';
        this.highlightCode();
      }
    },
    startEditing() {
      this.editedScript = this.script.script;
      this.isEditing = true;
      this.activeTab = 'code';
    },
    cancelEditing() {
      this.editedScript = this.script.script;
      this.isEditing = false;
      this.highlightCode();
    },
    selectRunMode(mode) {
      if (mode === 'dryRun' && !this.canUseDryRun) {
        return;
      }
      this.selectedRunMode = mode;
      this.showRunDropdown = false;
    },
    async executeScript() {
      this.showRunDropdown = false;
      try {
        const { script } = await api.Script.executeScript({
          scriptId: this.scriptId,
          script: this.isEditing ? this.editedScript : this.script.script,
          dryRun: this.selectedRunMode === 'dryRun'
        });
        this.script = script;
        this.editedScript = script.script;
        this.isEditing = false;
        this.activeTab = 'output';
        this.$toast.success(this.script.dryRun ? 'Dry run completed!' : 'Script executed successfully!');
      } catch (err) {
        const { script } = await api.Script.getScript({ scriptId: this.scriptId });
        this.script = script;
        this.editedScript = script.script;
        this.isEditing = false;
        this.activeTab = 'output';
        throw err;
      }
    },
    highlightCode() {
      this.$nextTick(() => {
        if (this.$refs.code) {
          Prism.highlightElement(this.$refs.code);
        }
      });
    }
  },
  mounted() {
    return this.loadScript();
  }
};
