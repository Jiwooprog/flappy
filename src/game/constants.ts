import type { Difficulty, DifficultyConfig, BirdSkin, Theme } from './types';
import ginoImg from '../assets/gino.jpg';
import jewelImg from '../assets/jewel.jpg';
import rjImg from '../assets/rj.jpg';

export const CANVAS_WIDTH = 380;
export const CANVAS_HEIGHT = 620;
export const GROUND_HEIGHT = 90;

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  casual: {
    gravity: 1150,
    jumpForce: -380,
    pipeSpeed: 140,
    pipeGap: 160,
    pipeInterval: 250,
    description: 'Gentler gravity & wider gaps. Relaxed flying!',
    badgeColor: '#10b981',
  },
  classic: {
    gravity: 1350,
    jumpForce: -420,
    pipeSpeed: 175,
    pipeGap: 135,
    pipeInterval: 230,
    description: 'The authentic arcade experience. Perfectly balanced.',
    badgeColor: '#f59e0b',
  },
  hardcore: {
    gravity: 1550,
    jumpForce: -460,
    pipeSpeed: 215,
    pipeGap: 115,
    pipeInterval: 210,
    description: 'Narrow gaps & blazing speed. For true masters.',
    badgeColor: '#ef4444',
  },
};

export interface SkinDefinition {
  id: BirdSkin;
  name: string;
  tagline: string;
  bodyColor: string;
  bellyColor: string;
  wingColor: string;
  beakColor: string;
  eyeColor: string;
  glowColor?: string;
  particleColor: string;
  imageUrl?: string;
}

export const SKINS: Record<BirdSkin, SkinDefinition> = {
  classic: {
    id: 'classic',
    name: 'Classic Flyer',
    tagline: 'The iconic golden bird',
    bodyColor: '#facc15',
    bellyColor: '#fef08a',
    wingColor: '#eab308',
    beakColor: '#f97316',
    eyeColor: '#ffffff',
    particleColor: '#fef08a',
  },
  gino: {
    id: 'gino',
    name: 'Gino',
    tagline: 'The fearless sky champ',
    bodyColor: '#3b82f6',
    bellyColor: '#93c5fd',
    wingColor: '#1d4ed8',
    beakColor: '#f59e0b',
    eyeColor: '#ffffff',
    glowColor: 'rgba(59, 130, 246, 0.7)',
    particleColor: '#60a5fa',
    imageUrl: ginoImg,
  },
  jewel: {
    id: 'jewel',
    name: 'Jewel',
    tagline: 'Radiant sparkling star',
    bodyColor: '#ec4899',
    bellyColor: '#fbcfe8',
    wingColor: '#be185d',
    beakColor: '#fbbf24',
    eyeColor: '#ffffff',
    glowColor: 'rgba(236, 72, 153, 0.7)',
    particleColor: '#f472b6',
    imageUrl: jewelImg,
  },
  rj: {
    id: 'rj',
    name: 'RJ',
    tagline: 'High-altitude flight ace',
    bodyColor: '#10b981',
    bellyColor: '#a7f3d0',
    wingColor: '#047857',
    beakColor: '#f97316',
    eyeColor: '#ffffff',
    glowColor: 'rgba(16, 185, 129, 0.7)',
    particleColor: '#34d399',
    imageUrl: rjImg,
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Neon',
    tagline: 'Futuristic synthwave drone',
    bodyColor: '#06b6d4',
    bellyColor: '#67e8f9',
    wingColor: '#3b82f6',
    beakColor: '#f43f5e',
    eyeColor: '#22d3ee',
    glowColor: 'rgba(6, 182, 212, 0.7)',
    particleColor: '#38bdf8',
  },
  phoenix: {
    id: 'phoenix',
    name: 'Solar Phoenix',
    tagline: 'Born from embers and solar flares',
    bodyColor: '#ea580c',
    bellyColor: '#fdba74',
    wingColor: '#c2410c',
    beakColor: '#fbbf24',
    eyeColor: '#fef3c7',
    glowColor: 'rgba(234, 88, 12, 0.6)',
    particleColor: '#f97316',
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Crow',
    tagline: 'Shadow glider of the twilight sky',
    bodyColor: '#312e81',
    bellyColor: '#4f46e5',
    wingColor: '#1e1b4b',
    beakColor: '#a855f7',
    eyeColor: '#ec4899',
    glowColor: 'rgba(168, 85, 247, 0.6)',
    particleColor: '#c084fc',
  },
};

export interface ThemeColors {
  skyTop: string;
  skyBottom: string;
  cloudColor: string;
  citySilhouette: string;
  pipeMain: string;
  pipeHighlight: string;
  pipeShadow: string;
  pipeBorder: string;
  groundSurface: string;
  groundBody: string;
  groundStripe: string;
}

export const THEME_PALETTES: Record<Theme, ThemeColors> = {
  day: {
    skyTop: '#38bdf8',
    skyBottom: '#bae6fd',
    cloudColor: 'rgba(255, 255, 255, 0.85)',
    citySilhouette: '#7dd3fc',
    pipeMain: '#22c55e',
    pipeHighlight: '#86efac',
    pipeShadow: '#15803d',
    pipeBorder: '#14532d',
    groundSurface: '#84cc16',
    groundBody: '#ded895',
    groundStripe: '#d1c97a',
  },
  sunset: {
    skyTop: '#f97316',
    skyBottom: '#fdba74',
    cloudColor: 'rgba(254, 215, 170, 0.75)',
    citySilhouette: '#ea580c',
    pipeMain: '#059669',
    pipeHighlight: '#34d399',
    pipeShadow: '#047857',
    pipeBorder: '#064e3b',
    groundSurface: '#eab308',
    groundBody: '#d97706',
    groundStripe: '#b45309',
  },
  night: {
    skyTop: '#090d16',
    skyBottom: '#1e1b4b',
    cloudColor: 'rgba(99, 102, 241, 0.25)',
    citySilhouette: '#1e293b',
    pipeMain: '#0284c7',
    pipeHighlight: '#38bdf8',
    pipeShadow: '#0369a1',
    pipeBorder: '#082f49',
    groundSurface: '#6366f1',
    groundBody: '#312e81',
    groundStripe: '#1e1b4b',
  },
};
