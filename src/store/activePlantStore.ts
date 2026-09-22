import { create } from 'zustand';

// Admin-only "viewing as plant" selector. Every other role is locked to its
// own registered plant (see useDepartmentScope) and never touches this
// store. `null` means "All plants" — admin's default, company-wide view;
// picking a plant here is what the plant-tab switcher in AppLayout writes,
// and what useDepartmentScope reads back for the admin role so every module
// that already honors department/plant scoping picks it up automatically.
interface ActivePlantState {
  activePlantId: string | null;
  setActivePlant: (plantId: string | null) => void;
}

const STORAGE_KEY = 'firmicore:activePlantId';

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(plantId: string | null) {
  try {
    if (plantId) localStorage.setItem(STORAGE_KEY, plantId);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private browsing / blocked storage — the in-memory store still works
    // for this session, it just won't survive a reload.
  }
}

export const useActivePlantStore = create<ActivePlantState>((set) => ({
  activePlantId: readStored(),
  setActivePlant: (plantId) => {
    writeStored(plantId);
    set({ activePlantId: plantId });
  },
}));
