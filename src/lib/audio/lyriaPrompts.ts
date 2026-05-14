// Mood presets keyed off SceneTemplate.location. Used by `npm run music`
// to derive Lyria weighted-prompt sets without per-template hand-tuning.
//
// Each preset is a list of weighted prompts. Lyria treats higher weights
// as stronger pulls. Keep total under ~5 prompts and weights in [0.3, 1.5].

export interface WeightedPrompt {
  text: string;
  weight: number;
}

export interface MusicConfig {
  bpm?: number;
  density?: number;     // 0..1, sparser → denser
  brightness?: number;  // 0..1, darker → brighter
  temperature?: number; // 0..3, default ~1.1
}

export interface MoodPreset {
  prompts: WeightedPrompt[];
  config?: MusicConfig;
}

const PRESETS: Record<string, MoodPreset> = {
  bookshop: {
    prompts: [
      { text: "quiet jazz trio", weight: 1.0 },
      { text: "soft brushed drums", weight: 0.8 },
      { text: "warm upright piano", weight: 0.9 },
      { text: "vinyl crackle, low volume", weight: 0.5 },
    ],
    config: { bpm: 78, density: 0.35, brightness: 0.45 },
  },
  cafe: {
    prompts: [
      { text: "downtempo chillhop, mellow", weight: 1.0 },
      { text: "warm rhodes electric piano", weight: 0.9 },
      { text: "soft brushed drums", weight: 0.6 },
      { text: "muted upright bass", weight: 0.5 },
    ],
    config: { bpm: 82, density: 0.45, brightness: 0.4 },
  },
  minshuku: {
    prompts: [
      { text: "ambient Japanese folk", weight: 1.0 },
      { text: "soft koto, gentle plucks", weight: 0.9 },
      { text: "shakuhachi, breathy and slow", weight: 0.6 },
      { text: "rain on shoji paper", weight: 0.4 },
    ],
    config: { bpm: 60, density: 0.25, brightness: 0.4 },
  },
  shrine: {
    prompts: [
      { text: "meditative shakuhachi", weight: 1.0 },
      { text: "wooden temple bell, distant", weight: 0.7 },
      { text: "wind through cedar trees", weight: 0.5 },
      { text: "drone, low pad", weight: 0.6 },
    ],
    config: { bpm: 52, density: 0.2, brightness: 0.35 },
  },
  station: {
    prompts: [
      { text: "minimal ambient electronic", weight: 1.0 },
      { text: "soft synth pads", weight: 0.8 },
      { text: "distant city hum", weight: 0.5 },
    ],
    config: { bpm: 90, density: 0.5, brightness: 0.6 },
  },
  town_outskirts: {
    prompts: [
      { text: "late-night ambient, contemplative", weight: 1.0 },
      { text: "warm analog synth pad", weight: 0.8 },
      { text: "cricket field, distant", weight: 0.5 },
      { text: "slow muted bass pulse", weight: 0.6 },
    ],
    config: { bpm: 68, density: 0.3, brightness: 0.4 },
  },
  meadow: {
    prompts: [
      { text: "soft pastoral ambient, late afternoon", weight: 1.0 },
      { text: "warm sustained strings, distant", weight: 0.8 },
      { text: "wind through tall grass", weight: 0.5 },
      { text: "gentle felt piano, sparse", weight: 0.7 },
    ],
    config: { bpm: 56, density: 0.22, brightness: 0.55 },
  },
};

const FALLBACK: MoodPreset = {
  prompts: [
    { text: "ambient cinematic", weight: 1.0 },
    { text: "warm pad", weight: 0.7 },
  ],
  config: { bpm: 70, density: 0.3, brightness: 0.5 },
};

export function presetForLocation(location: string): MoodPreset {
  return PRESETS[location] ?? FALLBACK;
}

export function listPresetLocations(): string[] {
  return Object.keys(PRESETS);
}
