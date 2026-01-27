import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Settings, Users, Plus, Edit2, Trash2, Search, Save, X, GitBranch } from 'lucide-react';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import CicdIntegrations from './CicdIntegrations';

const SettingsView = ({ workspace }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('general');
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  // Fetch workspace settings
  const { data: settingsData, isLoading } = useQuery(
    ['pm-workspace-settings', workspace.id],
    () => pmAPI.getWorkspaceSettings(workspace.id),
    {
      enabled: !!workspace?.id,
    }
  );

  const settings = settingsData?.data?.data;
  const members = settings?.members || [];
  const userRole = settings?.user_role;

  // Workspace settings form
  const [workspaceForm, setWorkspaceForm] = useState({
    name: '',
    description: '',
    workspace_type: 'scrum',
  });

  React.useEffect(() => {
    if (settings?.workspace) {
      setWorkspaceForm({
        name: settings.workspace.name || '',
        description: settings.workspace.description || '',
        workspace_type: settings.workspace.workspace_type || 'scrum',
      });
    }
  }, [settings]);

  // Search users for adding members
  const { data: usersData } = useQuery(
    ['pm-users-search', workspace.id, userSearch],
    () => pmAPI.getUsersForWorkspace(workspace.id, userSearch),
    {
      enabled: isMemberModalOpen && userSearch.length >= 2 && !!workspace?.id,
      debounce: 300,
    }
  );

  const users = usersData?.data?.data || [];

  // Update workspace settings mutation
  const updateWorkspaceMutation = useMutation(
    (data) => pmAPI.updateWorkspaceSettings(workspace.id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-workspace-settings', workspace.id]);
        queryClient.invalidateQueries(['pm-workspace', workspace.id]);
        toast.success('Workspace settings updated successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update workspace settings');
      },
    }
  );

  // Add member mutation
  const addMemberMutation = useMutation(
    (data) => pmAPI.addWorkspaceMember(workspace.id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-workspace-settings', workspace.id]);
        setIsMemberModalOpen(false);
        setUserSearch('');
        setSelectedUserId('');
        toast.success('Member added successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to add member');
      },
    }
  );

  // Update member mutation
  const updateMemberMutation = useMutation(
    ({ memberId, data }) => pmAPI.updateWorkspaceMember(workspace.id, memberId, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-workspace-settings', workspace.id]);
        setEditingMember(null);
        toast.success('Member updated successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update member');
      },
    }
  );

  // Remove member mutation
  const removeMemberMutation = useMutation(
    (memberId) => pmAPI.removeWorkspaceMember(workspace.id, memberId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-workspace-settings', workspace.id]);
        toast.success('Member removed successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to remove member');
      },
    }
  );

  const handleWorkspaceUpdate = (e) => {
    e.preventDefault();
    updateWorkspaceMutation.mutate(workspaceForm);
  };

  const handleAddMember = (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      toast.error('Please select a user');
      return;
    }
    addMemberMutation.mutate({
      user_id: parseInt(selectedUserId),
      role: 'member',
    });
  };

  const handleUpdateMember = (memberId, role) => {
    updateMemberMutation.mutate({
      memberId,
      data: { role },
    });
  };

  const handleRemoveMember = (memberId) => {
    if (window.confirm('Are you sure you want to remove this member?')) {
      removeMemberMutation.mutate(memberId);
    }
  };

  const canManageMembers = userRole === 'owner' || userRole === 'admin';
  const canEditSettings = userRole === 'owner' || userRole === 'admin';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary-600" />
            Workspace Settings
          </h2>
          <p className="text-gray-600 mt-1">Manage workspace configuration and members</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'general'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              General Settings
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'members'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Members ({members.length})
            </button>
            <button
              onClick={() => setActiveTab('cicd')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'cicd'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <GitBranch className="h-4 w-4 inline mr-2" />
              CI/CD
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* General Settings Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <form onSubmit={handleWorkspaceUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    value={workspaceForm.name}
                    onChange={(e) => setWorkspaceForm({ ...workspaceForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={!canEditSettings}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={workspaceForm.description}
                    onChange={(e) => setWorkspaceForm({ ...workspaceForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    rows={4}
                    disabled={!canEditSettings}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Workspace Type
                  </label>
                  <select
                    value={workspaceForm.workspace_type}
                    onChange={(e) => setWorkspaceForm({ ...workspaceForm, workspace_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={!canEditSettings}
                  >
                    <option value="scrum">Scrum</option>
                    <option value="kanban">Kanban</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>

                {canEditSettings && (
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={updateWorkspaceMutation.isLoading}
                      className="btn btn-primary flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {updateWorkspaceMutation.isLoading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}

                {!canEditSettings && (
                  <p className="text-sm text-gray-500">
                    Only workspace owners and admins can edit settings.
                  </p>
                )}
              </form>

              {/* Project Info */}
              {settings?.workspace?.project_title && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Linked Project</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Project:</span> {settings.workspace.project_title}
                    </p>
                    {settings.workspace.client_name && (
                      <p className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Client:</span> {settings.workspace.client_name}
                        {settings.workspace.client_company && ` (${settings.workspace.client_company})`}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="space-y-6">
              {canManageMembers && (
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setIsMemberModalOpen(true);
                      setEditingMember(null);
                    }}
                    className="btn btn-primary flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Member
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {members.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No members found</p>
                  </div>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 font-semibold">
                            {member.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{member.full_name}</p>
                          <p className="text-sm text-gray-500">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <select
                          value={member.role}
                          onChange={(e) => handleUpdateMember(member.id, e.target.value)}
                          disabled={!canManageMembers || member.role === 'owner'}
                          className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        {canManageMembers && member.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* CI/CD Tab */}
          {activeTab === 'cicd' && (
            <CicdIntegrations workspace={workspace} />
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Add Member</h3>
                <button
                  onClick={() => {
                    setIsMemberModalOpen(false);
                    setUserSearch('');
                    setSelectedUserId('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <form onSubmit={handleAddMember} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Users
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setSelectedUserId('');
                    }}
                    placeholder="Search by name, email, or username..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                {userSearch.length >= 2 && users.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                    {users.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setUserSearch(user.full_name || user.email);
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors ${
                          selectedUserId === user.id.toString() ? 'bg-primary-50' : ''
                        }`}
                      >
                        <p className="font-medium text-gray-900">{user.full_name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </button>
                    ))}
                  </div>
                )}
                {userSearch.length >= 2 && users.length === 0 && (
                  <p className="mt-2 text-sm text-gray-500">No users found</p>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsMemberModalOpen(false);
                    setUserSearch('');
                    setSelectedUserId('');
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedUserId || addMemberMutation.isLoading}
                  className="btn btn-primary"
                >
                  {addMemberMutation.isLoading ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
