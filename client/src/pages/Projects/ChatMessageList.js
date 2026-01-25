import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const ChatMessageList = ({ messages, chatRoomId, workspaceId }) => {
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const formatMessage = (text, mentions = []) => {
    if (!text) return '';
    
    // Escape HTML to prevent XSS
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // Highlight mentions
    if (mentions && mentions.length > 0) {
      // Replace @username patterns with highlighted spans
      escaped = escaped.replace(/@([^\s@]+)/g, (match, username) => {
        return `<span class="font-semibold text-primary-600 bg-primary-50 px-1 rounded">${match}</span>`;
      });
    }

    // Convert newlines to <br>
    escaped = escaped.replace(/\n/g, '<br>');

    return escaped;
  };

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto p-4 space-y-4 scrollbar-thin"
    >
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <p className="text-lg font-medium mb-2">No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        </div>
      ) : (
        messages.map((message) => {
          const isOwnMessage = message.user_id === user?.id;
          const hasMentions = message.mentions && message.mentions.length > 0;
          const isMentioned = hasMentions && message.mentions.includes(user?.id);

          return (
            <div
              key={message.id}
              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${
                isMentioned ? 'bg-yellow-50 -mx-2 px-2 py-1 rounded' : ''
              }`}
            >
              <div
                className={`max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col`}
              >
                {!isOwnMessage && (
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-6 w-6 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold">
                      {(message.user_name || message.user_email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      {message.user_name || message.user_email || 'Unknown User'}
                    </span>
                    {isMentioned && (
                      <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded">
                        Mentioned you
                      </span>
                    )}
                  </div>
                )}
                <div
                  className={`rounded-lg px-4 py-2 ${
                    isOwnMessage
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p
                    className="text-sm whitespace-pre-wrap break-words"
                    dangerouslySetInnerHTML={{
                      __html: formatMessage(message.message, message.mentions),
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500 mt-1">
                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          );
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessageList;
