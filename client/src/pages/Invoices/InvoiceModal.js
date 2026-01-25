import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation } from 'react-query';
import { X, Plus, Trash2, Calculator } from 'lucide-react';
import { invoicesAPI, clientsAPI, projectsAPI, quotationsAPI } from '../../services/api';
import toast from 'react-hot-toast';

const InvoiceModal = ({ isOpen, onClose, onSuccess, invoice }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch clients, projects, and quotations for dropdowns
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

  const { data: quotationsData } = useQuery(
    ['quotations', 'dropdown'],
    () => quotationsAPI.getAll({ limit: 1000 }),
    { enabled: isOpen }
  );

  const clients = clientsData?.data?.data?.clients || [];
  const projects = projectsData?.data?.data?.projects || [];
  const quotations = quotationsData?.data?.data?.quotations || [];

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      invoice_number: '',
      client_id: '',
      project_id: '',
      quotation_id: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'draft',
      subtotal: 0,
      tax_rate: 0,
      tax_amount: 0,
      total_amount: 0,
      currency: 'USD',
      notes: '',
      items: [{ item_name: '', description: '', quantity: 1, unit_price: 0, total_price: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  // Watch values for calculations
  const watchedItems = watch('items');
  const watchedTaxRate = watch('tax_rate');

  // Calculate totals when items or tax rate changes
  useEffect(() => {
    const subtotal = watchedItems.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unit_price) || 0;
      return sum + (quantity * unitPrice);
    }, 0);

    const taxRate = parseFloat(watchedTaxRate) || 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;

    setValue('subtotal', subtotal);
    setValue('tax_amount', taxAmount);
    setValue('total_amount', totalAmount);
  }, [watchedItems, watchedTaxRate, setValue]);

  // Reset form when invoice prop changes
  useEffect(() => {
    if (invoice) {
      reset({
        invoice_number: invoice.invoice_number || '',
        client_id: invoice.client_id ? String(invoice.client_id) : '',
        project_id: invoice.project_id ? String(invoice.project_id) : '',
        quotation_id: invoice.quotation_id ? String(invoice.quotation_id) : '',
        invoice_date: invoice.invoice_date || new Date().toISOString().split('T')[0],
        due_date: invoice.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: invoice.status || 'draft',
        subtotal: invoice.subtotal || 0,
        tax_rate: invoice.tax_rate || 0,
        tax_amount: invoice.tax_amount || 0,
        total_amount: invoice.total_amount || 0,
        currency: invoice.currency || 'USD',
        notes: invoice.notes || '',
        items: invoice.items?.length > 0 ? invoice.items : [{ item_name: '', description: '', quantity: 1, unit_price: 0, total_price: 0 }]
      });
    } else {
      reset({
        invoice_number: '',
        client_id: '',
        project_id: '',
        quotation_id: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'draft',
        subtotal: 0,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: 0,
        currency: 'USD',
        notes: '',
        items: [{ item_name: '', description: '', quantity: 1, unit_price: 0, total_price: 0 }]
      });
    }
  }, [invoice, reset, projects, quotations]);

  // Create/Update mutation
  const mutation = useMutation(
    (data) => {
      if (invoice) {
        return invoicesAPI.update(invoice.id, data);
      } else {
        return invoicesAPI.create(data);
      }
    },
    {
      onSuccess: () => {
        toast.success(invoice ? 'Invoice updated successfully' : 'Invoice created successfully');
        onSuccess();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to save invoice');
      },
      onSettled: () => {
        setIsSubmitting(false);
      },
    }
  );

  const onSubmit = (data) => {
    setIsSubmitting(true);
    
    // Calculate item totals
    const processedItems = data.items.map(item => ({
      ...item,
      quantity: parseInt(item.quantity),
      unit_price: parseFloat(item.unit_price),
      total_price: parseInt(item.quantity) * parseFloat(item.unit_price)
    }));

    const invoiceData = {
      ...data,
      client_id: parseInt(data.client_id),
      project_id: data.project_id ? parseInt(data.project_id) : null,
      quotation_id: data.quotation_id ? parseInt(data.quotation_id) : null,
      subtotal: parseFloat(data.subtotal),
      tax_rate: parseFloat(data.tax_rate),
      tax_amount: parseFloat(data.tax_amount),
      total_amount: parseFloat(data.total_amount),
      items: processedItems
    };

    mutation.mutate(invoiceData);
  };

  const addItem = () => {
    append({ item_name: '', description: '', quantity: 1, unit_price: 0, total_price: 0 });
  };

  const removeItem = (index) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {invoice ? 'Edit Invoice' : 'Add New Invoice'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="form-label">Invoice Number *</label>
              <input
                {...register('invoice_number', { required: 'Invoice number is required' })}
                className={`form-input ${errors.invoice_number ? 'border-red-500' : ''}`}
                placeholder="INV-2024-0001"
              />
              {errors.invoice_number && (
                <p className="text-red-500 text-sm mt-1">{errors.invoice_number.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Client *</label>
              <select
                {...register('client_id', { required: 'Client is required' })}
                className={`form-select ${errors.client_id ? 'border-red-500' : ''}`}
              >
                <option value="">Select Client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name} {client.company_name && `(${client.company_name})`}
                  </option>
                ))}
              </select>
              {errors.client_id && (
                <p className="text-red-500 text-sm mt-1">{errors.client_id.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Project</label>
              <select
                {...register('project_id')}
                className="form-select"
              >
                <option value="">Select Project (Optional)</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Quotation</label>
              <select
                {...register('quotation_id')}
                className="form-select"
              >
                <option value="">Select Quotation (Optional)</option>
                {quotations.map((quotation) => (
                  <option key={quotation.id} value={quotation.id}>
                    {quotation.quote_number} - {quotation.client_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Status *</label>
              <select
                {...register('status', { required: 'Status is required' })}
                className={`form-select ${errors.status ? 'border-red-500' : ''}`}
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {errors.status && (
                <p className="text-red-500 text-sm mt-1">{errors.status.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Invoice Date *</label>
              <input
                type="date"
                {...register('invoice_date', { required: 'Invoice date is required' })}
                className={`form-input ${errors.invoice_date ? 'border-red-500' : ''}`}
              />
              {errors.invoice_date && (
                <p className="text-red-500 text-sm mt-1">{errors.invoice_date.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Due Date *</label>
              <input
                type="date"
                {...register('due_date', { required: 'Due date is required' })}
                className={`form-input ${errors.due_date ? 'border-red-500' : ''}`}
              />
              {errors.due_date && (
                <p className="text-red-500 text-sm mt-1">{errors.due_date.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Currency *</label>
              <select
                {...register('currency', { required: 'Currency is required' })}
                className={`form-select ${errors.currency ? 'border-red-500' : ''}`}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
              </select>
              {errors.currency && (
                <p className="text-red-500 text-sm mt-1">{errors.currency.message}</p>
              )}
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="btn btn-outline btn-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </button>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="form-label">Item Name *</label>
                      <input
                        {...register(`items.${index}.item_name`, { required: 'Item name is required' })}
                        className={`form-input ${errors.items?.[index]?.item_name ? 'border-red-500' : ''}`}
                        placeholder="e.g., Website Development"
                      />
                      {errors.items?.[index]?.item_name && (
                        <p className="text-red-500 text-sm mt-1">{errors.items[index].item_name.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="form-label">Description</label>
                      <input
                        {...register(`items.${index}.description`)}
                        className="form-input"
                        placeholder="Item description"
                      />
                    </div>

                    <div>
                      <label className="form-label">Quantity *</label>
                      <input
                        type="number"
                        min="1"
                        {...register(`items.${index}.quantity`, { 
                          required: 'Quantity is required',
                          min: { value: 1, message: 'Quantity must be at least 1' }
                        })}
                        className={`form-input ${errors.items?.[index]?.quantity ? 'border-red-500' : ''}`}
                      />
                      {errors.items?.[index]?.quantity && (
                        <p className="text-red-500 text-sm mt-1">{errors.items[index].quantity.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="form-label">Unit Price *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register(`items.${index}.unit_price`, { 
                          required: 'Unit price is required',
                          min: { value: 0, message: 'Unit price must be positive' }
                        })}
                        className={`form-input ${errors.items?.[index]?.unit_price ? 'border-red-500' : ''}`}
                        placeholder="0.00"
                      />
                      {errors.items?.[index]?.unit_price && (
                        <p className="text-red-500 text-sm mt-1">{errors.items[index].unit_price.message}</p>
                      )}
                    </div>
                  </div>

                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="btn btn-outline btn-sm text-red-600 mt-2"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove Item
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="form-label">Subtotal</label>
              <input
                {...register('subtotal')}
                className="form-input"
                readOnly
              />
            </div>

            <div>
              <label className="form-label">Tax Rate (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                {...register('tax_rate', { 
                  min: { value: 0, message: 'Tax rate must be between 0 and 100' },
                  max: { value: 100, message: 'Tax rate must be between 0 and 100' }
                })}
                className={`form-input ${errors.tax_rate ? 'border-red-500' : ''}`}
                placeholder="0.00"
              />
              {errors.tax_rate && (
                <p className="text-red-500 text-sm mt-1">{errors.tax_rate.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Tax Amount</label>
              <input
                {...register('tax_amount')}
                className="form-input"
                readOnly
              />
            </div>

            <div className="md:col-span-3">
              <label className="form-label">Total Amount</label>
              <input
                {...register('total_amount')}
                className="form-input text-lg font-bold"
                readOnly
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Notes</label>
            <textarea
              {...register('notes')}
              className="form-textarea"
              rows="4"
              placeholder="Additional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t">
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
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="spinner h-4 w-4 mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-2" />
                  {invoice ? 'Update Invoice' : 'Create Invoice'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InvoiceModal;
