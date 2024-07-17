'use strict';

const Archetype = require('archetype');
const vm = require('vm');

const GetDashboardParams = new Archetype({
  dashboardId: {
    $type: 'string',
    $required: true
  },
  evaluate: {
    $type: 'boolean'
  }
}).compile('GetDashboardParams');

module.exports = ({ db }) => async function getDashboard(params) {
  const { dashboardId, evaluate } = new GetDashboardParams(params);
  const Dashboard = db.model('__Studio_Dashboard');

  const dashboard = await Dashboard.findOne({ _id: dashboardId });
  if (evaluate) {
    const context = vm.createContext({ db });
    let result = null;
    try {
      result = await vm.runInContext(formatFunction(dashboard.code), context);
      if (result.$document?.model) {
        let schemaPaths = {};
        const Model = Dashboard.db.model(result.$document?.model);
        for (const path of Object.keys(Model.schema.paths)) {
          schemaPaths[path] = {
            instance: Model.schema.paths[path].instance,
            path,
            ref: Model.schema.paths[path].options?.ref,
            required: Model.schema.paths[path].options?.required
          };
        }
        result.$document.schemaPaths = schemaPaths;
      }
    } catch (error) {
      return { dashboard, error: { message: error.message } };
    }
    
    return { dashboard, result };
  }

  return { dashboard };
};

const formatFunction = code => `(async function() {
  ${code}
})();`