import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

/**
 * Mock user database - In production, this would come from your backend
 * Users are pre-created by Admin, NO public sign-up allowed
 */
const MOCK_USERS_DATABASE = [
  {
    id: '1',
    name: 'Mahavir Virdha',
    email: 'mahavir@company.com',
    password: 'password123', // In production, never store plaintext passwords
    role: 'admin'
  },
  {
    id: '2',
    name: 'Aryan Manager',
    email: 'aryan@company.com',
    password: 'password123',
    role: 'manager'
  },
  {
    id: '3',
    name: 'Technician One',
    email: 'tech1@company.com',
    password: 'password123',
    role: 'technician'
  },
  {
    id: '4',
    name: 'Technician Two',
    email: 'tech2@company.com',
    password: 'password123',
    role: 'technician'
  }
];

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    const token = localStorage.getItem('token');

    if (storedUser && token) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
      } catch (e) {
        console.error('Failed to parse stored user:', e);
        localStorage.removeItem('authUser');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  /**
   * Login - Call backend API for authentication
   * Users can only login with pre-created accounts from the database
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<object>} - User object with role
   */
  const login = async (email, password) => {
    try {
      setError(null);
      
      // Call real backend API
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Invalid email or password');
      }

      const data = await response.json();
      
      // Extract user data from response
      const userData = {
        id: data.user.id,
        email: data.user.email,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        username: data.user.username,
        role: data.user.role // 'admin', 'manager', or 'technician'
      };

      // Store auth data
      localStorage.setItem('authUser', JSON.stringify(userData));
      localStorage.setItem('token', data.token); // Store JWT token from backend

      setUser(userData);
      return userData;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  /**
   * Logout - clear auth state and storage
   */
  const logout = () => {
    setUser(null);
    localStorage.removeItem('authUser');
    localStorage.removeItem('token');
    setError(null);
  };

  /**
   * Check if user has a specific role
   * @param {string|string[]} allowedRoles - Role or array of roles to check
   * @returns {boolean}
   */
  const hasRole = (allowedRoles) => {
    if (!user) return false;
    if (Array.isArray(allowedRoles)) {
      return allowedRoles.includes(user.role);
    }
    return user.role === allowedRoles;
  };

  /**
   * Get dashboard URL for user's role
   * @returns {string} - Dashboard route for user's role
   */
  const getDashboardUrl = () => {
    if (!user) return '/signin';
    const role = user.role ? user.role.toLowerCase() : '';
    switch (role) {
      case 'admin':
        return '/admin-dashboard';
      case 'manager':
        return '/manager-dashboard';
      case 'technician':
        return '/technician-dashboard';
      case 'user':
        return '/user-dashboard';
      default:
        return '/signin';
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    hasRole,
    getDashboardUrl,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to use auth context
 * @returns {object} - Auth context value
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};