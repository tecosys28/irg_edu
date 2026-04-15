'use client';
import React, { useState, useCallback } from 'react';
import { useConfirmation, useDoubleEntry, useDuplicateGuard, useDebounce } from '../../../shared/hooks';

interface ConsultantReviewFormProps { taskId: string; onSubmit: (data: any) => Promise<void>; onCancel: () => void; }

export const ConsultantReviewForm: React.FC<ConsultantReviewFormProps> = ({ taskId, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({ findings: '', recommendation: 'APPROVE' as const, riskAssessment: 'LOW' as const, reportUrls: [] as string[] });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const confirmation = useConfirmation({ confirmText: 'Submit Report', cancelText: 'Review Again', timeout: 30000 });
  const doubleEntry = useDoubleEntry();
  const duplicateGuard = useDuplicateGuard();
  const { debouncedFn: debouncedSave, isDebouncing } = useDebounce((data: typeof formData) => localStorage.setItem(`draft-${taskId}`, JSON.stringify(data)));

  const handleChange = useCallback((field: string, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    debouncedSave(updated);
  }, [formData, debouncedSave]);

  const handleSubmit = async () => {
    if (duplicateGuard.isDuplicate(formData)) { alert('Duplicate submission detected'); return; }
    if (!doubleEntry.verify()) return;
    confirmation.requestConfirmation(async () => {
      setIsSubmitting(true);
      try {
        duplicateGuard.recordSubmission(formData);
        await onSubmit({ taskId, ...formData, reportHash: `hash-${Date.now()}` });
        localStorage.removeItem(`draft-${taskId}`);
      } finally { setIsSubmitting(false); }
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-6">Submit Consultant Report</h2>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Findings</label>
        <textarea value={formData.findings} onChange={(e) => handleChange('findings', e.target.value)} rows={6} className="w-full border rounded-lg p-3" placeholder="Enter your detailed findings..." />
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Recommendation</label>
        <div className="flex space-x-4">
          {(['APPROVE', 'MODIFY', 'REJECT'] as const).map(rec => (
            <label key={rec} className="flex items-center"><input type="radio" name="recommendation" value={rec} checked={formData.recommendation === rec} onChange={() => handleChange('recommendation', rec)} className="mr-2" />{rec}</label>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Risk Assessment</label>
        <select value={formData.riskAssessment} onChange={(e) => handleChange('riskAssessment', e.target.value)} className="w-full border rounded-lg p-2">
          <option value="LOW">Low Risk</option><option value="MEDIUM">Medium Risk</option><option value="HIGH">High Risk</option><option value="CRITICAL">Critical Risk</option>
        </select>
      </div>
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm font-medium text-gray-700 mb-2">Value Verification (HEP)</p>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-gray-500">Enter Value</label><input type="number" value={doubleEntry.value1 || ''} onChange={(e) => doubleEntry.setValue1(parseFloat(e.target.value) || 0)} className="w-full border rounded p-2" /></div>
          <div><label className="text-xs text-gray-500">Confirm Value</label><input type="number" value={doubleEntry.value2 || ''} onChange={(e) => doubleEntry.setValue2(parseFloat(e.target.value) || 0)} className="w-full border rounded p-2" /></div>
        </div>
        {doubleEntry.value1 > 0 && doubleEntry.value2 > 0 && <p className={`text-xs mt-2 ${doubleEntry.isValid ? 'text-green-600' : 'text-red-600'}`}>{doubleEntry.isValid ? '✓ Values match' : `✗ Mismatch: ${(doubleEntry.differencePercent * 100).toFixed(2)}%`}</p>}
      </div>
      {isDebouncing && <p className="text-xs text-gray-400 mb-4">Saving draft...</p>}
      <div className="flex justify-end space-x-4">
        <button onClick={onCancel} className="px-4 py-2 border rounded-lg hover:bg-gray-50" disabled={isSubmitting}>Cancel</button>
        <button onClick={handleSubmit} disabled={isSubmitting || !formData.findings} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{isSubmitting ? 'Submitting...' : 'Submit Report'}</button>
      </div>
      {confirmation.isConfirming && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-bold mb-4">Confirm Submission</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to submit this report? This action cannot be undone.</p>
            <div className="flex justify-end space-x-4">
              <button onClick={confirmation.cancel} className="px-4 py-2 border rounded">{confirmation.cancelText}</button>
              <button onClick={confirmation.confirm} className="px-4 py-2 bg-blue-600 text-white rounded">{confirmation.confirmText}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultantReviewForm;
