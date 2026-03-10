'use strict';

const ace = require('ace-builds');
require('ace-builds/src-noconflict/mode-javascript');
require('ace-builds/src-noconflict/mode-json');
require('ace-builds/src-noconflict/theme-chrome');
require('ace-builds/src-noconflict/theme-one_dark');

const LIGHT_THEME = 'ace/theme/chrome';
const DARK_THEME = 'ace/theme/one_dark';

function isDarkMode() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

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
  editor.setTheme(isDarkMode() ? DARK_THEME : LIGHT_THEME);
  editor.session.setMode(mode === 'json' ? 'ace/mode/json' : 'ace/mode/javascript');
  editor.setValue(value, -1);
  editor.setOptions({
    showLineNumbers: lineNumbers,
    readOnly,
    wrap
  });
  if (minLines != null) editor.setOption('minLines', minLines);
  if (maxLines != null) editor.setOption('maxLines', maxLines);

  // Listen for theme toggles
  const onThemeChanged = (e) => {
    editor.setTheme(e.detail?.dark ? DARK_THEME : LIGHT_THEME);
  };
  document.documentElement.addEventListener('studio-theme-changed', onThemeChanged);
  editor._studioThemeHandler = onThemeChanged;

  return editor;
}

/**
 * Destroy an Ace editor and release resources.
 * @param {ace.Ace.Editor|null} editor - The editor instance from createAceEditor
 */
function destroyAceEditor(editor) {
  if (editor) {
    if (editor._studioThemeHandler) {
      document.documentElement.removeEventListener('studio-theme-changed', editor._studioThemeHandler);
    }
    editor.destroy();
  }
}

module.exports = { createAceEditor, destroyAceEditor };
