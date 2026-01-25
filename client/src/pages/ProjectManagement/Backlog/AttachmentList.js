import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Paperclip, Upload, X, Download, File, Image, FileText } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';

const AttachmentList = ({ entityType, entityId }) => {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef(null);

  // Fetch attachments
  const { data: attachmentsData, isLoading } = useQuery(
    ['pm-attachments', entityType, entityId],
    () => pmAPI.getAttachments(entityType, entityId),
    {
      enabled: !!entityType && !!entityId,
    }
  );

  const attachments = attachmentsData?.data?.data || [];

  // Upload mutation
  const uploadMutation = useMutation(
    (formData) => pmAPI.uploadAttachment(entityType, entityId, formData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-attachments', entityType, entityId]);
        toast.success('File uploaded successfully');
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to upload file');
        setIsUploading(false);
      },
    }
  );

  // Delete mutation
  const deleteMutation = useMutation(
    (attachmentId) => pmAPI.deleteAttachment(attachmentId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-attachments', entityType, entityId]);
        toast.success('Attachment deleted successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete attachment');
      },
    }
  );

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    uploadMutation.mutate(formData);
  };

  const handleDownload = async (attachment) => {
    try {
      const response = await pmAPI.downloadAttachment(attachment.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const handleDelete = (attachmentId) => {
    if (window.confirm('Are you sure you want to delete this attachment?')) {
      deleteMutation.mutate(attachmentId);
    }
  };

  const getFileIcon = (mimeType, fileName) => {
    if (mimeType?.startsWith('image/')) {
      return <Image className="h-4 w-4 text-blue-500" />;
    }
    if (mimeType?.includes('pdf') || fileName?.endsWith('.pdf')) {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-gray-500" />
          <h4 className="font-medium text-gray-900">Attachments</h4>
          {attachments.length > 0 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
              {attachments.length}
            </span>
          )}
        </div>
        <label className="cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <div className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
            <Upload className="h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Upload'}
          </div>
        </label>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        </div>
      ) : attachments.length === 0 ? (
        <div className="text-center py-4 text-gray-500 border border-gray-200 rounded-lg">
          <Paperclip className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">No attachments yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getFileIcon(attachment.mime_type, attachment.file_name)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {attachment.file_name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{formatFileSize(attachment.file_size)}</span>
                    <span>•</span>
                    <span>{formatDate(attachment.created_at)}</span>
                    {attachment.uploaded_by_name && (
                      <>
                        <span>•</span>
                        <span>{attachment.uploaded_by_name}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDownload(attachment)}
                  className="p-1 text-gray-400 hover:text-primary-600 rounded"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(attachment.id)}
                  className="p-1 text-gray-400 hover:text-red-600 rounded"
                  title="Delete"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AttachmentList;
