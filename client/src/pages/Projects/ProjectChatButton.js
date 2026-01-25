import React, { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { pmAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { useWorkspaceChatNotifications } from '../../hooks/useChatNotifications';
import ProjectChatModal from './ProjectChatModal';

const ProjectChatButton = ({ project }) => {
  const [workspace, setWorkspace] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Fetch workspace on mount to get notifications
  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        const response = await pmAPI.getWorkspaceByProject(project.id);
        if (response.data.success) {
          setWorkspace(response.data.data);
        }
      } catch (error) {
        // Silently fail - workspace might not exist yet
        console.log('Workspace not found for project:', project.id);
      }
    };

    if (project?.id) {
      fetchWorkspace();
    }
  }, [project?.id]);

  // Get chat notifications for this project's workspace
  const { unreadCount, mentionedCount } = useWorkspaceChatNotifications(workspace?.id);

  const handleOpenChat = async () => {
    try {
      setIsLoading(true);
      // Get or create workspace for this project
      const response = await pmAPI.getWorkspaceByProject(project.id);
      if (response.data.success) {
        const workspaceData = response.data.data;
        setWorkspace(workspaceData);
        setIsChatOpen(true);
      } else {
        toast.error('Project workspace not found');
      }
    } catch (error) {
      toast.error('Failed to open chat. Please ensure project has a workspace.');
      console.error('Error opening chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpenChat}
        disabled={isLoading}
        className="text-primary-600 hover:text-primary-900 relative disabled:opacity-50"
        title="Chat with Project Team"
      >
        <MessageSquare className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {isChatOpen && workspace && (
        <ProjectChatModal
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            setWorkspace(null);
          }}
          project={project}
          workspace={workspace}
        />
      )}
    </>
  );
};

export default ProjectChatButton;
