'use strict';

const Archetype = require('archetype');
const authorize = require('../../authorize');

const DeleteAlertParams = new Archetype({
  alertId: {
    $type: 'string',
    $required: true
  },
  roles: {
    $type: ['string']
  }
}).compile('DeleteAlertParams');

module.exports = ({ studioConnection }) => async function deleteAlert(params) {
  const { alertId, roles } = new DeleteAlertParams(params);

  await authorize('Alert.deleteAlert', roles);

  const Alert = studioConnection.model('__Studio_Alert');
  await Alert.findByIdAndDelete(alertId);

  return { success: true };
};
