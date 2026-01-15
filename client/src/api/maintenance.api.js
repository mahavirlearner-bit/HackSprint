import axios from 'axios';

const API_URL = '/api/requests';

// Function to get the JWT token from local storage
const getToken = () => {
  return localStorage.getItem('token');
};

// Create an axios instance with default headers
const axiosInstance = axios.create({
  baseURL: API_URL,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const getAllMaintenanceRequests = async () => {
  try {
    const response = await axiosInstance.get('/');
    return response.data;
  } catch (error) {
    console.error('Error fetching maintenance requests:', error);
    throw error;
  }
};

export const createMaintenanceRequest = async (requestData) => {
  try {
    const response = await axiosInstance.post('/', requestData);
    return response.data;
  } catch (error) {
    console.error('Error creating maintenance request:', error);
    throw error;
  }
};

export const getMaintenanceRequestById = async (id) => {
  try {
    const response = await axiosInstance.get(`/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching maintenance request by id:', error);
    throw error;
  }
};

export const updateMaintenanceRequest = async (id, requestData) => {
  try {
    const response = await axiosInstance.put(`/${id}`, requestData);
    return response.data;
  } catch (error) {
    console.error('Error updating maintenance request:', error);
    throw error;
  }
};

export const deleteMaintenanceRequest = async (id) => {
  try {
    const response = await axiosInstance.delete(`/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting maintenance request:', error);
    throw error;
  }
};

// Preview team assignment for a category
export const previewTeamAssignment = async (equipmentCategory) => {
  try {
    const response = await axiosInstance.post('/preview-assignment', {
      equipmentCategory
    });
    return response.data;
  } catch (error) {
    console.error('Error previewing team assignment:', error);
    throw error;
  }
};

// Get team mapping
export const getTeamMapping = async () => {
  try {
    const response = await axiosInstance.get('/team-mapping');
    return response.data;
  } catch (error) {
    console.error('Error fetching team mapping:', error);
    throw error;
  }
};

// Export requests
export const exportRequests = async (format, filters = {}) => {
  try {
    const params = new URLSearchParams();
    params.append('format', format);
    
    if (filters.team) params.append('team', filters.team);
    if (filters.status) params.append('status', filters.status);
    if (filters.fromDate) params.append('fromDate', filters.fromDate);
    if (filters.toDate) params.append('toDate', filters.toDate);

    const response = await axiosInstance.get(`/export?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error exporting requests:', error);
    throw error;
  }
};
