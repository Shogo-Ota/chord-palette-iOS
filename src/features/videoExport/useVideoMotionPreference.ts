import { useCallback, useEffect, useState } from 'react';

import type { VideoMotionPreference } from '@/lib/videoExport/comparison';
import {
  getVideoMotionPreference,
  setVideoMotionPreference,
} from '@/repositories/videoMotionPreferenceRepository';

export function useVideoMotionPreference(enabled = true) {
  const [motion, setMotion] = useState<VideoMotionPreference>('standard');

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void getVideoMotionPreference()
      .then((value) => {
        if (active) setMotion(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [enabled]);

  const selectMotion = useCallback((value: VideoMotionPreference) => {
    setMotion(value);
    void setVideoMotionPreference(value).catch(() => {
      setMotion('standard');
    });
  }, []);

  return { motion, selectMotion };
}
