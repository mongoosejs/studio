'use strict';

const assert = require('assert');

require('./setup');
const api = require('../../frontend/src/api');
const modelsComponent = require('../../frontend/src/models/models');

describe('models projection input', function() {
  it('adds _id to displayed projection paths by default', function() {
    const componentDef = modelsComponent({ component: (_name, def) => def });
    const state = {
      schemaPaths: [{ path: '_id' }, { path: 'email' }, { path: 'role' }],
      parseProjectionInput: componentDef.methods.parseProjectionInput,
      projectionExplicitlyExcludesId: componentDef.methods.projectionExplicitlyExcludesId
    };

    const paths = componentDef.methods.normalizeProjectionPathsForDisplay.call(state, 'email role');

    assert.deepStrictEqual(paths, ['_id', 'email', 'role']);
  });

  it('does not add _id when projection explicitly excludes it', function() {
    const componentDef = modelsComponent({ component: (_name, def) => def });
    const state = {
      schemaPaths: [{ path: '_id' }, { path: 'email' }, { path: 'role' }],
      parseProjectionInput: componentDef.methods.parseProjectionInput,
      projectionExplicitlyExcludesId: componentDef.methods.projectionExplicitlyExcludesId
    };

    const paths = componentDef.methods.normalizeProjectionPathsForDisplay.call(state, 'email role -_id');

    assert.deepStrictEqual(paths, ['email', 'role']);
  });

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

describe('models document loading errors', function() {
  let originalGetDocumentsStream;

  beforeEach(function() {
    originalGetDocumentsStream = api.Model.getDocumentsStream;
  });

  afterEach(function() {
    api.Model.getDocumentsStream = originalGetDocumentsStream;
  });

  it('keeps loaded documents and stores the last loading error', async function() {
    api.Model.getDocumentsStream = async function*() {
      yield { document: { _id: '1', name: 'test' } };
      throw new Error('Document query timed out');
    };
    const componentDef = modelsComponent({ component: (_name, def) => def });
    const state = createDocumentLoadingState();

    await componentDef.methods.getDocuments.call(state);

    assert.deepStrictEqual(state.documents, [{ _id: '1', name: 'test' }]);
    assert.strictEqual(state.documentsError, 'Document query timed out');
    assert.strictEqual(state.status, 'loaded');
  });

  it('stores count errors without treating document loading as failed', async function() {
    api.Model.getDocumentsStream = async function*() {
      yield { numDocsError: 'Count query timed out' };
      yield { document: { _id: '1', name: 'test' } };
    };
    const componentDef = modelsComponent({ component: (_name, def) => def });
    const state = createDocumentLoadingState();

    await componentDef.methods.getDocuments.call(state);

    assert.deepStrictEqual(state.documents, [{ _id: '1', name: 'test' }]);
    assert.strictEqual(state.numDocumentsError, 'Count query timed out');
    assert.strictEqual(state.documentsError, null);
  });
});

function createDocumentLoadingState() {
  return {
    currentModel: 'Test',
    documents: [],
    numDocuments: null,
    numDocumentsError: null,
    documentsError: null,
    loadedAllDocs: false,
    loadingMore: false,
    status: 'loaded',
    suppressScrollCheck: false,
    trackRecentModel() {},
    buildDocumentFetchParams() {
      return { model: this.currentModel };
    },
    restoreScrollPosition() {},
    checkIfScrolledToBottom() {},
    $nextTick(callback) {
      callback();
    }
  };
}
