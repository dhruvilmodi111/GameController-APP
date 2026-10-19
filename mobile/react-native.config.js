const android = require('@react-native-community/cli-platform-android');
const { bundleCommand, startCommand } = require('@react-native/community-cli-plugin');

module.exports = {
  commands: [...android.commands, bundleCommand, startCommand],
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
