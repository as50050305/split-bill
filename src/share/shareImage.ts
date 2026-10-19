import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/**
 * 分享 PNG：
 * - Android：先存到 App 快取資料夾，再叫出系統分享選單（可選 LINE）
 * - 瀏覽器：支援 Web Share 就分享，不支援就直接下載
 */
export async function shareImage(dataUrl: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const fileName = `settlement-${Date.now()}.png`;
  const base64 = dataUrl.split(',')[1];

  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
    try {
      await Share.share({ title, files: [uri], dialogTitle: '分享結算圖片' });
      return 'shared';
    } catch (e) {
      if (String(e).toLowerCase().includes('cancel')) return 'cancelled';
      throw e;
    }
  }

  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], fileName, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  a.click();
  return 'downloaded';
}
