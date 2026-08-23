import QRCode from 'qrcode';
import type { Pet } from '../types';
import { formatDate } from './time';

const W = 1080;
const H = 1350;

const STATUS_TEXT: Record<string, string> = {
  lost: 'LOST',
  found: 'FOUND',
  searching: 'STILL MISSING',
  reunited: 'BACK HOME!',
};

const STATUS_COLOR: Record<string, string> = {
  lost: '#F2603C',
  found: '#6FB833',
  searching: '#E0B90F',
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

/** Lay out 1–4 photos as a collage inside the given box. */
function drawCollage(ctx: CanvasRenderingContext2D, imgs: HTMLImageElement[], x: number, y: number, w: number, h: number, accent: string) {
  const gap = 12;
  // Round the outer box; tiles inside are drawn with straight edges and gaps.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 36);
  ctx.clip();
  ctx.fillStyle = '#F3F0E7';
  ctx.fillRect(x, y, w, h);

  if (imgs.length === 0) {
    drawPaw(ctx, x + w / 2, y + h / 2, 14, `${accent}55`);
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

  // Little "N photos" chip when there's more than one.
  if (imgs.length > 1) {
    const label = `${imgs.length} photos`;
    ctx.font = '700 30px Nunito, system-ui, sans-serif';
    const tw = ctx.measureText(label).width;
    const cx = x + w - tw - 56, cy = y + h - 60;
    ctx.fillStyle = 'rgba(42,39,31,0.72)';
    ctx.beginPath();
    ctx.roundRect(cx, cy, tw + 40, 44, 22);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx + 20, cy + 23);
  }
}

/** Render a shareable poster for a pet onto a canvas and return it as a PNG blob. */
export async function generatePoster(pet: Pet): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');

  // Make sure the brand fonts are ready before drawing text.
  await Promise.allSettled([
    document.fonts.load('700 96px Fredoka'),
    document.fonts.load('700 44px Nunito'),
  ]);
  const display = 'Fredoka, Nunito, system-ui, sans-serif';
  const body = 'Nunito, system-ui, sans-serif';

  const accent = STATUS_COLOR[pet.status] ?? '#F2603C';
  const petUrl = `${window.location.origin}/pet/${pet.id}`;

  // Gather up to 4 unique photos: the pet's own photo plus any sighting photos.
  const photoSrcs = Array.from(
    new Set([pet.photoUrl, ...pet.sightings.map(s => s.photoUrl)].filter(Boolean) as string[])
  ).slice(0, 4);
  const imgs: HTMLImageElement[] = [];
  for (const src of photoSrcs) {
    try { imgs.push(await loadImage(src)); } catch { /* skip broken images */ }
  }

  // Generate the QR code (points to the pet's page).
  let qrImg: HTMLImageElement | null = null;
  try {
    const qrDataUrl = await QRCode.toDataURL(petUrl, {
      margin: 0,
      width: 320,
      color: { dark: '#2A271F', light: '#FFFFFF' },
    });
    qrImg = await loadImage(qrDataUrl);
  } catch { /* QR is a nice-to-have; poster still renders without it */ }

  // Background
  ctx.fillStyle = '#FFF9EC';
  ctx.fillRect(0, 0, W, H);

  // Status band
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 150);
  ctx.fillStyle = pet.status === 'searching' ? '#2A271F' : '#FFFFFF';
  ctx.font = `700 84px ${display}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(STATUS_TEXT[pet.status] ?? 'LOST', W / 2, 82);

  // Photo collage
  drawCollage(ctx, imgs, 60, 200, W - 120, 540, accent);

  // Name
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2A271F';
  ctx.font = `700 90px ${display}`;
  ctx.fillText(pet.name, W / 2, 826);

  // Breed / age line
  const meta = [pet.breed, pet.ageYears != null ? `${pet.ageYears} yr${pet.ageYears !== 1 ? 's' : ''}` : '']
    .filter(Boolean)
    .join(' · ');
  if (meta) {
    ctx.fillStyle = '#6B6353';
    ctx.font = `700 42px ${body}`;
    ctx.fillText(meta, W / 2, 894);
  }

  // Last seen
  ctx.fillStyle = '#2A271F';
  ctx.font = `700 44px ${body}`;
  ctx.fillText(`Last seen: ${pet.lastSeen.label}`, W / 2, meta ? 966 : 918);
  ctx.fillStyle = '#6B6353';
  ctx.font = `400 36px ${body}`;
  ctx.fillText(formatDate(pet.lastSeen.at), W / 2, meta ? 1016 : 968);

  // Reward pill (optional)
  if (pet.reward && pet.status !== 'reunited') {
    const label = `REWARD  ${pet.reward}`;
    ctx.font = `800 40px ${body}`;
    const tw = ctx.measureText(label).width;
    const pillW = tw + 72, pillH = 74;
    const pillX = (W - pillW) / 2, pillY = 1052;
    ctx.fillStyle = '#FCF5B9';
    ctx.strokeStyle = '#E0B90F';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2A271F';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, pillY + pillH / 2 + 2);
    ctx.textBaseline = 'alphabetic';
  }

  // Footer band
  const footerY = H - 200;
  ctx.fillStyle = '#F3F0E7';
  ctx.fillRect(0, footerY, W, 200);

  // QR card (right)
  if (qrImg) {
    const card = 176, cardX = W - 60 - card, cardY = footerY + 12;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, card, card, 20);
    ctx.fill();
    ctx.drawImage(qrImg, cardX + 16, cardY + 16, card - 32, card - 32);
  }

  // Footer text (left)
  drawPaw(ctx, 92, footerY + 46, 4, accent);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#2A271F';
  ctx.font = `700 44px ${body}`;
  ctx.fillText(
    pet.status === 'reunited' ? `${pet.name} is home!` : `Seen ${pet.name}?`,
    132,
    footerY + 60
  );
  ctx.fillStyle = '#3F7A12';
  ctx.font = `700 34px ${body}`;
  ctx.fillText(qrImg ? 'Scan the code or visit' : 'Report on PawTrace', 70, footerY + 118);
  ctx.fillStyle = '#2A271F';
  ctx.font = `700 34px ${body}`;
  ctx.fillText(window.location.host, 70, footerY + 164);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Poster export failed'))), 'image/png');
  });
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/** Share the poster via the Web Share API, falling back to a PNG download. */
export async function sharePoster(pet: Pet): Promise<ShareOutcome> {
  const url = `${window.location.origin}/pet/${pet.id}`;
  const title = pet.status === 'reunited' ? `${pet.name} is back home!` : `Help find ${pet.name}`;
  const blob = await generatePoster(pet);
  const file = new File([blob], `pawtrace-${pet.name.toLowerCase().replace(/\s+/g, '-')}.png`, { type: 'image/png' });

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
    // User closed the share sheet — not an error, and don't force a download.
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    // Otherwise fall through to download.
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  return 'downloaded';
}
