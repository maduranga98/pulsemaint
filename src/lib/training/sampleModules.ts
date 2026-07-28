import { nanoid } from 'nanoid';
import type {
  LessonItem,
  TrainingModule,
  TrainingQuiz,
  TraineeTrainingType,
  TrainingDeliveryMode,
} from './trainingTypes';

/** Default training period for every sample trainee module (6 months), per
 * the same preset model used by the Trainee Programme duration picker
 * (`src/lib/traineeProgram/programmeDuration.ts` — DurationPreset 6 | 12 | 'custom'). */
export const SAMPLE_MODULE_DEFAULT_TRAINING_PERIOD_MONTHS = 6;

type SampleModuleBase = Pick<
  TrainingModule,
  'title' | 'description' | 'machineName' | 'estimatedMinutes' | 'passingScore' | 'language' | 'tags'
> & {
  lessons: LessonItem[];
  /** Practice quiz — stored on TrainingModule.practiceQuiz, does not gate completion. */
  quiz: TrainingQuiz;
  /** Final test — stored on TrainingModule.quiz, gates completion/certificate. */
  finalTest: TrainingQuiz;
};

/**
 * A Training-tab sample. Classified by training type and delivery mode (the
 * fields the Training module editor authors); it carries no
 * `defaultTrainingPeriodMonths`, which is a trainee-programme concept and
 * only exists in Trainee Management's library.
 */
export type TrainingLibrarySampleModule = SampleModuleBase & {
  trainingType: TraineeTrainingType;
  trainingMode: TrainingDeliveryMode;
};

/**
 * A Trainee Management sample: programme shaped. Training type, delivery
 * mode, and default training period are all required, matching what the
 * trainee module editor and validator demand.
 */
