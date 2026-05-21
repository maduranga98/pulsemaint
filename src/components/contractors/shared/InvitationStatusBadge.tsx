import { CheckCircle2, Mail, MessageCircle, XCircle } from 'lucide-react';

interface InvitationStatusBadgeProps {
  emailDelivered?: boolean;
  whatsappDelivered?: boolean;
}

export function InvitationStatusBadge({ emailDelivered = false, whatsappDelivered = false }: InvitationStatusBadgeProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${emailDelivered ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
        <Mail className="h-3.5 w-3.5" />
        Email {emailDelivered ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      </span>
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${whatsappDelivered ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
        <MessageCircle className="h-3.5 w-3.5" />
        WhatsApp {whatsappDelivered ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      </span>
    </div>
  );
}

export default InvitationStatusBadge;
