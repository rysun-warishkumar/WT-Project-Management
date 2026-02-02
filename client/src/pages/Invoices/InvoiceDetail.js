import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  ArrowLeft,
  Edit,
  Calendar,
  DollarSign,
  Building,
  FileText,
  ExternalLink,
  Download,
  Trash2,
  CreditCard,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { invoicesAPI } from '../../services/api';
import toast from 'react-hot-toast';
import InvoiceModal from './InvoiceModal';
import PaymentModal from './PaymentModal';
import DeleteConfirmModal from '../../components/Common/DeleteConfirmModal';

const InvoiceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch invoice data
  const {
    data: invoiceData,
    isLoading,
    error,
  } = useQuery(
    ['invoice', id],
    () => invoicesAPI.getById(id),
    {
      enabled: !!id,
    }
  );

  const invoice = invoiceData?.data?.data;

  // Delete mutation
  const deleteMutation = useMutation(
    () => invoicesAPI.delete(id),
    {
      onSuccess: () => {
        toast.success('Invoice deleted successfully');
        navigate('/invoices');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete invoice');
      },
    }
  );

  // Download invoice PDF
  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const response = await invoicesAPI.download(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice-${invoice?.invoice_number || id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Invoice downloaded successfully');
    } catch (error) {
      toast.error('Failed to download invoice');
      console.error('Download error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return 'gray';
      case 'sent':
        return 'blue';
      case 'paid':
        return 'green';
      case 'partial':
        return 'yellow';
      case 'overdue':
        return 'red';
      case 'cancelled':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-5 w-5" />;
      case 'overdue':
        return <AlertCircle className="h-5 w-5" />;
      case 'partial':
        return <Clock className="h-5 w-5" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getStatusText = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount, currency = 'USD') => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const isOverdue = (dueDate, status) => {
    if (!dueDate || status === 'paid' || status === 'cancelled') return false;
    return new Date(dueDate) < new Date();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner h-8 w-8"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load invoice details</p>
        <button
          onClick={() => navigate('/invoices')}
          className="btn btn-primary mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
        </button>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Invoice not found</p>
        <button
          onClick={() => navigate('/invoices')}
          className="btn btn-primary mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
        </button>
      </div>
    );
  }

  const outstandingAmount = Math.max(0, (parseFloat(invoice.total_amount) || 0) - (parseFloat(invoice.paid_amount) || 0));
  const overdue = isOverdue(invoice.due_date, invoice.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/invoices')}
            className="btn btn-outline btn-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{invoice.invoice_number}</h1>
            <p className="text-gray-600">
              {invoice.client_name} {invoice.client_company && `• ${invoice.client_company}`}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleDownload}
            className="btn btn-primary"
            disabled={isDownloading}
          >
            <Download className={`h-4 w-4 mr-2 ${isDownloading ? 'animate-spin' : ''}`} />
            {isDownloading ? 'Downloading...' : 'Download PDF'}
          </button>
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="btn btn-success"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Record Payment
            </button>
          )}
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="btn btn-outline"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Invoice
          </button>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="btn btn-outline text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </button>
        </div>
      </div>

      {/* Invoice Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Invoice Information</h3>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Invoice Number</label>
              <p className="text-gray-900 font-medium">{invoice.invoice_number}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Status</label>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`badge badge-${getStatusColor(invoice.status)} flex items-center space-x-1`}>
                  {getStatusIcon(invoice.status)}
                  <span>{getStatusText(invoice.status)}</span>
                </span>
                {overdue && (
                  <span className="badge badge-red">Overdue</span>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Invoice Date</label>
              <div className="flex items-center space-x-2 mt-1">
                <Calendar className="h-4 w-4 text-gray-400" />
                <p className="text-gray-900">{formatDate(invoice.invoice_date)}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Due Date</label>
              <div className="flex items-center space-x-2 mt-1">
                <Calendar className={`h-4 w-4 ${overdue ? 'text-red-500' : 'text-gray-400'}`} />
                <p className={`text-gray-900 ${overdue ? 'text-red-600 font-medium' : ''}`}>
                  {formatDate(invoice.due_date)}
                </p>
              </div>
            </div>
            {invoice.quotation_number && (
              <div>
                <label className="text-sm font-medium text-gray-500">Related Quotation</label>
                <p className="text-gray-900">{invoice.quotation_number}</p>
              </div>
            )}
            {invoice.project_title && invoice.project_title.trim() !== '' && (
              <div>
                <label className="text-sm font-medium text-gray-500">Project</label>
                <p className="text-gray-900">{invoice.project_title}</p>
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Financial Summary</h3>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Subtotal</label>
              <p className="text-gray-900 font-medium text-lg">
                {formatCurrency(invoice.subtotal, invoice.currency)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Tax ({invoice.tax_rate || 0}%)</label>
              <p className="text-gray-900 font-medium">
                {formatCurrency(invoice.tax_amount, invoice.currency)}
              </p>
            </div>
            <div className="border-t pt-4">
              <label className="text-sm font-medium text-gray-500">Total Amount</label>
              <p className="text-gray-900 font-bold text-xl">
                {formatCurrency(invoice.total_amount, invoice.currency)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Paid Amount</label>
              <p className="text-green-600 font-medium">
                {formatCurrency(invoice.paid_amount, invoice.currency)}
              </p>
            </div>
            <div className="border-t pt-4">
              <label className="text-sm font-medium text-gray-500">Outstanding Amount</label>
              <p className={`font-bold text-lg ${outstandingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(outstandingAmount, invoice.currency)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Currency</label>
              <p className="text-gray-900">{invoice.currency || 'USD'}</p>
            </div>
          </div>
        </div>

        {/* Client Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Client Information</h3>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Client Name</label>
              <div className="flex items-center space-x-2 mt-1">
                <Building className="h-4 w-4 text-gray-400" />
                <p className="text-gray-900 font-medium">{invoice.client_name}</p>
              </div>
            </div>
            {invoice.client_company && (
              <div>
                <label className="text-sm font-medium text-gray-500">Company</label>
                <p className="text-gray-900">{invoice.client_company}</p>
              </div>
            )}
            {invoice.client_email && (
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <div className="flex items-center space-x-2 mt-1">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <p className="text-gray-900">{invoice.client_email}</p>
                </div>
              </div>
            )}
            {invoice.client_phone && (
              <div>
                <label className="text-sm font-medium text-gray-500">Phone</label>
                <div className="flex items-center space-x-2 mt-1">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <p className="text-gray-900">{invoice.client_phone}</p>
                </div>
              </div>
            )}
            {invoice.client_address && (
              <div>
                <label className="text-sm font-medium text-gray-500">Address</label>
                <div className="flex items-start space-x-2 mt-1">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                  <p className="text-gray-900">{invoice.client_address}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Items */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Invoice Items</h3>
        </div>
        <div className="card-body">
          {invoice.items && invoice.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unit Price
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoice.items.map((item, index) => (
                    <tr key={item.id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.item_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">{item.description || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900">{item.quantity}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(item.unit_price, invoice.currency)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(item.total_price, invoice.currency)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No items found</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment History */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Payment History</h3>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Method
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoice.payments.map((payment, index) => (
                    <tr key={payment.id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <div className="text-sm text-gray-900">{formatDate(payment.payment_date)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{payment.payment_method}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-green-600">
                          {formatCurrency(payment.amount, invoice.currency)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{payment.reference_number || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">{payment.notes || 'N/A'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {invoice.notes && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Notes</h3>
          </div>
          <div className="card-body">
            <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        </div>
      )}

      {/* Modals */}
      <InvoiceModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries(['invoice', id]);
          setIsEditModalOpen(false);
        }}
        invoice={invoice}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
        }}
        onSuccess={() => {
          // Invalidate and refetch invoice data to get updated payment info
          queryClient.invalidateQueries(['invoice', id]);
          queryClient.invalidateQueries(['invoices']);
          setIsPaymentModalOpen(false);
        }}
        invoice={invoice}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
        }}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Invoice"
        message={`Are you sure you want to delete invoice "${invoice.invoice_number}"? This action cannot be undone.`}
        isLoading={deleteMutation.isLoading}
      />
    </div>
  );
};

export default InvoiceDetail;
