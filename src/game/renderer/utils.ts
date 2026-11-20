export const VIRTUAL_W = 480;
export const VIRTUAL_H = 270;

export interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
}

export interface DustMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
}

export interface RenderOptions {
  screenShake?: boolean;
  reduceFlashes?: boolean;
  visualNoise?: boolean;
  reducedMotion?: boolean;
  paused?: boolean;
}

export function safeNum(v: number, fallback = 0): number {
  return Number.isFinite(v) ? v : fallback;
}

export function safeLinearGrad(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): CanvasGradient {
  const sx0 = safeNum(x0, 0);
  const sy0 = safeNum(y0, 0);
  const sx1 = safeNum(x1, sx0 + 1);
  const sy1 = safeNum(y1, sy0);
  return ctx.createLinearGradient(sx0, sy0, sx1, sy1);
}

export function createRadialGlowCanvas(size = 128): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const gctx = canvas.getContext('2d');
  if (gctx) {
    const half = size / 2;
    const grad = gctx.createRadialGradient(half, half, Math.max(2, size * 0.08), half, half, half);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.48)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    gctx.fillStyle = grad;
    gctx.fillRect(0, 0, size, size);
  }
  return canvas;
}

export function drawCachedGlow(
  lctx: CanvasRenderingContext2D,
  glowCanvas: HTMLCanvasElement,
  cx: number,
  cy: number,
  outerRadius: number,
  alpha: number
): void {
  const r = Math.max(2, safeNum(outerRadius, 32));
  const a = Math.max(0, Math.min(1, safeNum(alpha, 1)));
  if (a <= 0.005) return;
  const prevAlpha = lctx.globalAlpha;
  lctx.globalAlpha = a;
  lctx.drawImage(glowCanvas, Math.round(cx - r), Math.round(cy - r), Math.round(r * 2), Math.round(r * 2));
  lctx.globalAlpha = prevAlpha;
}

export function createScanlineCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = VIRTUAL_W;
  canvas.height = VIRTUAL_H;
  const sctx = canvas.getContext('2d');
  if (sctx) {
    sctx.imageSmoothingEnabled = false;
    sctx.fillStyle = 'rgba(0, 0, 0, 0.055)';
    for (let y = 0; y < VIRTUAL_H; y += 2) {
      sctx.fillRect(0, y, VIRTUAL_W, 1);
    }
    sctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    sctx.fillRect(0, 0, VIRTUAL_W, 5);
    sctx.fillRect(0, VIRTUAL_H - 5, VIRTUAL_W, 5);
    sctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    for (let x = 0; x < VIRTUAL_W; x += 2) {
      sctx.fillRect(x, 5, 1, 2);
      sctx.fillRect(x + 1, VIRTUAL_H - 7, 1, 2);
    }
  }
  return canvas;
}

export function createHidingVignetteCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = VIRTUAL_W;
  canvas.height = VIRTUAL_H;
  const vctx = canvas.getContext('2d');
  if (vctx) {
    const vg = vctx.createRadialGradient(
      VIRTUAL_W / 2,
      VIRTUAL_H / 2,
      42,
      VIRTUAL_W / 2,
      VIRTUAL_H / 2,
      240
    );
    vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vg.addColorStop(1, 'rgba(2, 4, 8, 0.78)');
    vctx.fillStyle = vg;
    vctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
  }
  return canvas;
}

export function drawPixelMoon(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const drawDisc = (r: number, color: string) => {
    ctx.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.round(Math.sqrt(r * r - dy * dy));
      if (hw > 0) ctx.fillRect(cx - hw, cy + dy, hw * 2, 1);
    }
  };
  drawDisc(22, 'rgba(110, 152, 198, 0.04)');
  drawDisc(16, 'rgba(130, 168, 208, 0.075)');
  drawDisc(11, 'rgba(165, 200, 232, 0.13)');

  // Outer moon sphere
  ctx.fillStyle = '#8aa8c7';
  ctx.fillRect(cx - 3, cy - 7, 6, 14);
  ctx.fillRect(cx - 5, cy - 6, 10, 12);
  ctx.fillRect(cx - 6, cy - 5, 12, 10);
  ctx.fillRect(cx - 7, cy - 3, 14, 6);

  // Mid lit face
  ctx.fillStyle = '#aac5e0';
  ctx.fillRect(cx - 5, cy - 5, 8, 9);
  ctx.fillRect(cx - 6, cy - 3, 2, 5);

  // Bright lunar crescent rim
  ctx.fillStyle = '#d4e8fa';
  ctx.fillRect(cx - 4, cy - 6, 5, 2);
  ctx.fillRect(cx - 6, cy - 4, 2, 5);
  ctx.fillRect(cx - 5, cy - 5, 2, 2);

  // Craters & maria shading
  ctx.fillStyle = '#6c88a6';
  ctx.fillRect(cx + 1, cy - 3, 3, 2);
  ctx.fillRect(cx + 3, cy - 1, 2, 2);
  ctx.fillRect(cx - 2, cy + 2, 2, 2);
  ctx.fillRect(cx + 1, cy + 3, 3, 2);
  ctx.fillStyle = '#5c7692';
  ctx.fillRect(cx + 2, cy - 2, 1, 1);
  ctx.fillRect(cx - 1, cy + 3, 1, 1);
}

