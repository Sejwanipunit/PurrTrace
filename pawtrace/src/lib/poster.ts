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
  e(0, 4, 6, 5);      // pad
  e(-7, -3, 2.4, 2.4); // toes
  e(7, -3, 2.4, 2.4);
  e(-3, -7, 2.2, 2.2);
  e(3, -7, 2.2, 2.2);
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

  // Photo (rounded, cover-cropped) with paw placeholder fallback
  const px = 60, py = 210, pw = W - 120, ph = 600;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 36);
  ctx.clip();
  ctx.fillStyle = '#F3F0E7';
  ctx.fillRect(px, py, pw, ph);
  if (pet.photoUrl) {
    try {
      const img = await loadImage(pet.photoUrl);
      const scale = Math.max(pw / img.width, ph / img.height);
      const sw = pw / scale, sh = ph / scale;
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, px, py, pw, ph);
    } catch {
      drawPaw(ctx, W / 2, py + ph / 2, 14, `${accent}55`);
    }
  } else {
    drawPaw(ctx, W / 2, py + ph / 2, 14, `${accent}55`);
  }
  ctx.restore();

  // Name
  ctx.fillStyle = '#2A271F';
  ctx.font = `700 92px ${display}`;
  ctx.fillText(pet.name, W / 2, 910);

  // Breed / age line
  const meta = [pet.breed, pet.ageYears != null ? `${pet.ageYears} yr${pet.ageYears !== 1 ? 's' : ''}` : '']
    .filter(Boolean)
    .join(' · ');
  if (meta) {
    ctx.fillStyle = '#6B6353';
    ctx.font = `700 44px ${body}`;
    ctx.fillText(meta, W / 2, 985);
  }

  // Last seen
  ctx.fillStyle = '#2A271F';
  ctx.font = `700 46px ${body}`;
  ctx.fillText(`Last seen: ${pet.lastSeen.label}`, W / 2, meta ? 1070 : 1020);
  ctx.fillStyle = '#6B6353';
  ctx.font = `400 38px ${body}`;
  ctx.fillText(formatDate(pet.lastSeen.at), W / 2, meta ? 1125 : 1075);

  // Footer band with call to action
  ctx.fillStyle = '#F3F0E7';
  ctx.fillRect(0, H - 160, W, 160);
  drawPaw(ctx, 90, H - 80, 4.5, accent);
  ctx.fillStyle = '#2A271F';
  ctx.font = `700 40px ${body}`;
  ctx.fillText(
    pet.status === 'reunited' ? `${pet.name} is home — thank you!` : `Seen ${pet.name}? Report it on PawTrace`,
    W / 2,
    H - 100
  );
  ctx.fillStyle = '#3F7A12';
  ctx.font = `700 36px ${body}`;
  ctx.fillText(`${window.location.origin}/pet/${pet.id}`, W / 2, H - 48);

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
