import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Search, Plus, Edit2, Trash2, Download } from 'lucide-react';
import { getAllMaintenanceRequests } from '../api/maintenance.api';
import { deleteMaintenanceRequest } from '../api/maintenance.api';
import MainNavigation from '../components/common/MainNavigation';
import ExportDialog from '../components/common/ExportDialog';
import { toast } from 'react-toastify';

export default function Maintenance({ user }) {
  const navigate = useNavigate();
  const [maintenanceData, setMaintenanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  useEffect(() => {
    const fetchMaintenanceRequests = async () => {
      try {
        const data = await getAllMaintenanceRequests();
        setMaintenanceData(data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching maintenance requests:', err);
        setError('Failed to fetch maintenance requests');
        setLoading(false);
      }
    };

    fetchMaintenanceRequests();
  }, []);

  const handleExport = async (filters) => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Authentication token not found');
      return;
    }

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('format', filters.format);
      
      if (filters.team) {
        queryParams.append('team', filters.team);
      }
      if (filters.status) {
        queryParams.append('status', filters.status);
      }
      if (filters.fromDate) {
        queryParams.append('fromDate', filters.fromDate);
      }
      if (filters.toDate) {
        queryParams.append('toDate', filters.toDate);
      }

      const response = await fetch(
        `http://localhost:5000/api/requests/export?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        }
      );

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `maintenance-requests.${filters.format === 'excel' ? 'xlsx' : filters.format}`;
      
      if (contentDisposition) {
        const matches = contentDisposition.match(/filename="?([^"]*)"?/);
        if (matches) filename = matches[1];
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Successfully exported as ${filters.format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      throw new Error('Failed to export requests: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-gray-100">
      {/* Main Navigation */}
      <MainNavigation user={user} />

      {/* Main Content */}
      <main className="px-6 py-6">
        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => navigate('/maintenance/new')}
              className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/30"
            >
              <Plus className="w-5 h-5" />
              <span>New</span>
            </button>

            <button 
              onClick={() => setIsExportDialogOpen(true)}
              className="flex items-center space-x-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-green-500/30"
            >
              <Download className="w-5 h-5" />
              <span>Export</span>
            </button>
          </div>

          <div className="relative flex-1 max-w-md ml-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            />
          </div>
        </div>

        {/* Maintenance Table */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-white">Maintenance Requests</h2>
          </div>
          <div className="overflow-x-auto">
            {loading && <p className="p-6 text-center">Loading...</p>}
            {error && <p className="p-6 text-center text-red-400">{error}</p>}
            {!loading && !error && (
              <table className="w-full">
                <thead className="bg-slate-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Created By</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Technician</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {maintenanceData.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-300">{item.subject}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{item.createdBy?.firstName} {item.createdBy?.lastName}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">{item.technician?.firstName} {item.technician?.lastName}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.status === 'New' ? 'bg-yellow-500/20 text-yellow-300' :
                          item.status === 'In Progress' ? 'bg-blue-500/20 text-blue-300' :
                          'bg-green-500/20 text-green-300'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-300">{item.company}</td>
                      <td className="px-6 py-4 text-sm text-gray-300">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => navigate(`/maintenance/edit/${item._id}`)}
                            title="Edit"
                            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-md"
                          >
                            <Edit2 className="w-4 h-4 text-cyan-300" />
                          </button>
                          <button
                            onClick={async () => {
                              if (!window.confirm('Delete this maintenance request?')) return;
                              try {
                                await deleteMaintenanceRequest(item._id);
                                setMaintenanceData(prev => prev.filter(i => i._id !== item._id));
                              } catch (err) {
                                console.error('Error deleting request:', err);
                                alert(err?.response?.data?.message || 'Failed to delete request');
                              }
                            }}
                            title="Delete"
                            className="p-2 bg-slate-700 hover:bg-slate-600 rounded-md"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        onExport={handleExport}
      />
    </div>
  );
}
