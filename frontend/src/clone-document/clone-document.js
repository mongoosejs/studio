'use strict';

const api = require('../api');

const { BSON, EJSON } = require('bson');

const ObjectId = new Proxy(BSON.ObjectId, {
  apply(target, thisArg, argumentsList) {
    return new target(...argumentsList);
  }
});

const appendCSS = require('../appendCSS');

appendCSS(require('./clone-document.css'));

const template = require('./clone-document.html');

module.exports = app => app.component('clone-document', {
  props: ['currentModel', 'doc', 'schemaPaths'],
  template,
  data: function() {
    return {
      documentData: '',
      editor: null,
      errors: []
    };
  },
  methods: {
    async cloneDocument() {
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
    const pathsToClone = this.schemaPaths.map(x => x.path);
    
    // Create a filtered version of the document data
    const filteredDoc = {};
    pathsToClone.forEach(path => {
      const value = this.doc[path];
      if (value !== undefined) {
        filteredDoc[path] = value;
      }
    });

    // Replace _id with a new ObjectId
    if (pathsToClone.includes('_id')) {
      filteredDoc._id = new ObjectId();
    }

    this.documentData = JSON.stringify(filteredDoc, null, 2);
    this.$refs.codeEditor.value = this.documentData;
    this.editor = CodeMirror.fromTextArea(this.$refs.codeEditor, {
      mode: 'javascript',
      lineNumbers: true,
      smartIndent: false
    });
  }
});