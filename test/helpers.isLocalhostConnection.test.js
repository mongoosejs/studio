'use strict';

const assert = require('assert');
const isLocalhostConnection = require('../backend/helpers/isLocalhostConnection');

describe('isLocalhostConnection', function() {
  it('allows localhost IP addresses', function() {
    assert.ok(isLocalhostConnection({ ip: '127.0.0.1' }));
    assert.ok(isLocalhostConnection({ ip: '::1' }));
    assert.ok(isLocalhostConnection({ ip: '::ffff:127.0.0.1' }));
  });

  it('rejects non-localhost IP addresses', function() {
    assert.ok(!isLocalhostConnection({ ip: '192.168.0.5' }));
    assert.ok(!isLocalhostConnection({}));
  });
});
