/**
 * 备份（.ocbak / ZIP）里地图图片的序列化。
 *
 * 坑：地图记录里的 imageBlob（完整地图）和 paintBlob（手绘层）是 Blob，
 * 而备份是 JSON。JSON.stringify(Blob) 的结果是 `{}`，所以旧版备份会把地图大图
 * 丢掉，只剩缩略图；导入后 imageBlob 变成普通对象 `{}`，地图页导出 PNG/JPG
 * 时 createImageBitmap 收到非 Blob 就抛 TypeError（Safari 显示 "Type error"）。
 * 作者自带的示例数据 public/seed/oc-seed.json 也是这样生成的。
 *
 * 流程：
 * - 导出前：Blob → data URL 字符串（serializeMapBlobs）
 * - 导入时：data URL 字符串 → Blob；旧备份里的 `{}` 直接丢弃（deserializeMapBlobs），
 *   这样界面会按"还没有完整图片"处理（提示去生成器重新生成），而不是报错。
 */
import { blobToDataUrl } from '@/lib/local-media'

const MAP_BLOB_FIELDS = ['imageBlob', 'paintBlob'] as const

/** 判断是不是可用的 Blob（排除旧备份导入后残留的 `{}`）。 */
export function isUsableBlob(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob && value.size > 0
}

export async function serializeMapBlobs<T extends object>(maps: T[]): Promise<T[]> {
  return Promise.all(
    maps.map(async (map) => {
      const copy: Record<string, unknown> = { ...(map as Record<string, unknown>) }
      for (const field of MAP_BLOB_FIELDS) {
        const value = copy[field]
        if (isUsableBlob(value)) copy[field] = await blobToDataUrl(value)
        else delete copy[field]
      }
      return copy as T
    }),
  )
}

/**
 * data URL → Blob。
 * 坑：不能用 fetch(dataUrl)——Tauri 的 CSP 里 connect-src 没有 data:，
 * 桌面端会被拦下。这里手动解 base64，任何宿主都能用。
 */
export function dataUrlToBlobSync(dataUrl: string): Blob | undefined {
  const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(dataUrl)
  if (!match) return undefined
  const [, mime, isBase64, payload] = match
  try {
    let bytes: Uint8Array
    if (isBase64) {
      const binary = atob(payload)
      bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(payload))
    }
    if (bytes.length === 0) return undefined
    return new Blob([bytes as BlobPart], { type: mime || 'application/octet-stream' })
  } catch {
    return undefined
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob | undefined> {
  return dataUrlToBlobSync(dataUrl)
}

export async function deserializeMapBlobs(maps: unknown[]): Promise<unknown[]> {
  return Promise.all(
    maps.map(async (map) => {
      if (map === null || typeof map !== 'object') return map
      const copy: Record<string, unknown> = { ...(map as Record<string, unknown>) }
      for (const field of MAP_BLOB_FIELDS) {
        const value = copy[field]
        if (typeof value === 'string' && value.startsWith('data:')) {
          const blob = await dataUrlToBlob(value)
          if (blob) copy[field] = blob
          else delete copy[field]
        } else if (!isUsableBlob(value)) {
          delete copy[field]
        }
      }
      return copy
    }),
  )
}
