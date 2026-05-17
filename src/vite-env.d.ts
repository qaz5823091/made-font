/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_MEASUREMENT_ID: string
  readonly VITE_FB_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// gifenc ships untyped; declare just the surface we use.
declare module "gifenc" {
  type ColorRGB = [number, number, number]
  type Palette = ColorRGB[]
  type RGBA = Uint8Array | Uint8ClampedArray

  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: Palette
        delay?: number
        transparent?: boolean
        transparentIndex?: number
        dispose?: number
        first?: boolean
        repeat?: number
      },
    ): void
    finish(): void
    bytes(): Uint8Array
    reset(): void
  }

  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): GIFEncoderInstance
  export function quantize(
    rgba: RGBA,
    maxColors: number,
    opts?: { format?: "rgb444" | "rgb565" | "rgba4444"; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
  ): Palette
  export function applyPalette(
    rgba: RGBA,
    palette: Palette,
    format?: "rgb444" | "rgb565" | "rgba4444",
  ): Uint8Array
}
