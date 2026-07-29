import { useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/store/authStore';
import { canSignOffTraining } from '@/lib/training/trainingSignOff';
import { notifyUsers } from '@/services/notifications.service';
import { issueTrainingCertificate } from '@/services/trainingCertificates.service';
import type { TrainingAssignment } from '@/lib/training/trainingTypes';
import PracticalSignOffCard from './PracticalSignOffCard';

interface TrainingSignOffPanelProps {
  assignment: TrainingAssignment;
  onClose: () => void;
}

/**
 * Sign-off drawer for one completed training, opened from the Sign-Off Queue.
 * Writes the same practical sign-off record the trainee profile does, so a
 * training certified here is indistinguishable from one certified there.
 */
export default function TrainingSignOffPanel({ assignment, onClose }: TrainingSignOffPanelProps) {
  const userProfile = useAuthStore((s) => s.userProfile);
  const company = useAuthStore((s) => s.company);
  const [saving, setSaving] = useState(false);

  const permission = canSignOffTraining(assignment, userProfile?.role, userProfile?.id);

  async function handleSignOff(data: { passed: boolean; observations: string }) {
    if (!userProfile) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'trainingAssignments', assignment.id), {
        status: data.passed ? 'certified' : 'quiz_failed',
        practicalSignOff: {
          required: true,
          passed: data.passed,
          observations: data.observations,
          signedOffBy: userProfile.id,
          signedOffByName: userProfile.fullName ?? '',
          signedOffAt: serverTimestamp(),
        },
        ...(data.passed ? { certifiedAt: serverTimestamp(), completedAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp(),
      });

      // A pass issues the certificate the trainee sees under My Certificates.
      if (data.passed) {
        await issueTrainingCertificate({
          assignment,
          company,
          issuedBy: userProfile.id,
          issuedByName: userProfile.fullName ?? '',
          practicalObservations: data.observations,
        });
      }

      // Tell the learner; oversight roles are copied automatically.
      void notifyUsers(assignment.companyId, [assignment.traineeId], {
        type: 'training',
        message: data.passed
          ? `${userProfile.fullName ?? 'A manager'} signed off your training: ${assignment.moduleName}`
          : `Your training ${assignment.moduleName} did not pass the practical assessment`,
        linkTo: '/app/training/my-modules',
      });

      toast.success(data.passed ? 'Training signed off.' : 'Training marked as failed.');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-off failed.';
      toast.error(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-2 border-b border-gray-200 p-4">
          <div>
            <p className="text-lg font-bold text-gray-900">{assignment.moduleName}</p>
            <p className="mt-0.5 text-sm text-gray-500">
              {assignment.traineeName}
              {assignment.assignedByName ? ` · assigned by ${assignment.assignedByName}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {permission.allowed ? (
            <PracticalSignOffCard assignment={assignment} onSignOff={handleSignOff} isLoading={saving} />
          ) : (
            <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">{permission.reason}</p>
          )}
        </div>
      </div>
    </div>
  );
}
