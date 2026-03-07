'use strict';

const ace = require('ace-builds');
require('ace-builds/src-noconflict/mode-javascript');
require('ace-builds/src-noconflict/mode-json');
require('ace-builds/src-noconflict/theme-chrome');

/**
 * Create an Ace editor on a container element (div). The container must have
 * explicit dimensions (e.g. height/min-height and width).
 * @param {HTMLElement} container - A div element to attach the editor to
 * @param {Object} options - { value: string, mode: 'javascript'|'json', lineNumbers: boolean, ... }
 * @returns {ace.Ace.Editor} The Ace editor instance
 */
function createAceEditor(container, options = {}) {
  const {
    value = '',
    mode = 'javascript',
    lineNumbers = true,
    minLines,
    maxLines,
    readOnly = false,
    wrap = false
  } = options;

  const editor = ace.edit(container);
  editor.setTheme('ace/theme/chrome');
  editor.session.setMode(mode === 'json' ? 'ace/mode/json' : 'ace/mode/javascript');
  editor.setValue(value, -1);
  editor.setOptions({
    showLineNumbers: lineNumbers,
    readOnly,
    wrap
  });
  if (minLines != null) editor.setOption('minLines', minLines);
  if (maxLines != null) editor.setOption('maxLines', maxLines);

  return editor;
}

/**
 * Destroy an Ace editor and release resources.
 * @param {ace.Ace.Editor|null} editor - The editor instance from createAceEditor
 */
function destroyAceEditor(editor) {
  if (editor) {
    editor.destroy();
  }
}

module.exports = { createAceEditor, destroyAceEditor };
