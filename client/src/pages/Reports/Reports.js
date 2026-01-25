import React, { useState } from 'react';
import { useQuery } from 'react-query';
import {
  BarChart3,
  DollarSign,
  Users,
  FolderOpen,
  Receipt,
  Download,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
} from 'lucide-react';
import { reportsAPI, clientsAPI, projectsAPI } from '../../services/api';
import toast from 'react-hot-toast';

const Reports = () => {
  const [reportType, setReportType] = useState('summary');
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    client_id: '',
    project_id: '',
    status: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Fetch clients and projects for filters
  const { data: clientsData } = useQuery(
    ['clients', 'dropdown'],
    () => clientsAPI.getAll({ limit: 1000 }),
    { enabled: showFilters }
  );

  const { data: projectsData } = useQuery(
    ['projects', 'dropdown'],
    () => projectsAPI.getAll({ limit: 1000 }),
    { enabled: Boolean(showFilters && filters.client_id) }
  );

  const clients = clientsData?.data?.data?.clients || [];
  const projects = projectsData?.data?.data?.projects || [];

  // Fetch report data based on type
  const {
    data: reportData,
    isLoading,
    error,
    refetch,
  } = useQuery(
    ['report', reportType, filters],
    () => {
      const params = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.client_id) params.client_id = filters.client_id;
      if (filters.project_id) params.project_id = filters.project_id;
      if (filters.status) params.status = filters.status;

      switch (reportType) {
        case 'financial':
          return reportsAPI.getFinancial(params);
        case 'client-performance':
          return reportsAPI.getClientPerformance(params);
        case 'project-performance':
          return reportsAPI.getProjectPerformance(params);
        case 'invoices':
          return reportsAPI.getInvoices(params);
        case 'summary':
          return reportsAPI.getSummary();
        default:
          return reportsAPI.getSummary();
      }
    },
    {
      enabled: reportType !== '',
      retry: 2,
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to load report');
      },
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      // Reset project_id when client changes
      ...(key === 'client_id' && { project_id: '' }),
    }));
  };

  const clearFilters = () => {
    setFilters({
      start_date: '',
      end_date: '',
      client_id: '',
      project_id: '',
      status: '',
    });
  };

  const handleExport = (format) => {
    toast.info(`Export to ${format.toUpperCase()} will be available soon`);
    // TODO: Implement export functionality
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderSummaryReport = () => {
    const data = reportData?.data?.data || {};
    
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Clients</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{data.total_clients || 0}</p>
                <p className="text-xs text-gray-500 mt-1">{data.active_clients || 0} active</p>
              </div>
              <Users className="w-10 h-10 text-primary-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Projects</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{data.total_projects || 0}</p>
                <p className="text-xs text-gray-500 mt-1">{data.active_projects || 0} active, {data.completed_projects || 0} completed</p>
              </div>
              <FolderOpen className="w-10 h-10 text-success-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(data.total_revenue)}</p>
                <p className="text-xs text-gray-500 mt-1">{formatCurrency(data.outstanding_amount)} outstanding</p>
              </div>
              <DollarSign className="w-10 h-10 text-warning-600 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Invoices</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{data.total_invoices || 0}</p>
                <p className="text-xs text-gray-500 mt-1">{data.paid_invoices || 0} paid, {data.unpaid_invoices || 0} unpaid</p>
              </div>
              <Receipt className="w-10 h-10 text-danger-600 opacity-20" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Total Quotations</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{data.total_quotations || 0}</p>
            <p className="text-xs text-gray-500 mt-1">{data.pending_quotations || 0} pending</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Active Users</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{data.active_users || 0}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Total Files</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{data.total_files || 0}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderFinancialReport = () => {
    const data = reportData?.data?.data || {};
    const summary = data.summary || {};
    const revenueByMonth = data.revenue_by_month || [];
    const revenueByClient = data.revenue_by_client || [];

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Total Invoiced</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.total_amount)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Total Paid</p>
            <p className="text-2xl font-bold text-success-600 mt-1">{formatCurrency(summary.total_paid)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Outstanding</p>
            <p className="text-2xl font-bold text-warning-600 mt-1">{formatCurrency(summary.total_outstanding)}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600">Average Invoice</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(summary.average_invoice_amount)}</p>
          </div>
        </div>

        {/* Revenue by Month */}
        {revenueByMonth.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Month</h3>
            <div className="space-y-3">
              {revenueByMonth.map((month, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{month.month_name}</p>
                    <p className="text-sm text-gray-600">{month.invoice_count} invoices</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(month.total_amount)}</p>
                    <p className="text-sm text-gray-600">Paid: {formatCurrency(month.total_paid)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revenue by Client */}
        {revenueByClient.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Clients by Revenue</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoices</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {revenueByClient.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{client.full_name}</p>
                        {client.company_name && (
                          <p className="text-sm text-gray-600">{client.company_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-900">{client.invoice_count}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(client.total_amount)}</td>
                      <td className="px-4 py-3 text-right text-success-600">{formatCurrency(client.total_paid)}</td>
                      <td className="px-4 py-3 text-right text-warning-600">{formatCurrency(client.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderClientPerformanceReport = () => {
    const data = reportData?.data?.data || {};
    const clients = data.clients || [];
    const statusDistribution = data.status_distribution || [];

    return (
      <div className="space-y-6">
        {/* Status Distribution */}
        {statusDistribution.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Status Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statusDistribution.map((status, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 capitalize">{status.status}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{status.count}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Client List */}
        {clients.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Performance Details</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projects</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoices</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Invoiced</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{client.full_name}</p>
                        {client.company_name && (
                          <p className="text-sm text-gray-600">{client.company_name}</p>
                        )}
                        <p className="text-xs text-gray-500 capitalize">{client.status}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{client.project_count}</p>
                        <p className="text-xs text-gray-600">{client.completed_projects} completed</p>
                      </td>
                      <td className="px-4 py-3 text-gray-900">{client.invoice_count}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(client.total_invoiced)}</td>
                      <td className="px-4 py-3 text-right text-success-600">{formatCurrency(client.total_paid)}</td>
                      <td className="px-4 py-3 text-right text-warning-600">{formatCurrency(client.outstanding_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No client data found for the selected filters</p>
          </div>
        )}
      </div>
    );
  };

  const renderProjectPerformanceReport = () => {
    const data = reportData?.data?.data || {};
    const projects = data.projects || [];
    const statusDistribution = data.status_distribution || [];
    const typeDistribution = data.type_distribution || [];

    return (
      <div className="space-y-6">
        {/* Distribution Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {statusDistribution.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Status Distribution</h3>
              <div className="space-y-3">
                {statusDistribution.map((status, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{status.status}</p>
                      <p className="text-sm text-gray-600">{status.count} projects</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Avg Budget</p>
                      <p className="font-medium text-gray-900">{formatCurrency(status.avg_budget)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {typeDistribution.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Type Distribution</h3>
              <div className="space-y-3">
                {typeDistribution.map((type, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <p className="font-medium text-gray-900 capitalize">{type.type.replace('_', ' ')}</p>
                    <p className="text-2xl font-bold text-primary-600">{type.count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Project List */}
        {projects.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Performance Details</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Budget</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Invoiced</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {projects.map((project) => (
                    <tr key={project.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{project.title}</p>
                        <p className="text-sm text-gray-600 capitalize">{project.type.replace('_', ' ')}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{project.client_name}</p>
                        {project.company_name && (
                          <p className="text-sm text-gray-600">{project.company_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          project.status === 'completed' ? 'bg-green-100 text-green-800' :
                          project.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                          project.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {project.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-medium text-gray-900">{formatCurrency(project.budget)}</p>
                        {project.actual_cost && (
                          <p className="text-sm text-gray-600">Actual: {formatCurrency(project.actual_cost)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(project.total_invoiced)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {project.duration_days ? `${project.duration_days} days` : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No project data found for the selected filters</p>
          </div>
        )}
      </div>
    );
  };

  const renderInvoiceReport = () => {
    const data = reportData?.data?.data || {};
    const invoices = data.invoices || [];
    const statusSummary = data.status_summary || [];

    return (
      <div className="space-y-6">
        {/* Status Summary */}
        {statusSummary.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statusSummary.map((status, index) => (
              <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <p className="text-sm text-gray-600 capitalize">{status.status}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{status.count}</p>
                <p className="text-xs text-gray-500 mt-1">Total: {formatCurrency(status.total_amount)}</p>
                <p className="text-xs text-gray-500">Outstanding: {formatCurrency(status.total_outstanding)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Invoice List */}
        {invoices.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                        {invoice.project_title && (
                          <p className="text-xs text-gray-600">{invoice.project_title}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{invoice.client_name}</p>
                        {invoice.company_name && (
                          <p className="text-sm text-gray-600">{invoice.company_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <p>{formatDate(invoice.invoice_date)}</p>
                        <p className="text-xs">Due: {formatDate(invoice.due_date)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                          invoice.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                          invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                          invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(invoice.total_amount)}</td>
                      <td className="px-4 py-3 text-right text-success-600">{formatCurrency(invoice.paid_amount)}</td>
                      <td className="px-4 py-3 text-right text-warning-600">{formatCurrency(invoice.outstanding_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No invoice data found for the selected filters</p>
          </div>
        )}
      </div>
    );
  };

  const renderReportContent = () => {
    if (isLoading) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading report data...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">Error Loading Report</h3>
              <p className="text-sm text-red-700 mt-1">
                {error.response?.data?.message || 'Failed to load report data. Please try again.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      );
    }

    switch (reportType) {
      case 'summary':
        return renderSummaryReport();
      case 'financial':
        return renderFinancialReport();
      case 'client-performance':
        return renderClientPerformanceReport();
      case 'project-performance':
        return renderProjectPerformanceReport();
      case 'invoices':
        return renderInvoiceReport();
      default:
        return renderSummaryReport();
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Generate comprehensive reports and analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <div className="relative">
            <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
            {/* Export dropdown would go here */}
          </div>
        </div>
      </div>

      {/* Report Type Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setReportType('summary')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              reportType === 'summary'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Summary
          </button>
          <button
            onClick={() => setReportType('financial')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              reportType === 'financial'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Financial
          </button>
          <button
            onClick={() => setReportType('client-performance')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              reportType === 'client-performance'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Client Performance
          </button>
          <button
            onClick={() => setReportType('project-performance')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              reportType === 'project-performance'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            Project Performance
          </button>
          <button
            onClick={() => setReportType('invoices')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              reportType === 'invoices'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Invoices
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Filters</h3>
            <button
              onClick={clearFilters}
              className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear All
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <select
                value={filters.client_id}
                onChange={(e) => handleFilterChange('client_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent form-select"
              >
                <option value="">All Clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name} {client.company_name ? `(${client.company_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {filters.client_id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
                <select
                  value={filters.project_id}
                  onChange={(e) => handleFilterChange('project_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent form-select"
                >
                  <option value="">All Projects</option>
                  {projects.filter(p => p.client_id === parseInt(filters.client_id)).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {reportType === 'invoices' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent form-select"
                >
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Content */}
      {renderReportContent()}
    </div>
  );
};

export default Reports;
