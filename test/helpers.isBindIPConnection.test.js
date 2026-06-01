'use strict';

const assert = require('assert');
const isBindIPConnection = require('../backend/helpers/isBindIPConnection');

describe('isBindIPConnection', function() {
  it('allows any connection when bindIp is null', function() {
    assert.ok(isBindIPConnection({ ip: '203.0.113.10' }, null));
  });

  it('matches req.ip exactly', function() {
    const bindIp = ['127.0.0.1', '192.168.0.10'];

    assert.ok(isBindIPConnection({ ip: '127.0.0.1' }, bindIp));
    assert.ok(isBindIPConnection({ ip: '192.168.0.10' }, bindIp));
    assert.ok(!isBindIPConnection({ ip: '::ffff:127.0.0.1' }, bindIp));
    assert.ok(!isBindIPConnection({ ip: '10.0.0.2' }, bindIp));
  });

  it('does not treat 0.0.0.0 as special', function() {
    assert.ok(!isBindIPConnection({ ip: '203.0.113.10' }, ['0.0.0.0']));
  });
});
