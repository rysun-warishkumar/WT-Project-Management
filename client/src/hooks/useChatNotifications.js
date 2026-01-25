import { useState } from 'react';
import { useQuery } from 'react-query';
import { pmAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to get unread chat message counts for all workspaces
 * Returns counts for messages where user is mentioned
 */
export const useChatNotifications = () => {
  const { user } = useAuth();

  // This would need to fetch all workspaces the user has access to
  // For now, we'll create a simpler version that can be called per workspace
  // The actual implementation would aggregate across all workspaces

  return {
    totalUnread: 0,
    mentionedCount: 0,
  };
};

/**
 * Hook to get unread count for a specific workspace chat
 * Optimized to reduce API calls and prevent rate limiting
 */
export const useWorkspaceChatNotifications = (workspaceId) => {
  const { user } = useAuth();
  const [hasError, setHasError] = useState(false);

  // Get chat room first - cache for longer
  const { data: roomData } = useQuery(
    ['pm-chat-room-notifications', workspaceId],
    () => pmAPI.getChatRoom(workspaceId),
    {
      enabled: !!workspaceId && !!user?.id && !hasError,
      retry: 1,
      staleTime: 300000, // Cache for 5 minutes
      cacheTime: 600000, // Keep in cache for 10 minutes
      onError: () => {
        setHasError(true);
        // Reset error after 30 seconds
        setTimeout(() => setHasError(false), 30000);
      },
    }
  );

  const chatRoom = roomData?.data?.data;

  // Get unread count - poll less frequently
  const { data: unreadData, error: unreadError } = useQuery(
    ['pm-chat-unread-count', chatRoom?.id],
    () => pmAPI.getUnreadMessageCount(chatRoom.id),
    {
      enabled: !!chatRoom?.id && !!user?.id && !hasError,
      refetchInterval: 30000, // Poll every 30 seconds (reduced from 15)
      refetchOnWindowFocus: false, // Don't refetch on window focus
      retry: (failureCount, error) => {
        // Don't retry on 429 errors
        if (error?.response?.status === 429) {
          return false;
        }
        return failureCount < 2;
      },
      onError: (error) => {
        if (error?.response?.status === 429) {
          setHasError(true);
          // Reset error after 60 seconds on rate limit
          setTimeout(() => setHasError(false), 60000);
        }
      },
    }
  );

  const unreadCount = unreadData?.data?.data?.unread_count || 0;

  // Calculate mentioned count from unread count if possible
  // For now, we'll use a simpler approach - just show unread count
  // The mentioned count can be calculated client-side when messages are loaded
  const mentionedCount = 0; // Will be calculated from messages when chat is opened

  return {
    unreadCount,
    mentionedCount,
    totalUnread: unreadCount,
    hasError: hasError || !!unreadError,
  };
};
