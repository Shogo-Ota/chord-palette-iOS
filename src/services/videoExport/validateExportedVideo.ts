import * as FileSystem from 'expo-file-system/legacy';

export async function validateExportedVideo(uri: string): Promise<boolean> {
  if (!uri.startsWith('file://')) return false;
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists && !info.isDirectory && (info.size ?? 0) > 0;
}

export async function removeTemporaryVideoExportFile(uri: string): Promise<void> {
  if (!uri.startsWith('file://')) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}
