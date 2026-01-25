import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Plus, Edit2, Trash2, Filter } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import EpicModal from './EpicModal';
import ReferenceNumberBadge from './ReferenceNumberBadge';

const EpicList = ({ workspace, selectedEpicId, onEpicSelect }) => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEpic, setEditingEpic] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Fetch epics
  const { data: epicsData, isLoading } = useQuery(
    ['pm-epics', workspace.id, statusFilter],
    () => pmAPI.getEpics(workspace.id, { status: statusFilter || undefined }),
    {
      enabled: !!workspace?.id,
    }
  );

  const epics = epicsData?.data?.data || [];

  // Delete epic mutation
  const deleteMutation = useMutation(
    (epicId) => pmAPI.deleteEpic(epicId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-epics', workspace.id]);
        toast.success('Epic deleted successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete epic');
      },
    }
  );

  const handleAddEpic = () => {
    setEditingEpic(null);
    setIsModalOpen(true);
  };

  const handleEditEpic = (epic) => {
    setEditingEpic(epic);
    setIsModalOpen(true);
  };

  const handleDeleteEpic = (epicId) => {
    if (window.confirm('Are you sure you want to delete this epic? User stories linked to this epic will need to be reassigned.')) {
      deleteMutation.mutate(epicId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Epics</h3>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          <button
            onClick={handleAddEpic}
            className="btn btn-primary btn-sm flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Epic
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {epics.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No epics found</p>
            <button
              onClick={handleAddEpic}
              className="mt-2 text-primary-600 hover:text-primary-700 text-sm"
            >
              Create your first epic
            </button>
          </div>
        ) : (
          epics.map((epic) => (
            <div
              key={epic.id}
              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                selectedEpicId === epic.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => onEpicSelect(epic.id === selectedEpicId ? null : epic.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className="w-4 h-4 rounded mt-1 flex-shrink-0"
                    style={{ backgroundColor: epic.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <ReferenceNumberBadge 
                        referenceNumber={epic.reference_number} 
                        size="sm"
                        className="flex-shrink-0"
                      />
                      <h4 className="font-medium text-gray-900 truncate">{epic.name}</h4>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          epic.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : epic.status === 'completed'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {epic.status}
                      </span>
                    </div>
                    {epic.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{epic.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>{epic.total_stories} stories</span>
                      <span>{epic.total_story_points.toFixed(1)} SP</span>
                      <span className="text-green-600">
                        {epic.completed_stories}/{epic.total_stories} done
                      </span>
                    </div>
                    {epic.total_stories > 0 && (
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{
                            width: `${epic.progress_percentage}%`,
                            backgroundColor: epic.color,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditEpic(epic);
                    }}
                    className="p-1 text-gray-400 hover:text-primary-600 rounded"
                    title="Edit epic"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEpic(epic.id);
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 rounded"
                    title="Delete epic"
                    disabled={epic.total_stories > 0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <EpicModal
        workspace={workspace}
        epic={editingEpic}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEpic(null);
        }}
      />
    </div>
  );
};

export default EpicList;
