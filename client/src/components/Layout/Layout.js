import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  Home,
  Users,
  FolderOpen,
  FileText,
  Receipt,
  Folder,
  Key,
  MessageSquare,
  BarChart3,
  Settings,
  Bell,
  User,
  LogOut,
  BookOpen,
  Shield,
  UserCog,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { NAVIGATION_PERMISSIONS } from '../../utils/permissions';
import WorkspaceDisplay from './WorkspaceDisplay';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('cms-sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();

  // Save preference to localStorage
  useEffect(() => {
    localStorage.setItem('cms-sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Define all navigation items
  const allNavigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, key: 'dashboard' },
    { name: 'Clients', href: '/clients', icon: Users, key: 'clients' },
    { name: 'Projects', href: '/projects', icon: FolderOpen, key: 'projects' },
    { name: 'Quotations', href: '/quotations', icon: FileText, key: 'quotations' },
    { name: 'Invoices', href: '/invoices', icon: Receipt, key: 'invoices' },
    { name: 'Files', href: '/files', icon: Folder, key: 'files' },
    { name: 'Credentials', href: '/credentials', icon: Key, key: 'credentials' },
    { name: 'Conversations', href: '/conversations', icon: MessageSquare, key: 'conversations' },
    { name: 'Users', href: '/users', icon: UserCog, key: 'users' },
    { name: 'Roles & Permissions', href: '/roles', icon: Shield, key: 'roles' },
    { name: 'Reports', href: '/reports', icon: BarChart3, key: 'reports' },
    { name: 'Guide', href: '/guide', icon: BookOpen, key: 'guide' },
    { name: 'Settings', href: '/settings', icon: Settings, key: 'settings' },
  ];

  // Filter navigation based on permissions
  const navigation = allNavigationItems.filter(item => {
    const permission = NAVIGATION_PERMISSIONS[item.key];
    
    // If no permission required, always show
    if (!permission) {
      return true;
    }
    
    // Admin always sees everything
    if (isAdmin) {
      return true;
    }
    
    // Check if user has the required permission
    return hasPermission(permission.module, permission.action);
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActiveRoute = (href) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 flex z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <SidebarContent
              navigation={navigation}
              isActiveRoute={isActiveRoute}
              onItemClick={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Static sidebar for desktop */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <SidebarContent 
          navigation={navigation} 
          isActiveRoute={isActiveRoute}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Top header */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow">
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex items-center space-x-4">
              {/* Hide long title on small screens to keep header compact */}
              <h1 className="hidden sm:block text-2xl font-semibold text-gray-900">
                Client Management System
              </h1>
              <WorkspaceDisplay />
            </div>

            <div className="ml-4 flex items-center md:ml-6 space-x-4">
              {/* Notifications */}
              <button className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                <Bell className="h-6 w-6" />
              </button>

              {/* User menu */}
              <div className="ml-3 relative">
                <div>
                  <button
                    type="button"
                    className="max-w-xs bg-white flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                  >
                    <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <span className="ml-2 text-gray-700">{user?.full_name}</span>
                  </button>
                </div>

                {userMenuOpen && (
                  <div className="dropdown">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigate('/settings');
                        }}
                        className="dropdown-item"
                      >
                        <User className="mr-3 h-4 w-4" />
                        Profile
                      </button>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          handleLogout();
                        }}
                        className="dropdown-item text-danger-600 hover:bg-danger-50"
                      >
                        <LogOut className="mr-3 h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="container-responsive">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

const SidebarContent = ({ navigation, isActiveRoute, isCollapsed = false, onToggleCollapse, onItemClick }) => {
  const navigate = useNavigate();

  return (
    <aside
      className={`
        h-screen bg-white border-r border-gray-200
        transition-all duration-300 ease-in-out
        ${isCollapsed ? 'w-20' : 'w-64'}
        flex flex-col
        overflow-hidden
        flex-shrink-0
      `}
    >
      {/* Logo */}
      <div className={`h-16 flex-shrink-0 bg-primary-600 flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-4'} overflow-hidden`}>
        {!isCollapsed && (
          <div className="flex items-center flex-1 min-w-0">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center">
                <span className="text-primary-600 font-bold text-lg">C</span>
              </div>
            </div>
            <div className="ml-3 min-w-0">
              <h1 className="text-white text-lg font-semibold truncate">CMS</h1>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-primary-600 font-bold text-lg">C</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden scrollbar-thin">
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveRoute(item.href);
            return (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.href);
                  if (onItemClick) {
                    onItemClick();
                  }
                }}
                className={`
                  nav-link w-full
                  ${isActive ? 'nav-link-active' : ''}
                  ${isCollapsed ? 'justify-center' : ''}
                  group relative
                `}
                title={isCollapsed ? item.name : ''}
              >
                <Icon className={`
                  ${isCollapsed ? 'h-5 w-5 mx-auto' : 'mr-3 h-5 w-5 flex-shrink-0'}
                  ${isActive ? 'text-primary-600' : 'text-gray-500'}
                `} />
                {!isCollapsed && (
                  <span className="flex-1 text-left">{item.name}</span>
                )}
                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <span className="
                    absolute left-full ml-2 px-2 py-1
                    bg-gray-900 text-white text-xs rounded
                    opacity-0 group-hover:opacity-100
                    pointer-events-none whitespace-nowrap
                    transition-opacity duration-200 z-50
                    shadow-lg
                  ">
                    {item.name}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Toggle Button */}
      <div className="border-t border-gray-200 p-3">
        <button
          onClick={onToggleCollapse}
          className={`
            w-full flex items-center rounded-lg hover:bg-gray-50
            transition-colors duration-200
            ${isCollapsed ? 'justify-center px-2 py-2' : 'justify-center px-3 py-2'}
          `}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5 text-gray-400 mx-auto" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 text-gray-400 mr-2.5 flex-shrink-0" />
              <span className="text-sm font-medium text-gray-700">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Layout;
