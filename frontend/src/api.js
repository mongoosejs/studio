'use strict';

const axios = require('axios');
const client = axios.create({
  baseURL: config__baseURL
});

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
