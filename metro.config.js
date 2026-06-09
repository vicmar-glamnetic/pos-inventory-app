const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable the experimental package exports resolver — it mishandles packages
// that combine "type":"module" at root with a CommonJS cjs/ subdirectory
// (e.g. @ungap/structured-clone). Falls back to classic "main" field lookup.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
