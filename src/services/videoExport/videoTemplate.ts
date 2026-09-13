import type { VideoTemplateId } from '@/lib/videoExport/comparison';

export function normalizeVideoTemplateId(value: unknown): VideoTemplateId {
  return value === 'compare' ? 'compare' : 'standard';
}
