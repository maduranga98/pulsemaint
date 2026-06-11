import type { Timestamp } from 'firebase/firestore';

export interface ConditionReading {
  id: string;
  machineId: string;
  siteId: string;
  parameter: string;
  value: number;
  unit: string;
  min: number | null;
  max: number | null;
  takenBy: string;
  takenByName: string;
  takenAt: Timestamp;
}

export interface ConditionReadingDraft {
  parameter: string;
  value: number | '';
  unit: string;
  min: number | '';
  max: number | '';
}