export function drawPixelCloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  const rx = Math.round(x);
  ctx.fillStyle = '#0d1520';
  ctx.fillRect(rx + 4, y + 7, w - 8, 4);
  ctx.fillStyle = '#111b29';
  ctx.fillRect(rx + 6, y, w - 12, 4);
  ctx.fillRect(rx + 2, y + 3, w - 4, 5);
  ctx.fillRect(rx, y + 6, w, 4);
  ctx.fillStyle = '#1a293d';
  ctx.fillRect(rx + 8, y + 1, Math.floor(w * 0.48), 2);
  ctx.fillRect(rx + 12, y + 3, Math.floor(w * 0.35), 2);
  ctx.fillStyle = 'rgba(130, 168, 208, 0.14)';
  ctx.fillRect(rx + 9, y + 1, Math.floor(w * 0.32), 1);
}

export function drawPine(
  ctx: CanvasRenderingContext2D,
  x: number,
  groundY: number,
  height: number,
  color: string,
  highlight?: string,
  swayOffset = 0
): void {
  const trunkH = Math.round(height * 0.25);
  // Root flare & textured bark
  ctx.fillStyle = '#14100d';
  ctx.fillRect(x - 2, groundY - trunkH, 5, trunkH);
  ctx.fillRect(x - 5, groundY - 2, 11, 2);
  ctx.fillRect(x - 3, groundY - 4, 7, 2);
  ctx.fillStyle = '#241c16';
  ctx.fillRect(x, groundY - trunkH + 2, 1, trunkH - 3);

  for (let t = 0; t < 5; t++) {
    const tierTop = groundY - height + Math.round(t * height * 0.145);
    const tierH = Math.round(height * 0.22);
    const maxHalf = 5 + t * 3 + (t === 4 ? 2 : 0);
    const rows = Math.max(4, Math.floor(tierH / 2));
    const tierSway = t <= 1 ? Math.round(swayOffset) : t === 2 ? Math.round(swayOffset * 0.5) : 0;

    for (let r = 0; r < rows; r++) {
      const half = Math.max(1, Math.round((r / rows) * maxHalf));
      const ry = tierTop + r * 2;
      ctx.fillStyle = color;
      ctx.fillRect(x - half + tierSway, ry, half * 2 + 1, 2);
      // Ragged branch tips on lower rows
      if (r >= rows - 2 && maxHalf >= 8) {
        ctx.fillRect(x - half - 1 + tierSway, ry + 1, 2, 2);
        ctx.fillRect(x + half + tierSway, ry + 1, 2, 2);
      }
      // Deep inner bough underside shadow
      if (r === rows - 1) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.fillRect(x - Math.max(1, half - 2) + tierSway, ry + 1, Math.max(2, half * 2 - 4), 1);
      }
      // Moonlit / wet needle edge highlight
      if (highlight && r >= 1 && r < rows - 1) {
        ctx.fillStyle = highlight;
        ctx.fillRect(x + Math.max(0, half - 2) + tierSway, ry, 2, 2);
        if (r === 1 && half >= 4) {
          ctx.fillRect(x - 1 + tierSway, ry, 2, 1);
        }
      }
    }
  }
}

