'use strict';

const Archetype = require('archetype');
const assert = require('assert');
const mongoose = require('mongoose');
const z = require('zod/v4');

const archetypeToZodSchema = require('../backend/util/archetypeToZodSchema');

describe('archetypeToZodSchema()', function() {
  it('converts action parameter types to Zod object schemas', function() {
    const Params = new Archetype({
      name: { $type: 'string', $required: true },
      count: { $type: 'number', $default: 5 },
      enabled: { $type: 'boolean' },
      ids: { $type: [mongoose.Types.ObjectId], $required: true },
      value: { $type: Archetype.Any, $required: true },
      mode: { $type: 'string', $enum: ['one', 'two'] },
      nested: {
        label: { $type: 'string', $required: true }
      }
    }).compile('Params');

    const schema = archetypeToZodSchema(Params);
    assert.deepStrictEqual(schema.parse({
      name: 'test',
      ids: ['0123456789abcdef01234567'],
      value: { answer: 42 },
      mode: 'one',
      nested: { label: 'child' }
    }), {
      name: 'test',
      ids: ['0123456789abcdef01234567'],
      value: { answer: 42 },
      mode: 'one',
      nested: { label: 'child' }
    });
    assert.strictEqual(schema.safeParse({ name: 'test', ids: [], value: null, mode: 'invalid' }).success, false);

    const jsonSchema = z.toJSONSchema(schema);
    assert.deepStrictEqual(jsonSchema.required, ['name', 'ids', 'value']);
    assert.strictEqual(jsonSchema.properties.count.default, 5);
  });

  it('rejects values that fail an Archetype validator', function() {
    const Params = new Archetype({
      positive: {
        $type: 'number',
        $required: true,
        $validate: value => assert.ok(value > 0)
      }
    }).compile('Params');

    const schema = archetypeToZodSchema(Params);
    assert.strictEqual(schema.safeParse({ positive: 1 }).success, true);
    assert.strictEqual(schema.safeParse({ positive: 0 }).success, false);
  });
});
