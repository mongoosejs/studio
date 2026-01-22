'use strict';

const api = require('../api');

const { BSON, EJSON } = require('mongodb/lib/bson');

const ObjectId = new Proxy(BSON.ObjectId, {
  apply(target, thisArg, argumentsList) {
    return new target(...argumentsList);
  }
});

const appendCSS = require('../appendCSS');

appendCSS(require('./create-document.css'));

const template = require('./create-document.html');

module.exports = app => app.component('create-document', {
  props: ['currentModel', 'paths'],
  template,
  data: function() {
    return {
      documentData: '',
      editor: null,
      errors: [],
      aiPrompt: '',
      aiSuggestion: '',
      aiOriginalDocument: '',
      aiStreaming: false,
      aiSuggestionReady: false
    };
  },
  methods: {
    async requestAiSuggestion() {
      if (this.aiStreaming) {
        return;
      }
      const prompt = this.aiPrompt.trim();
      if (!prompt) {
        return;
      }

      this.aiOriginalDocument = this.editor.getValue();
      this.aiSuggestion = '';
      this.aiSuggestionReady = false;
      this.aiStreaming = true;

      try {
        for await (const event of api.Model.streamChatMessage({
          model: this.currentModel,
          content: prompt,
          documentData: this.aiOriginalDocument
        })) {
          if (event?.textPart) {
            this.aiSuggestion += event.textPart;
            this.editor.setValue(this.aiSuggestion);
          }
        }
        this.aiSuggestionReady = true;
      } catch (err) {
        this.editor.setValue(this.aiOriginalDocument);
        this.$toast.error('Failed to generate a document suggestion.');
        throw err;
      } finally {
        this.aiStreaming = false;
      }
    },
    acceptAiSuggestion() {
      this.aiSuggestionReady = false;
      this.aiSuggestion = '';
      this.aiOriginalDocument = '';
      this.aiPrompt = '';
    },
    rejectAiSuggestion() {
      this.editor.setValue(this.aiOriginalDocument);
      this.aiSuggestionReady = false;
      this.aiSuggestion = '';
      this.aiOriginalDocument = '';
    },
    async createDocument() {
      const data = EJSON.serialize(eval(`(${this.editor.getValue()})`));
      try {
        const { doc } = await api.Model.createDocument({ model: this.currentModel, data });
        this.errors.length = 0;
        this.$toast.success('Document created!');
        this.$emit('close', doc);
      } catch (err) {
        if (err.response?.data?.message) {
          console.log(err.response.data);
          const message = err.response.data.message.split(': ').slice(1).join(': ');
          this.errors = message.split(',').map(error => {
            return error.split(': ').slice(1).join(': ').trim();
          });
        }
        throw err;
      }
    }
  },
  mounted: function() {
    const requiredPaths = this.paths.filter(x => x.required);
    this.documentData = '{\n';
    for (let i = 0; i < requiredPaths.length; i++) {
      const isLast = i + 1 >= requiredPaths.length;
      this.documentData += `  ${requiredPaths[i].path}: ${isLast ? '' : ','}\n`;
    }
    this.documentData += '}';
    this.$refs.codeEditor.value = this.documentData;
    this.editor = CodeMirror.fromTextArea(this.$refs.codeEditor, {
      mode: 'javascript',
      lineNumbers: true,
      smartIndent: false
    });
  }
});
