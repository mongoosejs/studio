'use strict';
const Archetype = require('archetype');

const CreateDashboardParams = new Archetype({
  title: {
    $type: 'string',
    $required: true
  },
  code: {
    $type: 'string',
    $required: true
  }
}).compile('CreateDashboardParams');

module.exports = ({ db }) => async function createDashboard(params) {
  const { title, code } = new CreateDashboardParams(params);
  const Dashboard = db.model('__Studio_Dashboard');

  const dashboard = await Dashboard.create({ title, code });

  return { dashboard };
};