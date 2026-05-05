'use strict';

const assert = require('assert');

const getCapabilities = require('../backend/actions/getCapabilities');

describe('getCapabilities()', function() {
  it('returns change stream and transaction support for replica sets with sessions', async function() {
    const action = getCapabilities({
      db: {
        db: {
          admin() {
            return {
              command() {
                return Promise.resolve({
                  maxWireVersion: 17,
                  setName: 'rs0',
                  logicalSessionTimeoutMinutes: 30
                });
              }
            };
          }
        }
      }
    });

    const res = await action();

    assert.deepStrictEqual(res, {
      supportsChangeStreams: true,
      supportsTransactions: true,
      supportsAI: false
    });
  });

  it('disables transactions for standalone deployments', async function() {
    const action = getCapabilities({
      db: {
        db: {
          admin() {
            return {
              command() {
                return Promise.resolve({
                  maxWireVersion: 17,
                  logicalSessionTimeoutMinutes: 30
                });
              }
            };
          }
        }
      }
    });

    const res = await action();

    assert.deepStrictEqual(res, {
      supportsChangeStreams: false,
      supportsTransactions: false,
      supportsAI: false
    });
  });

  it('falls back to isMaster when hello is unavailable', async function() {
    let calls = 0;
    const action = getCapabilities({
      db: {
        db: {
          admin() {
            return {
              command(cmd) {
                ++calls;
                if (cmd.hello) {
                  return Promise.reject(new Error('no hello'));
                }
                return Promise.resolve({
                  maxWireVersion: 8,
                  msg: 'isdbgrid',
                  logicalSessionTimeoutMinutes: 30
                });
              }
            };
          }
        }
      }
    });

    const res = await action();

    assert.strictEqual(calls, 2);
    assert.deepStrictEqual(res, {
      supportsChangeStreams: true,
      supportsTransactions: true,
      supportsAI: false
    });
  });

  it('returns AI support when an AI provider key is configured', async function() {
    for (const key of ['openAIAPIKey', 'anthropicAPIKey', 'googleGeminiAPIKey']) {
      const action = getCapabilities({
        options: {
          [key]: 'test-key'
        },
        db: {
          db: {
            admin() {
              return {
                command() {
                  return Promise.resolve({
                    maxWireVersion: 17,
                    setName: 'rs0',
                    logicalSessionTimeoutMinutes: 30
                  });
                }
              };
            }
          }
        }
      });

      const res = await action();
      assert.strictEqual(res.supportsAI, true);
    }
  });
});
