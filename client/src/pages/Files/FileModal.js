import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from 'react-query';
import { X, Upload, FileText } from 'lucide-react';
import { filesAPI, clientsAPI, projectsAPI } from '../../services/api';
import toast from 'react-hot-toast';

const FileModal = ({ isOpen, onClose, onSuccess, file }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch clients and projects for dropdowns
  const { data: clientsData } = useQuery(
    ['clients', 'dropdown'],
    () => clientsAPI.getAll({ limit: 1000 }),
    { enabled: isOpen }
  );

  const { data: projectsData } = useQuery(
    ['projects', 'dropdown'],
    () => projectsAPI.getAll({ limit: 1000 }),
    { enabled: isOpen }
  );

  const clients = clientsData?.data?.data?.clients || [];
  const projects = projectsData?.data?.data?.projects || [];

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      client_id: '',
      project_id: '',
      description: '',
      tags: '',
    }
  });

  const watchedClientId = watch('client_id');

  // Filter projects by selected client
  const filteredProjects = watchedClientId
    ? projects.filter(p => p.client_id === parseInt(watchedClientId))
    : projects;

  // Reset form and clear file whenever modal opens (so Upload File always shows a clean form)
  useEffect(() => {
    if (!isOpen) return;
    setSelectedFile(null);
    if (file) {
      reset({
        client_id: file.client_id ? String(file.client_id) : '',
        project_id: file.project_id ? String(file.project_id) : '',
        description: file.description || '',
        tags: file.tags ? (typeof file.tags === 'string' ? file.tags : JSON.stringify(file.tags)) : '',
      });
    } else {
      reset({
        client_id: '',
        project_id: '',
        description: '',
        tags: '',
      });
    }
  }, [isOpen, file, reset]);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (10MB default)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error('File size exceeds 10MB limit');
        return;
      }
      setSelectedFile(file);
    }
  };

  // Upload new file
  const uploadFile = async (formData) => {
    try {
      const response = await filesAPI.upload(formData);
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  // Update file metadata
  const updateFile = async (id, data) => {
    try {
      const response = await filesAPI.update(id, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      if (file) {
        // Update existing file metadata
        const updateData = {
          client_id: data.client_id ? parseInt(data.client_id) : null,
          project_id: data.project_id ? parseInt(data.project_id) : null,
          description: data.description || null,
          tags: data.tags || null,
        };

        await updateFile(file.id, updateData);
        toast.success('File updated successfully');
      } else {
        // Upload new file
        if (!selectedFile) {
          toast.error('Please select a file to upload');
          setIsSubmitting(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);
        if (data.client_id) formData.append('client_id', data.client_id);
        if (data.project_id) formData.append('project_id', data.project_id);
        if (data.description) formData.append('description', data.description);
        if (data.tags) formData.append('tags', data.tags);

        await uploadFile(formData);
        toast.success('File uploaded successfully');
      }

      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save file');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {file ? 'Edit File' : 'Upload File'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {!file && (
            <div>
              <label className="form-label">File *</label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400">
                <div className="space-y-1 text-center">
                  {selectedFile ? (
                    <div className="flex flex-col items-center">
                      <FileText className="h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <>
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600">
                        <label className="relative cursor-pointer rounded-md font-medium text-primary-600 hover:text-primary-500">
                          <span>Upload a file</span>
                          <input
                            type="file"
                            className="sr-only"
                            onChange={handleFileChange}
                            accept="*/*"
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">Max 10MB</p>
                    </>
                  )}
                </div>
              </div>
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="mt-2 text-sm text-red-600 hover:text-red-800"
                >
                  Remove file
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="form-label">Client</label>
              <select
                {...register('client_id')}
                className="form-select"
              >
                <option value="">Select Client (Optional)</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name} {client.company_name && `(${client.company_name})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Project</label>
              <select
                {...register('project_id')}
                className="form-select"
                disabled={!watchedClientId}
              >
                <option value="">Select Project (Optional)</option>
                {filteredProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
              {!watchedClientId && (
                <p className="mt-1 text-xs text-gray-500">Select a client first to filter projects</p>
              )}
            </div>
          </div>

          <div>
            <label className="form-label">Description</label>
            <textarea
              {...register('description')}
              className="form-textarea"
              rows="3"
              placeholder="File description..."
            />
          </div>

          <div>
            <label className="form-label">Tags (JSON format)</label>
            <textarea
              {...register('tags')}
              className="form-textarea"
              rows="2"
              placeholder='["tag1", "tag2", "tag3"]'
            />
            <p className="mt-1 text-xs text-gray-500">Enter tags as a JSON array</p>
          </div>

          {file && (
            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm text-gray-600">
                <strong>Current File:</strong> {file.original_name}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                To replace the file, delete this one and upload a new file.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-4 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || (!file && !selectedFile)}
            >
              {isSubmitting ? 'Saving...' : file ? 'Update' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FileModal;
