import React from 'react';
import Svg, { Circle, Path, Rect, type SvgProps } from 'react-native-svg';

export type IconName =
  | 'plus'
  | 'chevronDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'gear'
  | 'check'
  | 'dots'
  | 'duplicate'
  | 'trash'
  | 'rewind'
  | 'skipBack'
  | 'skipForward'
  | 'play'
  | 'pause'
  | 'video'
  | 'lock'
  | 'download'
  | 'share'
  | 'close'
  | 'crown'
  | 'save'
  | 'pencil'
  | 'undo'
  | 'loop'
  | 'bookmark';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  /** Stroke width for outline icons. */
  strokeWidth?: number;
} & Omit<SvgProps, 'color'>;

/**
 * Icon set reproduced 1:1 from the Chord Palette mockup SVG paths.
 * Outline icons use fill="none" + stroke; solid icons (play, dots, crown) use fill.
 */
export function Icon({ name, size = 20, color = '#9aa3b5', strokeWidth = 2, ...rest }: Props) {
  const stroke = {
    fill: 'none' as const,
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'plus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M12 5v14M5 12h14" {...stroke} strokeWidth={strokeWidth ?? 2.6} />
        </Svg>
      );
    case 'chevronDown':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M6 9l6 6 6-6" {...stroke} strokeWidth={strokeWidth ?? 2.5} />
        </Svg>
      );
    case 'chevronLeft':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M15 18l-6-6 6-6" {...stroke} strokeWidth={strokeWidth ?? 2.4} />
        </Svg>
      );
    case 'chevronRight':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M9 18l6-6-6-6" {...stroke} strokeWidth={strokeWidth ?? 2.4} />
        </Svg>
      );
    case 'gear':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Circle cx={12} cy={12} r={3.2} {...stroke} />
          <Path
            d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7L5.6 5.6"
            {...stroke}
            strokeLinejoin="miter"
          />
        </Svg>
      );
    case 'check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M20 6L9 17l-5-5" {...stroke} strokeWidth={strokeWidth ?? 3} />
        </Svg>
      );
    case 'dots':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Circle cx={5} cy={12} r={1.8} fill={color} />
          <Circle cx={12} cy={12} r={1.8} fill={color} />
          <Circle cx={19} cy={12} r={1.8} fill={color} />
        </Svg>
      );
    case 'duplicate':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Rect x={8} y={8} width={12} height={12} rx={2.5} {...stroke} strokeLinecap="butt" />
          <Path d="M4 16V6a2 2 0 0 1 2-2h10" {...stroke} strokeLinecap="butt" />
        </Svg>
      );
    case 'trash':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13" {...stroke} />
        </Svg>
      );
    case 'rewind':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M9 14L4 9l5-5" {...stroke} />
          <Path d="M4 9h11a5 5 0 0 1 0 10h-1" {...stroke} />
        </Svg>
      );
    case 'skipBack':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M19 20L9 12l10-8zM5 19V5" {...stroke} />
        </Svg>
      );
    case 'skipForward':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M5 4l10 8-10 8zM19 5v14" {...stroke} />
        </Svg>
      );
    case 'play':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M7 5l13 7-13 7z" fill={color} />
        </Svg>
      );
    case 'pause':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Rect x={6} y={5} width={4} height={14} rx={1} fill={color} />
          <Rect x={14} y={5} width={4} height={14} rx={1} fill={color} />
        </Svg>
      );
    case 'video':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Rect x={2} y={5} width={15} height={14} rx={2.5} {...stroke} strokeLinecap="butt" />
          <Path d="M17 10l5-3v10l-5-3z" {...stroke} strokeLinecap="butt" />
        </Svg>
      );
    case 'lock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Rect x={4} y={10} width={16} height={11} rx={2.5} {...stroke} strokeLinecap="butt" strokeLinejoin="miter" />
          <Path d="M8 10V7a4 4 0 0 1 8 0v3" {...stroke} strokeLinecap="butt" />
        </Svg>
      );
    case 'download':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M12 3v13M7 11l5 5 5-5M5 21h14" {...stroke} />
        </Svg>
      );
    case 'share':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M12 16V3M8 7l4-4 4 4M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" {...stroke} />
        </Svg>
      );
    case 'close':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M6 6l12 12M18 6L6 18" {...stroke} strokeWidth={strokeWidth ?? 2.6} strokeLinejoin="miter" />
        </Svg>
      );
    case 'crown':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M3 8l4 3 5-6 5 6 4-3-1.6 11H4.6z" fill={color} />
          <Rect x={4} y={19.5} width={16} height={2.2} rx={1} fill={color} />
        </Svg>
      );
    case 'save':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path
            d="M5 3h11l3 3v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"
            {...stroke}
            strokeLinecap="butt"
          />
          <Path d="M8 3v6h8V3M8 21v-7h8v7" {...stroke} strokeLinecap="butt" />
        </Svg>
      );
    case 'pencil':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M12 20h9" {...stroke} />
          <Path
            d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
            {...stroke}
            strokeLinecap="butt"
          />
        </Svg>
      );
    case 'undo':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M9 14L4 9l5-5" {...stroke} />
          <Path d="M4 9h10a5 5 0 1 1 0 10h-3" {...stroke} />
        </Svg>
      );
    case 'loop':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M17 1l4 4-4 4" {...stroke} />
          <Path d="M3 11V9a4 4 0 0 1 4-4h14" {...stroke} />
          <Path d="M7 23l-4-4 4-4" {...stroke} />
          <Path d="M21 13v2a4 4 0 0 1-4 4H3" {...stroke} />
        </Svg>
      );
    case 'bookmark':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" {...rest}>
          <Path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" {...stroke} strokeLinecap="butt" />
        </Svg>
      );
    default:
      return null;
  }
}
