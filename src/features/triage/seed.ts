import {
  collection,
  query,
  where,
  limit,
  getDocs,
  writeBatch,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COL } from './api';
import type {
  TriageContentType,
  TriageStep,
  TriageQuestion,
} from './types';

/**
 * Default sample content for the Triage feature.
 *
 * Seeding strategy: a default-content fallback. The first time a company opens
 * the Triage page with no categories, `ensureTriageSeed` writes a curated set
 * of sample categories, content items, responsible persons (contacts) and quick
 * assessments in a single batch so the screens are never empty on first load.
 *
 * It is idempotent — it checks for an existing category before writing and is
 * guarded per-company in-memory so it only runs once per session.
 */

interface SampleCategory {
  key: string;
  title: string;
  icon: string;
  color: string;
  desc: string;
  pinned: boolean;
  content: SampleContent[];
}

interface SampleContent {
  type: TriageContentType;
  title: string;
  meta: string;
  intro?: string;
  steps?: TriageStep[];
  body?: string[];
  note?: string;
}

interface SampleContact {
  name: string;
  role: string;
  dept: string;
  phone: string;
  level: 'normal' | 'emergency';
}

interface SampleAssessment {
  title: string;
  cat: string;
  passMark: number;
  questions: TriageQuestion[];
}

const SAMPLE_CATEGORIES: SampleCategory[] = [
  {
    key: 'safety',
    title: 'Safety',
    icon: '🦺',
    color: '#ef4444',
    desc: 'Plant safety rules, PPE and emergency response',
    pinned: true,
    content: [
      {
        type: 'guide',
        title: 'Personal Protective Equipment (PPE) Checklist',
        meta: 'Guide · 2 min read',
        body: [
          'Wear safety shoes inside all production areas at all times.',
          'Use ear protection in zones marked above 85 dB.',
          'Safety glasses are mandatory near grinding, cutting or compressed air.',
          'Cut-resistant gloves required when handling blades or sheet metal.',
          'Tie back long hair and remove loose clothing near rotating parts.',
        ],
      },
      {
        type: 'procedure',
        title: 'Lockout / Tagout (LOTO) Before Maintenance',
        meta: 'Procedure · 5 steps',
        intro: 'Always isolate energy before opening guards or reaching into a machine.',
        steps: [
          { t: 'Notify', d: 'Inform the operator and supervisor that the machine is going down.' },
          { t: 'Shut down', d: 'Stop the machine using the normal stop sequence.' },
          { t: 'Isolate', d: 'Switch the main isolator to OFF and bleed any stored pressure.' },
          { t: 'Lock & tag', d: 'Apply your personal padlock and tag to the isolator.' },
          { t: 'Verify zero energy', d: 'Attempt a start to confirm the machine cannot run.' },
        ],
        note: 'Never remove another person\'s lock. One lock, one key, one person.',
      },
    ],
  },
  {
    key: 'autonomous_maintenance',
    title: 'Autonomous Maintenance',
    icon: '🧰',
    color: '#22c55e',
    desc: 'Operator-led cleaning, inspection and lubrication (CIL)',
    pinned: false,
    content: [
      {
        type: 'procedure',
        title: 'Daily CIL Routine (Clean · Inspect · Lubricate)',
        meta: 'Procedure · 4 steps',
        intro: 'Performed by the operator at the start of each shift (~10 minutes).',
        steps: [
          { t: 'Clean', d: 'Wipe down guards, sensors and contact surfaces. Remove debris and product build-up.' },
          { t: 'Inspect', d: 'Look for leaks, loose bolts, frayed belts and abnormal wear while cleaning.' },
          { t: 'Lubricate', d: 'Apply lubricant to marked points per the lubrication chart.' },
          { t: 'Report', d: 'Log any abnormality found on the AM tag board for the technician.' },
        ],
        note: 'Cleaning is inspection — most defects are first spotted during cleaning.',
      },
      {
        type: 'guide',
        title: 'How to Read Abnormality Tags',
        meta: 'Guide · 1 min read',
        body: [
          'Red tag: defect the operator cannot fix — needs maintenance.',
          'White/blue tag: defect the operator can fix during the shift.',
          'Record machine, location and date on every tag.',
          'Close out tags at the weekly AM review meeting.',
        ],
      },
    ],
  },
  {
    key: 'machine_operation',
    title: 'Machine Operation Procedures',
    icon: '⚙️',
    color: '#3b82f6',
    desc: 'Start-up to shift-end shutdown procedures',
    pinned: true,
    content: [
      {
        type: 'procedure',
        title: 'Machine Start-Up Procedure',
        meta: 'Procedure · 5 steps',
        intro: 'Follow in order at the beginning of every shift.',
        steps: [
          { t: 'Pre-start check', d: 'Confirm guards are in place, area is clear and no LOTO locks remain.' },
          { t: 'Power on', d: 'Switch the main isolator ON and wait for the control panel to boot.' },
          { t: 'Air & coolant', d: 'Open compressed air and confirm coolant level is within range.' },
          { t: 'Warm-up', d: 'Run the machine empty at low speed for the warm-up period.' },
          { t: 'Confirm ready', d: 'Check no alarms are active, then load the first job.' },
        ],
        note: 'Do not bypass any safety interlock to start the machine.',
      },
      {
        type: 'procedure',
        title: 'Shift-End Shutdown Procedure',
        meta: 'Procedure · 5 steps',
        intro: 'Follow in order before leaving the machine at the end of the shift.',
        steps: [
          { t: 'Finish job', d: 'Complete the current cycle — never stop mid-cycle if avoidable.' },
          { t: 'Unload', d: 'Remove product, tooling and scrap from the work area.' },
          { t: 'Clean down', d: 'Wipe surfaces and clear chips/debris (links to the CIL routine).' },
          { t: 'Stop & isolate', d: 'Use the normal stop sequence, then switch the isolator OFF.' },
          { t: 'Handover', d: 'Record output, downtime and any issues in the shift log.' },
        ],
        note: 'Report any abnormal noise or vibration noticed during the shift at handover.',
      },
    ],
  },
  {
    key: 'breakdowns',
    title: 'Breakdowns',
    icon: '🚨',
    color: '#f97316',
    desc: 'What to do when a machine stops unexpectedly',
    pinned: false,
    content: [
      {
        type: 'procedure',
        title: 'First Response to a Breakdown',
        meta: 'Procedure · 4 steps',
        intro: 'Stay calm. Make the situation safe before troubleshooting.',
        steps: [
          { t: 'Make safe', d: 'Hit emergency stop if there is any danger to people or equipment.' },
          { t: 'Assess', d: 'Note the alarm/error code and what the machine was doing when it stopped.' },
          { t: 'Raise ticket', d: 'Log a breakdown ticket with machine ID and a short description.' },
          { t: 'Escalate', d: 'Call the responsible technician/supervisor if it cannot be cleared quickly.' },
        ],
        note: 'Do not force or override a jammed mechanism — you may cause injury or further damage.',
      },
    ],
  },
  {
    key: 'maintenance',
    title: 'Maintenance',
    icon: '🔧',
    color: '#a78bfa',
    desc: 'Planned and preventive maintenance references',
    pinned: false,
    content: [
      {
        type: 'guide',
        title: 'Preventive Maintenance Basics',
        meta: 'Guide · 2 min read',
        body: [
          'PM is scheduled work done to prevent failures, not fix them.',
          'Follow the PM checklist for the specific machine and interval.',
          'Replace consumables (filters, belts, seals) by run-hours, not by failure.',
          'Record readings (temperature, vibration, pressure) to spot trends early.',
        ],
      },
      {
        type: 'procedure',
        title: 'Belt Tension Check & Adjust',
        meta: 'Procedure · 3 steps',
        intro: 'Machine must be isolated (LOTO) before opening the guard.',
        steps: [
          { t: 'Inspect', d: 'Check the belt for cracks, glazing and fraying. Replace if worn.' },
          { t: 'Measure', d: 'Press the belt midspan; deflection should match the spec on the chart.' },
          { t: 'Adjust', d: 'Move the tensioner to spec, then re-tighten the mounting bolts.' },
        ],
        note: 'Over-tensioning damages bearings; under-tensioning causes slip and heat.',
      },
    ],
  },
  {
    key: 'quality',
    title: 'Quality & Defects',
    icon: '🔍',
    color: '#fbbf24',
    desc: 'Identifying defects and stopping bad product early',
    pinned: false,
    content: [
      {
        type: 'guide',
        title: 'Common Defect Quick-Reference',
        meta: 'Guide · 1 min read',
        body: [
          'Stop the line if you see a repeating defect — do not pass it downstream.',
          'Quarantine suspect product and label it clearly.',
          'Record the defect type, time and machine for traceability.',
          'Inform the supervisor before restarting production.',
        ],
      },
    ],
  },
  {
    key: 'environment',
    title: 'Environment & Housekeeping',
    icon: '♻️',
    color: '#22c55e',
    desc: '5S, spill response and waste handling',
    pinned: false,
    content: [
      {
        type: 'guide',
        title: '5S Workplace Standard',
        meta: 'Guide · 1 min read',
        body: [
          'Sort: remove items not needed at the station.',
          'Set in order: a place for everything, everything in its place.',
          'Shine: clean as part of the daily routine.',
          'Standardize: make the first 3S the visible norm.',
          'Sustain: audit and keep the standard alive.',
        ],
      },
    ],
  },
];

