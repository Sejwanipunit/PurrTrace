import QRCode from 'qrcode';
import type { Pet } from '../types';
import { formatDate } from './time';

const W = 1080;
const H = 1350;

// Palette (poster is a standalone canvas, so tokens are inlined)
const CREAM = '#FBFAF5';
const INK = '#2A271F';
const MUTED = '#6E6857';
const BRAND = '#6FB833';       // sprout-500
const BRAND_DEEP = '#43741B';  // sprout-700 (footer, good contrast with white)
const BRAND_LINK = '#3F7A12';

const STATUS_TEXT: Record<string, string> = {
  lost: 'LOST',
  found: 'FOUND',
  searching: 'STILL MISSING',
  reunited: 'BACK HOME!',
};

const STATUS_COLOR: Record<string, string> = {
  lost: '#F2603C',
  found: '#6FB833',
  searching: '#F5D827',
  reunited: '#3EA094',
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawPaw(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, color: string) {
  ctx.fillStyle = color;
  const e = (cx: number, cy: number, rx: number, ry: number) => {
    ctx.beginPath();
    ctx.ellipse(x + cx * scale, y + cy * scale, rx * scale, ry * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  e(0, 4, 6, 5);       // pad
  e(-7, -3, 2.4, 2.4); // toes
  e(7, -3, 2.4, 2.4);
  e(-3, -7, 2.2, 2.2);
  e(3, -7, 2.2, 2.2);
}

/** Rounded pill helper: fill (and optional stroke) a pill and return its width. */
function pill(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, font: string, padX: number, hgt: number, bg: string, fg: string, stroke?: string) {
  ctx.font = font;
  const tw = ctx.measureText(text).width;
  const w = tw + padX * 2;
  const x = cx - w / 2, y = cy - hgt / 2;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, hgt, hgt / 2);
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); }
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 1);
  return w;
}

/** Cover-crop an image into a rect (optionally rounded). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number, radius = 0) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(dx, dy, dw, dh, radius);
  ctx.clip();
  const scale = Math.max(dw / img.width, dh / img.height);
  const sw = dw / scale, sh = dh / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

/** Lay out 1–4 photos as a collage inside the given (rounded) box. */
function drawCollage(ctx: CanvasRenderingContext2D, imgs: HTMLImageElement[], x: number, y: number, w: number, h: number, accent: string, radius = 32) {
  const gap = 10;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip();
  ctx.fillStyle = '#F3F0E7';
  ctx.fillRect(x, y, w, h);

  if (imgs.length === 0) {
    drawPaw(ctx, x + w / 2, y + h / 2, 15, `${accent}55`);
  } else if (imgs.length === 1) {
    drawCover(ctx, imgs[0], x, y, w, h);
  } else if (imgs.length === 2) {
    const cw = (w - gap) / 2;
    drawCover(ctx, imgs[0], x, y, cw, h);
    drawCover(ctx, imgs[1], x + cw + gap, y, cw, h);
  } else if (imgs.length === 3) {
    const cw = (w - gap) / 2;
    const ch = (h - gap) / 2;
    drawCover(ctx, imgs[0], x, y, cw, h);
    drawCover(ctx, imgs[1], x + cw + gap, y, cw, ch);
    drawCover(ctx, imgs[2], x + cw + gap, y + ch + gap, cw, ch);
  } else {
    const cw = (w - gap) / 2;
    const ch = (h - gap) / 2;
    drawCover(ctx, imgs[0], x, y, cw, ch);
    drawCover(ctx, imgs[1], x + cw + gap, y, cw, ch);
    drawCover(ctx, imgs[2], x, y + ch + gap, cw, ch);
    drawCover(ctx, imgs[3], x + cw + gap, y + ch + gap, cw, ch);
  }
  ctx.restore();
}

