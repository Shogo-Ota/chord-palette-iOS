import { editorPlaybackRequest, sessionToPlaybackRequest } from '@/features/editor/playback';
import { getSession } from '@/features/editor/session';
import { EDITOR_COUNT_IN } from '@/lib/playback/countIn';

describe('editor playback count-in boundary', () => {
  it('adds the pre-roll only to the normal editor Play action', () => {
    const session = getSession();

    expect(editorPlaybackRequest(session, true).countIn).toEqual(EDITOR_COUNT_IN);
    expect(sessionToPlaybackRequest(session, true).countIn).toBeUndefined();
  });
});
