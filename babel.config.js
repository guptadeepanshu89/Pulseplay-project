module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@theme': './src/theme',
            '@components': './src/components',
            '@screens': './src/screens',
            '@navigation': './src/navigation',
            '@context': './src/context',
            '@constants': './src/constants',
            '@types': './src/types',
            '@services': './src/services',
            '@hooks': './src/hooks',
            '@utils': './src/utils',
          },
        },
      ],
    ],
  };
};