/** Render a shareable poster for a pet onto a canvas and return it as a PNG blob. */
export async function generatePoster(pet: Pet): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');

  await Promise.allSettled([
    document.fonts.load('600 96px Fredoka'),
    document.fonts.load('700 44px Nunito'),
    document.fonts.load('800 44px Nunito'),
  ]);
  const display = 'Fredoka, Nunito, system-ui, sans-serif';
  const body = 'Nunito, system-ui, sans-serif';

  const accent = STATUS_COLOR[pet.status] ?? '#F2603C';
  const petUrl = `${window.location.origin}/pet/${pet.id}`;
  const host = window.location.host.replace(/^www\./, '');

  // Photos: pet photo + up to 3 sighting photos, de-duped.
  const photoSrcs = Array.from(
    new Set([pet.photoUrl, ...pet.sightings.map(s => s.photoUrl)].filter(Boolean) as string[])
  ).slice(0, 4);
  const imgs: HTMLImageElement[] = [];
  for (const src of photoSrcs) {
    try { imgs.push(await loadImage(src)); } catch { /* skip broken images */ }
  }

  // QR to the pet page.
  let qrImg: HTMLImageElement | null = null;
  try {
    const qrDataUrl = await QRCode.toDataURL(petUrl, { margin: 0, width: 320, color: { dark: INK, light: '#FFFFFF' } });
    qrImg = await loadImage(qrDataUrl);
  } catch { /* QR optional */ }

  // ---- Background ----
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  // ---- Brand header ----
  // Logo squircle + paw
  ctx.fillStyle = BRAND;
  ctx.beginPath();
  ctx.roundRect(64, 44, 74, 74, 22);
  ctx.fill();
  drawPaw(ctx, 64 + 37, 44 + 38, 4.4, '#FFFFFF');
  // Wordmark + tagline
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = `600 50px ${display}`;
  ctx.fillText('PawTrace', 154, 84);
  ctx.fillStyle = MUTED;
  ctx.font = `700 25px ${body}`;
  ctx.fillText('Community lost & found', 156, 114);
  // Domain (right)
  ctx.textAlign = 'right';
  ctx.fillStyle = BRAND_LINK;
  ctx.font = `800 30px ${body}`;
  ctx.fillText(host, W - 64, 96);
  // hairline divider
  ctx.strokeStyle = '#E6E1D5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 150);
  ctx.lineTo(W - 64, 150);
  ctx.stroke();

  // ---- Photo hero (with soft shadow) ----
  const px = 64, py = 178, pw = W - 128, ph = 600;
  ctx.save();
  ctx.shadowColor = 'rgba(42,39,31,0.20)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 32);
  ctx.fill();
  ctx.restore();
  drawCollage(ctx, imgs, px, py, pw, ph, accent, 32);

  // Status pill overlay (top-left of photo)
  const stText = STATUS_TEXT[pet.status] ?? 'LOST';
  ctx.font = `800 34px ${body}`;
  const stW = ctx.measureText(stText).width + 56;
  const stX = px + 26, stY = py + 26;
  ctx.save();
  ctx.shadowColor = 'rgba(42,39,31,0.25)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(stX, stY, stW, 60, 30);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = pet.status === 'searching' ? INK : '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(stText, stX + 28, stY + 31);

  // "N photos" chip (bottom-right of photo)
  if (imgs.length > 1) {
    const label = `${imgs.length} photos`;
    ctx.font = `700 28px ${body}`;
    const cw = ctx.measureText(label).width + 40;
    const cx = px + pw - cw - 22, cy = py + ph - 62;
    ctx.fillStyle = 'rgba(42,39,31,0.72)';
    ctx.beginPath();
    ctx.roundRect(cx, cy, cw, 44, 22);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx + 20, cy + 23);
  }

  // ---- Name + meta (centered) ----
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = `600 92px ${display}`;
  ctx.fillText(pet.name, W / 2, 872);

  const meta = [pet.breed, pet.ageYears != null ? `${pet.ageYears} yr${pet.ageYears !== 1 ? 's' : ''}` : '']
    .filter(Boolean)
    .join('  ·  ');
  if (meta) {
    ctx.fillStyle = MUTED;
    ctx.font = `700 42px ${body}`;
    ctx.fillText(meta, W / 2, 932);
  }

  // Last seen
  ctx.fillStyle = INK;
  ctx.font = `700 44px ${body}`;
  ctx.fillText(`Last seen · ${pet.lastSeen.label}`, W / 2, meta ? 1000 : 966);
  ctx.fillStyle = MUTED;
  ctx.font = `400 36px ${body}`;
  ctx.fillText(formatDate(pet.lastSeen.at), W / 2, meta ? 1048 : 1014);

  // Reward pill (optional)
  if (pet.reward && pet.status !== 'reunited') {
    pill(ctx, `REWARD  ${pet.reward}`, W / 2, 1112, `800 40px ${body}`, 38, 72, '#FCF5B9', INK, '#E0B90F');
  }

  // ---- Brand footer (promotes the site) ----
  const fY = H - 176;
  ctx.fillStyle = BRAND_DEEP;
  ctx.fillRect(0, fY, W, 176);

  // QR card (right)
  let textRight = W - 64;
  if (qrImg) {
    const card = 140, cardX = W - 64 - card, cardY = fY + 18;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, card, card, 18);
    ctx.fill();
    ctx.drawImage(qrImg, cardX + 12, cardY + 12, card - 24, card - 24);
    textRight = cardX - 36;
  }

  // Left text block (white on green)
  drawPaw(ctx, 90, fY + 58, 3.2, 'rgba(255,255,255,0.92)');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `700 34px ${body}`;
  ctx.fillText(
    pet.status === 'reunited' ? `${pet.name} is safely home` : `Seen ${pet.name}? ${qrImg ? 'Scan to help' : 'Report on PawTrace'}`,
    128, fY + 68
  );
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `600 46px ${display}`;
  // Clamp the domain so it never runs under the QR card.
  let domain = host;
  while (domain.length > 6 && 70 + ctx.measureText(domain).width > textRight) domain = domain.slice(0, -1);
  if (domain !== host) domain += '…';
  ctx.fillText(domain, 70, fY + 128);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Poster export failed'))), 'image/png');
  });
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

function posterFilename(pet: Pet): string {
  return `pawtrace-${pet.name.toLowerCase().replace(/\s+/g, '-')}.png`;
}

/** Whether the device can share files via the native share sheet. */
export function canSharePoster(): boolean {
  return typeof navigator !== 'undefined'
    && !!navigator.canShare
    && navigator.canShare({ files: [new File([], 'x.png', { type: 'image/png' })] });
}

/** Trigger a PNG download of an already-generated poster blob. */
export function downloadPosterBlob(pet: Pet, blob: Blob): void {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = posterFilename(pet);
  a.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}

/** Share an already-generated poster blob via the Web Share API, else download it. */
export async function sharePosterBlob(pet: Pet, blob: Blob): Promise<ShareOutcome> {
  const url = `${window.location.origin}/pet/${pet.id}`;
  const title = pet.status === 'reunited' ? `${pet.name} is back home!` : `Help find ${pet.name}`;
  const file = new File([blob], posterFilename(pet), { type: 'image/png' });

  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title, text: `${title} · ${url}` });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title, text: title, url });
      return 'shared';
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    // Otherwise fall through to download.
  }

  downloadPosterBlob(pet, blob);
  return 'downloaded';
}

/** Generate + share in one call (no preview). Kept for convenience. */
export async function sharePoster(pet: Pet): Promise<ShareOutcome> {
  const blob = await generatePoster(pet);
  return sharePosterBlob(pet, blob);
}
