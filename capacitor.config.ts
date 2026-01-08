import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.iz.drummachine',
  appName: 'IZ Drum Machine',
  webDir: 'dist/renderer',
  server: {
    androidScheme: 'https'
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#0d0d0d'
  },
  plugins: {}
};

export default config;
