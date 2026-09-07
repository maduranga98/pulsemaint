import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { CreatePMFormValues } from '../../../schemas/pm';
import type { PMPreallocatedPart } from '../../../types/pm.types';

export function Step6Parts() {
  const { t } = useTranslation();
  const { watch, setValue } = useFormContext<CreatePMFormValues>();
  const preallocatedParts = watch('preallocatedParts') || [];
  const [newPartId, setNewPartId] = useState('');
  const [newPartName, setNewPartName] = useState('');
  const [newPartNumber, setNewPartNumber] = useState('');
  const [newQuantity, setNewQuantity] = useState('1');

  const addPart = () => {
    if (!newPartId.trim() || !newPartName.trim()) return;
    const part: PMPreallocatedPart = {
      partId: newPartId,
      partName: newPartName,
      partNumber: newPartNumber,
      quantity: Number(newQuantity) || 1,
    };
    setValue('preallocatedParts', [...preallocatedParts, part]);
    setNewPartId('');
    setNewPartName('');
    setNewPartNumber('');
    setNewQuantity('1');
  };

  const removePart = (index: number) => {
    const updated = preallocatedParts.filter((_, i) => i !== index);
    setValue('preallocatedParts', updated);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">{t('common.pmSchedules.createForm.step6.heading')}</h3>
      <p className="text-sm text-gray-500">{t('common.pmSchedules.createForm.step6.subheading')}</p>

      {preallocatedParts.length > 0 && (
        <div className="space-y-2">
          {preallocatedParts.map((part, index) => (
            <div key={index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{part.partName}</p>
                <p className="text-xs text-gray-500">{t('common.pmSchedules.createForm.step6.partSummary', { number: part.partNumber, quantity: part.quantity })}</p>
              </div>
              <button
                type="button"
                onClick={() => removePart(index)}
                className="text-red-400 hover:text-red-600 text-sm"
              >
                {t('common.pmSchedules.createForm.step6.remove')}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input
          type="text"
          value={newPartId}
          onChange={(e) => setNewPartId(e.target.value)}
          placeholder={t('common.pmSchedules.createForm.step6.partIdPlaceholder')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <input
          type="text"
          value={newPartName}
          onChange={(e) => setNewPartName(e.target.value)}
          placeholder={t('common.pmSchedules.createForm.step6.partNamePlaceholder')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <input
          type="text"
          value={newPartNumber}
          onChange={(e) => setNewPartNumber(e.target.value)}
          placeholder={t('common.pmSchedules.createForm.step6.partNumberPlaceholder')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            value={newQuantity}
            onChange={(e) => setNewQuantity(e.target.value)}
            placeholder={t('common.pmSchedules.createForm.step6.qtyPlaceholder')}
            className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            type="button"
            onClick={addPart}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            {t('common.pmSchedules.createForm.step6.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
