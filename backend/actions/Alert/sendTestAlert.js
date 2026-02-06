'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');
const { renderTemplate, notifySlack } = require('../../alerts/alertUtils');

const SendTestAlertParams = new Archetype({
  workspaceId: {
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
  sampleDocument: {
    $type: 'object',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('SendTestAlertParams');

module.exports = ({ options }) => async function sendTestAlert(params) {
  const { workspaceId, slackChannel, templateText, sampleDocument, roles } = new SendTestAlertParams(params);

  await authorize('Alert.sendTestAlert', roles);

  const mothershipUrl = options?._mothershipUrl || 'https://mongoose-js.netlify.app/.netlify/functions';
  const text = renderTemplate(templateText, sampleDocument);
  await notifySlack({
    mothershipUrl,
    payload: {
      workspaceId,
      channel: slackChannel,
      template: templateText,
      text,
      sampleDocument
    }
  });

  return { success: true };
};
