/**
 * The people of one plant, for pickers that assign work to named employees
 * (audit participants, evaluation subjects, training and safety-training
 * assignees …). Users live under their company (`companies/{id}/users`), so
 * only the plant needs filtering here — `null` means "not plant-scoped" (an
 * admin on All Plants) and returns everyone in the company.
 */
export function usersInPlant<T extends { plantId?: string | null }>(users: T[], plantId: string | null): T[] {
  return plantId ? users.filter((u) => u.plantId === plantId) : users;
}
