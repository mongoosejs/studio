'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const UpdateAlertParams = new Archetype({
  alertId: {
    $type: 'string',
    $required: true
  },
  workspaceId: {
    $type: 'string'
  },
  name: {
    $type: 'string'
  },
  eventType: {
    $type: 'string'
  },
  database: {
    $type: 'string'
  },
  collection: {
    $type: 'string'
  },
  slackChannel: {
    $type: 'string'
  },
  templateText: {
    $type: 'string'
  },
  enabled: {
    $type: 'boolean'
  },
  roles: {
    $type: ['string']
  }
}).compile('UpdateAlertParams');

module.exports = ({ studioConnection }) => async function updateAlert(params) {
  const {
    alertId,
    workspaceId,
    name,
    eventType,
    database,
    collection,
    slackChannel,
    templateText,
    enabled,
    roles
  } = new UpdateAlertParams(params);

  await authorize('Alert.updateAlert', roles);

  const Alert = studioConnection.model('__Studio_Alert');
  const alert = await Alert.findByIdAndUpdate(
    alertId,
    {
      workspaceId,
      name,
      eventType,
      database,
      collection,
      slackChannel,
      templateText,
      enabled
    },
    { new: true }
  );

  return { alert };
};
