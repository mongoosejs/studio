'use strict';

const MongooseStudioChartColors = require('../constants/mongooseStudioChartColors');
const mongoose = require('mongoose');
const vm = require('vm');
const { createScriptDb } = require('./createScriptDb');

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

      return await runDryRunScript({
        db: this.db,
        context: this.context,
        setDryRunSession: this.setDryRunSession,
        wrappedScript
      });
    },
    close: scriptDb.close
  };
};

async function runDryRunScript({ db, context, setDryRunSession, wrappedScript }) {
  if (typeof db?.startSession !== 'function') {
    throw new Error('Dry run mode requires MongoDB sessions support');
  }

  const session = await db.startSession();
  setDryRunSession(session);

  try {
    session.startTransaction();
    const result = await vm.runInContext(wrappedScript, context);
    await abortTransaction(session);
    return result;
  } catch (err) {
    await abortTransaction(session);
    throw err;
  } finally {
    setDryRunSession(null);
    await session.endSession().catch(() => {});
  }
}

async function abortTransaction(session) {
  if (typeof session?.inTransaction === 'function' && !session.inTransaction()) {
    return;
  }

  await session.abortTransaction().catch(() => {});
}
