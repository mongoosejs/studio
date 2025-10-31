'use strict';

const template = require('./list-json.html');

const JsonNodeTemplate = `
  <div>
    <div class="flex items-baseline whitespace-pre" :style="indentStyle">
      <button
        v-if="showToggle"
        type="button"
        class="w-4 h-4 mr-1 inline-flex items-center justify-center leading-none text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-400 cursor-pointer"
        @click.stop="handleToggle"
      >
        {{ isCollapsedNode ? '+' : '-' }}
      </button>
      <span v-else class="w-4 h-4 mr-1 inline-flex items-center justify-center invisible"></span>
      <template v-if="hasKey">
        <span class="text-blue-600">"{{ nodeKey }}"</span><span>: </span>
      </template>
      <template v-if="isComplex">
        <template v-if="hasChildren">
          <span>{{ openingBracket }}</span>
          <span v-if="isCollapsedNode" class="mx-1">…</span>
          <span v-if="isCollapsedNode">{{ closingBracket }}{{ comma }}</span>
        </template>
        <template v-else>
          <span>{{ openingBracket }}{{ closingBracket }}{{ comma }}</span>
        </template>
      </template>
      <template v-else>
        <span :class="valueClasses">{{ formattedValue }}{{ comma }}</span>
      </template>
    </div>
    <template v-if="isComplex && hasChildren && !isCollapsedNode">
      <json-node
        v-for="child in children"
        :key="child.path"
        :node-key="child.displayKey"
        :value="child.value"
        :level="level + 1"
        :is-last="child.isLast"
        :path="child.path"
        :toggle-collapse="toggleCollapse"
        :is-collapsed="isCollapsed"
        :create-child-path="createChildPath"
        :indent-size="indentSize"
      ></json-node>
      <div class="flex items-baseline whitespace-pre" :style="indentStyle">
        <span class="w-4 h-4 mr-1 inline-flex items-center justify-center invisible"></span>
        <span>{{ closingBracket }}{{ comma }}</span>
      </div>
    </template>
  </div>
`;

module.exports = app => app.component('list-json', {
  template: template,
  props: ['value'],
  data() {
    return {
      collapsedMap: {},
      indentSize: 16
    };
  },
  watch: {
    value: {
      handler() {
        this.resetCollapse();
      }
    }
  },
  created() {
    this.resetCollapse();
  },
  methods: {
    resetCollapse() {
      this.collapsedMap = {};
    },
    toggleCollapse(path) {
      const current = this.isPathCollapsed(path);
      this.collapsedMap = Object.assign({}, this.collapsedMap, { [path]: !current });
    },
    isPathCollapsed(path) {
      if (path === 'root') {
        return false;
      }
      if (Object.prototype.hasOwnProperty.call(this.collapsedMap, path)) {
        return this.collapsedMap[path];
      }
      return true;
    },
    createChildPath(parentPath, childKey, isArray) {
      if (parentPath == null || parentPath === '') {
        return isArray ? `[${childKey}]` : `${childKey}`;
      }
      if (parentPath === 'root') {
        return isArray ? `root[${childKey}]` : `root.${childKey}`;
      }
      if (isArray) {
        return `${parentPath}[${childKey}]`;
      }
      return `${parentPath}.${childKey}`;
    }
  },
  components: {
    JsonNode: {
      name: 'JsonNode',
      template: JsonNodeTemplate,
      props: {
        nodeKey: {
          type: [String, Number],
          default: null
        },
        value: {
          required: true
        },
        level: {
          type: Number,
          required: true
        },
        isLast: {
          type: Boolean,
          default: false
        },
        path: {
          type: String,
          required: true
        },
        toggleCollapse: {
          type: Function,
          required: true
        },
        isCollapsed: {
          type: Function,
          required: true
        },
        createChildPath: {
          type: Function,
          required: true
        },
        indentSize: {
          type: Number,
          required: true
        }
      },
      computed: {
        hasKey() {
          return this.nodeKey !== null && this.nodeKey !== undefined;
        },
        isRoot() {
          return this.path === 'root';
        },
        isArray() {
          return Array.isArray(this.value);
        },
        isObject() {
          if (this.value === null || this.isArray) {
            return false;
          }
          return Object.prototype.toString.call(this.value) === '[object Object]';
        },
        isComplex() {
          return this.isArray || this.isObject;
        },
        children() {
          if (!this.isComplex) {
            return [];
          }
          if (this.isArray) {
            return this.value.map((childValue, index) => ({
              displayKey: null,
              value: childValue,
              isLast: index === this.value.length - 1,
              path: this.createChildPath(this.path, index, true)
            }));
          }
          const keys = Object.keys(this.value);
          return keys.map((key, index) => ({
            displayKey: key,
            value: this.value[key],
            isLast: index === keys.length - 1,
            path: this.createChildPath(this.path, key, false)
          }));
        },
        hasChildren() {
          return this.children.length > 0;
        },
        showToggle() {
          return this.hasChildren && !this.isRoot;
        },
        openingBracket() {
          return this.isArray ? '[' : '{';
        },
        closingBracket() {
          return this.isArray ? ']' : '}';
        },
        isCollapsedNode() {
          return this.isCollapsed(this.path);
        },
        formattedValue() {
          if (typeof this.value === 'bigint') {
            return `${this.value.toString()}n`;
          }
          const stringified = JSON.stringify(this.value);
          if (stringified === undefined) {
            if (typeof this.value === 'symbol') {
              return this.value.toString();
            }
            return String(this.value);
          }
          return stringified;
        },
        valueClasses() {
          const classes = ['text-slate-700'];
          if (this.value === null) {
            classes.push('text-gray-500', 'italic');
            return classes;
          }
          const type = typeof this.value;
          if (type === 'string') {
            classes.push('text-emerald-600');
            return classes;
          }
          if (type === 'number' || type === 'bigint') {
            classes.push('text-amber-600');
            return classes;
          }
          if (type === 'boolean') {
            classes.push('text-violet-600');
            return classes;
          }
          if (type === 'undefined') {
            classes.push('text-gray-500');
            return classes;
          }
          return classes;
        },
        comma() {
          return this.isLast ? '' : ',';
        },
        indentStyle() {
          return {
            paddingLeft: `${this.level * this.indentSize}px`
          };
        }
      },
      methods: {
        handleToggle() {
          if (!this.isRoot) {
            this.toggleCollapse(this.path);
          }
        }
      }
    }
  }
});
