import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuthStore } from '../../../store/authStore';
import type { UserProfile } from '../../../types/auth';
import type { Machine } from '../../../types/machine';
import type {
  AuditCategory,
  AuditTemplate,
  AuditSession,
} from '../types/audit.types';
import {
  subscribeTemplates,
  subscribeSessions,
  ensureDefaultTemplates,
} from '../services/audit.service';

export function usePlantId(): string | undefined {
  return useAuthStore((s) => s.userProfile?.companyId);
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function useAuditTemplates(): { templates: AuditTemplate[]; loading: boolean; error: string | null } {
  const plantId = usePlantId();
  const [templates, setTemplates] = useState<AuditTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plantId) return;
    let unsub = () => {};
    setLoading(true);
    ensureDefaultTemplates(plantId)
      .catch((e) => setError(e.message))
      .finally(() => {
        unsub = subscribeTemplates(
          plantId,
          (data) => {
            setTemplates(data);
            setLoading(false);
          },
          (e) => {
            setError(e.message);
            setLoading(false);
          },
        );
      });
    return () => unsub();
  }, [plantId]);

  return { templates, loading, error };
}

// ─── Sessions / History ─────────────────────────────────────────────────────

export function useAuditSessions(filters: {
  category?: AuditCategory;
  department?: string;
  machineId?: string;
} = {}): { sessions: AuditSession[]; loading: boolean; error: string | null } {
  const plantId = usePlantId();
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plantId) return;
    setLoading(true);
    const unsub = subscribeSessions(
      plantId,
      filters,
      (data) => {
        setSessions(data);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [plantId, filters.category, filters.department, filters.machineId]);

  return { sessions, loading, error };
}

// ─── Machines (for selection field) ───────────────────────────────────────────

export function useAuditMachines(): { machines: Machine[]; loading: boolean } {
  const plantId = usePlantId();
  const siteId = useAuthStore((s) => s.userProfile?.siteIds?.[0]) ?? plantId;
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    setLoading(true);
    const q = query(
      collection(db, 'machines'),
      where('siteId', '==', siteId),
      orderBy('name'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMachines(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Machine)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [siteId]);

  return { machines, loading };
}

// ─── Users (for participant selection) ─────────────────────────────────────────

export function useAuditUsers(): { users: UserProfile[]; loading: boolean } {
  const plantId = usePlantId();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!plantId) return;
    setLoading(true);
    const q = query(
      collection(db, `companies/${plantId}/users`),
      where('status', '==', 'active'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserProfile)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [plantId]);

  return { users, loading };
}
