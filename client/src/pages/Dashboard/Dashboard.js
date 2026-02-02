import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import {
  Users,
  FolderOpen,
  FileText,
  Receipt,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { dashboardAPI } from '../../services/api';
import StatCard from '../../components/Dashboard/StatCard';
import RecentActivities from '../../components/Dashboard/RecentActivities';
import UpcomingDueDates from '../../components/Dashboard/UpcomingDueDates';
import ProjectStatusChart from '../../components/Dashboard/ProjectStatusChart';
import RevenueChart from '../../components/Dashboard/RevenueChart';

const Dashboard = () => {
  const {
    data: overviewData,
    isLoading: overviewLoading,
    error: overviewError,
  } = useQuery('dashboard-overview', dashboardAPI.getOverview, {
    refetchInterval: 300000, // Refetch every 5 minutes
  });

  const {
    data: quickStatsData,
    isLoading: quickStatsLoading,
  } = useQuery('dashboard-quick-stats', dashboardAPI.getQuickStats);

  const {
    data: recentProjectsData,
    isLoading: recentProjectsLoading,
  } = useQuery('dashboard-recent-projects', dashboardAPI.getRecentProjects);

  const {
    data: recentInvoicesData,
    isLoading: recentInvoicesLoading,
  } = useQuery('dashboard-recent-invoices', dashboardAPI.getRecentInvoices);

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner h-8 w-8"></div>
      </div>
    );
  }

  if (overviewError) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load dashboard data</p>
      </div>
    );
  }

  // API response structure: { data: { success: true, data: { stats: {...}, ... } } }
  const stats = overviewData?.data?.data?.stats || {};
  const quickStats = quickStatsData?.data?.data || {};

  // Calculate percentage changes (comparing with previous period)
  const calculateChange = (current, previous) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      type: change >= 0 ? 'positive' : 'negative',
    };
  };

  const statCards = [
    {
      title: 'Total Clients',
      value: stats.total_clients || 0,
      subtitle: `${stats.active_clients || 0} active`,
      icon: Users,
      color: 'primary',
      change: stats.new_clients_month ? `+${stats.new_clients_month} this month` : null,
      changeType: 'positive',
    },
    {
      title: 'Total Projects',
      value: stats.total_projects || 0,
      subtitle: `${stats.active_projects || 0} active, ${stats.completed_projects || 0} completed`,
      icon: FolderOpen,
      color: 'success',
      change: null,
      changeType: 'positive',
    },
    {
      title: 'Total Quotations',
      value: stats.total_quotations || 0,
      subtitle: `${stats.pending_quotations || 0} pending`,
      icon: FileText,
      color: 'warning',
      change: null,
      changeType: 'neutral',
    },
    {
      title: 'Total Invoices',
      value: stats.total_invoices || 0,
      subtitle: `${stats.unpaid_invoices || 0} unpaid`,
      icon: Receipt,
      color: 'danger',
      change: stats.total_revenue ? `Revenue: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(stats.total_revenue)}` : null,
      changeType: 'positive',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600">
            Welcome back! Here's what's happening with your business.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-500">
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <span className="whitespace-nowrap">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Project Status Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Project Status Distribution</h3>
          </div>
          <div className="card-body">
            <ProjectStatusChart data={overviewData?.data?.data?.projectStatusDistribution || []} />
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Monthly Revenue</h3>
          </div>
          <div className="card-body">
            <RevenueChart data={overviewData?.data?.data?.monthlyRevenue || []} />
          </div>
        </div>
      </div>

      {/* Recent Activities and Upcoming Due Dates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Recent Activities</h3>
          </div>
          <div className="card-body">
            <RecentActivities activities={(overviewData?.data?.data?.recentActivities || []).slice(0, 5)} />
          </div>
        </div>

        {/* Upcoming Due Dates */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Upcoming Due Dates</h3>
          </div>
          <div className="card-body">
            <UpcomingDueDates dueDates={overviewData?.data?.data?.upcomingDueDates || []} />
          </div>
        </div>
      </div>

      {/* Recent Projects and Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Recent Projects</h3>
          </div>
          <div className="card-body">
            {recentProjectsLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="spinner h-6 w-6"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {recentProjectsData?.data?.data && recentProjectsData.data.data.length > 0 ? (
                  recentProjectsData.data.data.map((project) => (
                    <div key={project.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900">{project.title}</h4>
                        <p className="text-sm text-gray-600">{project.client_name}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`badge badge-${getStatusColor(project.status)}`}>
                          {project.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No recent projects found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recent Invoices */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Recent Invoices</h3>
          </div>
          <div className="card-body">
            {recentInvoicesLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="spinner h-6 w-6"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {recentInvoicesData?.data?.data && recentInvoicesData.data.data.length > 0 ? (
                  recentInvoicesData.data.data.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900">{invoice.invoice_number}</h4>
                        <p className="text-sm text-gray-600">{invoice.client_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          ${parseFloat(invoice.total_amount).toFixed(2)}
                        </p>
                        <span className={`badge badge-${getStatusColor(invoice.status)}`}>
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No recent invoices found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/clients"
              className="flex flex-col items-center p-4 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
            >
              <Users className="h-8 w-8 text-primary-600 mb-2" />
              <span className="text-sm font-medium text-primary-900">Add Client</span>
            </Link>
            <Link
              to="/projects"
              className="flex flex-col items-center p-4 bg-success-50 rounded-lg hover:bg-success-100 transition-colors"
            >
              <FolderOpen className="h-8 w-8 text-success-600 mb-2" />
              <span className="text-sm font-medium text-success-900">New Project</span>
            </Link>
            <Link
              to="/quotations"
              className="flex flex-col items-center p-4 bg-warning-50 rounded-lg hover:bg-warning-100 transition-colors"
            >
              <FileText className="h-8 w-8 text-warning-600 mb-2" />
              <span className="text-sm font-medium text-warning-900">Create Quote</span>
            </Link>
            <Link
              to="/invoices"
              className="flex flex-col items-center p-4 bg-danger-50 rounded-lg hover:bg-danger-100 transition-colors"
            >
              <Receipt className="h-8 w-8 text-danger-600 mb-2" />
              <span className="text-sm font-medium text-danger-900">New Invoice</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

const getStatusColor = (status) => {
  switch (status) {
    case 'active':
    case 'completed':
    case 'paid':
      return 'success';
    case 'in_progress':
    case 'sent':
      return 'warning';
    case 'cancelled':
    case 'overdue':
      return 'danger';
    case 'planning':
    case 'draft':
      return 'secondary';
    default:
      return 'info';
  }
};

export default Dashboard;
