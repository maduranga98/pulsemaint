import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Make sure each named department exists in the given plant, creating any
 * that don't (case-insensitive match, so "Assembly" and "assembly" are the
 * same department). Departments are a sub-category of a plant — the same
 * name in another plant is a separate department and is never touched.
 *
 * Called wherever a department is entered alongside a plant (machines, shift
 * plans, user import) so every department in use shows up in that plant's
 * department list. Best-effort: a failure here never blocks the save that
 * triggered it.
 */
export async function ensureDepartments(
  companyId: string | null | undefined,
  plantId: string | null | undefined,
  names: Array<string | null | undefined>,
): Promise<void> {
  if (!companyId || !plantId) return;
  const wanted = new Map<string, string>();
  names.forEach((n) => {
    const trimmed = (n ?? '').trim();
    if (trimmed) wanted.set(trimmed.toLowerCase(), trimmed);
  });
  if (wanted.size === 0) return;
  try {
    const snap = await getDocs(
      query(collection(db, 'departments'), where('companyId', '==', companyId), where('plantId', '==', plantId)),
    );
    const existing = new Set(snap.docs.map((d) => String(d.data().name ?? '').trim().toLowerCase()));
    const missing = [...wanted.entries()].filter(([key]) => !existing.has(key)).map(([, name]) => name);
    await Promise.all(
      missing.map((name) =>
        addDoc(collection(db, 'departments'), { companyId, plantId, name, createdAt: serverTimestamp() }),
      ),
    );
  } catch (err) {
    console.error('Failed to register departments for plant', err);
  }
}
