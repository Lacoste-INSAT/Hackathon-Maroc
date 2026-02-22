// ─── Image Compression Service ──────────────────────────────
// Compresses a captured image to ~180KB for Gemini upload
// while keeping the original full-res photo untouched.

import { COMPRESSION_TARGET_KB } from "@/lib/types"

const MAX_WIDTH = 1600
const INITIAL_QUALITY = 0.6
const QUALITY_STEP = 0.05
const MAX_RETRIES = 3

interface CompressionResult {
  compressedDataUrl: string
  sizeKB: number
}

/**
 * Compress an image data URL to approximately COMPRESSION_TARGET_KB.
 * Uses canvas-based resizing + iterative JPEG quality reduction.
 * The original is NEVER overwritten.
 */
export async function compressImage(
  dataUrl: string
): Promise<CompressionResult> {
  const img = await loadImage(dataUrl)

  // Calculate resize dimensions (max 1600px wide)
  let { width, height } = img
  if (width > MAX_WIDTH) {
    const ratio = MAX_WIDTH / width
    width = MAX_WIDTH
    height = Math.round(height * ratio)
  }

  // Draw to canvas
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0, width, height)

  // Iterative quality reduction
  let quality = INITIAL_QUALITY
  let result = canvas.toDataURL("image/jpeg", quality)
  let sizeKB = estimateBase64SizeKB(result)
  const threshold = COMPRESSION_TARGET_KB * 1.1

  let retries = 0
  while (sizeKB > threshold && retries < MAX_RETRIES) {
    quality -= QUALITY_STEP
    quality = Math.max(quality, 0.1) // floor at 10%
    result = canvas.toDataURL("image/jpeg", quality)
    sizeKB = estimateBase64SizeKB(result)
    retries++
  }

  return { compressedDataUrl: result, sizeKB }
}

/**
 * Estimate the size in KB of a base64 data URL.
 */
function estimateBase64SizeKB(dataUrl: string): number {
  // Remove the data URL prefix to get the raw base64
  const base64 = dataUrl.split(",")[1] ?? dataUrl
  // Base64 encodes 3 bytes into 4 chars
  const bytes = (base64.length * 3) / 4
  return bytes / 1024
}

/**
 * Load an image from a data URL into an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
