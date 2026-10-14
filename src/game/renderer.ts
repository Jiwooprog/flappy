import type { Bird, Pipe, Particle, Theme } from './types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GROUND_HEIGHT, SKINS, THEME_PALETTES, type SkinDefinition } from './constants';
import { PIPE_LIP_HEIGHT, PIPE_LIP_OVERHANG, PIPE_WIDTH } from './physics';

export class GameRenderer {
  private ctx: CanvasRenderingContext2D;
  private reduceEffects = window.matchMedia('(pointer: coarse)').matches;
  private imageCache = new Map<string, HTMLImageElement>();
  private skyGradients = new Map<Theme, CanvasGradient>();
  private pipeTextures = new Map<Theme, { body: HTMLCanvasElement; lip: HTMLCanvasElement }>();
  private readonly starPositions = [
    [30, 40], [80, 80], [130, 30], [210, 60], [260, 110],
    [45, 130], [160, 140], [330, 120], [100, 180], [240, 190],
  ];

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  private getImage(src: string): HTMLImageElement {
    let img = this.imageCache.get(src);
    if (!img) {
      img = new Image();
      img.src = src;
      this.imageCache.set(src, img);
    }
    return img;
  }

  private getPipeTextures(theme: Theme, palette: (typeof THEME_PALETTES)['day']) {
    let textures = this.pipeTextures.get(theme);
    if (textures) return textures;

    const body = document.createElement('canvas');
    body.width = PIPE_WIDTH;
    body.height = 1;
    const bodyCtx = body.getContext('2d');
    if (!bodyCtx) throw new Error('Unable to create pipe texture context');
    const bodyGradient = bodyCtx.createLinearGradient(0, 0, PIPE_WIDTH, 0);
    bodyGradient.addColorStop(0, palette.pipeShadow);
    bodyGradient.addColorStop(0.25, palette.pipeMain);
    bodyGradient.addColorStop(0.45, palette.pipeHighlight);
    bodyGradient.addColorStop(0.7, palette.pipeMain);
    bodyGradient.addColorStop(1, palette.pipeShadow);
    bodyCtx.fillStyle = bodyGradient;
    bodyCtx.fillRect(0, 0, PIPE_WIDTH, 1);

    const lip = document.createElement('canvas');
    lip.width = PIPE_WIDTH + PIPE_LIP_OVERHANG * 2;
    lip.height = PIPE_LIP_HEIGHT;
    const lipCtx = lip.getContext('2d');
    if (!lipCtx) throw new Error('Unable to create pipe lip texture context');
    const lipGradient = lipCtx.createLinearGradient(0, 0, lip.width, 0);
    lipGradient.addColorStop(0, palette.pipeShadow);
    lipGradient.addColorStop(0.25, palette.pipeMain);
    lipGradient.addColorStop(0.45, palette.pipeHighlight);
    lipGradient.addColorStop(0.7, palette.pipeMain);
    lipGradient.addColorStop(1, palette.pipeShadow);
    lipCtx.fillStyle = lipGradient;
    lipCtx.fillRect(0, 0, lip.width, lip.height);
    lipCtx.strokeStyle = palette.pipeBorder;
    lipCtx.lineWidth = 2.5;
    lipCtx.strokeRect(0, 0, lip.width, lip.height);
    lipCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    lipCtx.fillRect(PIPE_LIP_OVERHANG + 12, 3, 5, PIPE_LIP_HEIGHT - 6);

    textures = { body, lip };
    this.pipeTextures.set(theme, textures);
    return textures;
  }

