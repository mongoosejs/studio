'use strict';

const template = require('./mcp.html');

module.exports = {
  template,
  computed: {
    mcpUrl() {
      const configuredUrl = window.MONGOOSE_STUDIO_CONFIG.mcpUrl;
      if (configuredUrl) {
        return configuredUrl;
      }

      const url = new URL(window.location.href);
      url.hash = '';
      url.search = '';
      url.pathname = `${url.pathname.replace(/\/+$/, '')}/mcp`;
      return url.toString();
    }
  },
  methods: {
    async copyMCPUrl() {
      await navigator.clipboard.writeText(this.mcpUrl);
      this.$toast.success('MCP URL copied!');
    }
  }
};
