import { nanoid } from 'nanoid';
import type { LessonItem, TrainingModule, TrainingQuiz } from './trainingTypes';

type SampleModule = Pick<
  TrainingModule,
  'title' | 'description' | 'machineName' | 'estimatedMinutes' | 'passingScore' | 'language' | 'tags'
> & {
  lessons: LessonItem[];
  quiz: TrainingQuiz;
};

function lesson(order: number, title: string, description: string): LessonItem {
  return {
    id: nanoid(),
    order,
    title,
    type: 'text',
    contentUrl: '',
    thumbnailUrl: '',
    description,
    durationSeconds: 300,
    pageCount: 0,
    isRequired: true,
    subtitleUrl: '',
  };
}

function quiz(title: string, questions: { text: string; options: string[]; correctIndex: number }[]): TrainingQuiz {
  return {
    id: nanoid(),
    title,
    instructions: 'Answer every question. You need a passing score to complete this module.',
    timeLimit: 0,
    maxAttempts: 3,
    passingScore: 70,
    shuffleQuestions: false,
    shuffleOptions: false,
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
 */
export function sampleTrainingModules(): SampleModule[] {
  return [
    {
      title: 'Lockout-Tagout (LOTO) Safety Basics',
      description: 'Core lockout-tagout procedure every technician must know before servicing energized equipment.',
      machineName: 'General / All Machines',
      estimatedMinutes: 20,
      passingScore: 80,
      language: 'en',
      tags: ['safety', 'loto', 'orientation'],
      lessons: [
        lesson(1, 'Why Lockout-Tagout Matters', 'Understand the hazards of unexpected machine start-up during maintenance and why LOTO exists.'),
        lesson(2, 'The LOTO Procedure', 'Step through notify, shut down, isolate, lock, tag, and verify zero energy state.'),
        lesson(3, 'Group Lockout & Shift Handover', 'How to hand over a locked-out machine safely across shifts.'),
      ],
      quiz: quiz('LOTO Safety Basics Quiz', [
        {
          text: 'What is the first step before applying a lock to an energy isolation point?',
          options: ['Apply the tag', 'Notify affected personnel and shut down the equipment', 'Remove the fuse', 'Test the machine'],
          correctIndex: 1,
        },
        {
          text: 'How do you confirm a machine is at zero energy state?',
          options: ['Ask a coworker', 'Attempt to start the machine using normal controls', 'Assume it is safe once locked', 'Check the maintenance log'],
          correctIndex: 1,
        },
        {
          text: 'Who is allowed to remove another technician’s personal lock?',
          options: ['Anyone on shift', 'Only the technician who applied it, or a supervisor following the removal procedure', 'The next incoming supervisor automatically', 'Security'],
          correctIndex: 1,
        },
      ]),
    },
    {
      title: 'Forklift Operation Fundamentals',
      description: 'Pre-operation checks, safe driving practices, and load handling for powered industrial trucks.',
      machineName: 'Forklift',
      estimatedMinutes: 25,
      passingScore: 80,
      language: 'en',
      tags: ['safety', 'forklift', 'orientation'],
      lessons: [
        lesson(1, 'Pre-Operation Inspection', 'Daily checklist: tires, forks, hydraulics, horn, lights, and seatbelt.'),
        lesson(2, 'Safe Driving Practices', 'Speed limits, pedestrian awareness, load visibility, and ramps.'),
        lesson(3, 'Load Handling', 'Stacking, weight limits, and safe lifting height.'),
      ],
      quiz: quiz('Forklift Fundamentals Quiz', [
        {
          text: 'When should the pre-operation inspection be completed?',
          options: ['Once a month', 'At the start of every shift before use', 'Only after an incident', 'Never, it is optional'],
          correctIndex: 1,
        },
        {
          text: 'If a load blocks your forward view, what should you do?',
          options: ['Drive faster to clear the aisle', 'Drive in reverse or get a spotter', 'Lift the load higher to see under it', 'Ignore it'],
          correctIndex: 1,
        },
      ]),
    },
    {
      title: 'CNC Machine Safety Orientation',
      description: 'Baseline safety orientation for operating and maintaining CNC machines on the floor.',
      machineName: 'CNC Machine',
      estimatedMinutes: 30,
      passingScore: 75,
      language: 'en',
      tags: ['safety', 'cnc', 'orientation'],
      lessons: [
        lesson(1, 'Machine Guarding', 'Never operate a CNC machine with guards removed or interlocks bypassed.'),
        lesson(2, 'Emergency Stops', 'Location and use of E-stops, and what to do after triggering one.'),
        lesson(3, 'Housekeeping & Chip Management', 'Keeping the work area clear of swarf, coolant spills, and tripping hazards.'),
      ],
      quiz: quiz('CNC Safety Orientation Quiz', [
        {
          text: 'It is acceptable to bypass a machine guard interlock if you are experienced.',
          options: ['True', 'False'],
          correctIndex: 1,
        },
        {
          text: 'After pressing an emergency stop, what should you do next?',
          options: ['Immediately restart the machine', 'Investigate the cause and clear it safely before resetting', 'Ignore it and walk away', 'Report it next week'],
          correctIndex: 1,
        },
      ]),
    },
  ];
}
