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
  Plus,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';
import { quotationsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import QuotationModal from './QuotationModal';
import DeleteConfirmModal from '../../components/Common/DeleteConfirmModal';

const QuotationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Fetch quotation data
  const {
    data: quotationData,
    isLoading,
    error,
  } = useQuery(
    ['quotation', id],
    () => quotationsAPI.getById(id),
    {
      enabled: !!id,
    }
  );

  const quotation = quotationData?.data?.data;

  // Delete mutation
  const deleteMutation = useMutation(
    () => quotationsAPI.delete(id),
    {
      onSuccess: () => {
        toast.success('Quotation deleted successfully');
        navigate('/quotations');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete quotation');
      },
    }
  );

  // Convert to invoice mutation
  const convertToInvoiceMutation = useMutation(
    () => quotationsAPI.convertToInvoice(id),
    {
      onSuccess: (data) => {
        toast.success('Quotation converted to invoice successfully');
        navigate(`/invoices/${data.data.data.invoice_id}`);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to convert quotation');
      },
    }
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return 'gray';
      case 'sent':
        return 'blue';
      case 'accepted':
        return 'green';
      case 'declined':
        return 'red';
      case 'expired':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="h-5 w-5" />;
      case 'declined':
        return <XCircle className="h-5 w-5" />;
      case 'expired':
        return <Clock className="h-5 w-5" />;
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

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
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
        <p className="text-gray-500">Failed to load quotation details</p>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Quotation not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/quotations')}
            className="btn btn-outline btn-sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{quotation.quote_number}</h1>
            <p className="text-gray-600">
              {quotation.client_name} {quotation.client_company && `• ${quotation.client_company}`}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {quotation.status === 'accepted' && (
            <button
              onClick={() => convertToInvoiceMutation.mutate()}
              className="btn btn-success"
              disabled={convertToInvoiceMutation.isLoading}
            >
              <Plus className="h-4 w-4 mr-2" />
              Convert to Invoice
            </button>
          )}
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="btn btn-primary"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Quotation
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

      {/* Quotation Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
          </div>
          <div className="card-body space-y-4">
            <div className="flex items-center">
              <FileText className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Quote Number</p>
                <p className="text-sm text-gray-600">{quotation.quote_number}</p>
              </div>
            </div>

            <div className="flex items-center">
              {getStatusIcon(quotation.status)}
              <span className={`badge badge-${getStatusColor(quotation.status)} ml-2`}>
                {getStatusText(quotation.status)}
              </span>
            </div>

            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Quote Date</p>
                <p className="text-sm text-gray-600">{formatDate(quotation.quote_date)}</p>
              </div>
            </div>

            {quotation.valid_till_date && (
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Valid Till</p>
                  <p className="text-sm text-gray-600">{formatDate(quotation.valid_till_date)}</p>
                </div>
              </div>
            )}

            <div className="flex items-center">
              <DollarSign className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Currency</p>
                <p className="text-sm text-gray-600">{quotation.currency}</p>
              </div>
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
              <p className="text-sm font-medium text-gray-900">Client Name</p>
              <p className="text-sm text-gray-600">{quotation.client_name}</p>
            </div>

            {quotation.client_company && (
              <div>
                <p className="text-sm font-medium text-gray-900">Company</p>
                <p className="text-sm text-gray-600">{quotation.client_company}</p>
              </div>
            )}

            {quotation.client_email && (
              <div>
                <p className="text-sm font-medium text-gray-900">Email</p>
                <p className="text-sm text-gray-600">{quotation.client_email}</p>
              </div>
            )}

            {quotation.client_phone && (
              <div>
                <p className="text-sm font-medium text-gray-900">Phone</p>
                <p className="text-sm text-gray-600">{quotation.client_phone}</p>
              </div>
            )}

            {quotation.client_address && (
              <div>
                <p className="text-sm font-medium text-gray-900">Address</p>
                <p className="text-sm text-gray-600">{quotation.client_address}</p>
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
              <p className="text-sm font-medium text-gray-900">Subtotal</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(quotation.subtotal)}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900">Tax Rate</p>
              <p className="text-sm text-gray-600">{quotation.tax_rate}%</p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-900">Tax Amount</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(quotation.tax_amount)}
              </p>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-900">Total Amount</p>
              <p className="text-2xl font-bold text-primary-600">
                {formatCurrency(quotation.total_amount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Project Information */}
      {quotation.project_title && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Project Information</h3>
          </div>
          <div className="card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Project Title</p>
                <p className="text-sm text-gray-600">{quotation.project_title}</p>
                {quotation.project_description && (
                  <p className="text-sm text-gray-500 mt-1">{quotation.project_description}</p>
                )}
              </div>
              <button
                onClick={() => navigate(`/projects/${quotation.project_id}`)}
                className="btn btn-outline btn-sm"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quotation Items */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Quotation Items</h3>
        </div>
        <div className="card-body">
          {quotation.items && quotation.items.length > 0 ? (
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unit Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quotation.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {item.item_name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600">
                          {item.description || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {item.quantity}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(item.unit_price)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(item.total_price)}
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
              <p className="text-gray-500">No items found for this quotation</p>
            </div>
          )}
        </div>
      </div>

      {/* Notes and Terms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {quotation.notes && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Notes</h3>
            </div>
            <div className="card-body">
              <p className="text-gray-700 whitespace-pre-wrap">{quotation.notes}</p>
            </div>
          </div>
        )}

        {quotation.terms_conditions && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Terms & Conditions</h3>
            </div>
            <div className="card-body">
              <p className="text-gray-700 whitespace-pre-wrap">{quotation.terms_conditions}</p>
            </div>
          </div>
        )}
      </div>

      {/* Related Invoices */}
      {quotation.invoices && quotation.invoices.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Related Invoices</h3>
          </div>
          <div className="card-body">
            <div className="space-y-4">
              {quotation.invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => navigate(`/invoices/${invoice.id}`)}
                >
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{invoice.invoice_number}</h4>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                      <span>Date: {formatDate(invoice.invoice_date)}</span>
                      {invoice.due_date && (
                        <span>Due: {formatDate(invoice.due_date)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-medium text-gray-900">
                      {formatCurrency(invoice.total_amount)}
                    </span>
                    <span className={`badge badge-${getStatusColor(invoice.status)}`}>
                      {getStatusText(invoice.status)}
                    </span>
                    <ExternalLink className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <QuotationModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries(['quotation', id]);
          setIsEditModalOpen(false);
        }}
        quotation={quotation}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Quotation"
        message={`Are you sure you want to delete quotation "${quotation.quote_number}"? This action cannot be undone.`}
        isLoading={deleteMutation.isLoading}
      />
    </div>
  );
};

export default QuotationDetail;
