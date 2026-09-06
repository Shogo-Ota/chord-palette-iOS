export type VideoVisualStyle = 'classic' | 'pulse' | 'flow';

export interface VideoVisualStyleDefinition {
  id: VideoVisualStyle;
  label: string;
  description: string;
}

export const VIDEO_VISUAL_STYLES = {
  classic: {
    id: 'classic',
    label: 'クラシック',
    description: 'シンプル',
  },
  pulse: {
    id: 'pulse',
    label: 'パルス',
    description: 'リズムと進行を強調',
  },
  flow: {
    id: 'flow',
    label: 'フロー',
    description: 'なめらかな流れ',
  },
} satisfies Record<VideoVisualStyle, VideoVisualStyleDefinition>;

export function isVideoVisualStyle(value: unknown): value is VideoVisualStyle {
  return (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(VIDEO_VISUAL_STYLES, value)
  );
}

export function normalizeVideoVisualStyle(value: unknown): VideoVisualStyle {
  return isVideoVisualStyle(value) ? value : 'classic';
}