export type TraineeLibrarySampleModule = SampleModuleBase & {
  trainingType: TraineeTrainingType;
  trainingMode: TrainingDeliveryMode;
  defaultTrainingPeriodMonths: number;
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
 * Trainee Management's starter content — loaded on demand via its own
 * "Load Sample Modules" button rather than seeded automatically, since
 * companies may already have their own content.
 *
 * Six trade-specific trainee modules, one per `TraineeTrainingType`
 * (see trainingTypes.ts), each with a few realistic lessons, a practice
 * quiz, and a final test. All default to a 6-month training period when
 * assigned via the Trainee Management assignment flow (Task 2/5).
 *
 * These templates belong to the `trainee_management` library only — the
 * Training tab has its own, entirely separate set
 * (`sampleTrainingLibraryModules`). The two libraries never share templates.
 */
export function sampleTraineeProgrammeModules(): TraineeLibrarySampleModule[] {
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
      trainingMode: 'onsite',
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
      trainingMode: 'onsite',
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
      trainingMode: 'onsite',
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
      trainingMode: 'onsite',
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
      trainingMode: 'onsite',
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
      trainingMode: 'onsite',
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

/**
 * The Training tab's own starter content — deliberately a different set of
 * templates from Trainee Management's `sampleTraineeProgrammeModules()`.
 *
 * The Training tab covers the standing workforce (technicians, operators,
 * store keepers, supervisors …) rather than trainee programmes, so these are
 * plant-wide competency modules: safety, LOTO, PM discipline, breakdown
 * reporting, stores handling, and shift handover. They carry no
 * `trainingType` / `defaultTrainingPeriodMonths` — those are trainee-
 * programme concepts that only apply to Trainee Management's library.
 *
 * No title, lesson, or quiz is shared with the trainee set; loading samples
 * in one library never produces the same templates as the other.
 */
export function sampleTrainingLibraryModules(): TrainingLibrarySampleModule[] {
  return [
    {
      title: 'Plant Safety Induction',
      description: 'Baseline safety expectations for everyone working on the production floor.',
      machineName: 'Plant-wide',
      estimatedMinutes: 30,
      passingScore: 80,
      language: 'en',
      tags: ['safety', 'induction', 'workforce'],
      trainingType: 'other_trainee',
      trainingMode: 'onsite',
      lessons: [
        lesson(1, 'Plant Layout & Emergency Exits', 'Muster points, exit routes, and where emergency equipment is kept.'),
        lesson(2, 'PPE Selection by Work Area', 'Which protective equipment is mandatory in each zone of the plant.', 'image_gallery'),
        lesson(3, 'Incident & Near-Miss Reporting', 'What counts as a near miss and how to raise it the same day.'),
        lesson(4, 'Emergency Stop & Evacuation Drill', 'Using E-stops correctly and what to do when the evacuation alarm sounds.', 'video'),
      ],
      quiz: quiz('Plant Safety Induction Practice Quiz', [
        { text: 'A near miss should be reported:', options: ['Only if someone was injured', 'Even when nobody was hurt', 'Only at year end', 'Never'], correctIndex: 1 },
        { text: 'PPE requirements in the plant are decided by:', options: ['Personal preference', 'The work area and task', 'Shift length', 'Weather only'], correctIndex: 1 },
      ]),
      finalTest: quiz('Plant Safety Induction Final Test', [
        { text: 'On hearing the evacuation alarm you should:', options: ['Finish the current job first', 'Move to the designated muster point', 'Wait at your machine', 'Leave by any convenient route'], correctIndex: 1 },
        { text: 'An emergency stop button is used to:', options: ['Pause for a break', 'Bring equipment to an immediate safe stop', 'Reset the counter', 'Change the recipe'], correctIndex: 1 },
        { text: 'Emergency equipment locations should be known:', options: ['Only by supervisors', 'By everyone working in the area', 'Only by the safety officer', 'By nobody in particular'], correctIndex: 1 },
      ], true),
    },
    {
      title: 'Lockout–Tagout Competency',
      description: 'Full LOTO competency for staff who isolate equipment before maintenance work.',
      machineName: 'Plant-wide',
      estimatedMinutes: 45,
      passingScore: 85,
      language: 'en',
      tags: ['loto', 'isolation', 'safety'],
      trainingType: 'electrical_trainee',
      trainingMode: 'onsite',
      lessons: [
        lesson(1, 'Energy Sources & Isolation Points', 'Electrical, hydraulic, pneumatic, thermal, and stored-energy sources on plant equipment.'),
        lesson(2, 'Applying Locks, Tags & Personal Keys', 'One lock per person, personal key control, and correct tag information.'),
        lesson(3, 'Verifying Zero Energy', 'Try-start checks, bleeding stored pressure, and confirming with test equipment.'),
        lesson(4, 'Group LOTO & Shift Change Handover', 'Lock boxes, group isolation, and transferring isolation across a shift change.', 'document'),
      ],
      quiz: quiz('Lockout–Tagout Practice Quiz', [
        { text: 'How many personal locks may one worker share with a colleague?', options: ['One shared lock is fine', 'None — each person applies their own lock', 'Two per team', 'Whatever is available'], correctIndex: 1 },
        { text: 'Stored energy such as hydraulic pressure must be:', options: ['Ignored', 'Released or restrained before work starts', 'Increased for safety', 'Left for the next shift'], correctIndex: 1 },
      ]),
      finalTest: quiz('Lockout–Tagout Final Test', [
        { text: 'Zero-energy state is confirmed by:', options: ['Assuming the breaker worked', 'Testing and attempting a controlled start', 'Asking a colleague', 'Reading the manual only'], correctIndex: 1 },
        { text: 'A LOTO tag must identify:', options: ['Nothing in particular', 'Who applied it and why', 'The machine colour', 'The last service date only'], correctIndex: 1 },
        { text: 'When isolation must carry across a shift change, the correct method is:', options: ['Remove all locks at shift end', 'Use the documented group LOTO / lock box transfer', 'Leave a note on the panel', 'Let the next shift decide'], correctIndex: 1 },
      ], true),
    },
    {
      title: 'Preventive Maintenance Discipline',
      description: 'How PM schedules are planned, executed, and closed out so compliance stays measurable.',
      machineName: 'Plant-wide',
      estimatedMinutes: 40,
      passingScore: 75,
      language: 'en',
      tags: ['pm', 'planning', 'compliance'],
      trainingType: 'technician_trainee',
      trainingMode: 'onsite',
      lessons: [
        lesson(1, 'Why Planned Beats Reactive', 'The cost difference between planned maintenance and running to failure.'),
        lesson(2, 'Reading a PM Schedule & Checklist', 'Frequency, trigger type, and what each checklist line is asking for.'),
        lesson(3, 'Recording PM Findings Accurately', 'Capturing measurements and observations so trends stay usable.'),
        lesson(4, 'Overdue PM & Escalation Rules', 'When a missed PM becomes an escalation and who has to be told.', 'document'),
      ],
      quiz: quiz('Preventive Maintenance Practice Quiz', [
        { text: 'A PM checklist line left blank means:', options: ['The task passed', 'There is no record the task was done', 'The task is optional', 'The machine is healthy'], correctIndex: 1 },
        { text: 'Planned maintenance compared with run-to-failure is generally:', options: ['More expensive overall', 'Cheaper and less disruptive overall', 'Identical in cost', 'Only for new machines'], correctIndex: 1 },
      ]),
      finalTest: quiz('Preventive Maintenance Final Test', [
        { text: 'Measurements recorded during a PM are valuable because:', options: ['They fill in paperwork', 'They let condition trends be tracked over time', 'They are never reviewed', 'They replace inspections'], correctIndex: 1 },
        { text: 'An overdue PM should be:', options: ['Quietly closed', 'Escalated per the plant rule', 'Deleted from the schedule', 'Reassigned to the operator without notice'], correctIndex: 1 },
        { text: 'PM frequency is normally driven by:', options: ['Personal preference', 'Manufacturer guidance and observed condition', 'Shift rosters', 'Stock levels'], correctIndex: 1 },
      ], true),
    },
    {
      title: 'Breakdown Reporting & Root Cause Basics',
      description: 'Raising a usable breakdown report and taking a first pass at root cause.',
      machineName: 'Plant-wide',
      estimatedMinutes: 35,
      passingScore: 75,
      language: 'en',
      tags: ['breakdown', 'rca', 'reporting'],
      trainingType: 'technician_trainee',
      trainingMode: 'onsite',
      lessons: [
        lesson(1, 'What Makes a Report Actionable', 'Symptom, time, severity, and what was happening just before the fault.'),
        lesson(2, 'Severity & Downtime Classification', 'Choosing the right severity so priority and analytics stay meaningful.'),
        lesson(3, 'Five Whys in Practice', 'Working past the first plausible answer to a real contributing cause.'),
        lesson(4, 'Capturing Evidence Before Repair', 'Photographs, readings, and settings that disappear once the fix begins.', 'image_gallery'),
      ],
      quiz: quiz('Breakdown Reporting Practice Quiz', [
        { text: 'Evidence such as photos should be captured:', options: ['After the repair', 'Before the repair changes the state', 'Only if requested', 'Never'], correctIndex: 1 },
        { text: 'Severity on a breakdown report affects:', options: ['Nothing', 'How the job is prioritised and reported', 'The machine colour', 'Shift length'], correctIndex: 1 },
      ]),
      finalTest: quiz('Breakdown Reporting Final Test', [
        { text: 'The Five Whys technique is used to:', options: ['Assign blame', 'Move past symptoms toward a contributing cause', 'Shorten the report', 'Skip investigation'], correctIndex: 1 },
        { text: 'A report that says only "machine broken" is:', options: ['Sufficient', 'Not actionable — it lacks symptom and context', 'Ideal for analytics', 'Preferred by planners'], correctIndex: 1 },
        { text: 'Recording what the machine was doing before the fault helps because:', options: ['It fills space', 'It narrows the likely cause', 'It is required by law only', 'It has no effect'], correctIndex: 1 },
      ], true),
    },
    {
      title: 'Stores & Spare Parts Handling',
      description: 'Issuing, receiving, and reserving spares without breaking stock accuracy.',
      machineName: 'Stores',
      estimatedMinutes: 30,
      passingScore: 75,
      language: 'en',
      tags: ['inventory', 'stores', 'parts'],
      trainingType: 'other_trainee',
      trainingMode: 'onsite',
      lessons: [
        lesson(1, 'Part Identification & Catalog Codes', 'Finding the right catalog entry instead of creating duplicates.'),
        lesson(2, 'Issuing Parts Against a Work Order', 'Why every issue must be tied to a job for cost and usage tracking.'),
        lesson(3, 'Goods Receipt & Quality Check', 'Checking quantity, condition, and specification before accepting stock.'),
        lesson(4, 'Reorder Levels & Stock Counts', 'How reorder thresholds work and what a cycle count is for.', 'document'),
      ],
      quiz: quiz('Stores & Spare Parts Practice Quiz', [
        { text: 'Parts issued without a work order reference cause:', options: ['Better tracking', 'Untraceable cost and usage', 'Faster jobs', 'No effect'], correctIndex: 1 },
        { text: 'Creating a second catalog entry for an existing part leads to:', options: ['Cleaner data', 'Split stock and unreliable reorder levels', 'Lower cost', 'Nothing at all'], correctIndex: 1 },
      ]),
      finalTest: quiz('Stores & Spare Parts Final Test', [
        { text: 'On goods receipt you should check:', options: ['Quantity only', 'Quantity, condition, and specification', 'Nothing, the supplier is trusted', 'The delivery van'], correctIndex: 1 },
        { text: 'A reorder level exists to:', options: ['Limit spending', 'Trigger replenishment before stock runs out', 'Hide slow-moving parts', 'Set the sale price'], correctIndex: 1 },
        { text: 'A cycle count is:', options: ['A machine setting', 'A periodic physical stock verification', 'A purchase order type', 'A shift pattern'], correctIndex: 1 },
      ], true),
    },
    {
      title: 'Shift Handover Standards',
      description: 'Handing over a shift so nothing open is lost between crews.',
      machineName: 'Plant-wide',
      estimatedMinutes: 25,
      passingScore: 75,
      language: 'en',
      tags: ['handover', 'communication', 'shift'],
      trainingType: 'operator_trainee',
      trainingMode: 'onsite',
      lessons: [
        lesson(1, 'What Must Always Be Handed Over', 'Open jobs, isolations still in place, abnormal conditions, and pending decisions.'),
        lesson(2, 'Writing the Handover Record', 'Facts over impressions, and enough detail for someone who was not there.'),
        lesson(3, 'Face-to-Face Briefing Etiquette', 'Confirming understanding rather than assuming the note was read.'),
        lesson(4, 'Escalating Unresolved Issues', 'When an open issue needs a supervisor rather than another handover line.', 'document'),
      ],
      quiz: quiz('Shift Handover Practice Quiz', [
        { text: 'An isolation still in place at shift end must be:', options: ['Left undocumented', 'Explicitly handed over', 'Removed silently', 'Ignored'], correctIndex: 1 },
        { text: 'A good handover record is written for:', options: ['The person who wrote it', 'Someone who was not present on the shift', 'Auditors only', 'Nobody in particular'], correctIndex: 1 },
      ]),
      finalTest: quiz('Shift Handover Final Test', [
        { text: 'Confirming the incoming crew understood the handover is:', options: ['Unnecessary', 'Part of a proper handover', 'The supervisor’s job only', 'Optional paperwork'], correctIndex: 1 },
        { text: 'An issue that keeps being handed over unresolved should be:', options: ['Handed over again', 'Escalated to a supervisor', 'Closed without action', 'Deleted'], correctIndex: 1 },
        { text: 'Abnormal machine behaviour noticed late in a shift should be:', options: ['Left for someone to rediscover', 'Recorded and handed over', 'Mentioned next week', 'Kept informal'], correctIndex: 1 },
      ], true),
    },
  ];
}
