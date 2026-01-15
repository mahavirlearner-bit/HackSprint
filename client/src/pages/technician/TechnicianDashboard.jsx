import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Plus } from 'lucide-react';
import MainNavigation from '../../components/common/MainNavigation';
import { useAuth } from '../../context/AuthContext';

export default function TechnicianDashboard({ user }) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Use auth context user if component user is not provided
  const currentUser = user || authUser;

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/analytics/dashboard-data', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load data');
      const data = await res.json();
      console.log('Dashboard data received:', data);
      console.log('Recent requests:', data?.recentRequests);
      setDashboardData(data);
    } catch (e) {
      console.error('Dashboard fetch error:', e);
      setError(e.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-gray-100">
      <MainNavigation user={currentUser} />
      <main className="p-6">Loading...</main>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-gray-100">
      <MainNavigation user={currentUser} />
      <main className="p-6">Error: {error}</main>
    </div>
  );

  // My assigned tasks - backend already filters for technicians, so use data as-is
  const myTasks = dashboardData?.recentRequests || [];
  const upcoming = dashboardData?.upcomingMaintenance || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-gray-100">
      <MainNavigation user={currentUser} />
      <main className="p-6">
        {/* Technician Menu */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">Technician Menu</h1>
          <div className="flex items-center space-x-3">
            <button onClick={() => navigate('/maintenance/new')} className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg text-white font-medium flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Create Request</span>
            </button>
            <button onClick={() => navigate('/technician-dashboard')} className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 rounded-lg text-white font-medium">Dashboard</button>
            <button onClick={() => navigate('/maintenance-kanban')} className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg text-white font-medium">Kanban</button>
            <button onClick={() => navigate('/maintenance')} className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-lg text-white font-medium">My Tasks</button>
          </div>
        </div>

        {/* My Tasks Section */}
        <section className="grid grid-cols-1 gap-6">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Wrench className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-semibold">My Tasks</h3>
            </div>
            {myTasks.length === 0 ? (
              <p className="text-sm text-gray-400">No tasks assigned.</p>
            ) : (
              <ul className="space-y-3">
                {myTasks.map(t => (
                  <li key={t._id} className="p-4 bg-slate-700/30 rounded-lg flex justify-between items-center hover:bg-slate-700/50 transition-colors">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t.subject}</p>
                      <p className="text-xs text-gray-400 mt-1">{t.equipment?.name}</p>
                      <div className="flex items-center gap-3 mt-2">
                        {t.team && (
                          <span className="inline-flex items-center px-2 py-1 bg-blue-600/30 text-blue-300 text-xs rounded-md border border-blue-500/50">
                            Team: {t.team.teamName}
                          </span>
                        )}
                        {t.createdBy && (
                          <span className="inline-flex items-center px-2 py-1 bg-purple-600/30 text-purple-300 text-xs rounded-md border border-purple-500/50">
                            Assigned by: {t.createdBy.firstName} {t.createdBy.lastName}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => navigate(`/maintenance/${t._id}`)} className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded-md text-sm font-medium whitespace-nowrap ml-4">View</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Upcoming Maintenance Section */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Upcoming Maintenance</h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-400">No upcoming jobs.</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map(u => (
                  <li key={u._id} className="p-4 bg-slate-700/30 rounded-lg flex justify-between items-center hover:bg-slate-700/50 transition-colors">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{u.subject}</p>
                      <p className="text-xs text-gray-400 mt-1">{u.equipment?.name} • {u.scheduledDate ? new Date(u.scheduledDate).toLocaleString() : 'No date'}</p>
                      <div className="flex items-center gap-3 mt-2">
                        {u.team && (
                          <span className="inline-flex items-center px-2 py-1 bg-blue-600/30 text-blue-300 text-xs rounded-md border border-blue-500/50">
                            Team: {u.team.teamName}
                          </span>
                        )}
                        {u.createdBy && (
                          <span className="inline-flex items-center px-2 py-1 bg-purple-600/30 text-purple-300 text-xs rounded-md border border-purple-500/50">
                            Assigned by: {u.createdBy.firstName} {u.createdBy.lastName}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => navigate(`/maintenance/${u._id}`)} className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 rounded-md text-sm font-medium whitespace-nowrap ml-4">View</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
