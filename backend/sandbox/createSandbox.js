'use strict';

const MongooseStudioChartColors = require('../constants/mongooseStudioChartColors');
const mongoose = require('mongoose');
const vm = require('vm');
const { createScriptDb } = require('./createScriptDb');

const dryRunRollbackMessage = '__MONGOOSE_STUDIO_DRY_RUN_ROLLBACK__';

module.exports = function createSandbox({ db }) {
  const logs = [];
  const scriptDb = createScriptDb(db);
  if (!scriptDb.db.Types) {
    scriptDb.db.Types = mongoose.Types;
  }

  const sandbox = {
    db: scriptDb.db,
    mongoose,
    console: {},
    ObjectId: mongoose.Types.ObjectId,
    MongooseStudioChartColors
  };

  sandbox.console.log = function() {
    const args = Array.from(arguments);
    logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
  };

  return {
    context: vm.createContext(sandbox),
    db: scriptDb.db,
    getLogs() {
      return logs.join('\n');
    },
    setDryRunSession: scriptDb.setDryRunSession,
    async runScript({ script, dryRun }) {
      const wrappedScript = `(async () => {
        ${script}
      })()`;

      if (!dryRun) {
        return await vm.runInContext(wrappedScript, this.context);
      }

      let result;
      await this.db.transaction(async session => {
        this.setDryRunSession(session);
        result = await vm.runInContext(wrappedScript, this.context);
        throw new Error(dryRunRollbackMessage);
      }).catch(err => {
        if (err?.message !== dryRunRollbackMessage) {
          throw err;
        }
      });
      return result;
    },
    close: scriptDb.close
  };
};
