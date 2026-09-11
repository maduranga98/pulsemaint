import type { Timestamp } from 'firebase/firestore';

// A plant is the top-level physical-site grouping above the existing
// department separation (breakdowns/machines/WOs/WPs stay department-scoped
// within a plant — this does not change that rule). Every company can have
// multiple plants; non-admin roles are scoped to the plant(s) they are
// registered under.

export interface PlantLocation {
  /** Formatted address as returned by Google Places (or typed manually as a fallback). */
  formattedAddress: string;
  lat: number | null;
  lng: number | null;
  /** Google Places place_id, when the location was picked from the map search. */
  placeId: string | null;
}

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
  /** @deprecated superseded by `location.formattedAddress`; kept for older docs. */
  address: string | null;
  location: PlantLocation | null;
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
  location?: PlantLocation | null;
  contactPerson?: PlantContactPerson | null;
}

export interface UpdatePlantPayload {
  name?: string;
  code?: string | null;
  location?: PlantLocation | null;
  contactPerson?: PlantContactPerson | null;
  status?: 'active' | 'inactive';
}
