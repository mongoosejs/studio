'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const ListAlertsParams = new Archetype({
  workspaceId: {
    $type: 'string'
  },
  roles: {
    $type: ['string']
  }
}).compile('ListAlertsParams');

module.exports = ({ studioConnection }) => async function listAlerts(params = {}) {
  const { workspaceId, roles } = new ListAlertsParams(params);

  await authorize('Alert.listAlerts', roles);

  const Alert = studioConnection.model('__Studio_Alert');
  const query = workspaceId ? { workspaceId } : {};
  const alerts = await Alert.find(query).sort({ createdAt: -1 }).lean();

  return { alerts };
};
