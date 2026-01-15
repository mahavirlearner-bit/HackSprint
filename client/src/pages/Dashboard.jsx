import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Wrench, Users, Calendar, FileText, Search, Plus, TrendingUp, Clock, CheckCircle, ChevronDown, Monitor, Loader, AlertTriangle, RefreshCw } from 'lucide-react';
import { Line, Pie } from 'react-chartjs-2';
import MainNavigation from '../components/common/MainNavigation';

export default function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef(null);

  // Fetch dashboard data from backend
  const fetchDashboardData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      }
      setError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please log in again.');
        if (isInitial) {
          setLoading(false);
        }
        return;
      }

      // Use relative path so Vite dev server proxy handles the backend URL
      const response = await fetch('/api/analytics/dashboard-data', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication failed. Please log in again.');
          localStorage.removeItem('token');
          navigate('/signin');
          return;
        }
        throw new Error(`Failed to fetch dashboard data: ${response.status}`);
      }

      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  }, [navigate]);

  // Fetch data on component mount and set up polling
  useEffect(() => {
    fetchDashboardData(true);

    // Set up polling every 5 seconds for dynamic updates
    intervalRef.current = setInterval(() => {
      fetchDashboardData(false);
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchDashboardData]);

  // Filter recent requests based on search term
  const filteredRequests = dashboardData?.recentRequests?.filter(request =>
    request.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (request.equipment?.name || request.equipment || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.technician?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.technician?.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Get status color for maintenance requests
  const getStatusColor = (status) => {
    const s = (status || '').toString().toLowerCase();
    if (s === 'repaired' || s === 'completed') return 'bg-green-500/20 text-green-300';
    if (s === 'in progress' || s === 'in-progress' || s === 'in_progress') return 'bg-blue-500/20 text-blue-300';
    if (s === 'new' || s === 'pending') return 'bg-yellow-500/20 text-yellow-300';
    if (s === 'scrap' || s === 'scrapped') return 'bg-gray-600/20 text-gray-300';
    return 'bg-gray-500/20 text-gray-300';
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
        return 'bg-red-500/20 text-red-300';
      case 'high':
        return 'bg-orange-500/20 text-orange-300';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'low':
        return 'bg-green-500/20 text-green-300';
      default:
        return 'bg-gray-500/20 text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-gray-100">
        <MainNavigation user={user} onLogout={onLogout} />
        <main className="px-6 py-6">
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3 text-cyan-400">
              <Loader className="w-6 h-6 animate-spin" />
              <span>Loading dashboard data...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-gray-100">
        <MainNavigation user={user} onLogout={onLogout} />
        <main className="px-6 py-6">
          <div className="bg-red-900/20 border border-red-700 rounded-xl p-6 mb-6">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
            <button
              onClick={fetchDashboardData}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        </main>
      </div>
    );
  }

  const stats = dashboardData?.statistics || {};

  // Export top equipment list to CSV
  const exportTopEquipmentCSV = () => {
    const rows = [['Equipment ID', 'Name', 'Requests', 'Percent']];
    const total = dashboardData?.totalRequests || 0;
    (dashboardData?.topEquipment || []).forEach(eq => {
      const percent = total > 0 ? Math.round((eq.count / total) * 100) : 0;
      rows.push([eq.equipmentId, eq.name, String(eq.count), `${percent}%`]);
    });
    const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'top_equipment.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-gray-100">
      {/* Main Navigation */}
      <MainNavigation user={user} onLogout={onLogout} />

      {/* Main Content */}
      <main className="px-6 py-6">
        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/maintenance/new')}
              className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/30 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>New Request</span>
            </button>
            <button
              onClick={() => navigate('/maintenance-kanban')}
              title="Open Kanban Board"
              className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-purple-500/20 cursor-pointer"
            >
              <Wrench className="w-5 h-5" />
              <span>Open Kanban Board</span>
            </button>
            <button
              onClick={() => navigate('/maintenance-calendar')}
              title="Schedule Preventive Maintenance"
              className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Calendar className="w-5 h-5" />
              <span>Schedule Preventive</span>
            </button>
            <button
              onClick={async () => {
                setRefreshing(true);
                await fetchDashboardData(false);
                setRefreshing(false);
              }}
              disabled={refreshing}
              className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 px-4 py-2 rounded-lg font-medium transition-all cursor-pointer"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>

          <div className="relative flex-1 max-w-md ml-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search maintenance requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            />
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Critical Equipment Card */}
          <div className="bg-gradient-to-br from-red-900/40 to-red-800/40 backdrop-blur-sm border border-red-700/50 rounded-xl p-6 hover:shadow-lg hover:shadow-red-500/20 transition-all">
            <div className="flex items-start justify-between mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            
              </div>
            </div>
          </div>
        {dashboardData?.upcomingMaintenance && dashboardData.upcomingMaintenance.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <Calendar className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">Upcoming Maintenance (Next 7 Days)</h2>
            </div>
            <div className="space-y-3">
              {dashboardData.upcomingMaintenance.map((item) => (
                <div key={item._id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <div>
                      <p className="text-sm font-medium text-white">{item.subject}</p>
                      <p className="text-xs text-gray-400">
                        {item.equipment?.name || item.equipment} • {item.technician ? `${item.technician.firstName} ${item.technician.lastName}` : 'Unassigned'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-cyan-400">
                      {item.scheduledDate ? new Date(item.scheduledDate).toLocaleDateString() : 'No date'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {item.scheduledDate ? new Date(item.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Problematic Equipment */}
        {dashboardData?.topEquipment && dashboardData.topEquipment.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <Wrench className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">Top 5 Problematic Equipment</h2>
              <div className="ml-auto">
                <button onClick={exportTopEquipmentCSV} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-md text-sm">Export CSV</button>
              </div>
            </div>
            <div className="space-y-3">
              {dashboardData.topEquipment.map((eq) => {
                const percent = dashboardData.totalRequests ? Math.round((eq.count / dashboardData.totalRequests) * 100) : 0;
                return (
                  <div key={eq.equipmentId || eq.name} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Monitor className="w-5 h-5 text-cyan-400" />
                      <div>
                        <p className="text-sm font-medium text-white">{eq.name}</p>
                        <p className="text-xs text-gray-400">Requests: {eq.count} • {percent}% of total</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {eq.equipmentId && (
                        <button onClick={() => navigate(`/equipment/${eq.equipmentId}`)} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-md text-sm">View</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top Downtime Equipment */}
        {dashboardData?.topDowntime && dashboardData.topDowntime.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">Top Downtime Equipment</h2>
            </div>
            <div className="space-y-3">
              {dashboardData.topDowntime.map(item => (
                <div key={item.equipmentId || item.name} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Monitor className="w-5 h-5 text-cyan-400" />
                    <div>
                      <p className="text-sm font-medium text-white">{item.name}</p>
                      <p className="text-xs text-gray-400">Downtime: {item.totalDowntime} hrs • Requests: {item.requests}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {item.equipmentId && (
                      <button onClick={() => navigate(`/equipment/${item.equipmentId}`)} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-md text-sm">View</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Maintenance Table */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-white">Recent Maintenance Requests</h2>
            <p className="text-sm text-gray-400 mt-1">
              Showing {filteredRequests.length} of {dashboardData?.recentRequests?.length || 0} requests
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Equipment</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Technician</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredRequests.length > 0 ? (
                  filteredRequests.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-700/30 transition-colors cursor-pointer" onClick={() => navigate(`/maintenance/${item._id}`)}>
                      <td className="px-6 py-4 text-sm text-gray-300">{item.subject}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{item.equipment?.name || item.equipment || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {item.technician ? `${item.technician.firstName} ${item.technician.lastName}` : 'Unassigned'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(item.priority)}`}>
                          {item.priority || 'Medium'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(item.status)}`}>
                          {item.status === 'In Progress' ? 'In Progress' : item.status || 'New'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                      {searchTerm ? 'No maintenance requests found matching your search.' : 'No maintenance requests found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}