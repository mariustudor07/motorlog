require('dotenv').config();

module.exports = {
  expo: {
    name: 'Motorlog',
    slug: 'motorlog',
    version: '1.0.0',
    runtimeVersion: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    scheme: 'motorlog',
    description: 'UK vehicle management app. MOT, tax & insurance reminders, DVLA lookup, service history, fuel log, mileage tracker and more.',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0f172a',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.motorlog.app',
      buildNumber: '1',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSUserNotificationsUsageDescription: 'Motorlog uses notifications to remind you before your MOT, road tax, insurance, permits and other vehicle deadlines expire.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0f172a',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.motorlog.app',
      versionCode: 1,
      compileSdkVersion: 35,
      targetSdkVersion: 35,
      minSdkVersion: 26,
      permissions: [
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.SCHEDULE_EXACT_ALARM',
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.VIBRATE',
        'android.permission.USE_EXACT_ALARM',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      'expo-secure-store',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#1d4ed8',
          sounds: [],
        },
      ],
    ],
    extra: {
      dvlaApiKey: process.env.DVLA_API_KEY ?? '',
      geminiApiKey: process.env.GEMINI_API_KEY ?? '',
      dvsaClientId: process.env.DVSA_CLIENT_ID ?? '',
      dvsaClientSecret: process.env.DVSA_CLIENT_SECRET ?? '',
      dvsaApiKey: process.env.DVSA_API_KEY ?? '',
      eas: {
        projectId: 'ade4223c-fbfa-47c0-a3c2-a64d1149ec7e',
      },
    },
  },
};
