const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// @firebase/app ships both CJS (dist/index.cjs.js) and ESM (dist/esm/index.esm2017.js) bundles.
// Metro resolves ESM `import` to the ESM bundle and CJS `require` to the CJS bundle, producing
// two separate module instances with independent _apps/_components Maps.
// @firebase/auth's RN bundle uses require('@firebase/app') → CJS instance; registerAuth() runs there.
// firebase/app umbrella uses ESM export* → ESM instance; initializeApp() creates the app there.
// The two instances never share state → "Component auth has not been registered yet" at runtime.
// Fix: force every @firebase/app import to the CJS bundle so registerAuth and initializeApp
// share the same registry.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@firebase/app') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'node_modules/@firebase/app/dist/index.cjs.js'),
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
