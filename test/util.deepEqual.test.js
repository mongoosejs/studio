'use strict';

const assert = require('assert');
const deepEqual = require('../frontend/src/_util/deepEqual');

describe('deepEqual()', function() {
  describe('primitives', function() {
    it('returns true for identical numbers', function() {
      assert.strictEqual(deepEqual(5, 5), true);
      assert.strictEqual(deepEqual(0, 0), true);
      assert.strictEqual(deepEqual(-1, -1), true);
      assert.strictEqual(deepEqual(3.14, 3.14), true);
    });

    it('returns false for different numbers', function() {
      assert.strictEqual(deepEqual(5, 6), false);
      assert.strictEqual(deepEqual(0, 1), false);
      assert.strictEqual(deepEqual(-1, 1), false);
    });

    it('returns true for identical strings', function() {
      assert.strictEqual(deepEqual('hello', 'hello'), true);
      assert.strictEqual(deepEqual('', ''), true);
      assert.strictEqual(deepEqual('test', 'test'), true);
    });

    it('returns false for different strings', function() {
      assert.strictEqual(deepEqual('hello', 'world'), false);
      assert.strictEqual(deepEqual('test', 'Test'), false);
    });

    it('returns true for identical booleans', function() {
      assert.strictEqual(deepEqual(true, true), true);
      assert.strictEqual(deepEqual(false, false), true);
    });

    it('returns false for different booleans', function() {
      assert.strictEqual(deepEqual(true, false), false);
      assert.strictEqual(deepEqual(false, true), false);
    });

    it('handles null correctly', function() {
      assert.strictEqual(deepEqual(null, null), true);
      assert.strictEqual(deepEqual(null, undefined), false);
      assert.strictEqual(deepEqual(null, 0), false);
      assert.strictEqual(deepEqual(null, ''), false);
    });

    it('handles undefined correctly', function() {
      assert.strictEqual(deepEqual(undefined, undefined), true);
      assert.strictEqual(deepEqual(undefined, null), false);
      assert.strictEqual(deepEqual(undefined, 0), false);
    });
  });

  describe('arrays', function() {
    it('returns true for identical arrays', function() {
      assert.strictEqual(deepEqual([1, 2, 3], [1, 2, 3]), true);
      assert.strictEqual(deepEqual([], []), true);
      assert.strictEqual(deepEqual(['a', 'b'], ['a', 'b']), true);
    });

    it('returns false for different arrays', function() {
      assert.strictEqual(deepEqual([1, 2, 3], [1, 2, 4]), false);
      assert.strictEqual(deepEqual([1, 2], [1, 2, 3]), false);
      assert.strictEqual(deepEqual([1, 2, 3], [1, 2]), false);
      assert.strictEqual(deepEqual(['a'], ['b']), false);
    });

    it('returns false for arrays with different order', function() {
      assert.strictEqual(deepEqual([1, 2, 3], [3, 2, 1]), false);
      assert.strictEqual(deepEqual(['a', 'b'], ['b', 'a']), false);
    });

    it('handles nested arrays', function() {
      assert.strictEqual(deepEqual([[1, 2], [3, 4]], [[1, 2], [3, 4]]), true);
      assert.strictEqual(deepEqual([[1, 2], [3, 4]], [[1, 2], [3, 5]]), false);
      assert.strictEqual(deepEqual([1, [2, 3]], [1, [2, 3]]), true);
      assert.strictEqual(deepEqual([1, [2, 3]], [1, [2, 4]]), false);
    });

    it('handles arrays with mixed types', function() {
      assert.strictEqual(deepEqual([1, 'two', true], [1, 'two', true]), true);
      assert.strictEqual(deepEqual([1, 'two', true], [1, 'two', false]), false);
      assert.strictEqual(deepEqual([null, undefined], [null, undefined]), true);
    });
  });

  describe('objects', function() {
    it('returns true for identical objects', function() {
      assert.strictEqual(deepEqual({ a: 1 }, { a: 1 }), true);
      assert.strictEqual(deepEqual({}, {}), true);
      assert.strictEqual(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 }), true);
    });

    it('returns false for different objects', function() {
      assert.strictEqual(deepEqual({ a: 1 }, { a: 2 }), false);
      assert.strictEqual(deepEqual({ a: 1 }, { b: 1 }), false);
      assert.strictEqual(deepEqual({ a: 1, b: 2 }, { a: 1 }), false);
      assert.strictEqual(deepEqual({ a: 1 }, { a: 1, b: 2 }), false);
    });

    it('returns true for objects with properties in different order', function() {
      assert.strictEqual(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
      assert.strictEqual(deepEqual({ x: 1, y: 2, z: 3 }, { z: 3, x: 1, y: 2 }), true);
    });

    it('handles nested objects', function() {
      assert.strictEqual(deepEqual({ a: { b: 1 } }, { a: { b: 1 } }), true);
      assert.strictEqual(deepEqual({ a: { b: 1 } }, { a: { b: 2 } }), false);
      assert.strictEqual(deepEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 1 } } }), true);
      assert.strictEqual(deepEqual({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } }), false);
    });

    it('handles objects with mixed value types', function() {
      assert.strictEqual(deepEqual({ a: 1, b: 'two', c: true }, { a: 1, b: 'two', c: true }), true);
      assert.strictEqual(deepEqual({ a: 1, b: 'two', c: true }, { a: 1, b: 'two', c: false }), false);
      assert.strictEqual(deepEqual({ a: null, b: undefined }, { a: null, b: undefined }), true);
    });
  });

  describe('dates', function() {
    it('returns true for identical dates', function() {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-01');
      assert.strictEqual(deepEqual(date1, date2), true);
    });

    it('returns false for different dates', function() {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-02');
      assert.strictEqual(deepEqual(date1, date2), false);
    });

    it('returns true for dates with same timestamp but created differently', function() {
      const date1 = new Date(2024, 0, 1);
      const date2 = new Date(2024, 0, 1);
      assert.strictEqual(deepEqual(date1, date2), true);
    });

    it('handles dates in objects and arrays', function() {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-01');
      const date3 = new Date('2024-01-02');
      
      assert.strictEqual(deepEqual({ date: date1 }, { date: date2 }), true);
      assert.strictEqual(deepEqual({ date: date1 }, { date: date3 }), false);
      assert.strictEqual(deepEqual([date1], [date2]), true);
      assert.strictEqual(deepEqual([date1], [date3]), false);
    });
  });

  describe('complex nested structures', function() {
    it('handles arrays of objects', function() {
      assert.strictEqual(
        deepEqual([{ a: 1 }, { b: 2 }], [{ a: 1 }, { b: 2 }]),
        true
      );
      assert.strictEqual(
        deepEqual([{ a: 1 }, { b: 2 }], [{ a: 1 }, { b: 3 }]),
        false
      );
    });

    it('handles objects with array properties', function() {
      assert.strictEqual(
        deepEqual({ arr: [1, 2, 3] }, { arr: [1, 2, 3] }),
        true
      );
      assert.strictEqual(
        deepEqual({ arr: [1, 2, 3] }, { arr: [1, 2, 4] }),
        false
      );
    });

    it('handles deeply nested structures', function() {
      const obj1 = {
        a: 1,
        b: {
          c: [1, 2, { d: 3 }],
          e: 'test'
        }
      };
      const obj2 = {
        a: 1,
        b: {
          c: [1, 2, { d: 3 }],
          e: 'test'
        }
      };
      const obj3 = {
        a: 1,
        b: {
          c: [1, 2, { d: 4 }],
          e: 'test'
        }
      };
      
      assert.strictEqual(deepEqual(obj1, obj2), true);
      assert.strictEqual(deepEqual(obj1, obj3), false);
    });

    it('handles arrays with objects containing dates', function() {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-01');
      const date3 = new Date('2024-01-02');
      
      assert.strictEqual(
        deepEqual([{ date: date1 }], [{ date: date2 }]),
        true
      );
      assert.strictEqual(
        deepEqual([{ date: date1 }], [{ date: date3 }]),
        false
      );
    });
  });

  describe('edge cases', function() {
    it('returns false for different types', function() {
      assert.strictEqual(deepEqual(5, '5'), false);
      assert.strictEqual(deepEqual(true, 1), false);
      assert.strictEqual(deepEqual([], {}), false);
      assert.strictEqual(deepEqual(null, {}), false);
      assert.strictEqual(deepEqual(undefined, {}), false);
    });

    it('handles same reference', function() {
      const obj = { a: 1 };
      const arr = [1, 2, 3];
      assert.strictEqual(deepEqual(obj, obj), true);
      assert.strictEqual(deepEqual(arr, arr), true);
    });

    it('handles empty structures', function() {
      assert.strictEqual(deepEqual([], []), true);
      assert.strictEqual(deepEqual({}, {}), true);
      assert.strictEqual(deepEqual([], {}), false);
    });

    it('handles objects with number keys', function() {
      assert.strictEqual(deepEqual({ 0: 'a', 1: 'b' }, { 0: 'a', 1: 'b' }), true);
      assert.strictEqual(deepEqual({ 0: 'a', 1: 'b' }, { 0: 'a', 1: 'c' }), false);
    });
  });

  describe('real-world use cases', function() {
    it('handles MongoDB-like document structures', function() {
      const doc1 = {
        _id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        age: 30,
        tags: ['developer', 'nodejs'],
        address: {
          street: '123 Main St',
          city: 'New York'
        }
      };
      const doc2 = {
        _id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        age: 30,
        tags: ['developer', 'nodejs'],
        address: {
          street: '123 Main St',
          city: 'New York'
        }
      };
      const doc3 = {
        _id: '507f1f77bcf86cd799439011',
        name: 'John Doe',
        age: 31, // Changed
        tags: ['developer', 'nodejs'],
        address: {
          street: '123 Main St',
          city: 'New York'
        }
      };
      
      assert.strictEqual(deepEqual(doc1, doc2), true);
      assert.strictEqual(deepEqual(doc1, doc3), false);
    });

    it('handles array modifications', function() {
      const original = ['item1', 'item2', 'item3'];
      const unchanged = ['item1', 'item2', 'item3'];
      const modified = ['item1', 'item2', 'item4'];
      const added = ['item1', 'item2', 'item3', 'item4'];
      const removed = ['item1', 'item2'];
      
      assert.strictEqual(deepEqual(original, unchanged), true);
      assert.strictEqual(deepEqual(original, modified), false);
      assert.strictEqual(deepEqual(original, added), false);
      assert.strictEqual(deepEqual(original, removed), false);
    });
  });
});
