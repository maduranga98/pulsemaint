import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { resolveTriageFlow } from '../lib/triageFlowResolver';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

export const autoLaunchTriage = functions.firestore
  .document('breakdownTickets/{ticketId}')
  .onCreate(async (snap, context) => {
    const ticket = snap.data();
    if (!ticket) return;

    const { companyId, machineId, machineTypeId, supervisorId, supervisorName } = ticket as {
      companyId: string;
      machineId: string;
      machineTypeId: string | null;
      supervisorId: string;
      supervisorName: string;
    };

    try {
      const flow = await resolveTriageFlow(companyId, machineId, machineTypeId ?? null);
      if (!flow) {
        console.log('No triage flow found for machine', machineId);
        return;
      }

      const firstStep = flow.steps[0];
      const sessionData = {
        companyId,
        breakdownTicketId: context.params.ticketId,
        machineId,
        machineName: ticket.machineName ?? machineId,
        flowId: flow.id,
        flowName: flow.name,
        status: 'in_progress',
        language: flow.language,
        supervisorId: supervisorId ?? '',
        supervisorName: supervisorName ?? '',
        startedAt: admin.firestore.Timestamp.now(),
        completedAt: null,
        totalDuration: 0,
        currentStepId: firstStep?.id ?? '',
        currentStepNumber: firstStep?.stepNumber ?? 1,
        stepLogs: [],
        photosCaptured: [],
        outcomeType: null,
        outcomeNotes: '',
        escalatedAt: null,
        escalatedReason: '',
        quickFixDescription: '',
        isDemo: false,
      };

      await db.collection('triageSessions').add(sessionData);
      console.log('Created triage session for ticket', context.params.ticketId);
    } catch (err) {
      console.error('autoLaunchTriage error:', err);
    }
  });
