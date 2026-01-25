import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { MessageSquare, Send, Edit, Trash2, X } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';

const CommentsSection = ({ entityType, entityId }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');

  // Fetch comments
  const { data: commentsData, isLoading } = useQuery(
    ['pm-comments', entityType, entityId],
    () => pmAPI.getComments(entityType, entityId),
    {
      enabled: !!entityId,
    }
  );

  const comments = commentsData?.data?.data || [];

  // Create comment mutation
  const createMutation = useMutation(
    (data) => pmAPI.createComment(entityType, entityId, data),
    {
      onSuccess: () => {
        toast.success('Comment added successfully');
        queryClient.invalidateQueries(['pm-comments', entityType, entityId]);
        setNewComment('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to add comment');
      },
    }
  );

  // Update comment mutation
  const updateMutation = useMutation(
    ({ id, data }) => pmAPI.updateComment(id, data),
    {
      onSuccess: () => {
        toast.success('Comment updated successfully');
        queryClient.invalidateQueries(['pm-comments', entityType, entityId]);
        setEditingCommentId(null);
        setEditCommentText('');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update comment');
      },
    }
  );

  // Delete comment mutation
  const deleteMutation = useMutation(
    (id) => pmAPI.deleteComment(id),
    {
      onSuccess: () => {
        toast.success('Comment deleted successfully');
        queryClient.invalidateQueries(['pm-comments', entityType, entityId]);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete comment');
      },
    }
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    createMutation.mutate({ comment: newComment });
  };

  const handleEdit = (comment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.comment);
  };

  const handleUpdate = (commentId) => {
    if (!editCommentText.trim()) return;
    updateMutation.mutate({ id: commentId, data: { comment: editCommentText } });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="h-5 w-5 text-gray-400" />
        <h4 className="text-sm font-medium text-gray-900">Comments ({comments.length})</h4>
      </div>

      {/* Comments List */}
      <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading comments...</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-500">No comments yet. Be the first to comment!</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
              {editingCommentId === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editCommentText}
                    onChange={(e) => setEditCommentText(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdate(comment.id)}
                      className="px-3 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingCommentId(null);
                        setEditCommentText('');
                      }}
                      className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {comment.created_by_name || comment.created_by_username || 'Unknown User'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.comment}</p>
                    </div>
                    {comment.created_by === user?.id && (
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => handleEdit(comment)}
                          className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this comment?')) {
                              deleteMutation.mutate(comment.id);
                            }
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="flex items-start gap-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={2}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
        />
        <button
          type="submit"
          disabled={!newComment.trim() || createMutation.isLoading}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};

export default CommentsSection;
