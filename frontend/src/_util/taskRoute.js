'use strict';

/** Task name as used in URL path: spaces become underscores */
function taskNameToSlug(name) {
  return (name || '').replace(/ /g, '_');
}

/** Task name for API: underscores in route param become spaces */
function taskSlugToName(slug) {
  return (slug || '').replace(/_/g, ' ');
}

module.exports = { taskNameToSlug, taskSlugToName };
