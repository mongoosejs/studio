'use strict';

const assert = require('assert');

require('./setup');
const modelsComponent = require('../../frontend/src/models/models');

describe('models projection input', function() {
  it('persists projection input without also persisting fields', function() {
    const componentDef = modelsComponent({ component: (_name, def) => def });
    const pushedQueries = [];
    const state = {
      projectionText: 'name email',
      query: {
        projectionMode: '1'
      },
      $router: {
        push({ query }) {
          pushedQueries.push({ ...query });
        }
      }
    };

    componentDef.methods.updateProjectionQuery.call(state);

    assert.deepStrictEqual(pushedQueries[0], {
      projectionMode: '1',
      projectionInput: 'name email'
    });
  });

  it('sends projectionInput in document fetch params', function() {
    const componentDef = modelsComponent({ component: (_name, def) => def });
    const state = {
      currentModel: 'User',
      sortBy: {},
      searchText: '',
      query: {
        projectionInput: 'name email'
      },
      isProjectionMenuSelected: true,
      filteredPaths: [{ path: '_id' }, { path: 'name' }, { path: 'email' }]
    };

    const params = componentDef.methods.buildDocumentFetchParams.call(state);

    assert.strictEqual(params.model, 'User');
    assert.strictEqual(params.projectionInput, 'name email');
    assert.strictEqual(params.fields, undefined);
  });

  it('clears projection when projection text is an empty string', function() {
    const componentDef = modelsComponent({ component: (_name, def) => def });
    const updateProjectionQuery = function() {
      this.queryUpdated = true;
    };
    const state = {
      projectionText: '',
      filteredPaths: [{ path: '_id' }, { path: 'name' }],
      selectedPaths: [{ path: '_id' }, { path: 'name' }],
      queryUpdated: false,
      updateProjectionQuery
    };

    componentDef.methods.applyProjectionFromInput.call(state);

    assert.deepStrictEqual(state.filteredPaths, []);
    assert.deepStrictEqual(state.selectedPaths, []);
    assert.strictEqual(state.queryUpdated, true);
  });
});
