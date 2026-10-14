import type { Bird, Pipe, Particle, DifficultyConfig } from './types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, GROUND_HEIGHT } from './constants';

export const BIRD_START_X = 90;
export const BIRD_START_Y = 270;
export const BIRD_RADIUS = 14;
export const PIPE_WIDTH = 58;
export const PIPE_LIP_HEIGHT = 24;
export const PIPE_LIP_OVERHANG = 4;

export function createInitialBird(): Bird {
  return {
    x: BIRD_START_X,
    y: BIRD_START_Y,
    vy: 0,
    rotation: 0,
    radius: BIRD_RADIUS,
    wingFrame: 0,
    wingTimer: 0,
  };
}

export function flapBird(bird: Bird, jumpForce: number): Bird {
  return {
    ...bird,
    vy: jumpForce,
    rotation: -0.45, // approx -25 degrees
    wingTimer: 0,
  };
}

export function updateBirdPhysics(bird: Bird, dt: number, gravity: number): void {
  // Apply gravity
  bird.vy += gravity * dt;

  // Cap terminal velocity
  if (bird.vy > 680) {
    bird.vy = 680;
  }

  // Position update
  bird.y += bird.vy * dt;

  // Rotation interpolation:
  // If falling, smoothly rotate down towards +75 deg (~1.3 rad)
  if (bird.vy > 100) {
    const targetRot = Math.min(Math.PI / 2.2, (bird.vy - 100) / 400 * (Math.PI / 2.2));
    bird.rotation += (targetRot - bird.rotation) * Math.min(1, 8 * dt);
  } else {
    // Easing from upward tilt
    bird.rotation += (-0.45 - bird.rotation) * Math.min(1, 10 * dt);
  }

  // Wing animation
  bird.wingTimer += dt * 14;
  bird.wingFrame = Math.floor(bird.wingTimer) % 4;
}

export function createPipe(x: number, gap: number, pipeId: number): Pipe {
  const playAreaHeight = CANVAS_HEIGHT - GROUND_HEIGHT;
  const minTopHeight = 65;
  const maxTopHeight = playAreaHeight - gap - 65;
  const topHeight = Math.floor(minTopHeight + Math.random() * (maxTopHeight - minTopHeight));

  return {
    id: pipeId,
    x,
    topHeight,
    bottomY: topHeight + gap,
    width: PIPE_WIDTH,
    passed: false,
  };
}

export function updatePipesList(
  pipes: Pipe[],
  dt: number,
  config: DifficultyConfig,
  lastPipeIdRef: { current: number },
  onScore: () => void,
  birdX: number
): Pipe[] {
  const updatedPipes: Pipe[] = [];

  for (const pipe of pipes) {
    const newX = pipe.x - config.pipeSpeed * dt;
    let passed = pipe.passed;

    // Check if bird passed the pipe center
    if (!passed && birdX > newX + pipe.width / 2) {
      passed = true;
      onScore();
    }

    // Keep if still visible on screen
    if (newX + pipe.width + 10 > 0) {
      updatedPipes.push({
        ...pipe,
        x: newX,
        passed,
      });
    }
  }

  // Determine if we need to spawn a new pipe
  if (updatedPipes.length === 0) {
    lastPipeIdRef.current += 1;
    updatedPipes.push(createPipe(CANVAS_WIDTH + 30, config.pipeGap, lastPipeIdRef.current));
  } else {
    const rightmostPipe = updatedPipes.reduce((prev, curr) => (curr.x > prev.x ? curr : prev));
    if (rightmostPipe.x <= CANVAS_WIDTH - config.pipeInterval) {
      lastPipeIdRef.current += 1;
      updatedPipes.push(createPipe(CANVAS_WIDTH + 10, config.pipeGap, lastPipeIdRef.current));
    }
  }

  return updatedPipes;
}

// Circle vs Axis-Aligned Bounding Box (AABB) with gentle grace inset
function circleIntersectsRect(
  cx: number,
  cy: number,
  cr: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  // 3px grace threshold so near-brushes don't feel unfair
  const effectiveRadius = Math.max(2, cr - 3);

  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));

  const distanceX = cx - closestX;
  const distanceY = cy - closestY;

  return distanceX * distanceX + distanceY * distanceY < effectiveRadius * effectiveRadius;
}

