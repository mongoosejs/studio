

module.exports = function removeSpecifiedPaths(obj, paths) {
  for (const key in obj) {
    if (key.includes(paths)) {
      delete obj[key];
    }
  }
};