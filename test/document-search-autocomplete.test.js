'use strict';

const assert = require('assert');
const {
  buildAutocompleteTrie,
  getAutocompleteContext,
  getAutocompleteSuggestions,
  applySuggestion,
  getDatePickerInsertionRange,
  dateArgumentSliceToDatetimeLocal,
  insertQuotedIsoInDateArgument,
  FUNCTION_HELPERS
} = require('../frontend/src/_util/document-search-autocomplete');

describe('document-search-autocomplete', function() {
  describe('getAutocompleteContext()', function() {
    it('detects value context after colon', function() {
      const searchText = '{ _id: ';
      const cursorPos = searchText.length;
      const context = getAutocompleteContext(searchText, cursorPos);
      
      assert.ok(context);
      assert.strictEqual(context.role, 'value');
      assert.strictEqual(context.token, '');
    });

    it('detects value context with partial token', function() {
      const searchText = '{ _id: obj';
      const cursorPos = searchText.length;
      const context = getAutocompleteContext(searchText, cursorPos);
      
      assert.ok(context);
      assert.strictEqual(context.role, 'value');
      assert.strictEqual(context.token, 'obj');
    });

    it('detects field name context at start', function() {
      const searchText = '{ na';
      const cursorPos = searchText.length;
      const context = getAutocompleteContext(searchText, cursorPos);
      
      assert.ok(context);
      assert.strictEqual(context.role, 'fieldName');
      assert.strictEqual(context.token, 'na');
    });

    it('detects field name context after comma', function() {
      const searchText = '{ name: "test", ag';
      const cursorPos = searchText.length;
      const context = getAutocompleteContext(searchText, cursorPos);
      
      assert.ok(context);
      assert.strictEqual(context.role, 'fieldName');
      assert.strictEqual(context.token, 'ag');
    });

    it('returns null when not in autocomplete context', function() {
      const searchText = '{ name: "test" }';
      const cursorPos = searchText.length;
      const context = getAutocompleteContext(searchText, cursorPos);
      
      assert.strictEqual(context, null);
    });

    it('detects field context in nested object', function() {
      const searchText = '{ _id: { $gte: ';
      const cursorPos = searchText.length;
      const context = getAutocompleteContext(searchText, cursorPos);
      
      assert.ok(context);
      assert.strictEqual(context.role, 'value');
      assert.strictEqual(context.token, '');
    });

    it('detects field context when opening nested object', function() {
      const searchText = '{ _id: { ';
      const cursorPos = searchText.length;
      const context = getAutocompleteContext(searchText, cursorPos);
      
      assert.ok(context);
      assert.strictEqual(context.role, 'fieldName');
      assert.strictEqual(context.token, '');
    });

    it('detects field context with partial operator', function() {
      const searchText = '{ _id: { $g';
      const cursorPos = searchText.length;
      const context = getAutocompleteContext(searchText, cursorPos);
      
      assert.ok(context);
      assert.strictEqual(context.role, 'fieldName');
      assert.strictEqual(context.token, '$g');
    });
  });

  describe('buildAutocompleteTrie() and getAutocompleteSuggestions()', function() {
    it('suggests value helpers in value context', function() {
      const trie = buildAutocompleteTrie([]);
      const searchText = '{ _id: obj';
      const cursorPos = searchText.length;
      const suggestions = getAutocompleteSuggestions(trie, searchText, cursorPos, []);
      
      assert.ok(suggestions.includes('objectIdRange'));
      // ObjectId won't match 'obj' prefix since it starts with capital 'O'
      assert.ok(!suggestions.includes('ObjectId'));
    });

    it('suggests value helpers with empty token', function() {
      const trie = buildAutocompleteTrie([]);
      const searchText = '{ _id: ';
      const cursorPos = searchText.length;
      const suggestions = getAutocompleteSuggestions(trie, searchText, cursorPos, []);
      
      // Should return empty because term is empty
      assert.strictEqual(suggestions.length, 0);
    });

    it('suggests ObjectId when typing "O"', function() {
      const trie = buildAutocompleteTrie([]);
      const searchText = '{ _id: O';
      const cursorPos = searchText.length;
      const suggestions = getAutocompleteSuggestions(trie, searchText, cursorPos, []);
      
      assert.ok(suggestions.includes('ObjectId'));
    });

    it('suggests Date when typing "D"', function() {
      const trie = buildAutocompleteTrie([]);
      const searchText = '{ createdAt: D';
      const cursorPos = searchText.length;
      const suggestions = getAutocompleteSuggestions(trie, searchText, cursorPos, []);
      
      assert.ok(suggestions.includes('Date'));
    });

    it('suggests Math when typing "M"', function() {
      const trie = buildAutocompleteTrie([]);
      const searchText = '{ value: M';
      const cursorPos = searchText.length;
      const suggestions = getAutocompleteSuggestions(trie, searchText, cursorPos, []);
      
      assert.ok(suggestions.includes('Math'));
    });

    it('suggests field names in field context', function() {
      const schemaPaths = [
        { path: 'name' },
        { path: 'email' },
        { path: 'age' }
      ];
      const trie = buildAutocompleteTrie(schemaPaths);
      const searchText = '{ na';
      const cursorPos = searchText.length;
      const suggestions = getAutocompleteSuggestions(trie, searchText, cursorPos, schemaPaths);
      
      assert.ok(suggestions.includes('name'));
    });

    it('does not suggest value helpers in field context', function() {
      const trie = buildAutocompleteTrie([]);
      const searchText = '{ obj';
      const cursorPos = searchText.length;
      const suggestions = getAutocompleteSuggestions(trie, searchText, cursorPos, []);
      
      assert.ok(!suggestions.includes('objectIdRange'));
      assert.ok(!suggestions.includes('ObjectId'));
    });

    it('does not suggest field names in value context', function() {
      const schemaPaths = [
        { path: 'name' },
        { path: 'email' }
      ];
      const trie = buildAutocompleteTrie(schemaPaths);
      const searchText = '{ _id: na';
      const cursorPos = searchText.length;
      const suggestions = getAutocompleteSuggestions(trie, searchText, cursorPos, schemaPaths);
      
      assert.ok(!suggestions.includes('name'));
    });

    it('suggests query operators in nested object', function() {
      const trie = buildAutocompleteTrie([]);
      const searchText = '{ _id: { $g';
      const cursorPos = searchText.length;
      const suggestions = getAutocompleteSuggestions(trie, searchText, cursorPos, []);
      
      assert.ok(suggestions.includes('$gt'));
      assert.ok(suggestions.includes('$gte'));
    });

    it('suggests operators when opening nested object', function() {
      const trie = buildAutocompleteTrie([]);
      const searchText = '{ _id: { $';
      const cursorPos = searchText.length;
      const suggestions = getAutocompleteSuggestions(trie, searchText, cursorPos, []);
      
      assert.ok(suggestions.includes('$eq'));
      assert.ok(suggestions.includes('$gt'));
      assert.ok(suggestions.includes('$gte'));
    });
  });

  describe('applySuggestion()', function() {
    it('applies suggestion in value context with parentheses for functions', function() {
      const searchText = '{ _id: obj';
      const cursorPos = searchText.length;
      const result = applySuggestion(searchText, cursorPos, 'objectIdRange');
      
      assert.strictEqual(result.text, '{ _id: objectIdRange()');
      assert.strictEqual(result.newCursorPos, '{ _id: objectIdRange('.length);
    });

    it('adds parentheses for ObjectId', function() {
      const searchText = '{ _id: O';
      const cursorPos = searchText.length;
      const result = applySuggestion(searchText, cursorPos, 'ObjectId');
      
      assert.strictEqual(result.text, '{ _id: ObjectId()');
      assert.strictEqual(result.newCursorPos, '{ _id: ObjectId('.length);
    });

    it('adds parentheses for Date', function() {
      const searchText = '{ createdAt: D';
      const cursorPos = searchText.length;
      const result = applySuggestion(searchText, cursorPos, 'Date');
      
      assert.strictEqual(result.text, '{ createdAt: Date()');
      assert.strictEqual(result.newCursorPos, '{ createdAt: Date('.length);
    });

    it('does not add parentheses for Math', function() {
      const searchText = '{ value: M';
      const cursorPos = searchText.length;
      const result = applySuggestion(searchText, cursorPos, 'Math');
      
      assert.strictEqual(result.text, '{ value: Math');
      assert.strictEqual(result.newCursorPos, '{ value: Math'.length);
    });

    it('preserves opening brace when applying operator suggestions', function() {
      const searchText = '{ _id: { $ex';
      const cursorPos = searchText.length;
      const result = applySuggestion(searchText, cursorPos, '$exists');

      assert.strictEqual(result.text, '{ _id: { $exists');
      assert.strictEqual(result.newCursorPos, '{ _id: { $exists'.length);
    });

    it('does not add a brace when completing function helpers', function() {
      const searchText = '{ _id: object';
      const cursorPos = searchText.length;
      const result = applySuggestion(searchText, cursorPos, 'objectIdRange');

      assert.strictEqual(result.text, '{ _id: objectIdRange()');
      assert.strictEqual(result.newCursorPos, '{ _id: objectIdRange('.length);
    });

    it('applies suggestion in field context with colon', function() {
      const searchText = '{ na';
      const cursorPos = searchText.length;
      const result = applySuggestion(searchText, cursorPos, 'name');
      
      assert.strictEqual(result.text, '{ name:');
      assert.strictEqual(result.newCursorPos, '{ name:'.length);
    });

    it('preserves text after cursor', function() {
      const searchText = '{ _id: obj }';
      const cursorPos = '{ _id: obj'.length;
      const result = applySuggestion(searchText, cursorPos, 'objectIdRange');
      
      assert.strictEqual(result.text, '{ _id: objectIdRange() }');
    });

    it('handles quoted field names', function() {
      const searchText = '{ "na';
      const cursorPos = searchText.length;
      const result = applySuggestion(searchText, cursorPos, '"name"');
      
      assert.strictEqual(result.text, '{ "name":');
    });
  });

  describe('getDatePickerInsertionRange()', function() {
    it('returns null when the cursor is not inside Date(...)', function() {
      assert.strictEqual(getDatePickerInsertionRange('{ x: 1 }', 5), null);
      assert.strictEqual(getDatePickerInsertionRange('{ d: 1 }', '{ d: '.length), null);
    });

    it('detects new Date( at end of before', function() {
      const searchText = '{ x: new Date(';
      const cursorPos = searchText.length;
      const range = getDatePickerInsertionRange(searchText, cursorPos);

      assert.ok(range);
      assert.strictEqual(searchText.slice(0, range.innerStart).endsWith('new Date('), true);
      assert.strictEqual(range.needsClosingParen, true);
      assert.strictEqual(range.innerEnd, cursorPos);
    });

    it('sets needsClosingParen false when ) is present after the cursor', function() {
      const searchText = '{ createdAt: Date() }';
      const cursorPos = '{ createdAt: Date('.length;
      const range = getDatePickerInsertionRange(searchText, cursorPos);

      assert.ok(range);
      assert.strictEqual(range.needsClosingParen, false);
      assert.strictEqual(searchText.slice(range.innerStart, range.innerEnd), '');
      assert.strictEqual(searchText[range.innerEnd], ')');
    });

    it('sets needsClosingParen true when no ) appears after the cursor', function() {
      const searchText = '{ createdAt: Date( }';
      const cursorPos = '{ createdAt: Date('.length;
      const range = getDatePickerInsertionRange(searchText, cursorPos);

      assert.ok(range);
      assert.strictEqual(range.needsClosingParen, true);
      assert.strictEqual(range.innerEnd, cursorPos);
    });

    it('finds inner slice when cursor is before the closing quote of a literal', function() {
      const searchText = '{ createdAt: Date("2020-01-01") }';
      const cursorPos = '{ createdAt: Date("2020-01-01'.length;
      const range = getDatePickerInsertionRange(searchText, cursorPos);

      assert.ok(range);
      assert.strictEqual(searchText.slice(range.innerStart, range.innerEnd), '"2020-01-01"');
      assert.strictEqual(range.needsClosingParen, false);
    });
  });

  describe('dateArgumentSliceToDatetimeLocal()', function() {
    it('returns empty string for blank or invalid input', function() {
      assert.strictEqual(dateArgumentSliceToDatetimeLocal(''), '');
      assert.strictEqual(dateArgumentSliceToDatetimeLocal('   '), '');
      assert.strictEqual(dateArgumentSliceToDatetimeLocal('not-a-date'), '');
    });

    it('returns YYYY-MM-DDTHH:mm for a parseable slice', function() {
      const result = dateArgumentSliceToDatetimeLocal('2020-06-15T14:30');
      assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(result));
      assert.strictEqual(result.slice(0, 10), '2020-06-15');
    });

    it('strips surrounding quotes before parsing', function() {
      const result = dateArgumentSliceToDatetimeLocal('"2021-12-25T08:00:00.000Z"');
      assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(result));
    });
  });

  describe('insertQuotedIsoInDateArgument()', function() {
    it('replaces the inner range with JSON-stringified ISO and no extra ) by default', function() {
      const searchText = '{ d: Date(OLD) }';
      const prefix = '{ d: Date(';
      const inner = 'OLD';
      const innerStart = prefix.length;
      const innerEnd = innerStart + inner.length;
      const range = { innerStart, innerEnd, needsClosingParen: false };
      const iso = '2022-03-04T12:00:00.000Z';

      const result = insertQuotedIsoInDateArgument(searchText, range, iso);
      const expectedQuoted = JSON.stringify(iso);

      assert.strictEqual(result.text, '{ d: Date(' + expectedQuoted + ') }');
      assert.strictEqual(result.newCursorPos, innerStart + expectedQuoted.length);
    });

    it('appends ) when needsClosingParen is true', function() {
      const searchText = '{ d: Date( }';
      const innerStart = '{ d: Date('.length;
      const range = { innerStart, innerEnd: innerStart, needsClosingParen: true };
      const iso = '2023-01-02T00:00:00.000Z';

      const result = insertQuotedIsoInDateArgument(searchText, range, iso);
      const expectedQuoted = JSON.stringify(iso);

      assert.ok(result.text.includes('{ d: Date(' + expectedQuoted + ')'));
      assert.strictEqual(result.newCursorPos, innerStart + expectedQuoted.length + 1);
    });

    it('does not append ) when needsClosingParen is omitted (falsy)', function() {
      const searchText = '{ d: Date(x) }';
      const innerStart = '{ d: Date('.length;
      const range = { innerStart, innerEnd: innerStart + 1, needsClosingParen: false };
      const result = insertQuotedIsoInDateArgument(searchText, range, '2000-01-01T00:00:00.000Z');

      assert.strictEqual(result.text.indexOf('))'), -1);
      assert.ok(result.text.endsWith(') }'));
    });
  });

  describe('FUNCTION_HELPERS', function() {
    it('includes Date ObjectId and objectIdRange', function() {
      assert.ok(FUNCTION_HELPERS.has('Date'));
      assert.ok(FUNCTION_HELPERS.has('ObjectId'));
      assert.ok(FUNCTION_HELPERS.has('objectIdRange'));
      assert.ok(!FUNCTION_HELPERS.has('Math'));
    });
  });
});
