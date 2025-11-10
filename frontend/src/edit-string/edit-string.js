'use strict';

const template = require('./edit-string.html');

const OTHER_OPTION = '__other';
const NULL_OPTION = '__null';

function normalizeEnumValues(enumValues) {
  if (!Array.isArray(enumValues)) {
    return [];
  }

  const deduped = [];
  enumValues.forEach(value => {
    if (value == null) {
      return;
    }
    if (deduped.indexOf(value) === -1) {
      deduped.push(value);
    }
  });

  return deduped;
}

function getInitialSelection(value, normalizedEnumValues) {
  if (value == null) {
    return NULL_OPTION;
  }
  if (normalizedEnumValues.indexOf(value) !== -1) {
    return value;
  }
  if (typeof value === 'string' && value === '') {
    return OTHER_OPTION;
  }
  // For any other non-null, non-enum, non-empty string value, return OTHER_OPTION
  return OTHER_OPTION;
}

module.exports = app => app.component('edit-string', {
  template,
  props: {
    value: {
      type: null,
      default: undefined
    },
    enumValues: {
      type: Array,
      default: () => []
    }
  },
  emits: ['input'],
  data() {
    const normalizedEnums = normalizeEnumValues(this.enumValues);
    const initialSelection = normalizedEnums.length > 0 ? getInitialSelection(this.value, normalizedEnums) : null;

    return {
      normalizedEnums,
      selectedOption: initialSelection,
      otherValue: initialSelection === OTHER_OPTION && typeof this.value === 'string' ? this.value : ''
    };
  },
  computed: {
    hasEnumValues() {
      return this.normalizedEnums.length > 0;
    }
  },
  watch: {
    value(newVal) {
      if (!this.hasEnumValues) {
        return;
      }
      const newSelection = getInitialSelection(newVal, this.normalizedEnums);
      const selectionChanged = newSelection !== this.selectedOption;

      if (selectionChanged) {
        this.selectedOption = newSelection;
      }

      if (newSelection === OTHER_OPTION) {
        const nextOtherValue = typeof newVal === 'string' ? newVal : '';
        if (this.otherValue !== nextOtherValue) {
          this.otherValue = nextOtherValue;
        }
      } else if (selectionChanged && this.otherValue !== '') {
        this.otherValue = '';
      }
    },
    enumValues(newValues) {
      const normalized = normalizeEnumValues(newValues);
      this.normalizedEnums = normalized;

      if (!normalized.length) {
        this.selectedOption = null;
        this.otherValue = '';
        return;
      }

      const newSelection = getInitialSelection(this.value, normalized);
      const selectionChanged = newSelection !== this.selectedOption;

      if (selectionChanged) {
        this.selectedOption = newSelection;
      }

      if (newSelection === OTHER_OPTION) {
        const sourceValue = typeof this.value === 'string' ? this.value : '';
        if (this.otherValue !== sourceValue) {
          this.otherValue = sourceValue;
        }
      } else if (this.otherValue !== '') {
        this.otherValue = '';
      }
    }
  },
  methods: {
    onSelectChange(event) {
      if (!this.hasEnumValues) {
        return;
      }

      const selected = event.target.value;
      this.selectedOption = selected;

      if (selected === NULL_OPTION) {
        this.otherValue = '';
        this.$emit('input', null);
        return;
      }
      if (selected === OTHER_OPTION) {
        if (this.otherValue === '' && typeof this.value === 'string' && this.normalizedEnums.indexOf(this.value) === -1) {
          this.otherValue = this.value;
        }
        return;
      }

      this.otherValue = '';
      this.$emit('input', selected);
    },
    onOtherInput(event) {
      this.otherValue = event.target.value;
      this.$emit('input', this.otherValue);
    },
    onTextInput(event) {
      this.$emit('input', event.target.value);
    }
  }
});