  public clear() {
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  public renderBackground(theme: Theme, scrollOffset: number) {
    const ctx = this.ctx;
    const palette = THEME_PALETTES[theme];

    // 1. Sky Gradient
    let skyGrad = this.skyGradients.get(theme);
    if (!skyGrad) {
      skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT - GROUND_HEIGHT);
      skyGrad.addColorStop(0, palette.skyTop);
      skyGrad.addColorStop(1, palette.skyBottom);
      this.skyGradients.set(theme, skyGrad);
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_HEIGHT);

    // 2. Celestial bodies
    if (theme === 'day') {
      // Warm glowing Sun
      ctx.save();
      const sunGrad = ctx.createRadialGradient(290, 80, 5, 290, 80, 45);
      sunGrad.addColorStop(0, 'rgba(255, 255, 220, 1)');
      sunGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.8)');
      sunGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(290, 80, 45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (theme === 'sunset') {
      // Big setting sun on horizon
      ctx.save();
      const sunGrad = ctx.createRadialGradient(190, 320, 10, 190, 320, 70);
      sunGrad.addColorStop(0, 'rgba(255, 237, 213, 0.9)');
      sunGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.5)');
      sunGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(190, 320, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // Crescent Moon & Stars
      ctx.save();
      // Moon
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#fef08a';
      ctx.shadowBlur = this.reduceEffects ? 0 : 12;
      ctx.beginPath();
      ctx.arc(300, 70, 22, 0, Math.PI * 2);
      ctx.fill();
      // Moon cutout
      ctx.shadowBlur = 0;
      ctx.fillStyle = palette.skyTop;
      ctx.beginPath();
      ctx.arc(292, 65, 18, 0, Math.PI * 2);
      ctx.fill();

      // Static seeded stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < this.starPositions.length; i++) {
        const [sx, sy] = this.starPositions[i];
        const twinkle = Math.sin((scrollOffset * 0.05) + i * 2) * 0.3 + 0.7;
        ctx.globalAlpha = twinkle;
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // 3. Clouds (slow parallax 0.15)
    this.renderClouds(palette.cloudColor, scrollOffset * 0.15);

    // 4. Distant City / Mountain Skyline (medium parallax 0.35)
    this.renderSkyline(palette.citySilhouette, scrollOffset * 0.35);
  }

  private renderClouds(cloudColor: string, offset: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = cloudColor;

    const cloudBaseY = 240;
    const spacing = 190;
    const count = Math.ceil(CANVAS_WIDTH / spacing) + 2;

    for (let i = -1; i < count; i++) {
      const cx = ((i * spacing - (offset % spacing) + CANVAS_WIDTH * 2) % (CANVAS_WIDTH + spacing)) - 50;
      const cy = cloudBaseY + (i % 2 === 0 ? 0 : -25);

      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.arc(cx + 25, cy - 12, 34, 0, Math.PI * 2);
      ctx.arc(cx + 55, cy - 8, 28, 0, Math.PI * 2);
      ctx.arc(cx + 80, cy, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderSkyline(silhouetteColor: string, offset: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = silhouetteColor;
    ctx.globalAlpha = 0.5;

    const baseY = CANVAS_HEIGHT - GROUND_HEIGHT;
    const buildingWidth = 36;
    const heights = [70, 95, 60, 120, 85, 110, 75, 130, 90, 65];
    const totalW = heights.length * buildingWidth;
    const shifted = (offset % totalW + totalW) % totalW;

    for (let i = -1; i < heights.length + 3; i++) {
      const x = i * buildingWidth - shifted;
      const h = heights[((i % heights.length) + heights.length) % heights.length];
      ctx.fillRect(x, baseY - h, buildingWidth - 2, h);

      // Cute little window dots
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      for (let wy = baseY - h + 12; wy < baseY - 10; wy += 18) {
        ctx.fillRect(x + 6, wy, 4, 6);
        ctx.fillRect(x + 18, wy, 4, 6);
      }
      ctx.fillStyle = silhouetteColor;
    }
    ctx.restore();
  }

  public renderGround(theme: Theme, scrollOffset: number) {
    const ctx = this.ctx;
    const palette = THEME_PALETTES[theme];
    const groundY = CANVAS_HEIGHT - GROUND_HEIGHT;

    // Ground Body
    ctx.fillStyle = palette.groundBody;
    ctx.fillRect(0, groundY, CANVAS_WIDTH, GROUND_HEIGHT);

    // Diagonal striped ground pattern
    ctx.save();
    ctx.fillStyle = palette.groundStripe;
    const stripeWidth = 16;
    const stripeShift = (scrollOffset % (stripeWidth * 2) + stripeWidth * 2) % (stripeWidth * 2);

    for (let x = -stripeWidth * 2; x < CANVAS_WIDTH + stripeWidth * 2; x += stripeWidth * 2) {
      const drawX = x - stripeShift;
      ctx.beginPath();
      ctx.moveTo(drawX + stripeWidth, groundY + 12);
      ctx.lineTo(drawX + stripeWidth * 2, groundY + 12);
      ctx.lineTo(drawX + stripeWidth, groundY + GROUND_HEIGHT);
      ctx.lineTo(drawX, groundY + GROUND_HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Ground Surface Border & Grass rim
    ctx.fillStyle = palette.groundSurface;
    ctx.fillRect(0, groundY, CANVAS_WIDTH, 12);

    ctx.fillStyle = palette.pipeBorder;
    ctx.fillRect(0, groundY, CANVAS_WIDTH, 3);
    ctx.fillRect(0, groundY + 12, CANVAS_WIDTH, 2);
  }

  public renderPipes(pipes: Pipe[], theme: Theme) {
    const palette = THEME_PALETTES[theme];
    const textures = this.getPipeTextures(theme, palette);

    for (const pipe of pipes) {
      this.renderSinglePipe(pipe.x, 0, pipe.width, pipe.topHeight, true, palette, textures);
      const bottomH = CANVAS_HEIGHT - GROUND_HEIGHT - pipe.bottomY;
      this.renderSinglePipe(pipe.x, pipe.bottomY, pipe.width, bottomH, false, palette, textures);
    }
  }

  private renderSinglePipe(
    x: number,
    y: number,
    width: number,
    height: number,
    isTop: boolean,
    palette: (typeof THEME_PALETTES)['day'],
    textures: { body: HTMLCanvasElement; lip: HTMLCanvasElement }
  ) {
    const ctx = this.ctx;
    if (height <= 0) return;

    ctx.save();

    // Draw in pipe-local coordinates so one gradient serves both body and cap.
    ctx.translate(x, 0);
    const bodyY = isTop ? 0 : y + PIPE_LIP_HEIGHT;
    const bodyH = isTop ? height - PIPE_LIP_HEIGHT : height - PIPE_LIP_HEIGHT;

    if (bodyH > 0) {
      ctx.drawImage(textures.body, 0, bodyY, width, bodyH);

      // Outlines
      ctx.strokeStyle = palette.pipeBorder;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(0, bodyY, width, bodyH);
    }

    // 2. Pipe Lip Cap
    const lipX = -PIPE_LIP_OVERHANG;
    const lipY = isTop ? height - PIPE_LIP_HEIGHT : y;

    ctx.drawImage(textures.lip, lipX, lipY);

    ctx.restore();
  }

  public renderBird(bird: Bird, skinId: (keyof typeof SKINS)) {
    const ctx = this.ctx;
    const skin: SkinDefinition = SKINS[skinId] || SKINS.classic;

    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);

    // Glow effect for cyber/phoenix/midnight
    if (skin.glowColor) {
      ctx.shadowColor = skin.glowColor;
      ctx.shadowBlur = this.reduceEffects ? 0 : 12;
    }

    // Flapping Wing coordinates
    let wingY = 0;
    let wingTilt = 0;
    if (bird.wingFrame === 0) {
      wingY = -5;
      wingTilt = -0.35;
    } else if (bird.wingFrame === 2) {
      wingY = 4;
      wingTilt = 0.35;
    }

    // Custom Image Skin rendering (Gino, Jewel, RJ)
    if (skin.imageUrl) {
      const img = this.getImage(skin.imageUrl);

      // Back wing
      ctx.save();
      ctx.translate(-7, wingY);
      ctx.rotate(wingTilt);
      ctx.fillStyle = skin.wingColor;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Circular clipped photo avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, bird.radius + 1, 0, Math.PI * 2);
      ctx.clip();

      if (img.complete && img.naturalWidth > 0) {
        const minDim = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - minDim) / 2;
        const sy = (img.naturalHeight - minDim) / 4; // slight top bias to frame faces nicely
        ctx.drawImage(
          img,
          sx,
          sy,
          minDim,
          minDim,
          -bird.radius - 1,
          -bird.radius - 1,
          (bird.radius + 1) * 2,
          (bird.radius + 1) * 2
        );
      } else {
        ctx.fillStyle = skin.bodyColor;
        ctx.fill();
      }
      ctx.restore();

      // Shiny border ring
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, bird.radius + 1, 0, Math.PI * 2);
      ctx.stroke();

      // Front Flapping Wing
      ctx.save();
      ctx.translate(-4, wingY);
      ctx.rotate(wingTilt);
      ctx.fillStyle = skin.wingColor;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Cute Beak in front
      ctx.fillStyle = skin.beakColor;
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(10, -2);
      ctx.lineTo(20, 1);
      ctx.lineTo(10, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
      return;
    }

    // 1. Bird Body Outline & Fill
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1e1b4b';

    ctx.fillStyle = skin.bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, bird.radius + 2, bird.radius, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 2. Belly Arc
    ctx.fillStyle = skin.bellyColor;
    ctx.beginPath();
    ctx.ellipse(1, 4, bird.radius - 2, bird.radius - 6, 0, 0, Math.PI);
    ctx.fill();

    // 3. Flapping Wing
    ctx.save();
    ctx.translate(-4, wingY);
    ctx.rotate(wingTilt);
    ctx.fillStyle = skin.wingColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 4. Cute Big Eye
    ctx.shadowBlur = 0; // reset shadow for eye details
    const eyeX = 6;
    const eyeY = -4;
    const eyeRadius = 5.5;

    // Eye background
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pupil
    ctx.fillStyle = skin.eyeColor === '#ffffff' ? '#0f172a' : skin.eyeColor;
    ctx.beginPath();
    ctx.arc(eyeX + 2, eyeY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye catchlight sparkle
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX + 2.5, eyeY - 1, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // 5. Beak
    ctx.fillStyle = skin.beakColor;
    ctx.beginPath();
    ctx.moveTo(11, -2);
    ctx.lineTo(20, 1);
    ctx.lineTo(11, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Beak line
    ctx.beginPath();
    ctx.moveTo(12, 1);
    ctx.lineTo(18, 1);
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 6. Cute Blush or Skin Extras
    if (skin.id === 'classic') {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.beginPath();
      ctx.arc(2, 2, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (skin.id === 'cyber') {
      // Visor accent line
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, -5);
      ctx.lineTo(12, -3);
      ctx.stroke();
    } else if (skin.id === 'phoenix') {
      // Flame crest
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(-6, -12);
      ctx.lineTo(-2, -18);
      ctx.lineTo(2, -12);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  public renderParticles(particles: Particle[]) {
    const ctx = this.ctx;

    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;

      if (p.shape === 'star') {
        ctx.translate(p.x, p.y);
        if (p.rotation) ctx.rotate(p.rotation);
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          ctx.lineTo(Math.cos((i * Math.PI) / 2) * p.size, Math.sin((i * Math.PI) / 2) * p.size);
          ctx.lineTo(
            Math.cos((i * Math.PI) / 2 + Math.PI / 4) * (p.size * 0.35),
            Math.sin((i * Math.PI) / 2 + Math.PI / 4) * (p.size * 0.35)
          );
        }
        ctx.closePath();
        ctx.fill();
      } else if (p.shape === 'feather') {
        ctx.translate(p.x, p.y);
        if (p.rotation) ctx.rotate(p.rotation);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Circle / smoke / spark
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  public renderFlash(alpha: number) {
    if (alpha <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha)})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();
  }
}
