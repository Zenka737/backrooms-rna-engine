/**
 * Backrooms Level Definitions
 * Each level defines atmosphere, colors, fog, and wall appearance
 */

function hexToRgb(hex, a = 1) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function shadeColor(r, g, b, shade) {
  return `rgb(${Math.floor(r*shade)},${Math.floor(g*shade)},${Math.floor(b*shade)})`;
}

export const LEVELS = [
  {
    id: 0,
    name: 'Level 0 — The Lobby',
    description: 'Damp carpet, mono-yellow fluorescent light. The smell of moist concrete and old glue.',
    mapSize: { w: 64, h: 64 },
    fogDistance: 10,
    flickerRate: 0.04,
    vignetteStrength: 0.55,
    showSanity: true,
    ambientBrightness: 0.9,

    ceilingColorTop:    '#1a1400',
    ceilingColorBottom: '#2e2200',
    floorColorTop:      '#3a2e00',
    floorColorBottom:   '#1a1400',

    wallPalette: {
      1: [180, 155, 60],   // main wall: yellow wallpaper
      2: [100, 90, 40],    // pillar: darker
      3: [60, 50, 20],
    },

    getWallColor(type, wallX, shade) {
      const [r, g, b] = this.wallPalette[type] || [180, 155, 60];
      // Stripe texture
      const stripe = Math.sin(wallX * 8) > 0.7 ? 0.85 : 1.0;
      return shadeColor(r * stripe, g * stripe, b * stripe, shade);
    },

    entities: [],
    nextLevel: 1,
  },

  {
    id: 1,
    name: 'Level 1 — Fluorescent Hum',
    description: 'Concrete warehouses. Fluorescent tubes hum and flicker. Cardboard boxes everywhere.',
    mapSize: { w: 80, h: 80 },
    fogDistance: 13,
    flickerRate: 0.06,
    vignetteStrength: 0.65,
    showSanity: true,
    ambientBrightness: 0.75,

    ceilingColorTop:    '#0a0a0f',
    ceilingColorBottom: '#15151a',
    floorColorTop:      '#1a1a20',
    floorColorBottom:   '#0a0a0f',

    wallPalette: {
      1: [130, 130, 140],  // grey concrete
      2: [90, 90, 100],
      3: [160, 140, 80],   // cardboard box
    },

    getWallColor(type, wallX, shade) {
      const [r, g, b] = this.wallPalette[type] || [130, 130, 140];
      // Concrete crack texture
      const crack = Math.abs(Math.sin(wallX * 19.3)) < 0.03 ? 0.6 : 1.0;
      return shadeColor(r * crack, g * crack, b * crack, shade);
    },

    entities: [],
    nextLevel: 2,
  },

  {
    id: 2,
    name: 'Level 2 — Pipe Maintenance',
    description: 'Dark maintenance tunnels. Distant metallic banging. Dripping water. Do not linger.',
    mapSize: { w: 72, h: 72 },
    fogDistance: 7,
    flickerRate: 0.12,
    vignetteStrength: 0.8,
    showSanity: true,
    ambientBrightness: 0.5,

    ceilingColorTop:    '#000000',
    ceilingColorBottom: '#050508',
    floorColorTop:      '#080810',
    floorColorBottom:   '#000000',

    wallPalette: {
      1: [60, 60, 70],    // dark concrete
      2: [40, 40, 50],
      3: [80, 60, 40],    // rust pipe
    },

    getWallColor(type, wallX, shade) {
      const [r, g, b] = this.wallPalette[type] || [60, 60, 70];
      // Rust/grime streaks
      const grime = Math.sin(wallX * 5.7 + 1.3) * 0.15 + 0.85;
      return shadeColor(r * grime, g * grime, b * grime, shade);
    },

    entities: [],
    nextLevel: 0, // loops back
  },
];

export function getLevelDef(id) {
  return LEVELS.find(l => l.id === id) || LEVELS[0];
}
