'use strict';

const assert = require('assert');
const dedent = require('dedent');
const getModelDescriptions = require('../backend/helpers/getModelDescriptions');
const mongoose = require('mongoose');

const { Schema } = mongoose;

describe('getModelDescriptions', function() {
  let conn;

  afterEach(async function() {
    if (conn) {
      await conn.destroy();
      conn = null;
    }
  });

  it('should describe a simple schema with basic types', function() {
    conn = mongoose.createConnection();
    const UserSchema = new Schema({
      name: String,
      age: Number,
      email: { type: String }
    });

    conn.model('User', UserSchema, 'users');

    const result = getModelDescriptions(conn);

    assert.strictEqual(
      result,
      dedent(`
        User (collection: users)
        Fields:
        - name: String
        - age: Number
        - email: String
        - _id: ObjectId
        - __v: Number
      `)
    );
  });

  it('should include refs in schema paths', function() {
    conn = mongoose.createConnection();
    const BookSchema = new Schema({
      title: String,
      author: { type: Schema.Types.ObjectId, ref: 'User' }
    });

    conn.model('Book', BookSchema, 'books');

    const result = getModelDescriptions(conn);

    assert.strictEqual(
      result,
      dedent(`
        Book (collection: books)
        Fields:
        - title: String
        - author: ObjectId (ref: User)
        - _id: ObjectId
        - __v: Number
      `)
    );
  });

  it('should include virtual refs', function() {
    conn = mongoose.createConnection();
    const UserSchema = new Schema({ name: String });
    UserSchema.virtual('books', {
      ref: 'Book',
      localField: '_id',
      foreignField: 'author'
    });

    conn.model('User', UserSchema, 'users');

    const result = getModelDescriptions(conn);

    assert.strictEqual(
      result,
      dedent(`
        User (collection: users)
        Fields:
        - name: String
        - _id: ObjectId
        - __v: Number
        Virtuals:
        - books: Virtual (ref: Book)
      `)
    );
  });

  it('should skip models with names starting with __Studio', function() {
    conn = mongoose.createConnection();
    const HiddenSchema = new Schema({ foo: String });
    conn.model('__StudioHidden', HiddenSchema, 'hidden');

    const result = getModelDescriptions(conn);

    assert.strictEqual(result, '');
  });

  it('should describe multiple models', function() {
    conn = mongoose.createConnection();
    const UserSchema = new Schema({ name: String });
    const BookSchema = new Schema({
      title: String,
      author: { type: Schema.Types.ObjectId, ref: 'User' }
    });

    conn.model('User', UserSchema, 'users');
    conn.model('Book', BookSchema, 'books');

    const result = getModelDescriptions(conn);

    assert.strictEqual(
      result,
      dedent(`
        User (collection: users)
        Fields:
        - name: String
        - _id: ObjectId
        - __v: Number

        Book (collection: books)
        Fields:
        - title: String
        - author: ObjectId (ref: User)
        - _id: ObjectId
        - __v: Number
      `)
    );
  });

  it('should describe subdocuments and document arrays (1 level deep)', function() {
    conn = mongoose.createConnection();
    const BookSchema = new Schema({
      title: String,
      tags: [String],
      authors: [{ _id: false, name: String, isPrimary: Boolean }],
      primaryAuthor: new Schema({ _id: false, name: String })
    });

    conn.model('Book', BookSchema, 'books');

    const result = getModelDescriptions(conn);

    assert.strictEqual(
      result,
      dedent(`
        Book (collection: books)
        Fields:
        - title: String
        - tags: String[]
        - authors: Subdocument[]
          - name: String
          - isPrimary: Boolean
        - primaryAuthor: Embedded
          - name: String
        - _id: ObjectId
        - __v: Number
      `)
    );
  });

  it('should include methods and statics with their source code', function() {
    conn = mongoose.createConnection();
    const UserSchema = new Schema({ name: String });
    UserSchema.methods.greet = function(prefix) {
      return `${prefix} ${this.name}`;
    };
    UserSchema.statics.findByName = function(name) {
      return this.findOne({ name });
    };

    conn.model('User', UserSchema, 'users');

    const result = getModelDescriptions(conn);

    assert.strictEqual(
      result,
      dedent(`
        User (collection: users)
        Fields:
        - name: String
        - _id: ObjectId
        - __v: Number
        Methods:
        - greet:
          function(prefix) {
            return \`\${prefix} \${this.name}\`;
          }
        Statics:
        - findByName:
          function(name) {
            return this.findOne({ name });
          }
      `)
    );
  });
});
