import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.iz.drummachine',
  appName: 'IZ Drum Machine',
  webDir: 'dist/renderer',
  server: {
    // Security: Use HTTPS scheme on both platforms
    androidScheme: 'https',
    iosScheme: 'https',
    // Security: Restrict navigation to app only
    allowNavigation: []  // Empty = no external navigation allowed
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#0d0d0d',
    // Security: Disable scrolling to prevent content extraction
    scrollEnabled: false,
    // Security: Limit keyboard input
    limitsNavigationsToAppBoundDomains: true
  },
  android: {
    backgroundColor: '#0d0d0d',
    // Security: Use HTTPS
    allowMixedContent: false
  },
  plugins: {
    // Security: Keyboard hiding settings
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  }
};

export default config;
