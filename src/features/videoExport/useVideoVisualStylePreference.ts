import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getVideoVisualStylePreference,
  setVideoVisualStylePreference,
} from '@/repositories/videoVisualStylePreferenceRepository';
import { track } from '@/services/analytics';
import type { VideoVisualStyle } from '@/services/videoExport/videoVisualStyle';

export type VideoVisualStylePreferenceDependencies = {
  load(): Promise<VideoVisualStyle>;
  save(visualStyle: VideoVisualStyle): Promise<void>;
  trackSelection(visualStyle: VideoVisualStyle): void;
};

const DEFAULT_DEPENDENCIES: VideoVisualStylePreferenceDependencies = {
  load: getVideoVisualStylePreference,
  save: setVideoVisualStylePreference,
  trackSelection: (visualStyle) => {
    track('video_style_selected', { visualStyle });
  },
};

export type VideoVisualStylePreferenceController = {
  visualStyle: VideoVisualStyle;
  selectVisualStyle(visualStyle: VideoVisualStyle): void;
};

export function useVideoVisualStylePreference(
  dependencies: VideoVisualStylePreferenceDependencies = DEFAULT_DEPENDENCIES,
): VideoVisualStylePreferenceController {
  const [visualStyle, setVisualStyle] = useState<VideoVisualStyle>('classic');
  const selectedByUser = useRef(false);
  const latestSave = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let active = true;

    dependencies
      .load()
      .then((storedStyle) => {
        if (active && !selectedByUser.current) {
          setVisualStyle(storedStyle);
        }
      })
      .catch(() => {
        if (active && !selectedByUser.current) {
          setVisualStyle('classic');
        }
      });

    return () => {
      active = false;
      mounted.current = false;
    };
  }, [dependencies]);

  const selectVisualStyle = useCallback(
    (nextStyle: VideoVisualStyle) => {
      selectedByUser.current = true;
      const saveId = latestSave.current + 1;
      latestSave.current = saveId;
      setVisualStyle(nextStyle);
      dependencies.trackSelection(nextStyle);

      void dependencies.save(nextStyle).catch(() => {
        if (mounted.current && latestSave.current === saveId) {
          setVisualStyle('classic');
        }
      });
    },
    [dependencies],
  );

  return { visualStyle, selectVisualStyle };
}
