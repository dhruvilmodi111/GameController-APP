const android = require('@react-native-community/cli-platform-android');

module.exports = {
  commands: android.commands,
  platforms: {
    android: {
      npmPackageName: '@react-native-community/cli-platform-android',
      projectConfig: android.projectConfig,
      dependencyConfig: android.dependencyConfig,
    },
  },
  project: {
    android: {
      sourceDir: './android',
      appName: 'app',
      packageName: 'com.gyroplaycontroller',
    },
  },
};
