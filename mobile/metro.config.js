// Lets the app import `@myrating/shared` straight from ../shared/src (no
// build step, no npm link). tsconfig.json `paths` and the jest
// `moduleNameMapper` in package.json mirror these two rules.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const sharedDir = path.resolve(__dirname, '../shared');
const SHARED_PACKAGE = '@myrating/shared';

config.watchFolders = [...(config.watchFolders ?? []), sharedDir];

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  if (moduleName === SHARED_PACKAGE) {
    return { type: 'sourceFile', filePath: path.join(sharedDir, 'src/index.ts') };
  }
  // shared/'s package imports (zod) resolve from mobile's node_modules, so the
  // app bundles one zod and shared/ needs no install of its own. Relative
  // imports inside shared/ resolve normally.
  const isPackageImport = !moduleName.startsWith('.') && !path.isAbsolute(moduleName);
  if (isPackageImport && context.originModulePath.startsWith(sharedDir + path.sep)) {
    return resolve({ ...context, originModulePath: path.join(__dirname, 'package.json') }, moduleName, platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
