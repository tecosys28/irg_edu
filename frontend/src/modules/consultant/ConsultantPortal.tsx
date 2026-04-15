'use client';
import React, { useState, useEffect } from 'react';
import { useRateLimit } from '../../../shared/hooks';

interface ConsultantPortalProps { consultantId: string; }

export const ConsultantPortal: React.FC<ConsultantPortalProps> = ({ consultantId }) => {
  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tasks' | 'offers' | 'ratings' | 'earnings'>('tasks');
  const { isLimited, checkLimit, recordRequest } = useRateLimit();

  useEffect(() => { loadDashboard(); }, [consultantId]);

  const loadDashboard = async () => {
    if (!checkLimit()) return;
    recordRequest();
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/partners/consultants/dashboard?consultantId=${consultantId}`);
      const data = await res.json();
      if (data.success) setStats(data.data);
    } finally { setLoading(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Consultant Dashboard</h1>
        <p className="text-gray-600">Manage your tasks, offers, and earnings</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Tasks" value={stats?.tasks?.total || 0} />
        <StatCard label="Pending" value={stats?.tasks?.pending || 0} color="yellow" />
        <StatCard label="Completed" value={stats?.tasks?.completed || 0} color="green" />
        <StatCard label="Rating" value={stats?.profile?.rating?.toFixed(1) || '0.0'} suffix="/5" color="blue" />
      </div>
      <div className="border-b mb-6">
        <nav className="flex space-x-8">
          {(['tasks', 'offers', 'ratings', 'earnings'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>
      {activeTab === 'tasks' && <TaskList consultantId={consultantId} />}
      {isLimited && <div className="fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded">Rate limited. Please wait...</div>}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; suffix?: string; color?: string }> = ({ label, value, suffix = '', color = 'gray' }) => {
  const colors: Record<string, string> = { gray: 'bg-gray-50', blue: 'bg-blue-50', green: 'bg-green-50', yellow: 'bg-yellow-50' };
  return <div className={`rounded-lg p-4 ${colors[color]}`}><p className="text-sm font-medium opacity-75">{label}</p><p className="text-2xl font-bold">{value}{suffix}</p></div>;
};

const TaskList: React.FC<{ consultantId: string }> = ({ consultantId }) => {
  const [tasks, setTasks] = useState<any[]>([]);
  useEffect(() => {
    fetch(`/api/v1/partners/consultants/tasks?consultantId=${consultantId}`).then(res => res.json()).then(data => data.success && setTasks(data.data));
  }, [consultantId]);
  return (
    <div className="space-y-4">
      {tasks.map(task => (
        <div key={task.id} className="border rounded-lg p-4 hover:border-blue-300 transition">
          <div className="flex justify-between items-start">
            <div>
              <span className={`inline-block px-2 py-1 text-xs rounded ${task.status === 'OVERDUE' ? 'bg-red-100 text-red-800' : task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{task.status}</span>
              <h3 className="font-medium mt-2">{task.taskType}</h3>
              <p className="text-sm text-gray-600">{task.description}</p>
            </div>
            <div className="text-right">
              <p className="font-medium">₹{Number(task.feeQuoted).toLocaleString()}</p>
              <p className="text-sm text-gray-500">Due: {new Date(task.deadline).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      ))}
      {tasks.length === 0 && <p className="text-gray-500 text-center py-8">No tasks found</p>}
    </div>
  );
};

export default ConsultantPortal;
