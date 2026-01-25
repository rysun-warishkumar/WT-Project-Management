import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { BarChart3, TrendingUp, Clock, Users, Activity, Download } from 'lucide-react';
import { pmAPI } from '../../../services/api';

const ReportsView = ({ workspace }) => {
  const [selectedReport, setSelectedReport] = useState('summary');

  // Fetch summary data
  const { data: summaryData, isLoading: summaryLoading } = useQuery(
    ['pm-reports-summary', workspace.id],
    () => pmAPI.getSummary(workspace.id),
    {
      enabled: !!workspace?.id && selectedReport === 'summary',
    }
  );

  // Fetch velocity data
  const { data: velocityData, isLoading: velocityLoading } = useQuery(
    ['pm-reports-velocity', workspace.id],
    () => pmAPI.getVelocity(workspace.id),
    {
      enabled: !!workspace?.id && selectedReport === 'velocity',
    }
  );

  // Fetch cycle time data
  const { data: cycleTimeData, isLoading: cycleTimeLoading } = useQuery(
    ['pm-reports-cycle-time', workspace.id],
    () => pmAPI.getCycleTime(workspace.id),
    {
      enabled: !!workspace?.id && selectedReport === 'cycle-time',
    }
  );

  // Fetch throughput data
  const { data: throughputData, isLoading: throughputLoading } = useQuery(
    ['pm-reports-throughput', workspace.id],
    () => pmAPI.getThroughput(workspace.id),
    {
      enabled: !!workspace?.id && selectedReport === 'throughput',
    }
  );

  // Fetch cumulative flow data
  const { data: flowData, isLoading: flowLoading } = useQuery(
    ['pm-reports-flow', workspace.id],
    () => pmAPI.getCumulativeFlow(workspace.id, { days: 30 }),
    {
      enabled: !!workspace?.id && selectedReport === 'flow',
    }
  );

  // Fetch workload data
  const { data: workloadData, isLoading: workloadLoading } = useQuery(
    ['pm-reports-workload', workspace.id],
    () => pmAPI.getWorkload(workspace.id),
    {
      enabled: !!workspace?.id && selectedReport === 'workload',
    }
  );

  const reports = [
    { id: 'summary', name: 'Summary', icon: BarChart3 },
    { id: 'velocity', name: 'Velocity', icon: TrendingUp },
    { id: 'cycle-time', name: 'Cycle Time', icon: Clock },
    { id: 'throughput', name: 'Throughput', icon: Activity },
    { id: 'flow', name: 'Cumulative Flow', icon: BarChart3 },
    { id: 'workload', name: 'Team Workload', icon: Users },
  ];

  const renderSummary = () => {
    const summary = summaryData?.data?.data;
    if (summaryLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      );
    }

    if (!summary) return null;

    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Stories"
            value={summary.total_stories}
            subtitle={`${summary.completed_stories} completed`}
            color="blue"
          />
          <MetricCard
            title="Total Tasks"
            value={summary.total_tasks}
            subtitle={`${summary.completed_tasks} completed`}
            color="green"
          />
          <MetricCard
            title="Story Points"
            value={summary.total_story_points.toFixed(1)}
            subtitle={`${summary.completed_story_points.toFixed(1)} completed`}
            color="purple"
          />
          <MetricCard
            title="Completion Rate"
            value={`${summary.completion_rate}%`}
            subtitle={`${summary.completed_sprints}/${summary.total_sprints} sprints`}
            color="orange"
          />
        </div>

        {/* Progress Bars */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress Overview</h3>
          <div className="space-y-4">
            <ProgressBar
              label="Stories"
              current={summary.completed_stories}
              total={summary.total_stories}
              color="blue"
            />
            <ProgressBar
              label="Tasks"
              current={summary.completed_tasks}
              total={summary.total_tasks}
              color="green"
            />
            <ProgressBar
              label="Story Points"
              current={summary.completed_story_points}
              total={summary.total_story_points}
              color="purple"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderVelocity = () => {
    const velocity = velocityData?.data?.data;
    if (velocityLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      );
    }

    if (!velocity || !velocity.sprints || velocity.sprints.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No velocity data available</h3>
          <p className="text-gray-600">Complete some sprints to see velocity metrics.</p>
        </div>
      );
    }

    const maxVelocity = Math.max(...velocity.sprints.map(s => s.completed_points), 1);
    const chartHeight = 300;
    const chartWidth = Math.max(600, velocity.sprints.length * 80);

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Sprint Velocity</h3>
            <div className="text-right">
              <p className="text-sm text-gray-500">Average Velocity</p>
              <p className="text-2xl font-bold text-primary-600">{velocity.average_velocity.toFixed(1)} SP</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <svg width={chartWidth} height={chartHeight} className="min-w-full">
              {velocity.sprints.map((sprint, index) => {
                const x = (index * chartWidth) / velocity.sprints.length + 40;
                const barHeight = (sprint.completed_points / maxVelocity) * (chartHeight - 80);
                const y = chartHeight - 40 - barHeight;
                return (
                  <g key={sprint.id}>
                    <rect
                      x={x - 20}
                      y={y}
                      width={40}
                      height={barHeight}
                      fill="#3B82F6"
                      rx={4}
                    />
                    <text
                      x={x}
                      y={y - 5}
                      textAnchor="middle"
                      className="text-xs fill-gray-700"
                    >
                      {sprint.completed_points.toFixed(1)}
                    </text>
                    <text
                      x={x}
                      y={chartHeight - 20}
                      textAnchor="middle"
                      className="text-xs fill-gray-500"
                      transform={`rotate(-45 ${x} ${chartHeight - 20})`}
                    >
                      {sprint.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {velocity.sprints.map((sprint) => (
            <div key={sprint.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h4 className="font-semibold text-gray-900 mb-2">{sprint.name}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed:</span>
                  <span className="font-medium">{sprint.completed_points.toFixed(1)} SP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Committed:</span>
                  <span className="font-medium">{sprint.committed_points.toFixed(1)} SP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Velocity:</span>
                  <span className="font-medium text-primary-600">{sprint.velocity.toFixed(1)} SP</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCycleTime = () => {
    const cycleTime = cycleTimeData?.data?.data;
    if (cycleTimeLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      );
    }

    if (!cycleTime || !cycleTime.tasks || cycleTime.tasks.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No cycle time data available</h3>
          <p className="text-gray-600">Complete some tasks to see cycle time metrics.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Average Cycle Time"
            value={`${cycleTime.average_cycle_time_days.toFixed(1)} days`}
            subtitle="Time from start to completion"
            color="blue"
          />
          <MetricCard
            title="Median Cycle Time"
            value={`${cycleTime.median_cycle_time_days.toFixed(1)} days`}
            subtitle="Middle value"
            color="green"
          />
          <MetricCard
            title="Tasks Analyzed"
            value={cycleTime.tasks.length}
            subtitle="Completed tasks"
            color="purple"
          />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Cycle Times</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Story</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cycle Time</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cycleTime.tasks.slice(0, 20).map((task) => (
                  <tr key={task.task_id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{task.task_title}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{task.story_title}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {task.cycle_time_days.toFixed(1)} days
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderThroughput = () => {
    const throughput = throughputData?.data?.data;
    if (throughputLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      );
    }

    if (!throughput || !throughput.sprints || throughput.sprints.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No throughput data available</h3>
          <p className="text-gray-600">Complete some sprints to see throughput metrics.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sprint Throughput</h3>
          <div className="space-y-4">
            {throughput.sprints.map((sprint) => (
              <div key={sprint.id} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">{sprint.name}</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Stories Completed</p>
                    <p className="text-2xl font-bold text-blue-600">{sprint.stories_completed}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tasks Completed</p>
                    <p className="text-2xl font-bold text-green-600">{sprint.tasks_completed}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Story Points</p>
                    <p className="text-2xl font-bold text-purple-600">{sprint.story_points_completed.toFixed(1)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderCumulativeFlow = () => {
    const flow = flowData?.data?.data;
    if (flowLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      );
    }

    if (!flow || !flow.flow || flow.flow.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No flow data available</h3>
          <p className="text-gray-600">Work on stories to see cumulative flow diagram.</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cumulative Flow Diagram (Last 30 Days)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Shows the number of stories in each status over time
        </p>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            <div className="flex items-end space-x-1 h-64">
              {flow.flow.map((day, index) => {
                const total = day.backlog + day.sprint + day.in_progress + day.testing + day.done;
                if (total === 0) return null;
                return (
                  <div key={index} className="flex-1 flex flex-col justify-end">
                    <div className="relative" style={{ height: '200px' }}>
                      <div
                        className="absolute bottom-0 w-full bg-blue-500"
                        style={{ height: `${(day.backlog / total) * 100}%` }}
                        title={`Backlog: ${day.backlog}`}
                      />
                      <div
                        className="absolute bottom-0 w-full bg-yellow-500"
                        style={{
                          height: `${((day.backlog + day.sprint) / total) * 100}%`,
                          clipPath: `inset(${(day.backlog / total) * 100}% 0 0 0)`,
                        }}
                        title={`Sprint: ${day.sprint}`}
                      />
                      <div
                        className="absolute bottom-0 w-full bg-orange-500"
                        style={{
                          height: `${((day.backlog + day.sprint + day.in_progress) / total) * 100}%`,
                          clipPath: `inset(${((day.backlog + day.sprint) / total) * 100}% 0 0 0)`,
                        }}
                        title={`In Progress: ${day.in_progress}`}
                      />
                      <div
                        className="absolute bottom-0 w-full bg-purple-500"
                        style={{
                          height: `${((day.backlog + day.sprint + day.in_progress + day.testing) / total) * 100}%`,
                          clipPath: `inset(${((day.backlog + day.sprint + day.in_progress) / total) * 100}% 0 0 0)`,
                        }}
                        title={`Testing: ${day.testing}`}
                      />
                      <div
                        className="absolute bottom-0 w-full bg-green-500"
                        style={{
                          height: `${((day.backlog + day.sprint + day.in_progress + day.testing + day.done) / total) * 100}%`,
                          clipPath: `inset(${((day.backlog + day.sprint + day.in_progress + day.testing) / total) * 100}% 0 0 0)`,
                        }}
                        title={`Done: ${day.done}`}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 text-center transform -rotate-45 origin-top-left">
                      {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mt-4">
          <LegendItem color="blue" label="Backlog" />
          <LegendItem color="yellow" label="Sprint" />
          <LegendItem color="orange" label="In Progress" />
          <LegendItem color="purple" label="Testing" />
          <LegendItem color="green" label="Done" />
        </div>
      </div>
    );
  };

  const renderWorkload = () => {
    const workload = workloadData?.data?.data;
    if (workloadLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      );
    }

    if (!workload || !workload.members || workload.members.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No workload data available</h3>
          <p className="text-gray-600">Assign stories and tasks to see workload distribution.</p>
        </div>
      );
    }

    const maxWorkload = Math.max(...workload.members.map(m => m.remaining_story_points), 1);

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Workload Distribution</h3>
          <div className="space-y-4">
            {workload.members.map((member) => (
              <div key={member.user_id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{member.name}</h4>
                    <p className="text-sm text-gray-500">{member.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Remaining Story Points</p>
                    <p className="text-2xl font-bold text-orange-600">{member.remaining_story_points.toFixed(1)}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div
                    className="bg-orange-500 h-2 rounded-full"
                    style={{ width: `${(member.remaining_story_points / maxWorkload) * 100}%` }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Stories</p>
                    <p className="font-medium">{member.stories_assigned}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Tasks</p>
                    <p className="font-medium">{member.tasks_assigned}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Completed</p>
                    <p className="font-medium text-green-600">{member.tasks_completed}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Completed SP</p>
                    <p className="font-medium text-green-600">{member.completed_story_points.toFixed(1)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderReport = () => {
    switch (selectedReport) {
      case 'summary':
        return renderSummary();
      case 'velocity':
        return renderVelocity();
      case 'cycle-time':
        return renderCycleTime();
      case 'throughput':
        return renderThroughput();
      case 'flow':
        return renderCumulativeFlow();
      case 'workload':
        return renderWorkload();
      default:
        return renderSummary();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary-600" />
            Reports & Analytics
          </h2>
          <p className="text-gray-600 mt-1">Track team performance and project metrics</p>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            {reports.map((report) => {
              const Icon = report.icon;
              return (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    selectedReport === report.id
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {report.name}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="p-6">
          {renderReport()}
        </div>
      </div>
    </div>
  );
};

// Helper Components
const MetricCard = ({ title, value, subtitle, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
    orange: 'bg-orange-50 border-orange-200 text-orange-600',
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border-2 ${colorClasses[color]} p-4`}>
      <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
      <p className="text-3xl font-bold mb-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
};

const ProgressBar = ({ label, current, total, color }) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-600">
          {current} / {total} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${colorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const LegendItem = ({ color, label }) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-4 h-4 rounded ${colorClasses[color]}`} />
      <span className="text-sm text-gray-600">{label}</span>
    </div>
  );
};

export default ReportsView;
