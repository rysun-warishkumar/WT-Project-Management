import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ListTodo,
  Kanban,
  Calendar,
  BarChart3,
  Settings,
  X,
  FolderKanban,
  Activity,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import { pmAPI } from '../../services/api';
import toast from 'react-hot-toast';
import ProjectChatModal from '../Projects/ProjectChatModal';
import { useWorkspaceChatNotifications } from '../../hooks/useChatNotifications';

const PMLayout = ({ children, workspace }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('pm-sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Get chat notifications
  const { unreadCount, mentionedCount } = useWorkspaceChatNotifications(workspace?.id);

  // Save preference to localStorage
  useEffect(() => {
    localStorage.setItem('pm-sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const navigation = [
    { name: 'Backlog', href: `/project-management/${workspace?.id}/backlog`, icon: ListTodo },
    { name: 'Board', href: `/project-management/${workspace?.id}/board`, icon: Kanban },
    { name: 'Sprints', href: `/project-management/${workspace?.id}/sprints`, icon: Calendar },
    { name: 'Activity', href: `/project-management/${workspace?.id}/activity`, icon: Activity },
    { name: 'Reports', href: `/project-management/${workspace?.id}/reports`, icon: BarChart3 },
    { name: 'Settings', href: `/project-management/${workspace?.id}/settings`, icon: Settings },
  ];

  const isActive = (href) => {
    return location.pathname === href;
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 h-screen bg-white border-r border-gray-200 z-40
          transition-all duration-300 ease-in-out
          ${isCollapsed ? 'w-16 sm:w-20' : 'w-56 sm:w-64'}
          flex flex-col
          overflow-hidden
        `}
      >
        {/* Logo */}
        <div className={`h-16 flex-shrink-0 bg-primary-600 flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-4'} overflow-hidden`}>
          {!isCollapsed && (
            <div className="flex items-center flex-1 min-w-0">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center">
                  <FolderKanban className="h-5 w-5 text-primary-600" />
                </div>
              </div>
              <div className="ml-3 min-w-0">
                <h1 className="text-white text-lg font-semibold truncate">
                  {workspace?.name || 'PM'}
                </h1>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="h-8 w-8 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
              <FolderKanban className="h-5 w-5 text-primary-600" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden scrollbar-thin">
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.href)}
                  className={`
                    nav-link w-full
                    ${active ? 'nav-link-active' : ''}
                    ${isCollapsed ? 'justify-center' : ''}
                    group relative
                  `}
                  title={isCollapsed ? item.name : ''}
                >
                  <Icon className={`
                    ${isCollapsed ? 'h-5 w-5 mx-auto' : 'mr-3 h-5 w-5 flex-shrink-0'}
                    ${active ? 'text-primary-600' : 'text-gray-500'}
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
            onClick={toggleSidebar}
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

      {/* Main Content Area */}
      <div className={`
        flex-1 flex flex-col transition-all duration-300 ease-in-out
        ${isCollapsed ? 'ml-16 sm:ml-20' : 'ml-56 sm:ml-64'}
      `}>
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center min-w-0 flex-1">
                {!isCollapsed && (
                  <>
                    <div className="hidden md:block">
                      <h1 className="text-lg md:text-xl font-semibold text-gray-900">
                        {workspace?.name || 'Project Management'}
                      </h1>
                      {workspace?.project_title && (
                        <p className="text-sm text-gray-500">
                          {workspace?.client_name} • {workspace?.project_title}
                        </p>
                      )}
                    </div>
                  </>
                )}
                {isCollapsed && (
                  <div>
                    <h1 className="text-lg md:text-xl font-semibold text-gray-900">
                      {workspace?.name || 'Project Management'}
                    </h1>
                    {workspace?.project_title && (
                      <p className="text-sm text-gray-500">
                        {workspace?.client_name} • {workspace?.project_title}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      const response = await pmAPI.getChatRoom(workspace.id);
                      if (response.data.success) {
                        setIsChatOpen(true);
                      } else {
                        toast.error('Failed to open chat');
                      }
                    } catch (error) {
                      toast.error('Failed to open chat');
                      console.error('Error opening chat:', error);
                    }
                  }}
                  className="p-2 text-gray-400 hover:text-primary-600 transition-colors relative"
                  title="Open Chat"
                >
                  <MessageSquare className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => window.close()}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Chat Modal */}
      {isChatOpen && workspace && (
        <ProjectChatModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          project={{ id: workspace.project_id, title: workspace.name }}
          workspace={workspace}
        />
      )}
    </div>
  );
};

export default PMLayout;
