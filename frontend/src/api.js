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
    if (typeof err?.response?.data === 'string') {
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
    },
    shareChatThread(params) {
      return client.post('', { action: 'ChatThread.shareChatThread', ...params }).then(res => res.data);
    },
    streamChatMessage: async function* streamChatMessage(params) {
      // Don't stream on Next.js or Netlify for now.
      const data = await client.post('', { action: 'ChatThread.createChatMessage', ...params }).then(res => res.data);
      yield { chatMessage: data.chatMessages[0] };
      yield { chatMessage: data.chatMessages[1] };
      yield { chatThread: data.chatThread };
    }
  };
  exports.ChatMessage = {
    executeScript(params) {
      return client.post('', { action: 'ChatMessage.executeScript', ...params }).then(res => res.data);
    }
  };
  exports.Model = {
    addField(params) {
      return client.post('', { action: 'Model.addField', ...params }).then(res => res.data);
    },
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
    executeDocumentScript(params) {
      return client.post('', { action: 'Model.executeDocumentScript', ...params }).then(res => res.data);
    },
    exportQueryResults(params) {
      const accessToken = window.localStorage.getItem('_mongooseStudioAccessToken') || null;

      return fetch(window.MONGOOSE_STUDIO_CONFIG.baseURL + '?' + new URLSearchParams({ ...params, action: 'Model.exportQueryResults' }).toString(), {
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
    getDocumentsStream: async function* getDocumentsStream(params) {
      const data = await client.post('', { action: 'Model.getDocuments', ...params }).then(res => res.data);
      yield { schemaPaths: data.schemaPaths };
      yield { numDocs: data.numDocs };
      for (const doc of data.docs) {
        yield { document: doc };
      }
    },
    streamDocumentChanges: async function* streamDocumentChanges(params, options = {}) {
      const pollIntervalMs = 5000;
      while (!options.signal?.aborted) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        if (options.signal?.aborted) {
          return;
        }
        yield { type: 'poll', model: params.model, documentId: params.documentId };
      }
    },
    getCollectionInfo: function getCollectionInfo(params) {
      return client.post('', { action: 'Model.getCollectionInfo', ...params }).then(res => res.data);
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
    createChatMessage(params) {
      return client.post('', { action: 'Model.createChatMessage', ...params }).then(res => res.data);
    },
    streamChatMessage: async function* streamChatMessage(params) {
      // Don't stream on Next.js or Netlify for now.
      const data = await client.post('', { action: 'Model.createChatMessage', ...params }).then(res => res.data);
      yield { textPart: data.text };
    },
    updateDocuments: function updateDocuments(params) {
      return client.post('', { action: 'Model.updateDocuments', ...params }).then(res => res.data);
    }
  };
  exports.Task = {
    cancelTask: function cancelTask(params) {
      return client.post('', { action: 'Task.cancelTask', ...params }).then(res => res.data);
    },
    createTask: function createTask(params) {
      return client.post('', { action: 'Task.createTask', ...params }).then(res => res.data);
    },
    getTask: function getTask(params) {
      return client.post('', { action: 'Task.getTask', ...params }).then(res => res.data);
    },
    getTasks: function getTasks(params) {
      return client.post('', { action: 'Task.getTasks', ...params }).then(res => res.data);
    },
    rescheduleTask: function rescheduleTask(params) {
      return client.post('', { action: 'Task.rescheduleTask', ...params }).then(res => res.data);
    },
    runTask: function runTask(params) {
      return client.post('', { action: 'Task.runTask', ...params }).then(res => res.data);
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
    },
    shareChatThread: function shareChatThread(params) {
      return client.post('/ChatThread/shareChatThread', params).then(res => res.data);
    },
    streamChatMessage: async function* streamChatMessage(params) {
      const accessToken = window.localStorage.getItem('_mongooseStudioAccessToken') || null;
      const url = window.MONGOOSE_STUDIO_CONFIG.baseURL + '/ChatThread/streamChatMessage?' + new URLSearchParams(params).toString();

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `${accessToken}`,
          Accept: 'text/event-stream'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let eventEnd;
        while ((eventEnd = buffer.indexOf('\n\n')) !== -1) {
          const eventStr = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + 2);

          // Parse SSE event
          const lines = eventStr.split('\n');
          let data = '';
          for (const line of lines) {
            if (line.startsWith('data:')) {
              data += line.slice(5).trim();
            }
          }
          if (data) {
            try {
              const res = JSON.parse(data);
              yield res;
            } catch (err) {
              yield data;
            }
          }
        }
      }
    }
  };
  exports.ChatMessage = {
    executeScript: function executeScript(params) {
      return client.post('/ChatMessage/executeScript', params).then(res => res.data);
    }
  };
  exports.Model = {
    addField(params) {
      return client.post('/Model/addField', params).then(res => res.data);
    },
    createChart: function(params) {
      return client.post('/Model/createChart', params).then(res => res.data);
    },
    createChatMessage: function(params) {
      return client.post('/Model/createChatMessage', params).then(res => res.data);
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
    executeDocumentScript: function(params) {
      return client.post('/Model/executeDocumentScript', params).then(res => res.data);
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
    getDocumentsStream: async function* getDocumentsStream(params) {
      const accessToken = window.localStorage.getItem('_mongooseStudioAccessToken') || null;
      const url = window.MONGOOSE_STUDIO_CONFIG.baseURL + '/Model/getDocumentsStream?' + new URLSearchParams(params).toString();

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `${accessToken}`,
          Accept: 'text/event-stream'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let eventEnd;
        while ((eventEnd = buffer.indexOf('\n\n')) !== -1) {
          const eventStr = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + 2);

          // Parse SSE event
          const lines = eventStr.split('\n');
          let data = '';
          for (const line of lines) {
            if (line.startsWith('data:')) {
              data += line.slice(5).trim();
            }
          }
          if (data) {
            try {
              yield JSON.parse(data);
            } catch (err) {
              // If not JSON, yield as string
              yield data;
            }
          }
        }
      }
    },
    streamDocumentChanges: async function* streamDocumentChanges(params, options = {}) {
      const accessToken = window.localStorage.getItem('_mongooseStudioAccessToken') || null;
      const url = window.MONGOOSE_STUDIO_CONFIG.baseURL + '/Model/streamDocumentChanges?' + new URLSearchParams(params).toString();

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `${accessToken}`,
          Accept: 'text/event-stream'
        },
        signal: options.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let eventEnd;
        while ((eventEnd = buffer.indexOf('\n\n')) !== -1) {
          const eventStr = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + 2);

          // Parse SSE event
          const lines = eventStr.split('\n');
          let data = '';
          for (const line of lines) {
            if (line.startsWith('data:')) {
              data += line.slice(5).trim();
            }
          }
          if (data) {
            try {
              yield JSON.parse(data);
            } catch (err) {
              // If not JSON, yield as string
              yield data;
            }
          }
        }
      }
    },
    getCollectionInfo: function getCollectionInfo(params) {
      return client.post('/Model/getCollectionInfo', params).then(res => res.data);
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
    streamChatMessage: async function* streamChatMessage(params) {
      const accessToken = window.localStorage.getItem('_mongooseStudioAccessToken') || null;
      const url = window.MONGOOSE_STUDIO_CONFIG.baseURL + '/Model/streamChatMessage?' + new URLSearchParams(params).toString();

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `${accessToken}`,
          Accept: 'text/event-stream'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let eventEnd;
        while ((eventEnd = buffer.indexOf('\n\n')) !== -1) {
          const eventStr = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + 2);

          // Parse SSE event
          const lines = eventStr.split('\n');
          let data = '';
          for (const line of lines) {
            if (line.startsWith('data:')) {
              data += line.slice(5).trim();
            }
          }
          if (data) {
            try {
              yield JSON.parse(data);
            } catch (err) {
              // If not JSON, yield as string
              yield data;
            }
          }
        }
      }
    },
    updateDocuments: function updateDocument(params) {
      return client.post('/Model/updateDocuments', params).then(res => res.data);
    }
  };
  exports.Task = {
    cancelTask: function cancelTask(params) {
      return client.post('/Task/cancelTask', params).then(res => res.data);
    },
    createTask: function createTask(params) {
      return client.post('/Task/createTask', params).then(res => res.data);
    },
    getTask: function getTask(params) {
      return client.post('/Task/getTask', params).then(res => res.data);
    },
    getTasks: function getTasks(params) {
      return client.post('/Task/getTasks', params).then(res => res.data);
    },
    rescheduleTask: function rescheduleTask(params) {
      return client.post('/Task/rescheduleTask', params).then(res => res.data);
    },
    runTask: function runTask(params) {
      return client.post('/Task/runTask', params).then(res => res.data);
    }
  };
}
