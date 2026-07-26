import { frameSizeFor } from '@/lib/exportPlan';

describe('frameSizeFor', () => {
  it('keeps the 9:16 frame the app has always encoded', () => {
    expect(frameSizeFor(1920)).toEqual({ width: 1080, height: 1920 });
  });

  it('drops to 720p for the free tier ceiling', () => {
    expect(frameSizeFor(1280)).toEqual({ width: 720, height: 1280 });
  });

  it('keeps both edges even so H.264 can encode them', () => {
    for (const h of [640, 720, 1000, 1280, 1440, 1920]) {
      const { width } = frameSizeFor(h);
      expect({ h, even: width % 2 }).toEqual({ h, even: 0 });
    }
  });
});
