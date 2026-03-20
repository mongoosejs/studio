'use strict';

const assert = require('assert');

require('./setup');
const modelsComponent = require('../../frontend/src/models/models');

describe('models component', function() {
  it('preserves nested properties in JSON view filters', function() {
    const componentDef = modelsComponent({ component: (_name, def) => def });
    const state = {
      filteredPaths: [
        { path: '_id' },
        { path: 'profile.name.first' },
        { path: 'profile.name.last' },
        { path: 'settings.flags.0' }
      ],
      setPathValue: componentDef.methods.setPathValue
    };

    const filtered = componentDef.methods.filterDocument.call(state, {
      _id: 'doc1',
      profile: {
        name: {
          first: 'Ada',
          last: 'Lovelace'
        }
      },
      settings: {
        flags: ['active', 'beta']
      }
    });

    assert.deepStrictEqual(filtered, {
      _id: 'doc1',
      profile: {
        name: {
          first: 'Ada',
          last: 'Lovelace'
        }
      },
      settings: {
        flags: ['active']
      }
    });
  });
});
