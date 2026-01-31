import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  CreditCard,
  Building2,
  Users,
  Calendar,
  Edit2,
  Loader,
  CheckCircle,
  XCircle,
  User,
  Trash2,
} from 'lucide-react';
import { subscriptionsAPI } from '../../services/api';
import toast from 'react-hot-toast';

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function Subscriptions() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [trialEndsAt, setTrialEndsAt] = useState('');

  const { data, isLoading, error } = useQuery(
    'subscriptions',
    () => subscriptionsAPI.getAll().then((res) => res.data.data),
    {
      onError: (err) => {
        if (err.response?.status === 403) {
          toast.error('Super admin access required');
        } else {
          toast.error(err.response?.data?.message || 'Failed to load subscriptions');
        }
      },
    }
  );

  const updateTrialMutation = useMutation(
    ({ workspaceId, trial_ends_at }) => subscriptionsAPI.updateTrial(workspaceId, { trial_ends_at }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('subscriptions');
        setEditingId(null);
        setTrialEndsAt('');
        toast.success('Trial end date updated');
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to update trial');
      },
    }
  );

  const deleteWorkspaceMutation = useMutation(
    (id) => subscriptionsAPI.deleteWorkspace(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('subscriptions');
        toast.success('Workspace deleted');
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to delete workspace');
      },
    }
  );

  const subscriptions = data?.subscriptions || [];

  const handleStartEdit = (sub) => {
    setEditingId(sub.id);
    setTrialEndsAt(sub.trial_ends_at ? new Date(sub.trial_ends_at).toISOString().slice(0, 16) : '');
  };

  const handleSaveTrial = () => {
    if (!editingId) return;
    const value = trialEndsAt ? new Date(trialEndsAt).toISOString() : null;
    updateTrialMutation.mutate({ workspaceId: editingId, trial_ends_at: value });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTrialEndsAt('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="h-10 w-10 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error?.response?.status === 403) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium">Super admin access required to view subscriptions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions & trials</h1>
        <p className="text-gray-600 mt-1">
          View all workspaces, trial periods, and user counts. Edit trial end dates as needed.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {subscriptions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No workspaces found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Workspace
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trial ends
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subscription
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Building2 className="h-5 w-5 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{sub.name}</div>
                          <div className="text-xs text-gray-500">{sub.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{sub.owner_name || '—'}</div>
                      <div className="text-xs text-gray-500">{sub.owner_email || ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                      {sub.plan_type || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingId === sub.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="datetime-local"
                            value={trialEndsAt}
                            onChange={(e) => setTrialEndsAt(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                          />
                          <button
                            onClick={handleSaveTrial}
                            disabled={updateTrialMutation.isLoading}
                            className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                          >
                            {updateTrialMutation.isLoading ? (
                              <Loader className="h-4 w-4 animate-spin" />
                            ) : (
                              'Save'
                            )}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-gray-500 hover:text-gray-700 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900">{formatDate(sub.trial_ends_at)}</span>
                          <button
                            onClick={() => handleStartEdit(sub)}
                            className="text-primary-600 hover:text-primary-800"
                            title="Edit trial end date"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {sub.subscription_id ? (
                        <span className="text-green-700 font-medium">{sub.subscription_id}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <Users className="h-3 w-3 mr-1" />
                        {sub.user_count ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {sub.status === 'active' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="h-3 w-3 mr-1" />
                          {sub.status || '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {editingId !== sub.id && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleStartEdit(sub)}
                            className="text-primary-600 hover:text-primary-900 text-sm font-medium"
                          >
                            Edit trial
                          </button>
                          <button
                            onClick={() => handleDeleteWorkspace(sub)}
                            disabled={deleteWorkspaceMutation.isLoading}
                            className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center gap-1"
                            title="Delete workspace (soft delete)"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
