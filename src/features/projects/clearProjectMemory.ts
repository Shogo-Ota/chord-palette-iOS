import { deleteAllProjects } from '@/repositories/projectRepository';
import { clearLastProjectId } from '@/repositories/sessionPrefsRepository';

export type ClearProjectMemoryDependencies = {
  deleteAllProjects: () => Promise<void>;
  clearLastProjectId: () => Promise<void>;
};

const defaultDependencies: ClearProjectMemoryDependencies = {
  deleteAllProjects,
  clearLastProjectId,
};

/**
 * Clear the Memory list and its resume pointer as one feature-level operation.
 * The repository deliberately leaves the first-launch seed marker untouched.
 */
export async function clearProjectMemory(
  dependencies: ClearProjectMemoryDependencies = defaultDependencies,
): Promise<void> {
  await dependencies.deleteAllProjects();
  await dependencies.clearLastProjectId();
}
