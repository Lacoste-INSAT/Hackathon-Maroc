// ─────────────────────────────────────────────────────────────
// Snap & Sync — Native Image Compression (expo-image-manipulator)
// ─────────────────────────────────────────────────────────────
//
// Compresses a captured photo to ~180KB for Gemini upload.
// Uses expo-image-manipulator instead of the web canvas API.
// The ORIGINAL full-res file is NEVER modified.
// ─────────────────────────────────────────────────────────────

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { getInfoAsync, makeDirectoryAsync, moveAsync, documentDirectory } from 'expo-file-system/legacy';
import { COMPRESSION_TARGET_KB } from '@/lib/types';

const MAX_WIDTH = 1600;
const INITIAL_COMPRESS = 0.6;
const COMPRESS_STEP = 0.05;
const MAX_RETRIES = 3;

interface CompressionResult {
  compressedUri: string;
  sizeKB: number;
}

/**
 * Compress an image file to approximately COMPRESSION_TARGET_KB.
 * Uses expo-image-manipulator for resize + JPEG quality reduction.
 * The original file is NEVER overwritten — a new file is created.
 *
 * @param originalUri - file:// URI of the original photo
 * @returns { compressedUri, sizeKB }
 */
export async function compressImage(originalUri: string): Promise<CompressionResult> {
  let quality = INITIAL_COMPRESS;

  // First pass: resize to max 1600px wide + initial compression
  let result = await manipulateAsync(
    originalUri,
    [{ resize: { width: MAX_WIDTH } }],
    { compress: quality, format: SaveFormat.JPEG }
  );

  let sizeKB = await getFileSizeKB(result.uri);
  const threshold = COMPRESSION_TARGET_KB * 1.1; // 10% margin

  // Iterative quality reduction if still too large
  let retries = 0;
  while (sizeKB > threshold && retries < MAX_RETRIES) {
    quality -= COMPRESS_STEP;
    quality = Math.max(quality, 0.1); // floor at 10%

    result = await manipulateAsync(
      originalUri, // always re-compress from ORIGINAL (not from previous output)
      [{ resize: { width: MAX_WIDTH } }],
      { compress: quality, format: SaveFormat.JPEG }
    );

    sizeKB = await getFileSizeKB(result.uri);
    retries++;
  }

  // Move compressed file to a stable location
  // Move compressed file to a stable location
  const documentDir = typeof documentDirectory === 'string'
    ? documentDirectory
    : (FileSystem as any).documentDirectory;
  const compressedDir = `${documentDir}compressed/`;
  const dirInfo = await getInfoAsync(compressedDir);
  if (!dirInfo.exists) {
    await makeDirectoryAsync(compressedDir, { intermediates: true });
  }

  const filename = `compressed_${Date.now()}.jpg`;
  const finalUri = `${compressedDir}${filename}`;
  await moveAsync({ from: result.uri, to: finalUri });

  console.log(`[imageCompression] ${sizeKB.toFixed(0)}KB @ quality ${quality.toFixed(2)}`);

  return { compressedUri: finalUri, sizeKB };
}

/**
 * Read a base64-encoded string from a file URI (for sending to API).
 */
export async function fileToBase64(uri: string): Promise<string> {
  return await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });
}

/**
 * Get the file size in KB.
 */
async function getFileSizeKB(uri: string): Promise<number> {
  const info = await getInfoAsync(uri, { size: true } as any);
  if (info.exists && 'size' in info) {
    return (info as any).size / 1024;
  }
  return 0;
}
