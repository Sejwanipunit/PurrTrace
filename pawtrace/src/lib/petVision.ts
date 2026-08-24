// On-device pet vision — 100% free, no API keys, no tokens, no backend.
// Uses TensorFlow.js + MobileNet, loaded from a CDN at runtime and cached by the
// browser. MobileNet gives image classification (breed/species) and image
// embeddings (for visual similarity). Everything runs in the user's browser.
//
// (Loaded via CDN <script> rather than an npm import because Vite's dev bundler
//  mis-handles the tfjs package; the CDN UMD build is proven to work in-browser.)

const TF_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
const MOBILENET_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const w = window as any;

const loaded: Record<string, Promise<void>> = {};
function loadScript(src: string): Promise<void> {
  if (!loaded[src]) {
    loaded[src] = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    });
  }
  return loaded[src];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let modelPromise: Promise<any> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getModel(): Promise<any> {
  if (!modelPromise) {
    modelPromise = (async () => {
      await loadScript(TF_URL);
      await loadScript(MOBILENET_URL);
      await w.tf.ready();
      return w.mobilenet.load({ version: 2, alpha: 1.0 });
    })();
  }
  return modelPromise;
}

/** Load an <img> element from a File or a (CORS-enabled) URL. */
export function loadImageEl(src: File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (typeof src === 'string') img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = typeof src === 'string' ? src : URL.createObjectURL(src);
  });
}

export interface Classification {
  className: string;
  probability: number;
}

/** Top-k ImageNet classifications for an image. */
export async function classify(img: HTMLImageElement, topk = 5): Promise<Classification[]> {
  const model = await getModel();
  return model.classify(img, topk);
}

/** MobileNet embedding for an image, L2-normalised (so a dot product is cosine similarity). */
export async function embed(img: HTMLImageElement): Promise<Float32Array> {
  const model = await getModel();
  const tensor = model.infer(img, true); // embedding=true
  const raw: Float32Array = tensor.dataSync();
  tensor.dispose?.();
  let norm = 0;
  for (let i = 0; i < raw.length; i++) norm += raw[i] * raw[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw[i] / norm;
  return out;
}

/** Cosine similarity of two L2-normalised vectors (0..1). */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, dot));
}

const COLORS: Array<{ name: string; rgb: [number, number, number] }> = [
  { name: 'black', rgb: [30, 30, 30] },
  { name: 'white', rgb: [235, 235, 235] },
  { name: 'grey', rgb: [128, 128, 128] },
  { name: 'brown', rgb: [120, 72, 40] },
  { name: 'tan', rgb: [200, 160, 110] },
  { name: 'golden', rgb: [212, 175, 90] },
  { name: 'cream', rgb: [235, 220, 180] },
  { name: 'ginger', rgb: [200, 110, 50] },
  { name: 'orange', rgb: [220, 130, 40] },
];

/** Rough dominant-colour name from the image's average pixel (ignores near-white background). */
export function dominantColor(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  const size = 40;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, 0, 0, size, size);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    return ''; // tainted canvas (cross-origin without CORS)
  }
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const rr = data[i], gg = data[i + 1], bb = data[i + 2];
    if (rr > 225 && gg > 225 && bb > 225) continue; // skip near-white background
    r += rr; g += gg; b += bb; count++;
  }
  if (count === 0) return '';
  r /= count; g /= count; b /= count;
  let best = COLORS[0], bestDist = Infinity;
  for (const c of COLORS) {
    const d = (c.rgb[0] - r) ** 2 + (c.rgb[1] - g) ** 2 + (c.rgb[2] - b) ** 2;
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best.name;
}
