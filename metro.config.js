const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// lucide-react-native et autres paquets ESM
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}
// Compatibilité Metro + certaines libs (lucide, etc.)
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