const SAMPLE_CONTACTS: SampleContact[] = [
  { name: 'Nimal Perera', role: 'Shift Supervisor', dept: 'Production', phone: '+94 77 123 4567', level: 'normal' },
  { name: 'Kasun Silva', role: 'Maintenance Technician', dept: 'Engineering', phone: '+94 71 234 5678', level: 'normal' },
  { name: 'Priya Fernando', role: 'Plant Manager', dept: 'Operations', phone: '+94 76 345 6789', level: 'normal' },
  { name: 'Emergency / First Aid', role: 'Safety Officer', dept: 'EHS', phone: '+94 70 999 0000', level: 'emergency' },
  { name: 'Fire & Evacuation', role: 'Security Desk', dept: 'Facilities', phone: '+94 70 111 2222', level: 'emergency' },
];

const SAMPLE_ASSESSMENTS: SampleAssessment[] = [
  {
    title: 'Safety & LOTO Basics',
    cat: 'Safety',
    passMark: 80,
    questions: [
      {
        q: 'When must you apply Lockout/Tagout?',
        opts: ['Only at night', 'Before opening guards or reaching into a machine', 'After the job is finished', 'Never'],
        a: 1,
      },
      {
        q: 'Whose lock can you remove from an isolator?',
        opts: ['Anyone\'s', 'Only your own', 'The supervisor\'s', 'The oldest one'],
        a: 1,
      },
      {
        q: 'PPE near grinding/cutting must include:',
        opts: ['Sandals', 'Safety glasses', 'No gloves', 'Loose sleeves'],
        a: 1,
      },
    ],
  },
  {
    title: 'Machine Start-Up & Shutdown',
    cat: 'Machine Operation Procedures',
    passMark: 75,
    questions: [
      {
        q: 'What is the first step of the start-up procedure?',
        opts: ['Load a job', 'Pre-start safety check', 'Open coolant', 'Call the supervisor'],
        a: 1,
      },
      {
        q: 'At shift end you should:',
        opts: ['Leave the machine running', 'Stop, isolate and complete handover', 'Skip cleaning', 'Remove guards'],
        a: 1,
      },
    ],
  },
];

