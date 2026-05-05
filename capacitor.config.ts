import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.prophub.app',
  appName: 'PropHub',
  webDir: 'dist',
  plugins: {
    Camera: {
      permissions: ['camera', 'photos']
    }
  }
};

export default config;
