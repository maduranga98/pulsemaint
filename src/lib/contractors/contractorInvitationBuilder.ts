import type { Contractor, ContractorJob } from './contractorTypes';

export interface InvitationContent {
  subject: string;
  html: string;
  whatsapp: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildContractorInvitationContent(params: {
  contractor: Pick<Contractor, 'companyName' | 'primaryContactName' | 'primaryEmail' | 'emergencyContact'>;
  job: ContractorJob;
  factoryName: string;
  supervisorName: string;
  supervisorPhone: string;
  deadlineText: string;
}): InvitationContent {
  const { contractor, job, factoryName, supervisorName, supervisorPhone, deadlineText } = params;
  const subject = `Job Assignment - ${job.workOrderNumber} | ${job.machineName} | ${job.priority} Priority`;
  const contactName = contractor.primaryContactName || 'Sir/Madam';
  const description = job.breakdownDescription || job.workDoneDescription || 'Maintenance work assigned by the factory supervisor.';

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0A1628;line-height:1.5">
      <h2 style="margin:0 0 12px">PulseMaint</h2>
      <p>Dear ${escapeHtml(contactName)},</p>
      <p>You have been assigned a maintenance job at <strong>${escapeHtml(factoryName)}</strong>.</p>
      <table style="border-collapse:collapse;width:100%;max-width:640px;margin:16px 0">
        <tr><td><strong>Work Order</strong></td><td>${escapeHtml(job.workOrderNumber)}</td></tr>
        <tr><td><strong>Job Type</strong></td><td>${escapeHtml(job.workOrderType)}</td></tr>
        <tr><td><strong>Priority</strong></td><td>${escapeHtml(String(job.priority).toUpperCase())}</td></tr>
        <tr><td><strong>Machine</strong></td><td>${escapeHtml(job.machineName)}</td></tr>
        <tr><td><strong>Location</strong></td><td>${escapeHtml(job.machineLocation)}</td></tr>
        <tr><td><strong>Deadline</strong></td><td>${escapeHtml(deadlineText)}</td></tr>
      </table>
      <p><strong>Work Description</strong><br>${escapeHtml(description)}</p>
      <p><strong>Factory Contact</strong><br>${escapeHtml(supervisorName)} - ${escapeHtml(supervisorPhone)}<br>Emergency: ${escapeHtml(contractor.emergencyContact || supervisorPhone)}</p>
      <p>Please confirm receipt of this invitation. Contact the supervisor if you need any additional information before attending.</p>
      <p style="color:#64748b;font-size:12px">Sent via PulseMaint | pulsemaint.com | ${escapeHtml(factoryName)}<br>Do not reply to this email - contact the supervisor directly.</p>
    </div>
  `;

  const whatsapp = [
    `Job Invitation - ${factoryName}`,
    '',
    `WO: ${job.workOrderNumber} | ${job.workOrderType}`,
    `Machine: ${job.machineName}`,
    `Location: ${job.machineLocation}`,
    `Priority: ${job.priority}`,
    `Deadline: ${deadlineText}`,
    '',
    `Contact: ${supervisorName} - ${supervisorPhone}`,
    '',
    `Full details sent to ${contractor.primaryEmail}. Please confirm receipt.`,
  ].join('\n');

  return { subject, html, whatsapp };
}
