'use strict';

const assert = require('assert');
const normalizeBindIPOption = require('../backend/helpers/normalizeBindIPOption');

describe('normalizeBindIPOption', function() {
  it('defaults to localhost', function() {
    assert.deepStrictEqual(normalizeBindIPOption(undefined), ['localhost']);
  });

  it('preserves null', function() {
    assert.strictEqual(normalizeBindIPOption(null), null);
  });

  it('splits comma-separated strings', function() {
    assert.deepStrictEqual(normalizeBindIPOption('127.0.0.1, 192.168.0.10'), ['127.0.0.1', '192.168.0.10']);
  });

  it('supports arrays and trims values', function() {
    assert.deepStrictEqual(normalizeBindIPOption(['::1', ' 10.0.0.4 ']), ['::1', '10.0.0.4']);
  });

  it('filters empty values', function() {
    assert.deepStrictEqual(normalizeBindIPOption('127.0.0.1,, '), ['127.0.0.1']);
  });
});
