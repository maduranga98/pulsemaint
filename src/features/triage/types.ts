import type { Timestamp } from 'firebase/firestore';

export interface TriageCategory {
  id: string;
  companyId: string;
  title: string;
  icon: string;
  color: string;
  desc: string;
  pinned: boolean;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface TriageStep {
  t: string;
  d: string;
}

export type TriageContentType = 'procedure' | 'guide' | 'video' | 'pdf';

export interface TriageContentItem {
  id: string;
  companyId: string;
  categoryId: string;
  type: TriageContentType;
  title: string;
  meta: string;
  order: number;
  intro?: string;
  steps?: TriageStep[];
  note?: string;
  body?: string[];
  videoId?: string;
  fileUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface TriageContact {
  id: string;
  companyId: string;
  name: string;
  role: string;
  dept: string;
  phone: string;
  level: 'normal' | 'emergency';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface TriageQuestion {
  q: string;
  opts: string[];
  a: number;
}

export interface TriageAssessment {
  id: string;
  companyId: string;
  title: string;
  cat: string;
  passMark: number;
  status: 'open' | 'archived';
  questions: TriageQuestion[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface TriageAssessmentResult {
  id: string;
  companyId: string;
  userId: string;
  assessmentId: string;
  score: number;
  total: number;
  passed: boolean;
  completedAt: Timestamp;
}

export interface AITriageResponse {
  summary: string;
  likelyCauses: string[];
  checkNow: string[];
  safeActions: string[];
  doNot: string[];
  basedOn: string;
}
