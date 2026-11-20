// Aquarium starting points and lighting presets.

// decor: [type, nx (-1..1 across the tank), z (-12 back .. 6 front), scale, rotation, hue]
export const TEMPLATES = {
  reef: {
    name: 'Coral reef', blurb: 'Bright, sunny and full of coral', swatch: ['#22b5c9', '#efe2bd', '#ff6f91'],
    env: { waterColor: '#22b5c9', deepColor: '#04456e', lightColor: '#fff6e0', lightIntensity: 1.1, clarity: 0.6, caustics: 1.1, rays: 0.8, bubbles: 0.3, specks: 0.6, floorType: 0, floorColorA: '#efe2bd', floorColorB: '#d6c294', glow: 0, disco: false },
    decor: [
      ['boulder', -0.8, -9, 1.4, 0.3, 0], ['branchcoral', -0.62, -6, 1.3, 0, 0], ['seafan', -0.42, -10, 1.6, 0.2, 0],
      ['braincoral', -0.25, -4, 0.9, 0, 0], ['anemone', -0.05, -1, 1.0, 0, 0], ['tablecoral', 0.2, -8, 1.2, 0, 0],
      ['branchcoral', 0.38, -3, 1.0, 1, 1.5], ['tubesponge', 0.55, -7, 1.2, 0, 0], ['rock', 0.7, -2, 1.2, 1.2, 0],
      ['anemone', 0.82, -6, 0.9, 0, 2.5], ['seaweed', -0.9, -3, 1.0, 0, 0], ['starfish', 0.12, 2.5, 0.8, 0.5, 0],
      ['shell', -0.35, 3, 0.8, 0.3, 0], ['seaweed', 0.95, -10, 1.3, 0, 0], ['branchcoral', 0.05, -11, 1.5, 0, 4],
      ['pebbles', 0.45, 2, 1, 0, 0],
    ],
    creatures: [['clownfish', 2], ['bluetang', 1], ['angelfish', 1], ['crab', 1], ['seahorse', 1]],
  },
  planted: {
    name: 'Freshwater garden', blurb: 'A calm planted tank with tiny tetras', swatch: ['#79b896', '#3b2f25', '#5fae3a'],
    env: { waterColor: '#7fc0a0', deepColor: '#163f33', lightColor: '#fff8e8', lightIntensity: 1.0, clarity: 0.7, caustics: 0.8, rays: 0.6, bubbles: 0.2, specks: 0.8, floorType: 2, floorColorA: '#3a2c20', floorColorB: '#8a7a66', glow: 0, disco: false },
    decor: [
      ['grass', -0.8, 1, 1.2, 0, 0], ['grass', -0.4, 2, 1.0, 0, 0], ['grass', 0.1, 3, 1.1, 0, 0], ['grass', 0.6, 1.5, 1.2, 0, 0],
      ['sword', -0.6, -5, 1.4, 0, 0], ['sword', 0.45, -8, 1.6, 0.4, 0], ['redplant', -0.2, -9, 1.3, 0, 0], ['redplant', 0.8, -6, 1.2, 0, 0],
      ['driftwood', 0.05, -4, 1.1, 0.25, 0], ['rock', -0.35, -2, 1.0, 0, 0], ['rock', 0.3, -1, 0.7, 1, 0], ['mossball', -0.05, 1, 1, 0, 0],
      ['seaweed', -0.9, -9, 1.5, 0, 0], ['seaweed', 0.95, -10, 1.6, 0, 0.3], ['bubbler', 0.7, -1, 1, 0, 0], ['pebbles', -0.7, 3, 1, 0, 0],
    ],
    creatures: [['neon', 1], ['goldfish', 1], ['angelfish', 1], ['snail', 1]],
  },
  kelp: {
    name: 'Kelp forest', blurb: 'Tall swaying kelp in cool water', swatch: ['#3f8e94', '#8a8a80', '#a9a53a'],
    env: { waterColor: '#4a9a9a', deepColor: '#0b2e38', lightColor: '#f2fbff', lightIntensity: 0.95, clarity: 0.45, caustics: 0.9, rays: 1.0, bubbles: 0.2, specks: 1.0, floorType: 1, floorColorA: '#6e6a62', floorColorB: '#a8a294', glow: 0, disco: false },
    decor: [
      ['kelp', -0.75, -9, 1.0, 0, 0], ['kelp', -0.4, -6, 1.0, 1, 0], ['kelp', 0.0, -11, 1.1, 2, 0], ['kelp', 0.35, -7, 0.95, 3, 0], ['kelp', 0.75, -10, 1.05, 4, 0],
      ['kelp', 0.9, -4, 0.9, 5, 0], ['boulder', -0.55, -3, 1.0, 0, 0], ['rock', 0.2, -2, 1.3, 0.5, 0], ['rock', 0.6, 1, 0.9, 1, 0],
      ['starfish', -0.2, 2, 1, 0, 0], ['starfish', 0.4, 3, 0.8, 1, 1.5], ['anemone', -0.85, 0, 0.9, 0, 3], ['arch', 0.05, -5, 1.1, 0.2, 0],
    ],
    creatures: [['turtle', 1], ['goldfish', 1], ['bluetang', 1], ['crab', 1]],
  },
  wreck: {
    name: 'Sunken treasure', blurb: 'A shipwreck, gold and mystery', swatch: ['#3d7f86', '#b9a888', '#ffd04a'],
    env: { waterColor: '#3a8088', deepColor: '#082a33', lightColor: '#e8fff4', lightIntensity: 0.85, clarity: 0.4, caustics: 0.9, rays: 0.9, bubbles: 0.3, specks: 1.0, floorType: 0, floorColorA: '#b9a888', floorColorB: '#8f7f62', glow: 0, disco: false },
    decor: [
      ['shipwreck', -0.25, -9, 1.2, 0.35, 0], ['chest', 0.35, -1, 1.0, -0.4, 0], ['anchor', 0.7, -5, 1.1, 0.3, 0],
      ['amphora', -0.6, 1, 0.9, 0.5, 0], ['column', 0.55, -10, 1.2, 0, 0], ['helmet', -0.75, -4, 0.9, 0.6, 0],
      ['seaweed', -0.9, -7, 1.2, 0, 0], ['seaweed', 0.9, -2, 1.0, 0, 0.4], ['rock', 0.1, -4, 1.0, 0, 0], ['rock', -0.45, -2, 0.7, 1, 0],
      ['pebbles', 0.05, 2.5, 1, 0, 0], ['anemone', 0.95, -9, 0.8, 0, 1],
    ],
    creatures: [['shark', 1], ['puffer', 1], ['crab', 1], ['diver', 1]],
  },
  deep: {
    name: 'Deep sea glow', blurb: 'Dark water and glowing things', swatch: ['#0f2a5a', '#2a2a40', '#3ad6ff'],
    env: { waterColor: '#14306a', deepColor: '#01040c', lightColor: '#7f9cff', lightIntensity: 0.3, clarity: 0.55, caustics: 0.3, rays: 0.25, bubbles: 0.3, specks: 1.0, floorType: 1, floorColorA: '#2e2e3e', floorColorB: '#4e4e66', glow: 0.8, disco: false },
    decor: [
      ['crystal', -0.6, -5, 1.3, 0, 0], ['crystal', 0.5, -8, 1.6, 1, 2], ['mushroom', -0.15, -2, 1.2, 0, 0], ['mushroom', 0.75, 0, 1, 0, 2.2],
      ['boulder', -0.85, -9, 1.3, 0, 0], ['rock', 0.2, -10, 1.6, 0, 0], ['anemone', 0.25, -3, 1.0, 0, 3.6], ['volcano', -0.4, -10, 1.0, 0, 0],
      ['seafan', 0.9, -6, 1.3, 0, 2], ['crystal', -0.9, 1, 0.9, 0, 4],
    ],
    creatures: [['jelly', 3], ['shark', 1], ['puffer', 1]],
  },
  candy: {
    name: 'Candy castle', blurb: 'Pink water, rainbow pebbles, a castle!', swatch: ['#ff9ad5', '#b78cff', '#ffd23a'],
    env: { waterColor: '#ff9fd8', deepColor: '#4a2a8a', lightColor: '#fff0fb', lightIntensity: 1.05, clarity: 0.65, caustics: 1.0, rays: 0.8, bubbles: 0.6, specks: 0.5, floorType: 3, floorColorA: '#ffffff', floorColorB: '#ffd0f0', glow: 0.2, disco: false },
    decor: [
      ['castle', 0.05, -7, 1.3, 0, 0], ['crystal', -0.55, -4, 1.2, 0, 0], ['crystal', 0.6, -3, 1.0, 0, 2.5], ['mushroom', -0.8, 0, 1.2, 0, 1],
      ['mushroom', 0.85, -8, 1.3, 0, 4], ['branchcoral', -0.35, -10, 1.3, 0, 2.2], ['branchcoral', 0.45, -10, 1.2, 0, 4.2], ['bubbler', -0.15, 1, 1, 0, 0],
      ['bubbler', 0.3, 0.5, 1, 0, 0], ['shell', 0.2, 3, 1, 0, 0], ['starfish', -0.4, 2.5, 1, 0, 3], ['anemone', 0.95, 0, 0.9, 0, 4.5],
    ],
    creatures: [['goldfish', 1], ['puffer', 1], ['jelly', 2], ['seahorse', 1], ['clownfish', 1]],
  },
  empty: {
    name: 'Empty tank', blurb: 'Start from scratch', swatch: ['#2aa7c4', '#e6d4a6', '#ffffff'],
    env: { waterColor: '#2aa7c4', deepColor: '#073e66', lightColor: '#fff4dc', lightIntensity: 1, clarity: 0.6, caustics: 1, rays: 0.7, bubbles: 0.2, specks: 0.6, floorType: 0, floorColorA: '#e6d4a6', floorColorB: '#c2a777', glow: 0, disco: false },
    decor: [],
    creatures: [],
  },
};

