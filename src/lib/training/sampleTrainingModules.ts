import { nanoid } from 'nanoid';
import type { LessonItem, TrainingModule, TrainingQuiz, TraineeTrainingType } from './trainingTypes';

/** Default training period for every sample trainee module (6 months), per
 * the same preset model used by the Trainee Programme duration picker
 * (`src/lib/traineeProgram/programmeDuration.ts` — DurationPreset 6 | 12 | 'custom'). */
export const SAMPLE_MODULE_DEFAULT_TRAINING_PERIOD_MONTHS = 6;

type SampleModule = Pick<
  TrainingModule,
  'title' | 'description' | 'machineName' | 'estimatedMinutes' | 'passingScore' | 'language' | 'tags' | 'trainingType' | 'defaultTrainingPeriodMonths'
> & {
  lessons: LessonItem[];
  /** Practice quiz — stored on TrainingModule.practiceQuiz, does not gate completion. */
  quiz: TrainingQuiz;
  /** Final test — stored on TrainingModule.quiz, gates completion/certificate. */
  finalTest: TrainingQuiz;
};

function lesson(order: number, title: string, description: string, type: LessonItem['type'] = 'text'): LessonItem {
  return {
    id: nanoid(),
    order,
    title,
    type,
    contentUrl: '',
    thumbnailUrl: '',
    description,
    durationSeconds: 300,
    pageCount: 0,
    isRequired: true,
    subtitleUrl: '',
  };
}

function quiz(
  title: string,
  questions: { text: string; options: string[]; correctIndex: number }[],
  isFinalTest = false,
): TrainingQuiz {
  return {
    id: nanoid(),
    title,
    instructions: isFinalTest
      ? 'Final test: answer every question. A passing score is required to complete this module and receive your certificate.'
      : 'Practice quiz: answer every question to check your understanding before the final test.',
    timeLimit: isFinalTest ? 30 : 15,
    maxAttempts: isFinalTest ? 3 : 5,
    passingScore: 70,
    shuffleQuestions: false,
    shuffleOptions: false,
    isFinalTest,
    questions: questions.map((q, i) => ({
      id: nanoid(),
      order: i + 1,
      text: q.text,
      type: 'single_choice',
      imageUrl: '',
      points: 1,
      explanation: '',
      options: q.options.map((text, oi) => ({
        id: nanoid(),
        text,
        isCorrect: oi === q.correctIndex,
        explanation: '',
      })),
    })),
  };
}

/**
 * Starter content so a new company isn't staring at an empty training
 * library. Loaded on demand via "Load Sample Modules" rather than seeded
 * automatically, since companies may already have their own content.
 *
 * Six trade-specific trainee modules, one per `TraineeTrainingType`
 * (see trainingTypes.ts), each with a few realistic lessons, a practice
 * quiz, and a final test. All default to a 6-month training period when
 * assigned via the Trainee Management assignment flow (Task 2/5).
 */
