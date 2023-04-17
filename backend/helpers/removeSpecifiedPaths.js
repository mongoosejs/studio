
// https://stackoverflow.com/questions/8085004/iterate-through-nested-javascript-objects
module.exports = function removeSpecifiedPaths(obj, paths) {
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      removeSpecifiedPaths(obj[key], paths);
    }
    if (key.includes(paths)) {
      delete obj[key];
    }
  }
}