export function checkCollision(bird: Bird, pipes: Pipe[]): boolean {
  // Ground collision
  if (bird.y + bird.radius >= CANVAS_HEIGHT - GROUND_HEIGHT) {
    return true;
  }

  // Ceiling collision
  if (bird.y - bird.radius <= 0) {
    return true;
  }

  // Pipe collisions
  for (const pipe of pipes) {
    // Only check if pipe is close to bird horizontally
    if (pipe.x - 20 > bird.x + bird.radius || pipe.x + pipe.width + 20 < bird.x - bird.radius) {
      continue;
    }

    // Upper pipe body
    if (circleIntersectsRect(bird.x, bird.y, bird.radius, pipe.x, 0, pipe.width, pipe.topHeight - PIPE_LIP_HEIGHT)) {
      return true;
    }

    // Upper pipe lip cap
    if (
      circleIntersectsRect(
        bird.x,
        bird.y,
        bird.radius,
        pipe.x - PIPE_LIP_OVERHANG,
        pipe.topHeight - PIPE_LIP_HEIGHT,
        pipe.width + PIPE_LIP_OVERHANG * 2,
        PIPE_LIP_HEIGHT
      )
    ) {
      return true;
    }

    // Lower pipe lip cap
    if (
      circleIntersectsRect(
        bird.x,
        bird.y,
        bird.radius,
        pipe.x - PIPE_LIP_OVERHANG,
        pipe.bottomY,
        pipe.width + PIPE_LIP_OVERHANG * 2,
        PIPE_LIP_HEIGHT
      )
    ) {
      return true;
    }

    // Lower pipe body
    const lowerBodyY = pipe.bottomY + PIPE_LIP_HEIGHT;
    const lowerBodyH = CANVAS_HEIGHT - GROUND_HEIGHT - lowerBodyY;
    if (circleIntersectsRect(bird.x, bird.y, bird.radius, pipe.x, lowerBodyY, pipe.width, lowerBodyH)) {
      return true;
    }
  }

  return false;
}

export function updateParticles(particles: Particle[], dt: number): Particle[] {
  const result: Particle[] = [];

  for (const p of particles) {
    p.life -= dt;
    if (p.life <= 0) continue;

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.alpha = Math.max(0, p.life / p.maxLife);

    if (p.shape === 'feather') {
      p.vy += 80 * dt; // gentle gravity on feathers
      if (p.rotation !== undefined && p.rotSpeed !== undefined) {
        p.rotation += p.rotSpeed * dt;
      }
    } else if (p.shape === 'smoke') {
      p.size += 15 * dt; // smoke expands
    }

    result.push(p);
  }

  return result;
}

export function createFlapParticles(bird: Bird, color: string): Particle[] {
  const count = 4;
  const newParticles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const angle = Math.PI * 0.75 + Math.random() * Math.PI * 0.5; // blast backwards and slightly down
    const speed = 40 + Math.random() * 80;
    newParticles.push({
      x: bird.x - 12 + (Math.random() * 6 - 3),
      y: bird.y + 6 + (Math.random() * 6 - 3),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      size: 3 + Math.random() * 3,
      alpha: 0.9,
      life: 0.35 + Math.random() * 0.2,
      maxLife: 0.5,
      shape: Math.random() > 0.5 ? 'smoke' : 'feather',
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 6,
    });
  }

  return newParticles;
}

export function createScoreParticles(x: number, y: number): Particle[] {
  const count = 12;
  const newParticles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.2 - 0.1);
    const speed = 70 + Math.random() * 110;
    newParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: Math.random() > 0.4 ? '#facc15' : '#ffffff',
      size: 3.5 + Math.random() * 3,
      alpha: 1,
      life: 0.55 + Math.random() * 0.25,
      maxLife: 0.8,
      shape: 'star',
      rotation: Math.random() * Math.PI,
      rotSpeed: (Math.random() - 0.5) * 10,
    });
  }

  return newParticles;
}

export function createImpactParticles(bird: Bird, skinColor: string): Particle[] {
  const count = 20;
  const newParticles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 160;
    newParticles.push({
      x: bird.x,
      y: bird.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: Math.random() > 0.5 ? skinColor : '#ffffff',
      size: 4 + Math.random() * 4,
      alpha: 1,
      life: 0.6 + Math.random() * 0.4,
      maxLife: 1.0,
      shape: Math.random() > 0.6 ? 'feather' : 'spark',
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 12,
    });
  }

  return newParticles;
}
