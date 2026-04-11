const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enableSymlinks = true;
config.resolver.extraNodeModules = {
  react: path.resolve(workspaceRoot, 'node_modules/react'),
  'react-native': path.resolve(workspaceRoot, 'node_modules/react-native'),
  '@fact/api': path.resolve(workspaceRoot, 'packages/api'),
  '@fact/auth': path.resolve(workspaceRoot, 'packages/auth'),
  '@fact/config': path.resolve(workspaceRoot, 'packages/config'),
  '@fact/domain': path.resolve(workspaceRoot, 'packages/domain'),
  '@fact/types': path.resolve(workspaceRoot, 'packages/types'),
};

module.exports = config;