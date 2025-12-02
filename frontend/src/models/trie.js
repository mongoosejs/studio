'use strict';

class TrieNode {
  constructor() {
    this.children = Object.create(null);
    this.isEnd = false;
    this.freq = 0;
    this.roles = new Set(); // semantic roles like 'fieldName', 'operator'
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word, freq = 1, role = null) {
    if (!word) {
      return;
    }
    let node = this.root;
    for (const ch of word) {
      if (!node.children[ch]) {
        node.children[ch] = new TrieNode();
      }
      node = node.children[ch];
    }
    node.isEnd = true;
    node.freq += freq;
    if (role) {
      node.roles.add(role);
    }
  }

  bulkInsert(words, freq = 1, role = null) {
    for (const word of words) this.insert(word, freq, role);
  }

  collect(node, prefix, out, role) {
    if (node.isEnd && (role == null || node.roles.has(role))) {
      out.push([prefix, node.freq]);
    }
    for (const [ch, child] of Object.entries(node.children)) {
      this.collect(child, prefix + ch, out, role);
    }
  }

  suggest(prefix, limit = 10, role = null) {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children[ch]) {
        return [];
      }
      node = node.children[ch];
    }
    const results = [];
    this.collect(node, prefix, results, role);
    results.sort((a, b) => b[1] - a[1]);
    return results.slice(0, limit).map(([word]) => word);
  }

  fuzzySuggest(prefix, limit = 10, role = null) {
    const results = new Set();

    const dfs = (node, path, edits) => {
      if (edits > 1) {
        return;
      }
      if (node.isEnd && Math.abs(path.length - prefix.length) <= 1 && (role == null || node.roles.has(role))) {
        const dist = levenshtein(prefix, path);
        if (dist <= 1) {
          results.add(path);
        }
      }
      for (const [ch, child] of Object.entries(node.children)) {
        const nextEdits = ch === prefix[path.length] ? edits : edits + 1;
        if (role != null && !child.roles.has(role)) {
          continue;
        }
        dfs(child, path + ch, nextEdits);
      }
    };

    dfs(this.root, '', 0);
    return Array.from(results).slice(0, limit);
  }

  getSuggestions(prefix, limit = 10, role = null) {
    if (!prefix) {
      return [];
    }
    const exact = this.suggest(prefix, limit, role);
    if (exact.length >= limit) {
      return exact;
    }
    const fuzzy = this.fuzzySuggest(prefix, limit - exact.length, role);
    return [...exact, ...fuzzy];
  }

  toString() {
    const lines = [];
    function dfs(node, prefix, depth) {
      let line = '  '.repeat(depth);
      if (prefix.length > 0) {
        line += prefix[prefix.length - 1];
      } else {
        line += '(root)';
      }
      if (node.isEnd) {
        line += ' *';
      }
      if (node.roles.size > 0) {
        line += ' [' + Array.from(node.roles).join(',') + ']';
      }
      if (node.freq > 0) {
        line += ` {freq:${node.freq}}`;
      }
      lines.push(line);
      for (const ch of Object.keys(node.children).sort()) {
        dfs(node.children[ch], prefix + ch, depth + 1);
      }
    }
    dfs(this.root, '', 0);
    return lines.join('\n');
  }
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

module.exports = {
  Trie,
  TrieNode
};
