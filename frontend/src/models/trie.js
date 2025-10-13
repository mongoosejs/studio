'use strict';

class TrieNode {
  constructor() {
    this.children = Object.create(null);
    this.isEnd = false;
    this.freq = 0;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word, freq = 1) {
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
  }

  bulkInsert(words, freq = 1) {
    if (!Array.isArray(words)) {
      return;
    }
    for (const word of words) {
      this.insert(word, freq);
    }
  }

  collect(node, prefix, out) {
    if (node.isEnd) {
      out.push([prefix, node.freq]);
    }
    for (const [ch, child] of Object.entries(node.children)) {
      this.collect(child, prefix + ch, out);
    }
  }

  suggest(prefix, limit = 10) {
    let node = this.root;
    for (const ch of prefix) {
      if (!node.children[ch]) {
        return [];
      }
      node = node.children[ch];
    }
    const results = [];
    this.collect(node, prefix, results);
    results.sort((a, b) => b[1] - a[1]);
    return results.slice(0, limit).map(([word]) => word);
  }

  fuzzySuggest(prefix, limit = 10) {
    const results = new Set();

    const dfs = (node, path, edits) => {
      if (edits > 1) {
        return;
      }
      if (node.isEnd && Math.abs(path.length - prefix.length) <= 1) {
        const dist = levenshtein(prefix, path);
        if (dist <= 1) {
          results.add(path);
        }
      }
      for (const [ch, child] of Object.entries(node.children)) {
        const nextEdits = ch === prefix[path.length] ? edits : edits + 1;
        dfs(child, path + ch, nextEdits);
      }
    };

    dfs(this.root, '', 0);
    return Array.from(results).slice(0, limit);
  }

  getSuggestions(prefix, limit = 10) {
    if (!prefix) {
      return [];
    }
    const exact = this.suggest(prefix, limit);
    if (exact.length >= limit) {
      return exact;
    }
    const fuzzy = this.fuzzySuggest(prefix, limit - exact.length);
    return [...exact, ...fuzzy];
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
