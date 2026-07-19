import { AUTOSAVE_DEBOUNCE_MS, createAutosaveScheduler } from '@/features/editor/useAutosave';

describe('createAutosaveScheduler', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('saves once after the debounce window when dirty', () => {
    const save = jest.fn();
    const scheduler = createAutosaveScheduler(save, 700);

    scheduler.schedule(true);
    expect(save).not.toHaveBeenCalled();

    jest.advanceTimersByTime(699);
    expect(save).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('debounces rapid edits into a single save', () => {
    const save = jest.fn();
    const scheduler = createAutosaveScheduler(save, 700);

    scheduler.schedule(true);
    jest.advanceTimersByTime(400);
    scheduler.schedule(true); // edit within the window → restart timer
    jest.advanceTimersByTime(400);
    expect(save).not.toHaveBeenCalled(); // 800ms total, but only 400ms since last edit

    jest.advanceTimersByTime(300);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does not save when not dirty and cancels any pending save', () => {
    const save = jest.fn();
    const scheduler = createAutosaveScheduler(save, 700);

    scheduler.schedule(true);
    scheduler.schedule(false); // e.g. save completed → dirty cleared
    jest.advanceTimersByTime(1000);
    expect(save).not.toHaveBeenCalled();
  });

  it('cancel() prevents a pending save from firing', () => {
    const save = jest.fn();
    const scheduler = createAutosaveScheduler(save, 700);

    scheduler.schedule(true);
    scheduler.cancel();
    jest.advanceTimersByTime(1000);
    expect(save).not.toHaveBeenCalled();
  });

  it('defaults to the 700ms window', () => {
    const save = jest.fn();
    const scheduler = createAutosaveScheduler(save);

    scheduler.schedule(true);
    jest.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 1);
    expect(save).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
