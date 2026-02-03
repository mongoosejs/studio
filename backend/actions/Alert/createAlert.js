'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const CreateAlertParams = new Archetype({
  workspaceId: {
    $type: 'string'
  },
  name: {
    $type: 'string'
  },
  eventType: {
    $type: 'string',
    $required: true
  },
  database: {
    $type: 'string'
  },
  collection: {
    $type: 'string'
  },
  slackChannel: {
    $type: 'string',
    $required: true
  },
  templateText: {
    $type: 'string',
    $required: true
  },
  enabled: {
    $type: 'boolean'
  },
  roles: {
    $type: ['string']
  }
}).compile('CreateAlertParams');

module.exports = ({ studioConnection }) => async function createAlert(params) {
  const {
    workspaceId,
    name,
    eventType,
    database,
    collection,
    slackChannel,
    templateText,
    enabled,
    roles
  } = new CreateAlertParams(params);

  await authorize('Alert.createAlert', roles);

  const Alert = studioConnection.model('__Studio_Alert');
  const alert = await Alert.create({
    workspaceId,
    name,
    eventType,
    database,
    collection,
    slackChannel,
    templateText,
    enabled: !!enabled
  });

  return { alert };
};
