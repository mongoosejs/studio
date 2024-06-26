'use strict';

const axios = require('axios');

const client = axios.create({
  baseURL: config__baseURL
});

window.apiClient = client;
if (typeof config__setAuthorizationHeaderFrom === 'string' && config__setAuthorizationHeaderFrom) {
  client.interceptors.request.use(req => {
    const accessToken = window.localStorage.getItem(config__setAuthorizationHeaderFrom) || null;
    if (accessToken) {
      req.headers.authorization = accessToken;
    }
  
    return req;
  });
}

if (config__isLambda) {
  exports.Dashboard = {
    getDashboard(params) {
      return client.post('', { action: 'Dashboard.getDashboard', ...params }).then(res => res.data);
    },
    getDashboards(params) {
      return client.post('', { action: 'Dashboard.getDashboards', ...params }).then(res => res.data);
    },
    updateDashboard(params) {
      return client.post('', { action: 'Dashboard.updateDashboard', ...params}).then(res => res.data);
    }
  }
  exports.Model = {
    createChart(params) {
      return client.post('', { action: 'Model.createChart', ...params}).then(res => res.data);
    },
    createDocument(params) {
      return client.post('', { action: 'Model.createDocument', ...params}).then(res => res.data);
    },
    deleteDocument(params) {
      return client.post('', { action: 'Model.deleteDocument', ...params}).then(res => res.data);
    },
    exportQueryResults(params) {
      return client.post('', { action: 'Model.exportQueryResults', ...params }).then(res => res.data);
    },
    getDocument: function getDocument(params) {
      return client.post('', { action: 'Model.getDocument', ...params }).then(res => res.data);
    },
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
  exports.Dashboard = {
    getDashboard: function getDashboard(params) {
      return client.get('/Dashboard/getDashboard', params).then(res => res.data);
    },
    getDashboards: function getDashboards(params) {
      return client.get('/Dashboard/getDashboards', params).then(res => res.data);
    },
    updateDashboard: function updateDashboard(params) {
      return client.post('/Dashboard/updateDashboard', params).then(res => res.data);
    }
  }
  exports.Model = {
    createChart: function (params) {
      return client.post('/Model/createChart', params).then(res => res.data);
    },
    createDocument: function(params) {
      return client.post('/Model/createDocument', params).then(res => res.data);
    },
    deleteDocument: function (params) {
      return client.post('/Model/deleteDocument', params).then(res => res.data);
    },
    exportQueryResults(params) {
      const anchor = document.createElement('a');
      anchor.href = config__baseURL + '/Model/exportQueryResults?' + (new URLSearchParams(params)).toString();
      anchor.target = '_blank';
      anchor.download = 'export.csv';
      anchor.click();
      return;
    },
    getDocument: function getDocument(params) {
      return client.post('/Model/getDocument', params).then(res => res.data);
    },
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
  exports.Script = {

  };
}
