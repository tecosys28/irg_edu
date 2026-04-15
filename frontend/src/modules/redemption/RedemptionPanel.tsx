'use client';
import React, { useState, useEffect } from 'react';
import { useConfirmation } from '../../../shared/hooks';

interface RedemptionPanelProps { userId: string; }

export const RedemptionPanel: React.FC<RedemptionPanelProps> = ({ userId }) => {
  const [pendingRedemptions, setPendingRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const confirmation = useConfirmation({ confirmText: 'Deregister', cancelText: 'Cancel', timeout: 30000 });

  useEffect(() => { loadPending(); }, [userId]);

  const loadPending = async () => {
    try {
      const res = await fetch(`/api/v1/redemption/pending?userId=${userId}`);
      const data = await res.json();
      if (data.success) setPendingRedemptions(data.data);
    } finally { setLoading(false); }
  };

  const handleDeregister = async (tokenId: string) => {
    confirmation.requestConfirmation(async () => {
      const res = await fetch(`/api/v1/redemption/deregister/${tokenId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ holderId: userId })
      });
      const data = await res.json();
      if (data.success) { loadPending(); alert('Token deregistered successfully'); }
    });
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-xl font-bold mb-6">Pending Redemptions</h2>
      <p className="text-gray-600 mb-4">Tokens in surrender state. You have 7 days to exercise deregistration option.</p>
      <div className="space-y-4">
        {pendingRedemptions.map(token => (
          <div key={token.id} className="border rounded-lg p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">{token.publicId}</p>
              <p className="text-sm text-gray-500">Face Value: ₹{token.faceValue}</p>
              <p className="text-sm text-gray-500">Surrendered: {new Date(token.surrenderedAt).toLocaleDateString()}</p>
            </div>
            <button onClick={() => handleDeregister(token.id)} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
              Deregister
            </button>
          </div>
        ))}
        {pendingRedemptions.length === 0 && <p className="text-gray-500 text-center py-8">No pending redemptions</p>}
      </div>
      {confirmation.isConfirming && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-bold mb-4">Confirm Deregistration</h3>
            <p className="text-gray-600 mb-6">This will permanently burn the token. You will receive 55% of face value. This action cannot be undone.</p>
            <div className="flex justify-end space-x-4">
              <button onClick={confirmation.cancel} className="px-4 py-2 border rounded">{confirmation.cancelText}</button>
              <button onClick={confirmation.confirm} className="px-4 py-2 bg-red-600 text-white rounded">{confirmation.confirmText}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RedemptionPanel;
