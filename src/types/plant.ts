import type { Timestamp } from 'firebase/firestore';

// A plant is the top-level physical-site grouping above the existing
// department separation (breakdowns/machines/WOs/WPs stay department-scoped
// within a plant — this does not change that rule). Every company can have
// multiple plants; non-admin roles are scoped to the plant(s) they are
// registered under.

export interface PlantContactPerson {
  name: string;
  phone: string | null;
  email: string | null;
  designation: string | null;
}

export interface Plant {
  id: string;
  companyId: string;
  name: string;
  code: string | null;
  address: string | null;
  contactPerson: PlantContactPerson | null;
  status: 'active' | 'inactive';
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface CreatePlantPayload {
  name: string;
  code?: string | null;
  address?: string | null;
  contactPerson?: PlantContactPerson | null;
}

export interface UpdatePlantPayload {
  name?: string;
  code?: string | null;
  address?: string | null;
  contactPerson?: PlantContactPerson | null;
  status?: 'active' | 'inactive';
}