export const LIGHTS = {
  sunny: { name: 'Sunny day', icon: '☀️', set: { lightColor: '#fff6e0', lightIntensity: 1.1, rays: 0.8, caustics: 1.1, glow: 0, disco: false } },
  morning: { name: 'Morning', icon: '🌤️', set: { lightColor: '#ffe6c0', lightIntensity: 0.85, rays: 1.0, caustics: 0.9, glow: 0, disco: false } },
  sunset: { name: 'Sunset', icon: '🌅', set: { lightColor: '#ff9f62', lightIntensity: 0.7, rays: 0.9, caustics: 0.8, glow: 0.1, disco: false } },
  night: { name: 'Moonlight', icon: '🌙', set: { lightColor: '#8fb0ff', lightIntensity: 0.28, rays: 0.2, caustics: 0.45, glow: 0.4, disco: false } },
  glow: { name: 'Glow party', icon: '✨', set: { lightColor: '#7a6cff', lightIntensity: 0.14, rays: 0.0, caustics: 0.25, glow: 1.0, disco: false } },
  disco: { name: 'Disco', icon: '🎉', set: { lightColor: '#ffffff', lightIntensity: 0.9, rays: 1.0, caustics: 1.0, glow: 0.3, disco: true } },
};

export const WATER_SWATCHES = [
  ['#22b5c9', '#04456e'], ['#1f7fc4', '#062a5a'], ['#3fd0c0', '#0a4a52'], ['#7fc0a0', '#163f33'],
  ['#5a8a78', '#10261f'], ['#14306a', '#01040c'], ['#ff9fd8', '#4a2a8a'], ['#9b86ff', '#1e1050'],
  ['#ffcf70', '#6a3a10'], ['#e8f4ff', '#3a5a7a'],
];

export const FLOORS = [
  { type: 0, name: 'Sand', a: '#efe2bd', b: '#d6c294' },
  { type: 0, name: 'Dark sand', a: '#8f7f62', b: '#5e5240' },
  { type: 1, name: 'Gravel', a: '#6e6a62', b: '#a8a294' },
  { type: 2, name: 'Soil', a: '#3a2c20', b: '#8a7a66' },
  { type: 3, name: 'Rainbow', a: '#ffffff', b: '#ffd0f0' },
  { type: 1, name: 'Black stones', a: '#1e1e24', b: '#4a4a56' },
];
