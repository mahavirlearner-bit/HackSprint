import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  LayoutDashboard,
  Kanban,
  CheckSquare,
  Calendar,
  Wrench,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Plus
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './RoleBasedNavigation.css';

/**
 * Role-Based Navigation Component
 * 
 * Dynamically renders navigation menu based on user role.
 * - Admin: Dashboard, Users, Teams, Equipment, Reports
 * - Manager: Dashboard, Calendar, Equipment, Reports
 * - Technician: Dashboard, Kanban, My Tasks
 */
const RoleBasedNavigation = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user) return null;

  /**
   * Navigation menu structure by role
   * Each role has specific menu items with routes and icons
   */
  const navigationMenus = {
    admin: [
      {
        label: 'Admin Dashboard',
        path: '/admin-dashboard',
        icon: LayoutDashboard,
        description: 'System overview'
      },
      {
        label: 'Users',
        path: '/users',
        icon: Users,
        description: 'Manage user accounts and roles'
      },
      {
        label: 'Teams',
        path: '/teams',
        icon: Users,
        description: 'Manage maintenance teams'
      },
      {
        label: 'Equipment',
        path: '/equipment',
        icon: Wrench,
        description: 'Equipment configuration'
      },
      {
        label: 'Reports',
        path: '/reporting',
        icon: BarChart3,
        description: 'System reports and analytics'
      }
    ],
    manager: [
      {
        label: 'Manager Dashboard',
        path: '/manager-dashboard',
        icon: LayoutDashboard,
        description: 'KPI overview and trends'
      },
      {
        label: 'Calendar',
        path: '/maintenance-calendar',
        icon: Calendar,
        description: 'Maintenance schedule'
      },
      {
        label: 'Equipment',
        path: '/equipment',
        icon: Wrench,
        description: 'Equipment status and health'
      },
      {
        label: 'Reports',
        path: '/reporting',
        icon: BarChart3,
        description: 'Maintenance reports'
      }
    ],
    technician: [
      {
        label: 'My Dashboard',
        path: '/technician-dashboard',
        icon: LayoutDashboard,
        description: 'Your assigned tasks'
      },
      {
        label: 'Kanban Board',
        path: '/maintenance-kanban',
        icon: Kanban,
        description: 'Work in progress board'
      },
      {
        label: 'My Tasks',
        path: '/maintenance',
        icon: CheckSquare,
        description: 'All assigned tasks'
      }
    ],
    user: [
      {
        label: 'My Dashboard',
        path: '/user-dashboard',
        icon: LayoutDashboard,
        description: 'My reported issues'
      },
      {
        label: 'Report Issue',
        path: '/maintenance/new',
        icon: Plus,
        description: 'Create a new maintenance request'
      }
    ]
  };

  const currentMenu = navigationMenus[user.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="role-nav-desktop">
        <div className="nav-header">
          <div className="nav-brand">
            <Wrench className="nav-logo" />
            <span>GearGuard</span>
          </div>
          <div className="nav-user-badge">
            <span className="nav-role-badge" data-role={user.role}>
              {user.role.toUpperCase()}
            </span>
          </div>
        </div>

        <ul className="nav-menu">
          {currentMenu.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path} className="nav-menu-item">
                <Link
                  to={item.path}
                  className={`nav-menu-link ${isActive(item.path) ? 'active' : ''}`}
                  title={item.description}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="nav-footer">
          <div className="nav-user-info">
            <div className="user-avatar">{user.name.charAt(0)}</div>
            <div className="user-details">
              <p className="user-name">{user.name}</p>
              <p className="user-email">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="nav-logout-btn"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="role-nav-mobile">
        <div className="mobile-nav-header">
          <div className="nav-brand">
            <Wrench className="nav-logo" />
            <span>GearGuard</span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="mobile-menu-toggle"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="mobile-menu-content">
            <ul className="nav-menu">
              {currentMenu.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.path} className="nav-menu-item">
                    <Link
                      to={item.path}
                      className={`nav-menu-link ${isActive(item.path) ? 'active' : ''}`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon size={20} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <button
              onClick={handleLogout}
              className="nav-logout-btn"
              style={{ width: '100%', marginTop: '1rem' }}
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default RoleBasedNavigation;
