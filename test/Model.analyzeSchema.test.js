'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const { actions, connection } = require('./setup.test');

describe('Model.analyzeSchema()', function() {
  const AnalyzeSchemaTest = connection.model('AnalyzeSchemaTest', new mongoose.Schema({
    name: {
      type: String,
      required: true
    },
    conditional: {
      type: String,
      required: function() {
        return false;
      }
    },
    age: Number,
    nested: {
      enabled: Boolean
    }
  }, { strict: false }));
  const NestedAnalyzeSchemaTest = connection.model('NestedAnalyzeSchemaTest', new mongoose.Schema({
    profile: new mongoose.Schema({
      name: String,
      settings: {
        enabled: Boolean
      },
      level1: new mongoose.Schema({
        level2: new mongoose.Schema({
          level3: new mongoose.Schema({
            level4: new mongoose.Schema({
              tooDeep: String
            })
          })
        })
      })
    }),
    children: [new mongoose.Schema({
      name: String,
      score: Number
    })]
  }, { strict: false }));
  const SlowAnalyzeSchemaTest = connection.model('SlowAnalyzeSchemaTest', new mongoose.Schema({
    name: {
      type: String,
      validate: async function() {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return true;
      }
    }
  }));

  afterEach(async function() {
    await Promise.all([
      AnalyzeSchemaTest.deleteMany(),
      NestedAnalyzeSchemaTest.deleteMany(),
      SlowAnalyzeSchemaTest.deleteMany()
    ]);
  });

  it('returns validation counts and property type counts for readonly members', async function() {
    const validDoc = await AnalyzeSchemaTest.create({ name: 'one', age: 42, nested: { enabled: true } });
    const invalidDoc = await AnalyzeSchemaTest.collection.insertOne({ name: 123, age: 'not a number', extra: null });
    await AnalyzeSchemaTest.collection.insertOne({ age: 10, extra: 'value' });

    const { analysis } = await actions.Model.analyzeSchema({
      model: 'AnalyzeSchemaTest',
      roles: ['readonly']
    });

    assert.strictEqual(analysis.documentCount, 3);
    assert.strictEqual(analysis.sampleSize, 3);
    assert.strictEqual(analysis.sampled, false);
    assert.strictEqual(analysis.validDocumentCount, 1);
    assert.strictEqual(analysis.invalidDocumentCount, 2);
    assert.strictEqual(analysis.firstValidDocumentId, validDoc._id.toString());
    assert.strictEqual(analysis.firstInvalidDocumentId, invalidDoc.insertedId.toString());
    assert.strictEqual(analysis.invalidDocuments.length, 2);
    assert.strictEqual(analysis.invalidDocuments[0].documentId, invalidDoc.insertedId.toString());
    assert(analysis.invalidDocuments[0].error.includes('AnalyzeSchemaTest validation failed'));
    assert(analysis.invalidDocuments[0].errors.age.message.includes('Cast to Number failed'));
    assert(analysis.invalidDocuments[1].errors.name.message.includes('Path `name` is required'));
    assert.deepStrictEqual(analysis.paths.map(path => path.path), ['name', 'conditional', 'age', 'nested.enabled', '_id', '__v']);

    const byPath = Object.fromEntries(analysis.paths.map(path => [path.path, path.types]));
    const pathMetadata = Object.fromEntries(analysis.paths.map(path => [path.path, path]));
    assert.strictEqual(pathMetadata.name.required, true);
    assert(!Object.prototype.hasOwnProperty.call(pathMetadata.conditional, 'required'));
    assert(!Object.prototype.hasOwnProperty.call(pathMetadata.age, 'required'));
    assert.deepStrictEqual(typeCounts(byPath.name), {
      number: 1,
      string: 1,
      undefined: 1
    });
    assert.strictEqual(byPath.extra, undefined);
    assert.deepStrictEqual(typeCounts(byPath['nested.enabled']), {
      boolean: 1,
      undefined: 2
    });
    assert.deepStrictEqual(typeCounts(byPath.__v), {
      number: 1,
      undefined: 2
    });
  });

  it('samples 1000 documents for collections with more than 1000 documents', async function() {
    this.timeout(10000);

    const docs = [];
    for (let i = 0; i < 1001; ++i) {
      docs.push({ name: `doc ${i}`, age: i });
    }
    await AnalyzeSchemaTest.insertMany(docs);

    const { analysis } = await actions.Model.analyzeSchema({
      model: 'AnalyzeSchemaTest',
      roles: ['admin']
    });

    assert.strictEqual(analysis.documentCount, 1001);
    assert.strictEqual(analysis.sampleSize, 1000);
    assert.strictEqual(analysis.sampled, true);
  });

  it('drills into subdocuments and document arrays up to depth 4', async function() {
    await NestedAnalyzeSchemaTest.collection.insertOne({
      profile: {
        name: 'test',
        settings: { enabled: true },
        level1: { level2: { level3: { level4: { tooDeep: 'hidden' } } } }
      },
      children: [{ name: 'alpha', score: 1 }, { name: 2, score: 'bad' }]
    });
    await NestedAnalyzeSchemaTest.collection.insertOne({});

    const { analysis } = await actions.Model.analyzeSchema({
      model: 'NestedAnalyzeSchemaTest',
      roles: ['admin']
    });

    const paths = analysis.paths.map(path => path.path);
    assert(paths.includes('profile.name'));
    assert(paths.includes('profile.settings.enabled'));
    assert(paths.includes('children.name'));
    assert(paths.includes('children.score'));
    assert(paths.includes('profile.level1.level2.level3'));
    assert(!paths.includes('profile.level1.level2.level3.level4'));
    assert(!paths.includes('profile.level1.level2.level3.level4.tooDeep'));

    const byPath = Object.fromEntries(analysis.paths.map(path => [path.path, path.types]));
    const pathMetadata = Object.fromEntries(analysis.paths.map(path => [path.path, path]));
    assert.deepStrictEqual(typeCounts(byPath['children.name']), {
      number: 1,
      string: 1
    });
    assert.strictEqual(pathMetadata['children.name'].valueCount, 2);
  });

  it('counts nested document array path types per array element', async function() {
    await NestedAnalyzeSchemaTest.collection.insertOne({
      children: [
        { name: 'alpha', score: 1 },
        { name: 'beta' },
        { name: null, score: 3 },
        { score: 4 }
      ]
    });

    const { analysis } = await actions.Model.analyzeSchema({
      model: 'NestedAnalyzeSchemaTest',
      roles: ['admin']
    });

    const byPath = Object.fromEntries(analysis.paths.map(path => [path.path, path.types]));
    const pathMetadata = Object.fromEntries(analysis.paths.map(path => [path.path, path]));
    assert.deepStrictEqual(typeCounts(byPath['children.name']), {
      string: 2,
      null: 1,
      undefined: 1
    });
    assert.deepStrictEqual(typeCounts(byPath['children.score']), {
      number: 3,
      undefined: 1
    });
    assert.strictEqual(pathMetadata['children.name'].valueCount, 4);
    assert.strictEqual(pathMetadata['children.score'].valueCount, 4);
  });

  it('does not collapse single-element document arrays when reading nested paths', async function() {
    await NestedAnalyzeSchemaTest.collection.insertOne({
      children: [{ name: 'solo', score: 5 }]
    });

    const { analysis } = await actions.Model.analyzeSchema({
      model: 'NestedAnalyzeSchemaTest',
      roles: ['admin']
    });

    const byPath = Object.fromEntries(analysis.paths.map(path => [path.path, path.types]));
    const pathMetadata = Object.fromEntries(analysis.paths.map(path => [path.path, path]));
    assert.deepStrictEqual(typeCounts(byPath['children']), {
      array: 1
    });
    assert.deepStrictEqual(typeCounts(byPath['children.name']), {
      string: 1
    });
    assert.deepStrictEqual(typeCounts(byPath['children.score']), {
      number: 1
    });
    assert.strictEqual(pathMetadata['children.name'].valueCount, 1);
    assert.strictEqual(pathMetadata['children.score'].valueCount, 1);
  });

  it('validates documents in parallel and treats validations over 1s as failed', async function() {
    this.timeout(3000);

    await SlowAnalyzeSchemaTest.collection.insertMany([{ name: 'one' }, { name: 'two' }]);

    const start = Date.now();
    const { analysis } = await actions.Model.analyzeSchema({
      model: 'SlowAnalyzeSchemaTest',
      roles: ['admin']
    });
    const elapsed = Date.now() - start;

    assert(elapsed < 1800);
    assert.strictEqual(analysis.validDocumentCount, 0);
    assert.strictEqual(analysis.invalidDocumentCount, 2);
    assert.strictEqual(analysis.invalidDocuments.length, 2);
    assert.strictEqual(analysis.invalidDocuments[0].error, 'Validation timed out');
    assert.strictEqual(analysis.invalidDocuments[0].errors, null);
  });

  it('validates one document by id for readonly members', async function() {
    const validDoc = await AnalyzeSchemaTest.create({ name: 'valid', age: 1 });
    const invalidDoc = await AnalyzeSchemaTest.collection.insertOne({ age: 'bad' });

    const validRes = await actions.Model.validateDocument({
      model: 'AnalyzeSchemaTest',
      documentId: validDoc._id.toString(),
      roles: ['readonly']
    });
    const invalidRes = await actions.Model.validateDocument({
      model: 'AnalyzeSchemaTest',
      documentId: invalidDoc.insertedId.toString(),
      roles: ['readonly']
    });

    assert.deepStrictEqual(validRes.result, {
      valid: true,
      documentId: validDoc._id.toString(),
      error: null,
      errors: null
    });
    assert.strictEqual(invalidRes.result.valid, false);
    assert.strictEqual(invalidRes.result.documentId, invalidDoc.insertedId.toString());
    assert(invalidRes.result.error.includes('AnalyzeSchemaTest validation failed'));
    assert(invalidRes.result.errors.name.message.includes('Path `name` is required'));
    assert(invalidRes.result.errors.age.message.includes('Cast to Number failed'));
  });
});

function typeCounts(types) {
  return Object.fromEntries(types.map(type => [type.type, type.count]));
}
