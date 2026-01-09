'use strict';

const { Trie } = require('../models/trie');

const QUERY_SELECTORS = [
  '$eq',
  '$ne',
  '$gt',
  '$gte',
  '$lt',
  '$lte',
  '$in',
  '$nin',
  '$exists',
  '$regex',
  '$options',
  '$text',
  '$search',
  '$and',
  '$or',
  '$nor',
  '$not',
  '$elemMatch',
  '$size',
  '$all',
  '$type',
  '$expr',
  '$jsonSchema',
  '$mod'
];

const VALUE_HELPERS = [
  'objectIdRange',
  'ObjectId',
  'Date',
  'Math'
];

// Helpers that are function calls and should have () added
const FUNCTION_HELPERS = new Set([
  'objectIdRange',
  'ObjectId',
  'Date'
]);

function buildAutocompleteTrie(schemaPaths) {
  const trie = new Trie();
  // Query operators can appear as field names in nested objects, so add with both roles
  trie.bulkInsert(QUERY_SELECTORS, 5, 'operator');
  trie.bulkInsert(QUERY_SELECTORS, 5, 'fieldName');
  trie.bulkInsert(VALUE_HELPERS, 5, 'value');
  
  if (Array.isArray(schemaPaths) && schemaPaths.length > 0) {
    const paths = schemaPaths
      .map(path => path?.path)
      .filter(path => typeof path === 'string' && path.length > 0);
    for (const path of schemaPaths) {
      if (path.schema) {
        paths.push(...Object.keys(path.schema).map(subpath => `${path.path}.${subpath}`));
      }
    }
    trie.bulkInsert(paths, 10, 'fieldName');
  }
  
  return trie;
}

function getAutocompleteContext(searchText, cursorPos) {
  const before = searchText.slice(0, cursorPos);
  
  // Check if we're in a field name context (after { or ,)
  // This takes precedence over value context to handle cases like { _id: { $gt
  const fieldMatch = before.match(/(?:\{|,)\s*([^:\s]*)$/);
  if (fieldMatch) {
    const token = fieldMatch[1];
    return {
      token,
      role: 'fieldName',
      startPos: cursorPos - token.length
    };
  }
  
  // Check if we're in a value context (after a colon)
  // Match the last colon followed by optional whitespace and capture everything after
  const valueMatch = before.match(/:\s*([^\s,\}\]:]*)$/);
  if (valueMatch) {
    const token = valueMatch[1];
    return {
      token,
      role: 'value',
      startPos: cursorPos - token.length
    };
  }
  
  return null;
}

function getAutocompleteSuggestions(trie, searchText, cursorPos, schemaPaths) {
  const context = getAutocompleteContext(searchText, cursorPos);
  
  if (!context) {
    return [];
  }
  
  const { token, role } = context;
  
  // Extract the actual term without quotes
  const leadingQuoteMatch = token.match(/^["']/);
  const trailingQuoteMatch = token.length > 1 && /["']$/.test(token)
    ? token[token.length - 1]
    : '';
  const term = token
    .replace(/^["']/, '')
    .replace(trailingQuoteMatch ? new RegExp(`[${trailingQuoteMatch}]$`) : '', '')
    .trim();
  
  if (!term) {
    return [];
  }
  
  const primarySuggestions = trie.getSuggestions(term, 10, role);
  const suggestionsSet = new Set(primarySuggestions);
  
  // Add schema path suggestions for field names
  if (role === 'fieldName' && Array.isArray(schemaPaths) && schemaPaths.length > 0) {
    for (const schemaPath of schemaPaths) {
      const path = schemaPath?.path;
      if (
        typeof path === 'string' &&
        path.startsWith(`${term}.`) &&
        !suggestionsSet.has(path)
      ) {
        suggestionsSet.add(path);
        if (suggestionsSet.size >= 10) {
          break;
        }
      }
    }
  }
  
  let suggestions = Array.from(suggestionsSet);
  
  // Preserve quotes if present
  if (leadingQuoteMatch) {
    const leadingQuote = leadingQuoteMatch[0];
    suggestions = suggestions.map(suggestion => `${leadingQuote}${suggestion}`);
  }
  if (trailingQuoteMatch) {
    suggestions = suggestions.map(suggestion =>
      suggestion.endsWith(trailingQuoteMatch) ? suggestion : `${suggestion}${trailingQuoteMatch}`
    );
  }
  
  return suggestions;
}

function applySuggestion(searchText, cursorPos, suggestion) {
  const before = searchText.slice(0, cursorPos);
  const after = searchText.slice(cursorPos);
  
  // Check if we're in a value context
  const valueMatch = before.match(/:\s*([^\s,\}\]:]*)$/);
  if (valueMatch) {
    const token = valueMatch[1];
    const start = cursorPos - token.length;
    let replacement = suggestion;
    let cursorOffset = replacement.length;
    
    // Add parentheses for function helpers and position cursor inside
    if (FUNCTION_HELPERS.has(suggestion)) {
      replacement = `${suggestion}()`;
      cursorOffset = suggestion.length + 1; // Position cursor between ()
    }
    
    return {
      text: searchText.slice(0, start) + replacement + after,
      newCursorPos: start + cursorOffset
    };
  }
  
  // Check if we're in a field name context
  const fieldMatch = before.match(/(?:\{|,)\s*([^:\s]*)$/);
  if (fieldMatch) {
    const token = fieldMatch[1];
    const start = cursorPos - token.length;
    let replacement = suggestion;
    
    const leadingQuote = token.startsWith('"') || token.startsWith('\'') ? token[0] : '';
    const trailingQuote = token.length > 1 && (token.endsWith('"') || token.endsWith('\'')) ? token[token.length - 1] : '';
    const colonNeeded = !/^\s*:/.test(after);
    
    // If suggestion already has quotes, use it as-is
    const suggestionHasQuotes = (suggestion.startsWith('"') || suggestion.startsWith('\'')) &&
                                (suggestion.endsWith('"') || suggestion.endsWith('\''));
    if (suggestionHasQuotes) {
      replacement = suggestion;
    } else {
      if (leadingQuote && !replacement.startsWith(leadingQuote)) {
        replacement = `${leadingQuote}${replacement}`;
      }
      if (trailingQuote && !replacement.endsWith(trailingQuote)) {
        replacement = `${replacement}${trailingQuote}`;
      }
    }
    
    // Only insert : if we know the user isn't entering in a nested path
    // If suggestion has full quotes or user typed both quotes, add colon
    if (colonNeeded && (suggestionHasQuotes || !leadingQuote || trailingQuote)) {
      replacement = `${replacement}:`;
    }
    
    return {
      text: searchText.slice(0, start) + replacement + after,
      newCursorPos: start + replacement.length
    };
  }
  
  return null;
}

module.exports = {
  buildAutocompleteTrie,
  getAutocompleteContext,
  getAutocompleteSuggestions,
  applySuggestion,
  QUERY_SELECTORS,
  VALUE_HELPERS,
  FUNCTION_HELPERS
};
