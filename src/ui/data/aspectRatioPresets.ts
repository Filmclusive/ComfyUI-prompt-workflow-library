export type AspectRatioPreset = {
  id: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
  description?: string;
};

export const ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [
  { id: "16x9-1024", ratio: "16:9", width: 1024, height: 576, label: "16:9 · 1024 × 576", description: "Standard HD" },
  { id: "16x9-1536", ratio: "16:9", width: 1536, height: 864, label: "16:9 · 1536 × 864", description: "Mid-weight 2K" },
  { id: "16x9-2048", ratio: "16:9", width: 2048, height: 1152, label: "16:9 · 2048 × 1152", description: "Crisper 2K" },
  { id: "4x3-1280", ratio: "4:3", width: 1280, height: 960, label: "4:3 · 1280 × 960", description: "Legacy DSLR" },
  { id: "3x2-1536", ratio: "3:2", width: 1536, height: 1024, label: "3:2 · 1536 × 1024", description: "Digital SLR" },
  { id: "2x1-1600", ratio: "2:1", width: 1600, height: 800, label: "2:1 · 1600 × 800", description: "Wide cinema" },
  { id: "1x1-1024", ratio: "1:1", width: 1024, height: 1024, label: "1:1 · 1024 × 1024", description: "Square" },
  { id: "9x16-720", ratio: "9:16", width: 720, height: 1280, label: "9:16 · 720 × 1280", description: "Vertical (phone)" },
  { id: "4x5-1280", ratio: "4:5", width: 1280, height: 1600, label: "4:5 · 1280 × 1600", description: "Portrait" },
  { id: "21x9-2560", ratio: "21:9", width: 2560, height: 1080, label: "21:9 · 2560 × 1080", description: "Ultra wide" },
];

export function findAspectRatioPresetByDimensions(
  width?: number,
  height?: number,
): AspectRatioPreset | undefined {
  if (width == null || height == null) return undefined;
  return ASPECT_RATIO_PRESETS.find(
    (preset) => preset.width === width && preset.height === height,
  );
}
