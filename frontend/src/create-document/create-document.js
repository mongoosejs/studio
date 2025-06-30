'use strict';

const api = require('../api');

const { BSON, EJSON } = require('bson');

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
      errors: []
    };
  },
  methods: {
    async createDocument() {
      const data = EJSON.serialize(eval(`(${this.editor.getValue()})`));
      const { doc } = await api.Model.createDocument({ model: this.currentModel, data }).catch(err => {
        if (err.response?.data?.message) {
          console.log(err.response.data);
          const message = err.response.data.message.split(': ').slice(1).join(': ');
          this.errors = message.split(',').map(error => {
            return error.split(': ').slice(1).join(': ').trim();
          });
          throw new Error(err.response?.data?.message);
        }
        throw err;
      });
      this.errors.length = 0;
      this.$emit('close', doc);
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