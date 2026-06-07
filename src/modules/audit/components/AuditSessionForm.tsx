import { useState, useMemo, useEffect } from 'react';
import {
  Loader2,
  UserCheck,
  Settings2,
  CheckCircle2,
  Download,
  FileCheck,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { useAuthStore } from '../../../store/authStore';
import { useDepartments } from '../../../hooks/useDepartments';
import {
  AUDIT_CATEGORY_LABELS,
  type AuditTemplate,
  type AuditAnswer,
  type AuditFinding,
  type AuditAttachment,
  type AuditParticipant,
  type MachineRef,
  type AuditSession,
} from '../types/audit.types';
import { useAuditMachines, useAuditUsers } from '../hooks/useAudit';
import { submitAudit, clearDraft, saveDraft } from '../services/audit.service';
import { analyzeAudit } from '../utils/aiRootCause';
import { downloadAuditPdf } from '../utils/auditPdf';
import { MachineMultiSelect } from './MachineMultiSelect';
import { ParticipantSelector } from './ParticipantSelector';
import { AttachmentUploader } from './AttachmentUploader';
import { FindingsSection } from './FindingsSection';
import { AIRootCausePanel } from './AIRootCausePanel';

interface Props {
  template: AuditTemplate;
  onConfigure: () => void;
  onDone: () => void;
}

function isFailed(value: string, answerType: string): boolean {
  if (answerType === 'yes_no') return value === 'no';
  if (answerType === 'scale') return value !== '' && Number(value) <= 2;
  return false;
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-sm font-bold text-white font-sora mb-3">{children}</h3>
);

export function AuditSessionForm({ template, onConfigure, onDone }: Props) {
  const profile = useAuthStore((s) => s.userProfile);
  const plantId = profile?.companyId ?? '';
  const { machines } = useAuditMachines();
  const { users } = useAuditUsers();
  const { departments } = useDepartments(plantId);

  const [selectedMachines, setSelectedMachines] = useState<MachineRef[]>([]);
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [participants, setParticipants] = useState<AuditParticipant[]>([]);
  const [answers, setAnswers] = useState<Record<string, AuditAnswer>>({});
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [attachments, setAttachments] = useState<AuditAttachment[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditSession | null>(null);

  // Stable key so attachments for this in-progress audit share a storage folder.
  const [sessionKey] = useState(() => nanoid());

  const setAnswer = (taskId: string, taskText: string, answerType: AuditAnswer['answerType'], value: string, notes?: string) => {
    setAnswers((prev) => ({
      ...prev,
      [taskId]: {
        taskId,
        taskText,
        answerType,
        value,
        notes: notes ?? prev[taskId]?.notes ?? '',
        failed: isFailed(value, answerType),
      },
    }));
  };

  const setNotes = (taskId: string, taskText: string, answerType: AuditAnswer['answerType'], notes: string) => {
    setAnswers((prev) => ({
      ...prev,
      [taskId]: {
        taskId,
        taskText,
        answerType,
        value: prev[taskId]?.value ?? '',
        notes,
        failed: prev[taskId]?.failed ?? false,
      },
    }));
  };

  const answerList = useMemo(() => Object.values(answers), [answers]);

  // Live AI preview from findings + failed answers.
  const aiPreview = useMemo(
    () =>
      analyzeAudit(
        findings,
        answerList.filter((a) => a.failed).map((a) => ({ taskText: a.taskText, notes: a.notes })),
      ),
    [findings, answerList],
  );

  const scoring = useMemo(() => {
    const scorable = answerList.filter((a) => a.answerType !== 'text' && a.value !== '');
    const passed = scorable.filter((a) => !a.failed).length;
    const score = scorable.length ? Math.round((passed / scorable.length) * 100) : 0;
    return { totalTasks: scorable.length, passedTasks: passed, score };
  }, [answerList]);

  // Persist a lightweight draft as the auditor works.
  useEffect(() => {
    if (!plantId || result) return;
    saveDraft(plantId, {
      category: template.category,
      templateId: template.id,
      machines: selectedMachines,
      department,
      location,
      participants,
      answers,
      findings,
      lastSaved: new Date().toISOString(),
    });
  }, [plantId, template, selectedMachines, department, location, participants, answers, findings, result]);

  const handleSubmit = async () => {
    setError(null);
    if (answerList.length === 0) {
      setError('Answer at least one task before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const session = await submitAudit(plantId, {
        category: template.category,
        templateId: template.id,
        templateName: template.name,
        machines: selectedMachines,
        department,
        location,
        auditorId: profile?.id ?? '',
        auditorName: profile?.fullName ?? 'Unknown',
        auditorEmployeeId: profile?.employeeId ?? '',
        auditorRole: profile?.role ?? '',
        participants,
        answers: answerList,
        findings,
        attachments,
        score: scoring.score,
        totalTasks: scoring.totalTasks,
        passedTasks: scoring.passedTasks,
        plantId,
        auditDate: new Date().toISOString().split('T')[0],
      });
      clearDraft(plantId, template.category);
      setResult(session);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success view ──────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="max-w-2xl mx-auto text-center py-10 space-y-5">
        <div className="h-16 w-16 mx-auto rounded-full bg-emerald-900/40 border border-emerald-700/50 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white font-sora">Audit Submitted</h2>
          <p className="text-sm text-slate-400 mt-1">
            Score {result.score}% · {result.passedTasks}/{result.totalTasks} tasks passed
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          {result.reportUrl ? (
            <a
              href={result.reportUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
            >
              <FileCheck className="h-4 w-4" /> View PDF Report
            </a>
          ) : (
            <button
              onClick={() => downloadAuditPdf(result)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
            >
              <Download className="h-4 w-4" /> Download PDF Report
            </button>
          )}
          <button onClick={onDone} className="px-4 py-2 text-sm text-slate-300 hover:text-white">
            Done
          </button>
        </div>
        {result.aiSuggestions.length > 0 && (
          <div className="text-left pt-4 border-t border-slate-800">
            <AIRootCausePanel suggestions={result.aiSuggestions} />
          </div>
        )}
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white font-sora">
            {AUDIT_CATEGORY_LABELS[template.category]}
          </h2>
          <p className="text-xs text-slate-400">{template.name}</p>
        </div>
        <button
          onClick={onConfigure}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg"
        >
          <Settings2 className="h-3.5 w-3.5" /> Configure Tasks
        </button>
      </div>

      {/* Auditor identity (auto-captured) */}
      <div className="flex items-center gap-3 p-3 bg-slate-800/60 border border-slate-700 rounded-xl">
        <UserCheck className="h-5 w-5 text-emerald-400" />
        <div className="text-sm">
          <span className="text-slate-400">Conducted by </span>
          <span className="text-white font-semibold">{profile?.fullName ?? 'Unknown'}</span>
          <span className="text-slate-500">
            {' '}· {profile?.role}{profile?.employeeId ? ` · #${profile.employeeId}` : ''}
          </span>
        </div>
      </div>

      {/* Scope */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
        <SectionTitle>Scope</SectionTitle>
        <label className="block text-xs font-semibold text-slate-400 mb-1">Machines</label>
        <MachineMultiSelect machines={machines} selected={selectedMachines} onChange={setSelectedMachines} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">Select department…</option>
              {['Production', 'Maintenance', 'Quality', 'Safety', 'Electrical', ...departments]
                .filter((v, i, arr) => arr.indexOf(v) === i)
                .map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Location / Zone</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Factory Floor A, Bay 3, Compressor Room"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Participants */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
        <SectionTitle>Participants</SectionTitle>
        <ParticipantSelector users={users} selected={participants} onChange={setParticipants} />
      </div>

      {/* Tasks */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
        <SectionTitle>Checklist</SectionTitle>
        <div className="space-y-4">
          {template.tasks.map((task, i) => {
            const ans = answers[task.id];
            return (
              <div key={task.id} className="pb-4 border-b border-slate-800 last:border-0">
                <p className="text-sm text-white mb-2">
                  <span className="text-slate-500 mr-1.5">{i + 1}.</span>
                  {task.text}
                  {task.critical && <span className="ml-1.5 text-[10px] text-amber-400">(critical)</span>}
                </p>

                {task.answerType === 'yes_no' && (
                  <div className="flex gap-2">
                    {['yes', 'no'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAnswer(task.id, task.text, 'yes_no', v)}
                        className={`px-4 py-1.5 text-sm rounded-lg border ${
                          ans?.value === v
                            ? v === 'yes'
                              ? 'bg-emerald-900/50 border-emerald-600 text-emerald-200'
                              : 'bg-red-900/50 border-red-600 text-red-200'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {v === 'yes' ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                )}

                {task.answerType === 'scale' && (
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setAnswer(task.id, task.text, 'scale', String(n))}
                        className={`h-9 w-9 text-sm rounded-lg border ${
                          ans?.value === String(n)
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}

                {task.answerType === 'text' && (
                  <textarea
                    value={ans?.value ?? ''}
                    onChange={(e) => setAnswer(task.id, task.text, 'text', e.target.value)}
                    rows={2}
                    placeholder="Enter response…"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none resize-none"
                  />
                )}

                {ans?.failed && (
                  <input
                    value={ans?.notes ?? ''}
                    onChange={(e) => setNotes(task.id, task.text, task.answerType, e.target.value)}
                    placeholder="Note the reason for this non-conformance…"
                    className="mt-2 w-full px-3 py-2 bg-red-950/30 border border-red-900/50 rounded-lg text-sm text-white placeholder-red-300/40 focus:border-red-500 focus:outline-none"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Findings */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
        <SectionTitle>Losses, Breakdowns, Safety &amp; Maintenance Findings</SectionTitle>
        <FindingsSection findings={findings} onChange={setFindings} />
      </div>

      {/* Attachments */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
        <SectionTitle>Evidence &amp; Attachments</SectionTitle>
        <AttachmentUploader
          plantId={plantId}
          sessionKey={sessionKey}
          attachments={attachments}
          onChange={setAttachments}
        />
      </div>

      {/* AI preview */}
      <div className="bg-slate-800/40 border border-emerald-900/30 rounded-xl p-4">
        <SectionTitle>AI Root-Cause Analysis (preview)</SectionTitle>
        <AIRootCausePanel suggestions={aiPreview} />
      </div>

      {/* Submit bar */}
      <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 -mx-4 px-4 py-3 flex items-center justify-between">
        <div className="text-sm text-slate-300">
          Score: <span className="font-bold text-white">{scoring.score}%</span>
          <span className="text-slate-500"> · {scoring.passedTasks}/{scoring.totalTasks} passed</span>
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-red-400">{error}</span>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
            Submit &amp; Generate PDF
          </button>
        </div>
      </div>
    </div>
  );
}
