import { clearProjectMemory } from '@/features/projects/clearProjectMemory';

describe('clearProjectMemory', () => {
  it('deletes all projects and clears the resume pointer', async () => {
    const deleteAllProjects = jest.fn().mockResolvedValue(undefined);
    const clearLastProjectId = jest.fn().mockResolvedValue(undefined);

    await clearProjectMemory({ deleteAllProjects, clearLastProjectId });

    expect(deleteAllProjects).toHaveBeenCalledTimes(1);
    expect(clearLastProjectId).toHaveBeenCalledTimes(1);
  });

  it('does not report success when project deletion fails', async () => {
    const error = new Error('delete failed');
    const clearLastProjectId = jest.fn().mockResolvedValue(undefined);

    await expect(
      clearProjectMemory({
        deleteAllProjects: jest.fn().mockRejectedValue(error),
        clearLastProjectId,
      }),
    ).rejects.toBe(error);
    expect(clearLastProjectId).not.toHaveBeenCalled();
  });
});