// In-memory guard so we only attempt the seed once per company per session.
const seededCompanies = new Set<string>();

export async function ensureTriageSeed(companyId: string, uid: string): Promise<void> {
  if (!companyId || !uid) return;
  if (seededCompanies.has(companyId)) return;
  seededCompanies.add(companyId);

  // Idempotency: skip if this company already has any triage category.
  const existing = await getDocs(
    query(
      collection(db, COL.categories),
      where('companyId', '==', companyId),
      limit(1),
    ),
  );
  if (!existing.empty) return;

  const batch = writeBatch(db);
  const meta = {
    companyId,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  SAMPLE_CATEGORIES.forEach((cat, ci) => {
    const catRef = doc(collection(db, COL.categories));
    batch.set(catRef, {
      title: cat.title,
      icon: cat.icon,
      color: cat.color,
      desc: cat.desc,
      pinned: cat.pinned,
      order: ci,
      ...meta,
    });

    cat.content.forEach((item, ii) => {
      const itemRef = doc(collection(db, COL.content));
      // Build a clean payload without undefined fields (Firestore rejects undefined).
      const payload: Record<string, unknown> = {
        categoryId: catRef.id,
        type: item.type,
        title: item.title,
        meta: item.meta,
        order: ii,
        ...meta,
      };
      if (item.intro !== undefined) payload.intro = item.intro;
      if (item.steps !== undefined) payload.steps = item.steps;
      if (item.body !== undefined) payload.body = item.body;
      if (item.note !== undefined) payload.note = item.note;
      batch.set(itemRef, payload);
    });
  });

  SAMPLE_CONTACTS.forEach((c) => {
    const ref = doc(collection(db, COL.contacts));
    batch.set(ref, { ...c, ...meta });
  });

  SAMPLE_ASSESSMENTS.forEach((a) => {
    const ref = doc(collection(db, COL.assessments));
    batch.set(ref, {
      title: a.title,
      cat: a.cat,
      passMark: a.passMark,
      status: 'open',
      questions: a.questions,
      ...meta,
    });
  });

  await batch.commit();
}
