module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // react-native-worklets/plugin is already included by nativewind/babel (via react-native-css-interop/babel)
    // Adding react-native-reanimated/plugin here would apply the worklets transform twice
  };
};
