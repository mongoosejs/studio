'use strict';

const axios = require('axios');

const client = axios.create({
  baseURL: window.MONGOOSE_STUDIO_CONFIG.baseURL
});

console.log('API baseURL:', window.MONGOOSE_STUDIO_CONFIG.baseURL);

window.apiClient = client;
client.interceptors.request.use(req => {
  const accessToken = window.localStorage.getItem('_mongooseStudioAccessToken') || null;
  if (accessToken) {
    req.headers.authorization = accessToken;
  }

  return req;
});

client.interceptors.response.use(
  res => res,
  err => {
    if (typeof err.response.data === 'string') {
      throw new Error(`Error in ${err.config?.method} ${err.config?.url}: ${err.response.data}`);
    }
    throw err;
  }
);

if (window.MONGOOSE_STUDIO_CONFIG.isLambda) {
  exports.status = function status() {
    return client.post('', { action: 'status' }).then(res => res.data);
  };
  exports.Dashboard = {
    createDashboard(params) {
      return client.post('', { action: 'Dashboard.createDashboard', ...params }).then(res => res.data);
    },
    getDashboard(params) {
      return client.post('', { action: 'Dashboard.getDashboard', ...params }).then(res => res.data);
    },
    getDashboards(params) {
      return client.post('', { action: 'Dashboard.getDashboards', ...params }).then(res => res.data);
    },
    updateDashboard(params) {
      return client.post('', { action: 'Dashboard.updateDashboard', ...params }).then(res => res.data);
    }
  };
  exports.ChatThread = {
    createChatMessage(params) {
      return client.post('', { action: 'ChatThread.createChatMessage', ...params }).then(res => res.data);
    },
    createChatThread(params) {
      return client.post('', { action: 'ChatThread.createChatThread', ...params }).then(res => res.data);
    },
    getChatThread(params) {
      return client.post('', { action: 'ChatThread.getChatThread', ...params }).then(res => res.data);
    },
    listChatThreads(params) {
      return client.post('', { action: 'ChatThread.listChatThreads', ...params }).then(res => res.data);
    }
  };
  exports.ChatMessage = {
    executeScript(params) {
      return client.post('', { action: 'ChatMessage.executeScript', ...params }).then(res => res.data);
    }
  };
  exports.Model = {
    createChart(params) {
      return client.post('', { action: 'Model.createChart', ...params }).then(res => res.data);
    },
    createDocument(params) {
      return client.post('', { action: 'Model.createDocument', ...params }).then(res => res.data);
    },
    deleteDocument(params) {
      return client.post('', { action: 'Model.deleteDocument', ...params }).then(res => res.data);
    },
    deleteDocuments(params) {
      return client.post('', { action: 'Model.deleteDocuments', ...params }).then(res => res.data);
    },
    exportQueryResults(params) {
      const accessToken = window.localStorage.getItem('_mongooseStudioAccessToken') || null;

      return fetch(window.MONGOOSE_STUDIO_CONFIG.baseURL + new URLSearchParams({ ...params, action: 'Model.exportQueryResults' }).toString(), {
        method: 'GET',
        headers: {
          Authorization: `${accessToken}`, // Set your authorization token here
          Accept: 'text/csv'
        }
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.blob();
        })
        .then(blob => {
          const blobURL = window.URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = blobURL;
          anchor.download = 'export.csv';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          window.URL.revokeObjectURL(blobURL);
        });
    },
    getDocument: function getDocument(params) {
      return client.post('', { action: 'Model.getDocument', ...params }).then(res => res.data);
    },
    getDocuments: function getDocuments(params) {
      return client.post('', { action: 'Model.getDocuments', ...params }).then(res => res.data);
    },
    getIndexes: function getIndexes(params) {
      return client.post('', { action: 'Model.getIndexes', ...params }).then(res => res.data);
    },
    dropIndex: function dropIndex(params) {
      return client.post('', { action: 'Model.dropIndex', ...params }).then(res => res.data);
    },
    listModels: function listModels() {
      return client.post('', { action: 'Model.listModels' }).then(res => res.data);
    },
    updateDocument: function updateDocument(params) {
      return client.post('', { action: 'Model.updateDocument', ...params }).then(res => res.data);
    },
    updateDocuments: function updateDocuments(params) {
      return client.post('', { action: 'Model.updateDocuments', ...params }).then(res => res.data);
    }
  };
} else {
  exports.status = function status() {
    return client.get('/status').then(res => res.data);
  };
  exports.Dashboard = {
    createDashboard: function createDashboard(params) {
      return client.post('/Dashboard/createDashboard', params).then(res => res.data);
    },
    deleteDashboard: function deleteDashboard(params) {
      return client.post('/Dashboard/deleteDashboard', params).then(res => res.data);
    },
    getDashboard: function getDashboard(params) {
      return client.put('/Dashboard/getDashboard', params).then(res => res.data);
    },
    getDashboards: function getDashboards(params) {
      return client.put('/Dashboard/getDashboards', params).then(res => res.data);
    },
    updateDashboard: function updateDashboard(params) {
      return client.post('/Dashboard/updateDashboard', params).then(res => res.data);
    }
  };
  exports.ChatThread = {
    createChatMessage: function createChatMessage(params) {
      return client.post('/ChatThread/createChatMessage', params).then(res => res.data);
    },
    createChatThread: function createChatThread(params) {
      return client.post('/ChatThread/createChatThread', params).then(res => res.data);
    },
    getChatThread: function getChatThread(params) {
      return client.post('/ChatThread/getChatThread', params).then(res => res.data);
    },
    listChatThreads: function listChatThreads(params) {
      return client.post('/ChatThread/listChatThreads', params).then(res => res.data);
    }
  };
  exports.ChatMessage = {
    executeScript: function executeScript(params) {
      return client.post('/ChatMessage/executeScript', params).then(res => res.data);
    }
  };
  exports.Model = {
    createChart: function(params) {
      return client.post('/Model/createChart', params).then(res => res.data);
    },
    createDocument: function(params) {
      return client.post('/Model/createDocument', params).then(res => res.data);
    },
    deleteDocument: function(params) {
      return client.post('/Model/deleteDocument', params).then(res => res.data);
    },
    deleteDocuments: function(params) {
      return client.post('/Model/deleteDocuments', params).then(res => res.data);
    },
    exportQueryResults(params) {
      const accessToken = window.localStorage.getItem('_mongooseStudioAccessToken') || null;

      return fetch(window.MONGOOSE_STUDIO_CONFIG.baseURL + '/Model/exportQueryResults?' + new URLSearchParams(params).toString(), {
        method: 'GET',
        headers: {
          Authorization: `${accessToken}`, // Set your authorization token here
          Accept: 'text/csv'
        }
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.blob();
        })
        .then(blob => {
          const blobURL = window.URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = blobURL;
          anchor.download = 'export.csv';
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          window.URL.revokeObjectURL(blobURL);
        });
    },
    getDocument: function getDocument(params) {
      return client.post('/Model/getDocument', params).then(res => res.data);
    },
    getDocuments: function getDocuments(params) {
      return client.post('/Model/getDocuments', params).then(res => res.data);
    },
    getIndexes: function getIndexes(params) {
      return client.post('/Model/getIndexes', params).then(res => res.data);
    },
    dropIndex: function dropIndex(params) {
      return client.post('/Model/dropIndex', params).then(res => res.data);
    },
    listModels: function listModels() {
      return client.post('/Model/listModels', {}).then(res => res.data);
    },
    updateDocument: function updateDocument(params) {
      return client.post('/Model/updateDocument', params).then(res => res.data);
    },
    updateDocuments: function updateDocument(params) {
      return client.post('/Model/updateDocuments', params).then(res => res.data);
    }
  };
}
