'use strict';

const assert = require('assert');
const ObjectId = require('mongoose/lib/mongoose').Types.ObjectId;

require('./setup');
const { createSSRApp } = require('vue');
const { renderToString } = require('vue/server-renderer');

const detailObjectId = require('../../frontend/src/detail-objectid/detail-objectid');

async function renderDetailObjectId(value, viewMode) {
  const app = createSSRApp({
    data: () => ({ value, viewMode }),
    template: '<detail-objectid :value="value" :viewMode="viewMode" />'
  });
  detailObjectId(app);

  return await renderToString(app);
}

describe('detail-objectid component', function() {
  it('formats ObjectId values as hex by default', async function() {
    const objectId = new ObjectId('662803f721efb6da63d4df7b');
    const html = await renderDetailObjectId(objectId);

    assert.ok(html.includes('>662803f721efb6da63d4df7b</pre>'));
  });

  it('formats string ObjectId values as ObjectId calls', async function() {
    const html = await renderDetailObjectId('662803f721efb6da63d4df7b', 'object_call');

    assert.ok(html.includes('>ObjectId(&#39;662803f721efb6da63d4df7b&#39;)</pre>'));
  });

  it('formats ObjectId values as Unix seconds', async function() {
    const html = await renderDetailObjectId('662803f721efb6da63d4df7b', 'unix_seconds');

    assert.ok(html.includes('>1713898487</pre>'));
  });

  it('formats ObjectId values as ISO dates', async function() {
    const html = await renderDetailObjectId('662803f721efb6da63d4df7b', 'date');

    assert.ok(html.includes('>2024-04-23T18:54:47.000Z</pre>'));
  });

  it('reads extended JSON $oid values', async function() {
    const html = await renderDetailObjectId({ $oid: '662803f721efb6da63d4df7b' });

    assert.ok(html.includes('>662803f721efb6da63d4df7b</pre>'));
  });

  it('preserves nullish values', async function() {
    const nullHtml = await renderDetailObjectId(null);
    const undefinedHtml = await renderDetailObjectId(undefined);

    assert.ok(nullHtml.includes('>null</pre>'));
    assert.ok(undefinedHtml.includes('>undefined</pre>'));
  });
});