export function sampleTrainingModules(): SampleModule[] {
  const trainingType = (t: TraineeTrainingType) => t;

  return [
    {
      title: 'Electrical Trainee Orientation',
      description: 'Foundational electrical safety and workshop practice for incoming electrical trainees.',
      machineName: 'General / Electrical Panels',
      estimatedMinutes: 40,
      passingScore: 80,
      language: 'en',
      tags: ['electrical', 'trainee', 'safety'],
      trainingType: trainingType('electrical_trainee'),
      defaultTrainingPeriodMonths: SAMPLE_MODULE_DEFAULT_TRAINING_PERIOD_MONTHS,
      lessons: [
        lesson(1, 'Electrical Hazard Awareness', 'Recognizing shock, arc-flash, and short-circuit hazards around live panels and wiring.'),
        lesson(2, 'Lockout-Tagout for Electrical Circuits', 'Isolating and verifying zero-energy state before working on electrical equipment.'),
        lesson(3, 'Reading Single-Line & Wiring Diagrams', 'How to interpret basic single-line diagrams, schematics, and panel labeling.', 'image_gallery'),
        lesson(4, 'Multimeter & Test Equipment Basics', 'Safe use of a multimeter to check voltage, continuity, and resistance.', 'video'),
      ],
      quiz: quiz('Electrical Trainee Practice Quiz', [
        { text: 'What must be verified before touching a de-energized circuit?', options: ['That the breaker is off', 'Zero energy state using a tested meter', 'That a coworker said it is safe', 'Nothing, if it looks off'], correctIndex: 1 },
        { text: 'What is arc-flash?', options: ['A type of lighting fixture', 'A dangerous release of energy from an electrical fault', 'A wiring diagram symbol', 'A brand of multimeter'], correctIndex: 1 },
      ]),
      finalTest: quiz('Electrical Trainee Final Test', [
        { text: 'Before servicing a panel, the correct first step is to:', options: ['Remove the cover', 'Apply lockout-tagout and verify zero energy', 'Ask a supervisor after starting work', 'Test with bare hands'], correctIndex: 1 },
        { text: 'A single-line diagram is primarily used to:', options: ['Show plumbing routes', 'Represent the electrical distribution system simply', 'List spare parts', 'Track work orders'], correctIndex: 1 },
        { text: 'A multimeter set to continuity mode is used to check:', options: ['Room temperature', 'Whether a circuit path is unbroken', 'Oil pressure', 'Machine vibration'], correctIndex: 1 },
      ], true),
    },
    {
      title: 'Mechanical Trainee Orientation',
      description: 'Core mechanical maintenance skills: lubrication, alignment, and hand-tool safety for new mechanical trainees.',
      machineName: 'General / Rotating Equipment',
      estimatedMinutes: 40,
      passingScore: 80,
      language: 'en',
      tags: ['mechanical', 'trainee', 'maintenance'],
      trainingType: trainingType('mechanical_trainee'),
      defaultTrainingPeriodMonths: SAMPLE_MODULE_DEFAULT_TRAINING_PERIOD_MONTHS,
      lessons: [
        lesson(1, 'Hand & Power Tool Safety', 'Safe use, inspection, and storage of wrenches, torque tools, and power tools.'),
        lesson(2, 'Lubrication Fundamentals', 'Grease vs. oil, lubrication schedules, and avoiding over-greasing bearings.'),
        lesson(3, 'Shaft Alignment & Coupling Basics', 'Why misalignment causes vibration and premature bearing failure.', 'image_gallery'),
        lesson(4, 'Belt & Chain Drive Maintenance', 'Tensioning, wear inspection, and safe guarding of belt/chain drives.', 'video'),
      ],
      quiz: quiz('Mechanical Trainee Practice Quiz', [
        { text: 'Over-greasing a bearing can cause:', options: ['Better performance', 'Overheating and seal damage', 'No effect', 'Longer bearing life always'], correctIndex: 1 },
        { text: 'What commonly causes premature bearing failure?', options: ['Correct alignment', 'Shaft misalignment', 'Regular lubrication', 'Clean work area'], correctIndex: 1 },
      ]),
      finalTest: quiz('Mechanical Trainee Final Test', [
        { text: 'Before using a power tool, you should:', options: ['Skip inspection to save time', 'Inspect it for damage and confirm guards are in place', 'Remove the guard for better visibility', 'Use it regardless of condition'], correctIndex: 1 },
        { text: 'A loose drive belt typically causes:', options: ['Improved efficiency', 'Slippage and reduced power transfer', 'No noticeable effect', 'Lower vibration'], correctIndex: 1 },
        { text: 'Shaft alignment is checked primarily to prevent:', options: ['Paint wear', 'Vibration and bearing/coupling damage', 'Electrical faults', 'Software errors'], correctIndex: 1 },
      ], true),
    },
    {
      title: 'HR Trainee Orientation',
      description: 'Introduction to HR processes, employee records, and workplace policy for HR trainees.',
      machineName: 'N/A',
      estimatedMinutes: 35,
      passingScore: 80,
      language: 'en',
      tags: ['hr', 'trainee', 'orientation'],
      trainingType: trainingType('hr_trainee'),
      defaultTrainingPeriodMonths: SAMPLE_MODULE_DEFAULT_TRAINING_PERIOD_MONTHS,
      lessons: [
        lesson(1, 'Employee Records & Confidentiality', 'Handling personnel files, data privacy, and access-control expectations.'),
        lesson(2, 'Onboarding & Documentation', 'Steps in new-hire onboarding: contracts, ID issuance, and induction scheduling.'),
        lesson(3, 'Workplace Policy & Code of Conduct', 'Attendance, leave policy, grievance handling, and disciplinary procedure basics.'),
        lesson(4, 'Communicating with Employees', 'Professional tone and escalation paths for HR-related employee queries.', 'document'),
      ],
      quiz: quiz('HR Trainee Practice Quiz', [
        { text: 'Employee personnel files should be:', options: ['Shared openly with all staff', 'Kept confidential and access-restricted', 'Posted on a public board', 'Discarded after a year'], correctIndex: 1 },
        { text: 'A grievance raised by an employee should be:', options: ['Ignored', 'Logged and routed through the proper escalation process', 'Handled informally with no record', 'Denied automatically'], correctIndex: 1 },
      ]),
      finalTest: quiz('HR Trainee Final Test', [
        { text: 'When onboarding a new hire, HR should first:', options: ['Skip documentation', 'Prepare the contract and required documentation', 'Assign a machine', 'Schedule a performance review'], correctIndex: 1 },
        { text: 'Confidential employee data should be accessed by:', options: ['Anyone in the company', 'Only authorized HR personnel', 'External vendors freely', 'The public'], correctIndex: 1 },
        { text: 'The code of conduct primarily exists to:', options: ['Increase paperwork', 'Set clear behavioral and disciplinary expectations', 'Replace safety training', 'Track machine health'], correctIndex: 1 },
      ], true),
    },
    {
      title: 'Civil Trainee Orientation',
      description: 'Site safety, structural basics, and material handling for civil/facilities trainees.',
      machineName: 'General / Site & Structures',
      estimatedMinutes: 40,
      passingScore: 80,
      language: 'en',
      tags: ['civil', 'trainee', 'site-safety'],
      trainingType: trainingType('civil_trainee'),
      defaultTrainingPeriodMonths: SAMPLE_MODULE_DEFAULT_TRAINING_PERIOD_MONTHS,
      lessons: [
        lesson(1, 'Site Safety & PPE Requirements', 'Hard hats, high-visibility gear, and site access control rules.'),
        lesson(2, 'Reading Structural & Site Drawings', 'Interpreting basic civil/structural drawings and site layout plans.', 'image_gallery'),
        lesson(3, 'Material Handling & Storage', 'Safe stacking, storage, and handling of construction materials on site.'),
        lesson(4, 'Working at Height Basics', 'Scaffolding checks, fall protection, and permit requirements.', 'video'),
      ],
      quiz: quiz('Civil Trainee Practice Quiz', [
        { text: 'Before working at height, you must:', options: ['Skip the permit', 'Confirm fall protection and required permits are in place', 'Remove guardrails for access', 'Work alone without checks'], correctIndex: 1 },
        { text: 'PPE on a civil work site typically includes:', options: ['Sandals and casual clothing', 'Hard hat and high-visibility clothing', 'No protective gear needed', 'Only sunglasses'], correctIndex: 1 },
      ]),
      finalTest: quiz('Civil Trainee Final Test', [
        { text: 'Improperly stacked materials on site can lead to:', options: ['Improved safety', 'Collapse and injury hazards', 'No risk at all', 'Faster construction only'], correctIndex: 1 },
        { text: 'A structural drawing is used to:', options: ['Track payroll', 'Communicate design and dimensions to the site team', 'Replace safety training', 'Log breakdowns'], correctIndex: 1 },
        { text: 'Scaffolding should be inspected:', options: ['Never', 'Before use and at regular intervals', 'Only after a complaint', 'Only by untrained staff'], correctIndex: 1 },
      ], true),
    },
    {
      title: 'Technician Trainee Orientation',
      description: 'Fault-finding fundamentals, work order discipline, and tool care for technician trainees.',
      machineName: 'General / All Machines',
      estimatedMinutes: 45,
      passingScore: 80,
      language: 'en',
      tags: ['technician', 'trainee', 'maintenance'],
      trainingType: trainingType('technician_trainee'),
      defaultTrainingPeriodMonths: SAMPLE_MODULE_DEFAULT_TRAINING_PERIOD_MONTHS,
      lessons: [
        lesson(1, 'Work Order Discipline', 'Logging breakdowns, updating status, and closing out work orders correctly.'),
        lesson(2, 'Basic Fault-Finding Method', 'Symptom, isolate, test, verify — a structured approach to troubleshooting.'),
        lesson(3, 'Using the Triage / Knowledge Base', 'Finding known fixes and root-cause guidance before escalating.', 'document'),
        lesson(4, 'Tool Care & Calibration Awareness', 'Keeping test equipment calibrated and hand tools in good condition.', 'video'),
      ],
      quiz: quiz('Technician Trainee Practice Quiz', [
        { text: 'Before closing a work order, a technician should:', options: ['Leave it blank', 'Confirm the fix and document the resolution', 'Delete the record', 'Reassign it randomly'], correctIndex: 1 },
        { text: 'A structured fault-finding approach starts with:', options: ['Replacing random parts', 'Understanding the reported symptom', 'Ignoring the complaint', 'Skipping to a full teardown'], correctIndex: 1 },
      ]),
      finalTest: quiz('Technician Trainee Final Test', [
        { text: 'The triage/knowledge base is used to:', options: ['Track attendance', 'Find known fixes and guidance for a fault', 'Approve purchase orders', 'Schedule shifts'], correctIndex: 1 },
        { text: 'Calibration of test equipment matters because:', options: ['It looks professional only', 'Inaccurate readings can lead to wrong diagnoses', 'It is not important', 'It replaces training'], correctIndex: 1 },
        { text: 'A work order should be updated:', options: ['Only at month end', 'As status changes, so records stay accurate', 'Never', 'Only when asked twice'], correctIndex: 1 },
      ], true),
    },
    {
      title: 'Operator Trainee Orientation',
      description: 'Safe machine operation, pre-start checks, and shift handover practice for floor operator trainees.',
      machineName: 'General / Production Floor',
      estimatedMinutes: 35,
      passingScore: 80,
      language: 'en',
      tags: ['operator', 'trainee', 'orientation'],
      trainingType: trainingType('operator_trainee'),
      defaultTrainingPeriodMonths: SAMPLE_MODULE_DEFAULT_TRAINING_PERIOD_MONTHS,
      lessons: [
        lesson(1, 'Pre-Start Machine Checks', 'Daily checklist before starting any production machine.'),
        lesson(2, 'Safe Operating Procedures', 'Standard operating limits, guarding, and when to stop and call for help.'),
        lesson(3, 'Reporting Breakdowns', 'How and when to raise a breakdown report instead of continuing to run a faulty machine.', 'document'),
        lesson(4, 'Shift Handover Basics', 'What to communicate to the next operator at end of shift.', 'video'),
      ],
      quiz: quiz('Operator Trainee Practice Quiz', [
        { text: 'If a machine makes an unusual noise, the operator should:', options: ['Keep running it', 'Stop and report it', 'Increase the speed', 'Ignore it until shift end'], correctIndex: 1 },
        { text: 'Pre-start checks should be done:', options: ['Once a week', 'Before every shift/start-up', 'Only after a breakdown', 'Never'], correctIndex: 1 },
      ]),
      finalTest: quiz('Operator Trainee Final Test', [
        { text: 'A breakdown should be reported:', options: ['At the end of the week', 'As soon as it is noticed', 'Only if production stops completely', 'Never, operators fix it themselves'], correctIndex: 1 },
        { text: 'At shift handover, an operator should communicate:', options: ['Nothing, the next operator will figure it out', 'Machine condition, open issues, and pending tasks', 'Only their break times', 'Personal opinions only'], correctIndex: 1 },
        { text: 'Operating a machine beyond its safe limits is:', options: ['Acceptable if in a hurry', 'Not acceptable and a safety risk', 'Encouraged for efficiency', 'Required by policy'], correctIndex: 1 },
      ], true),
    },
  ];
}
