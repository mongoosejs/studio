'use strict';

const actionsToRequiredRoles = {
  'ChatMessage.executeScript': ['owner', 'admin', 'member'],
  'ChatThread.createChatMessage': ['owner', 'admin', 'member'],
  'ChatThread.createChatThread': ['owner', 'admin', 'member'],
  'ChatThread.getChatThread': ['owner', 'admin', 'member'],
  'ChatThread.listChatThreads': ['owner', 'admin', 'member'],
  'ChatThread.shareChatThread': ['owner', 'admin', 'member'],
  'Dashboard.createDashboard': ['owner', 'admin', 'member'],
  'Dashboard.deleteDashboard': ['owner', 'admin', 'member'],
  'Dashboard.getDashboard': ['owner', 'admin', 'member', 'readonly', 'dashboards'],
  'Dashboard.getDashboards': ['owner', 'admin', 'member', 'readonly', 'dashboards'],
  'Dashboard.updateDashboard': ['owner', 'admin', 'member'],
  'Model.createDocument': ['owner', 'admin', 'member'],
  'Model.updateDocument': ['owner', 'admin', 'member'],
  'Model.deleteDocument': ['owner', 'admin', 'member'],
  'Model.deleteDocuments': ['owner', 'admin', 'member'],
  'Model.dropIndex': ['owner', 'admin'],
  'Model.exportQueryResults': ['owner', 'admin', 'member', 'readonly'],
  'Model.getDocument': ['owner', 'admin', 'member', 'readonly'],
  'Model.getDocuments': ['owner', 'admin', 'member', 'readonly'],
  'Model.getDocumentsStream': ['owner', 'admin', 'member', 'readonly'],
  'Model.getIndexes': ['owner', 'admin', 'member', 'readonly'],
  'Model.listModels': ['owner', 'admin', 'member', 'readonly'],
  'Model.updateDocuments': ['owner', 'admin', 'member']
};

module.exports = function authorize(action, roles) {
  if (roles == null) {
    return;
  }
  const authorized = actionsToRequiredRoles[action] && roles.find(role => actionsToRequiredRoles[action].includes(role));
  if (!authorized) {
    throw new Error(`Unauthorized to take action ${action}`);
  }
};
