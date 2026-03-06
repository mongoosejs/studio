'use strict';

const api = require('../api');

const { BSON, EJSON } = require('mongodb/lib/bson');

const ObjectId = new Proxy(BSON.ObjectId, {
  apply(target, thisArg, argumentsList) {
    return new target(...argumentsList);
  }
});

const appendCSS = require('../appendCSS');

appendCSS(require('./clone-document.css'));

const template = require('./clone-document.html');
const { createAceEditor, destroyAceEditor } = require('../aceEditor');

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
      try {
        const { doc } = await api.Model.createDocument({ model: this.currentModel, data });
        this.errors.length = 0;
        this.$toast.success('Document cloned!');
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
    const container = this.$refs.codeEditor;
    this.editor = createAceEditor(container, {
      value: this.documentData,
      mode: 'javascript',
      lineNumbers: true
    });
    this.editor.session.on('change', () => {
      this.documentData = this.editor.getValue();
    });
  },
  beforeDestroy() {
    if (this.editor) {
      destroyAceEditor(this.editor);
    }
  }
});
