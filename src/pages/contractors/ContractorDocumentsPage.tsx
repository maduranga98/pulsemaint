import { useParams } from 'react-router-dom';
import { useContractorDocuments } from '@/hooks/contractors/useContractorDocuments';
import DocumentList from '@/components/contractors/documents/DocumentList';

export function ContractorDocumentsPage() {
  const { contractorId } = useParams();
  const { documents, loading } = useContractorDocuments(contractorId);

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Contractor Documents</h1>
        <p className="mt-1 text-sm text-slate-500">Compliance documents, renewals, and assignment blocking status.</p>
      </div>
      {loading ? <div className="text-slate-500">Loading documents...</div> : <DocumentList documents={documents} />}
    </div>
  );
}

export default ContractorDocumentsPage;
