import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'tw.yushengzhe.splitbill',
  appName: '分帳本',
  webDir: 'dist',
  plugins: {
    SystemBars: {
      // 狀態列文字顏色跟隨手機淺深色；畫面延伸到狀態列下方，由 CSS 的 safe-area 留白
      style: 'DEFAULT',
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
