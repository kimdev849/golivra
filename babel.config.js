module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['nativewind/babel', 'babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