export function drawPixelCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  headlightsOn: boolean,
  trunkOpen: boolean,
  interiorDriver: boolean,
  sputtering: boolean,
  timeSec = 0,
  distance = 0
): void {
  // Ground contact shadow + wet road reflection strip
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(x + 2, y + 36, 94, 4);
  ctx.fillStyle = 'rgba(105, 145, 185, 0.08)';
  ctx.fillRect(x + 8, y + 39, 80, 1);

  // Lower rocker skirt & wheel wells
  ctx.fillStyle = '#242d3a';
  ctx.fillRect(x + 1, y + 29, 94, 3);

  // Main sedan body shell + shaded waist line
  ctx.fillStyle = '#384659';
  ctx.fillRect(x, y + 14, 96, 16);
  ctx.fillStyle = '#475970';
  ctx.fillRect(x + 1, y + 15, 94, 8);
  // Moonlit wet shoulder sheen
  ctx.fillStyle = '#627996';
  ctx.fillRect(x + 2, y + 14, 92, 2);
  ctx.fillStyle = 'rgba(205, 228, 250, 0.28)';
  ctx.fillRect(x + 4, y + 14, 20, 1);
  ctx.fillRect(x + 70, y + 14, 22, 1);

  // Cabin roof & pillars
  ctx.fillStyle = '#4b5e78';
  ctx.fillRect(x + 19, y + 2, 50, 13);
  ctx.fillStyle = '#637a96';
  ctx.fillRect(x + 21, y + 2, 46, 2);
  // Roof rain gutter
  ctx.fillStyle = '#2d3745';
  ctx.fillRect(x + 19, y + 4, 50, 1);

  // Door seam, trim strip & chrome handles
  ctx.fillStyle = '#2c3747';
  ctx.fillRect(x + 43, y + 16, 1, 13);
  ctx.fillRect(x + 67, y + 16, 1, 12);
  ctx.fillStyle = '#28313d';
  ctx.fillRect(x + 3, y + 22, 88, 1);
  ctx.fillStyle = '#9aa8ba';
  ctx.fillRect(x + 34, y + 19, 3, 1);
  ctx.fillRect(x + 47, y + 19, 4, 1);

  // Side windows + glass reflections + B-pillar
  ctx.fillStyle = '#14202b';
  ctx.fillRect(x + 23, y + 4, 19, 9);
  ctx.fillRect(x + 45, y + 4, 20, 9);
  ctx.fillStyle = '#2d3847';
  ctx.fillRect(x + 42, y + 4, 3, 10);
  // Rain streaks / moonlight reflection on glass
  ctx.fillStyle = 'rgba(150, 192, 232, 0.28)';
  ctx.fillRect(x + 26, y + 5, 2, 7);
  ctx.fillRect(x + 30, y + 6, 1, 4);
  ctx.fillRect(x + 56, y + 5, 2, 7);
  ctx.fillRect(x + 60, y + 6, 1, 5);
  // Side mirror
  ctx.fillStyle = '#2d3745';
  ctx.fillRect(x + 65, y + 11, 5, 3);
  ctx.fillStyle = '#5f738c';
  ctx.fillRect(x + 66, y + 11, 3, 1);

  if (interiorDriver) {
    // Silhouette of protagonist + faint dashboard amber glow
    ctx.fillStyle = '#0c1117';
    ctx.fillRect(x + 50, y + 6, 6, 7);
    ctx.fillRect(x + 51, y + 5, 4, 2);
    if (headlightsOn) {
      ctx.fillStyle = 'rgba(255, 165, 82, 0.5)';
      ctx.fillRect(x + 61, y + 10, 3, 2);
    }
  }

  // Open trunk with warm dim trunk bulb & spare hinge
  if (trunkOpen) {
    ctx.fillStyle = '#10151c';
    ctx.fillRect(x + 1, y + 10, 14, 5);
    ctx.fillStyle = '#4e627d';
    ctx.fillRect(x - 3, y + 4, 17, 3);
    ctx.fillStyle = '#738aa8';
    ctx.fillRect(x - 2, y + 4, 15, 1);
    ctx.fillStyle = '#313d4d';
    ctx.fillRect(x + 12, y + 7, 2, 7);
    ctx.fillStyle = 'rgba(245, 200, 115, 0.65)';
    ctx.fillRect(x + 6, y + 11, 3, 2);
  }

  // Front grille & chrome bumpers
  ctx.fillStyle = '#181e26';
  ctx.fillRect(x + 92, y + 23, 4, 4);
  ctx.fillStyle = '#7c8b9c';
  ctx.fillRect(x - 2, y + 25, 6, 3);
  ctx.fillRect(x + 93, y + 25, 6, 3);
  ctx.fillStyle = '#aebccb';
  ctx.fillRect(x - 2, y + 25, 6, 1);
  ctx.fillRect(x + 93, y + 25, 6, 1);

  // Taillight + housing
  if (headlightsOn) {
    ctx.fillStyle = 'rgba(220, 56, 56, 0.34)';
    ctx.fillRect(x - 5, y + 16, 7, 8);
  }
  ctx.fillStyle = headlightsOn ? '#d94444' : '#4a2323';
  ctx.fillRect(x, y + 18, 3, 4);
  if (headlightsOn) {
    ctx.fillStyle = '#ff9898';
    ctx.fillRect(x, y + 19, 1, 2);
  }

  // Wheel arches, tires, alloy rims & rotating lug spokes
  ctx.fillStyle = '#080b0f';
  ctx.fillRect(x + 12, y + 24, 18, 8);
  ctx.fillRect(x + 66, y + 24, 18, 8);
  ctx.fillStyle = '#11151b';
  ctx.fillRect(x + 14, y + 26, 14, 12);
  ctx.fillRect(x + 68, y + 26, 14, 12);
  // Tire tread highlight
  ctx.fillStyle = '#1e252e';
  ctx.fillRect(x + 15, y + 26, 12, 1);
  ctx.fillRect(x + 69, y + 26, 12, 1);
  // Alloy rims
  ctx.fillStyle = '#7c8a99';
  ctx.fillRect(x + 18, y + 29, 6, 6);
  ctx.fillRect(x + 72, y + 29, 6, 6);
  ctx.fillStyle = '#a4b2c2';
  ctx.fillRect(x + 19, y + 30, 4, 4);
  ctx.fillRect(x + 73, y + 30, 4, 4);
  if (distance > 0) {
    const spoke = Math.floor(distance * 220) % 3;
    ctx.fillStyle = '#2b333d';
    ctx.fillRect(x + 19 + spoke, y + 30, 1, 4);
    ctx.fillRect(x + 73 + spoke, y + 30, 1, 4);
  } else {
    ctx.fillStyle = '#37414d';
    ctx.fillRect(x + 20, y + 31, 2, 2);
    ctx.fillRect(x + 74, y + 31, 2, 2);
  }

  // Front headlight bezel & glass
  ctx.fillStyle = headlightsOn ? '#fff2b8' : '#3a424c';
  ctx.fillRect(x + 93, y + 18, 4, 5);
  if (headlightsOn) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 95, y + 19, 2, 3);
  }

  // Hood steam & exhaust wisps when stalled / sputtering
  if (sputtering) {
    const puff = Math.floor(timeSec * 10) % 12;
    ctx.fillStyle = 'rgba(175, 192, 210, 0.3)';
    ctx.fillRect(x + 81, y + 8 - Math.floor(puff * 0.65), 8, 5);
    ctx.fillRect(x + 75 - Math.floor(puff * 0.4), y + 2 - puff, 6, 4);
    ctx.fillRect(x + 86 - Math.floor(puff * 0.2), y + 5 - Math.floor(puff * 0.8), 4, 3);
    // Faint exhaust puff near tailpipe
    ctx.fillStyle = 'rgba(150, 165, 182, 0.2)';
    ctx.fillRect(x - 6 - (puff >> 1), y + 31 - (puff >> 2), 4, 2);
  }
}

