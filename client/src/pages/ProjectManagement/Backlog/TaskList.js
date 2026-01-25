import React, { useState } from 'react';
import { Plus, CheckSquare, Square, Edit, Trash2, Clock, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { useMutation, useQueryClient } from 'react-query';
import { pmAPI } from '../../../services/api';
import toast from 'react-hot-toast';
import TaskModal from './TaskModal';
import TimeLogList from './TimeLogList';
import ReferenceNumberBadge from './ReferenceNumberBadge';
import AssigneeSelector from './AssigneeSelector';

const TaskList = ({ userStory, tasks, workspace }) => {
  const queryClient = useQueryClient();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [expandedSubtasks, setExpandedSubtasks] = useState(new Set());

  const deleteMutation = useMutation(
    (taskId) => pmAPI.deleteTask(taskId),
    {
      onSuccess: () => {
        toast.success('Task deleted successfully');
        queryClient.invalidateQueries(['pm-tasks', userStory.id]);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete task');
      },
    }
  );

  const toggleTaskStatus = useMutation(
    ({ taskId, newStatus }) => pmAPI.updateTask(taskId, { status: newStatus }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pm-tasks', userStory.id]);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update task');
      },
    }
  );

  const handleTaskClick = (task) => {
    if (task.status === 'done') {
      toggleTaskStatus.mutate({ taskId: task.id, newStatus: 'todo' });
    } else {
      toggleTaskStatus.mutate({ taskId: task.id, newStatus: 'done' });
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900">Tasks</h4>
        <button
          onClick={() => {
            setEditingTask(null);
            setIsTaskModalOpen(true);
          }}
          className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
        >
          <Plus className="h-4 w-4" />
          Add Task
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No tasks yet. Add your first task!</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const isExpanded = expandedTasks.has(task.id);
            const estimatedHours = parseFloat(task.estimated_hours) || 0;
            const loggedHours = parseFloat(task.logged_hours) || 0;
            
            return (
              <div
                key={task.id}
                className="bg-white rounded border border-gray-200 hover:border-primary-300 transition-colors"
              >
                <div className="flex items-center gap-3 p-2">
                  <button
                    onClick={() => handleTaskClick(task)}
                    className="text-gray-400 hover:text-primary-600 transition-colors flex-shrink-0"
                  >
                    {task.status === 'done' ? (
                      <CheckSquare className="h-5 w-5 text-green-600" />
                    ) : (
                      <Square className="h-5 w-5" />
                    )}
                  </button>
                  <ReferenceNumberBadge 
                    referenceNumber={task.reference_number} 
                    size="sm"
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${
                        task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900'
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
                    )}
                    {(estimatedHours > 0 || loggedHours > 0) && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          <span>
                            {loggedHours.toFixed(2)}h / {estimatedHours.toFixed(2)}h
                          </span>
                        </div>
                        {estimatedHours > 0 && (
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                loggedHours > estimatedHours
                                  ? 'bg-red-500'
                                  : loggedHours / estimatedHours > 0.8
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                              }`}
                              style={{
                                width: `${Math.min(100, (loggedHours / estimatedHours) * 100)}%`
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                  <AssigneeSelector
                    workspaceId={workspace.id}
                    currentAssignee={task.assignee_id ? {
                      id: task.assignee_id,
                      full_name: task.assignee_name,
                      email: task.assignee_email
                    } : null}
                    entityType="task"
                    entityId={task.id}
                    size="sm"
                    onSelect={async (assigneeId) => {
                      try {
                        await pmAPI.assignTask(task.id, assigneeId);
                        queryClient.invalidateQueries(['pm-tasks', userStory.id]);
                        toast.success(assigneeId ? 'Task assigned successfully' : 'Task unassigned successfully');
                      } catch (error) {
                        toast.error(error.response?.data?.message || 'Failed to assign task');
                      }
                    }}
                  />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const newExpanded = new Set(expandedTasks);
                        if (isExpanded) {
                          newExpanded.delete(task.id);
                        } else {
                          newExpanded.add(task.id);
                        }
                        setExpandedTasks(newExpanded);
                      }}
                      className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                      title="Time Logs"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingTask(task);
                        setIsTaskModalOpen(true);
                      }}
                      className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this task?')) {
                          deleteMutation.mutate(task.id);
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-gray-200 p-3 bg-gray-50 space-y-4">
                    {/* Subtasks */}
                    {task.subtasks && task.subtasks.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                            <h5 className="text-sm font-medium text-gray-900">
                              Subtasks ({task.completed_subtask_count || 0}/{task.subtask_count || task.subtasks.length})
                            </h5>
                            {task.subtask_progress !== undefined && (
                              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-500"
                                  style={{ width: `${task.subtask_progress}%` }}
                                />
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setEditingTask({ parentTask: task });
                              setIsTaskModalOpen(true);
                            }}
                            className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Add Subtask
                          </button>
                        </div>
                        <div className="ml-6 space-y-1">
                          {task.subtasks.map((subtask) => (
                            <div
                              key={subtask.id}
                              className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded hover:bg-gray-50"
                            >
                              <button
                                onClick={() => {
                                  if (subtask.status === 'done') {
                                    toggleTaskStatus.mutate({ taskId: subtask.id, newStatus: 'todo' });
                                  } else {
                                    toggleTaskStatus.mutate({ taskId: subtask.id, newStatus: 'done' });
                                  }
                                }}
                                className="text-gray-400 hover:text-primary-600 transition-colors flex-shrink-0"
                              >
                                {subtask.status === 'done' ? (
                                  <CheckSquare className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Square className="h-4 w-4" />
                                )}
                              </button>
                              <ReferenceNumberBadge 
                                referenceNumber={subtask.reference_number} 
                                size="sm"
                                className="flex-shrink-0"
                              />
                              <p
                                className={`text-sm flex-1 min-w-0 ${
                                  subtask.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900'
                                }`}
                              >
                                {subtask.title}
                              </p>
                              <AssigneeSelector
                                workspaceId={workspace.id}
                                currentAssignee={subtask.assignee_id ? {
                                  id: subtask.assignee_id,
                                  full_name: subtask.assignee_name,
                                  email: subtask.assignee_email
                                } : null}
                                entityType="task"
                                entityId={subtask.id}
                                size="sm"
                                onSelect={async (assigneeId) => {
                                  try {
                                    await pmAPI.assignTask(subtask.id, assigneeId);
                                    queryClient.invalidateQueries(['pm-tasks', userStory.id]);
                                    toast.success(assigneeId ? 'Subtask assigned successfully' : 'Subtask unassigned successfully');
                                  } catch (error) {
                                    toast.error(error.response?.data?.message || 'Failed to assign subtask');
                                  }
                                }}
                              />
                              <button
                                onClick={() => {
                                  setEditingTask(subtask);
                                  setIsTaskModalOpen(true);
                                }}
                                className="p-1 text-gray-400 hover:text-primary-600"
                                title="Edit"
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('Are you sure you want to delete this subtask?')) {
                                    deleteMutation.mutate(subtask.id);
                                  }
                                }}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(!task.subtasks || task.subtasks.length === 0) && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">No subtasks</span>
                        <button
                          onClick={() => {
                            setEditingTask({ parentTask: task });
                            setIsTaskModalOpen(true);
                          }}
                          className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          Add Subtask
                        </button>
                      </div>
                    )}
                    <TimeLogList task={task} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isTaskModalOpen && (
        <TaskModal
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setEditingTask(null);
          }}
          userStory={userStory}
          task={editingTask && !editingTask.parentTask ? editingTask : null}
          parentTask={editingTask && editingTask.parentTask ? editingTask.parentTask : null}
          workspace={workspace}
        />
      )}
    </div>
  );
};

export default TaskList;
