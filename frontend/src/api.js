'use strict';

const axios = require('axios');

const client = axios.create({
  baseURL: config__baseURL
});

if (config__isLambda) {
  exports.Model = {
    getDocuments: function getDocuments(params) {
      return client.post('', { action: 'Model.getDocuments', ...params }).then(res => res.data);
    },
    listModels: function listModels() {
      return client.post('', { action: 'Model.listModels' }).then(res => res.data);
    },
    updateDocument: function updateDocument(params) {
      return client.post('', { action: 'Model.updateDocument', ...params }).then(res => res.data);
    }
  };
} else {
  exports.Model = {
    getDocuments: function getDocuments(params) {
      return client.post('/Model/getDocuments', params).then(res => res.data);
    },
    listModels: function listModels() {
      return client.post('/Model/listModels', {}).then(res => res.data);
    },
    updateDocument: function updateDocument(params) {
      return client.post('/Model/updateDocument', params).then(res => res.data);
    }
  };
}