export function drawInteractMarker(ctx: CanvasRenderingContext2D, x: number, y: number, timeSec: number): void {
  const bob = Math.round(Math.sin(timeSec * 4.2) * 1.5);
  const pulse = Math.sin(timeSec * 6.5) > 0.35;
  const mx = Math.round(x) - 6;
  const my = Math.round(y) + bob - 11;

  // Soft dark shadow + crisp outer glow brackets
  ctx.fillStyle = 'rgba(6, 10, 15, 0.92)';
  ctx.fillRect(mx - 1, my - 1, 14, 13);
  ctx.fillStyle = pulse ? '#88b4dc' : '#587490';
  ctx.fillRect(mx, my, 12, 11);
  ctx.fillStyle = '#101721';
  ctx.fillRect(mx + 1, my + 1, 10, 9);

  // Subtle corner highlight pixels
  ctx.fillStyle = '#b4d6f5';
  ctx.fillRect(mx, my, 2, 1);
  ctx.fillRect(mx + 10, my, 2, 1);
  ctx.fillRect(mx, my + 10, 2, 1);
  ctx.fillRect(mx + 10, my + 10, 2, 1);

  // Crisp pixel 'E' glyph
  ctx.fillStyle = '#f0f6fc';
  ctx.fillRect(mx + 4, my + 3, 4, 1);
  ctx.fillRect(mx + 4, my + 3, 1, 5);
  ctx.fillRect(mx + 4, my + 5, 3, 1);
  ctx.fillRect(mx + 4, my + 7, 4, 1);

  // Tiny downward pointer chevron
  ctx.fillStyle = pulse ? '#9dc9f0' : '#6583a1';
  ctx.fillRect(mx + 5, my + 12, 2, 1);
}
