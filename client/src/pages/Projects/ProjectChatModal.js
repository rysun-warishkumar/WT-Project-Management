import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { X, Send, Loader } from 'lucide-react';
import { pmAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import ChatMessageList from './ChatMessageList';

const ProjectChatModal = ({ isOpen, onClose, project, workspace }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [mentions, setMentions] = useState([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(-1);
  const messageInputRef = useRef(null);
  const mentionListRef = useRef(null);

  // Get or create chat room
  const { data: roomData, isLoading: roomLoading } = useQuery(
    ['pm-chat-room', workspace?.id],
    () => pmAPI.getChatRoom(workspace.id),
    {
      enabled: isOpen && !!workspace?.id,
      retry: 1,
    }
  );

  const chatRoom = roomData?.data?.data;

  // Fetch messages - with error handling and reduced polling
  const { data: messagesData, isLoading: messagesLoading, error: messagesError } = useQuery(
    ['pm-chat-messages', chatRoom?.id],
    () => pmAPI.getChatMessages(chatRoom.id, { limit: 50 }),
    {
      enabled: Boolean(isOpen && chatRoom?.id),
      refetchInterval: Boolean(isOpen && chatRoom?.id) ? 10000 : false, // Poll every 10 seconds only when modal is open
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      retry: (failureCount, error) => {
        // Don't retry on 429 errors
        if (error?.response?.status === 429) {
          return false;
        }
        return failureCount < 2;
      },
      onError: (error) => {
        if (error?.response?.status === 429) {
          toast.error('Too many requests. Please wait a moment.');
        }
      },
    }
  );

  const messages = messagesData?.data?.data || [];

  // Fetch workspace members for mentions
  const { data: membersData } = useQuery(
    ['pm-workspace-members-mentions', workspace?.id, mentionSearch],
    () => pmAPI.getWorkspaceMembersForMentions(workspace.id, mentionSearch),
    {
      enabled: isOpen && !!workspace?.id && showMentionList,
      debounce: 300,
    }
  );

  const members = membersData?.data?.data || [];

  // Send message mutation
  const sendMessageMutation = useMutation(
    (data) => {
      if (!chatRoom?.id) {
        throw new Error('Chat room not available');
      }
      return pmAPI.sendChatMessage(chatRoom.id, data);
    },
    {
      onSuccess: () => {
        setMessage('');
        setMentions([]);
        // Invalidate queries to refresh data
        queryClient.invalidateQueries(['pm-chat-messages', chatRoom.id]);
        queryClient.invalidateQueries(['pm-chat-unread-count', chatRoom.id]);
        queryClient.invalidateQueries(['pm-chat-room-notifications']);
      },
      onError: (error) => {
        let errorMessage = 'Failed to send message';
        if (error?.response?.status === 429) {
          errorMessage = 'Too many requests. Please wait a moment before sending another message.';
        } else if (error?.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error?.message) {
          errorMessage = error.message;
        }
        toast.error(errorMessage);
        console.error('Send message error:', error);
      },
    }
  );

  // Mark messages as read
  const markReadMutation = useMutation(
    (messageIds) => pmAPI.markMessagesAsRead(chatRoom.id, messageIds),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-chat-unread-count', chatRoom.id]);
        queryClient.invalidateQueries(['pm-chat-room-notifications']);
      },
      onError: (error) => {
        console.error('Failed to mark messages as read:', error);
      },
    }
  );

  // Handle @ mention
  const handleMessageChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionIndex(lastAtIndex);
        setMentionSearch(textAfterAt);
        setShowMentionList(true);
        return;
      }
    }

    setShowMentionList(false);
    setMentionIndex(-1);
  };

  // Handle mention selection
  const handleMentionSelect = (member) => {
    if (mentionIndex === -1) return;

    const beforeMention = message.substring(0, mentionIndex);
    const afterMention = message.substring(mentionIndex).replace(/@[\w\s]*/, '');
    const newMessage = `${beforeMention}@${member.full_name || member.email}${afterMention}`;

    setMessage(newMessage);
    setMentions([...mentions.filter(m => m !== member.id), member.id]);
    setShowMentionList(false);
    setMentionIndex(-1);
    setMentionSearch('');

    // Focus back on input
    setTimeout(() => {
      if (messageInputRef.current) {
        const newCursorPos = mentionIndex + `@${member.full_name || member.email}`.length;
        messageInputRef.current.focus();
        messageInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle send message
  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (message.length > 5000) {
      toast.error('Message is too long. Maximum 5000 characters allowed.');
      return;
    }

    sendMessageMutation.mutate({
      message: message.trim(),
      mentions: mentions,
    });
  };

  // Mark visible messages as read when modal is open - debounced to avoid too many requests
  useEffect(() => {
    if (!isOpen || !chatRoom?.id || messages.length === 0 || !user?.id) {
      return;
    }

    const unreadMessages = messages
      .filter(msg => !msg.is_read_by_me && msg.user_id !== user.id)
      .map(msg => msg.id);

    if (unreadMessages.length > 0) {
      // Debounce to avoid marking as read too frequently
      const timeoutId = setTimeout(() => {
        markReadMutation.mutate(unreadMessages);
      }, 500); // Faster update after reading

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, chatRoom?.id, messages.length, user?.id]);

  // Close mention list when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        mentionListRef.current &&
        !mentionListRef.current.contains(event.target) &&
        messageInputRef.current &&
        !messageInputRef.current.contains(event.target)
      ) {
        setShowMentionList(false);
      }
    };

    if (showMentionList) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMentionList]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Chat - {project?.title || 'Project'}
            </h2>
            <p className="text-sm text-gray-500">
              {workspace?.name || 'Workspace'} • {members.length} members
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden relative">
          {roomLoading || messagesLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : chatRoom ? (
            <ChatMessageList
              messages={messages}
              chatRoomId={chatRoom.id}
              workspaceId={workspace.id}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Failed to load chat room
            </div>
          )}
        </div>

        {/* Message Input */}
        {chatRoom && (
          <div className="p-4 border-t border-gray-200 relative">
            <form onSubmit={handleSendMessage} className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={messageInputRef}
                  value={message}
                  onChange={handleMessageChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    } else if (e.key === 'ArrowDown' && showMentionList) {
                      e.preventDefault();
                      // Handle keyboard navigation
                    } else if (e.key === 'Escape') {
                      setShowMentionList(false);
                    }
                  }}
                  placeholder="Type a message... Use @ to mention someone"
                  rows={3}
                  maxLength={5000}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
                <div className="absolute bottom-2 right-2 text-xs text-gray-400">
                  {message.length}/5000
                </div>

                {/* Mention List */}
                {showMentionList && (
                  <div
                    ref={mentionListRef}
                    className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50"
                  >
                    {members.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 text-center">
                        No members found
                      </div>
                    ) : (
                      members.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => handleMentionSelect(member)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-semibold">
                            {(member.full_name || member.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {member.full_name || member.email}
                            </p>
                            {member.email && member.full_name && (
                              <p className="text-xs text-gray-500 truncate">{member.email}</p>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={!message.trim() || sendMessageMutation.isLoading}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {sendMessageMutation.isLoading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectChatModal;
