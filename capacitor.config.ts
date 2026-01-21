import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chatlix.android',
  appName: 'Chatlix',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;