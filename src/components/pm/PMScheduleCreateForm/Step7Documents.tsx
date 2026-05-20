import { useState } from 'react';

interface Step7DocumentsProps {
  onFilesChange?: (files: File[]) => void;
}

export function Step7Documents({ onFilesChange }: Step7DocumentsProps) {
  const [documents, setDocuments] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const updated = [...documents, ...files];
    setDocuments(updated);
    onFilesChange?.(updated);
  };

  const removeFile = (index: number) => {
    const updated = documents.filter((_, i) => i !== index);
    setDocuments(updated);
    onFilesChange?.(updated);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Documents & References</h3>
      <p className="text-sm text-gray-500">Attach machine manuals, SOPs, reference photos.</p>

      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((file, index) => (
            <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg">📄</span>
                <span className="text-sm text-gray-700 truncate">{file.name}</span>
                <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="text-red-400 hover:text-red-600 text-sm flex-shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 cursor-pointer transition-colors">
          <input
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
          />
          <span className="text-sm text-gray-500">Click to upload files or drag and drop</span>
          <p className="text-xs text-gray-400 mt-1">PDF, Word, Images up to 10MB</p>
        </label>
      </div>
    </div>
  );
}
