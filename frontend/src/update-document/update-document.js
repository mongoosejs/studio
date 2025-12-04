'use strict';

const api = require('../api');

const { BSON, EJSON } = require('mongodb/lib/bson');

const ObjectId = new Proxy(BSON.ObjectId, {
  apply(target, thisArg, argumentsList) {
    return new target(...argumentsList);
  }
});

const appendCSS = require('../appendCSS');

appendCSS(require('./update-document.css'));

const template = require('./update-document.html');

module.exports = app => app.component('update-document', {
  props: ['currentModel', 'document', 'multiple'],
  template,
  data: function() {
    return {
      editor: null,
      errors: []
    };
  },
  methods: {
    async updateDocument() {
      const data = EJSON.serialize(eval(`(${this.editor.getValue()})`));
      if (this.multiple) {
        const ids = this.document.map(x => x._id);
        await api.Model.updateDocuments({ model: this.currentModel, _id: ids, update: data }).catch(err => {
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
      } else {
        await api.Model.updateDocument({ model: this.currentModel, _id: this.document._id, update: data }).catch(err => {
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
      }
      this.errors.length = 0;
      this.$emit('update');
      this.$emit('close');
    }
  },
  mounted: function() {
    this.$refs.codeEditor.value = '{\n    \n}';
    this.editor = CodeMirror.fromTextArea(this.$refs.codeEditor, {
      mode: 'javascript',
      lineNumbers: true,
      smartIndent: false
    });
  }
});
