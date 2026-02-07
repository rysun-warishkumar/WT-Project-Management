import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useQuery, useMutation } from 'react-query';
import { X, Plus, Trash2, Calculator } from 'lucide-react';
import { quotationsAPI, clientsAPI, projectsAPI } from '../../services/api';
import toast from 'react-hot-toast';

// Normalize API date (Date, ISO string, or YYYY-MM-DD) to YYYY-MM-DD for input type="date"
const toDateOnly = (value) => {
  if (value == null || value === '') return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

const QuotationModal = ({ isOpen, onClose, onSuccess, quotation }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      quote_number: '',
      client_id: '',
      project_id: '',
      quote_date: new Date().toISOString().split('T')[0],
      valid_till_date: '',
      status: 'draft',
      subtotal: 0,
      tax_rate: 0,
      tax_amount: 0,
      total_amount: 0,
      currency: 'USD',
      notes: '',
      terms_conditions: '',
      items: [{ item_name: '', description: '', quantity: 1, unit_price: 0, total_price: 0 }]
    }
  });

  // Watch selected client so we can fetch projects for that client
  const selectedClientId = watch('client_id');

  // Fetch clients for dropdown
  const { data: clientsData } = useQuery(
    ['clients', 'dropdown'],
    () => clientsAPI.getAll({ limit: 1000 }),
    { enabled: isOpen }
  );

  const clients = clientsData?.data?.data?.clients || [];

  // Fetch projects only for the selected client
  const { data: projectsData } = useQuery(
    ['projects', 'dropdown', selectedClientId],
    () => projectsAPI.getAll({ limit: 1000, client_id: selectedClientId }),
    { enabled: isOpen && !!selectedClientId }
  );

  const projects = projectsData?.data?.data?.projects || [];

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  // When opening edit from list, quotation has no items; fetch full quotation (same as detail page) so items show correctly
  const needsFullQuotation = isOpen && !!quotation?.id && (!quotation?.items || quotation.items.length === 0);
  const { data: fullQuotationData, isLoading: isLoadingFullQuotation } = useQuery(
    ['quotation', quotation?.id],
    () => quotationsAPI.getById(quotation.id),
    { enabled: needsFullQuotation }
  );
  const fullQuotation = fullQuotationData?.data?.data;
  const effectiveQuotation = fullQuotation || quotation;

  // Single source of truth: recalculate subtotal, tax (0 when empty), and total
  const recalculateTotals = () => {
    const items = getValues('items') || [];
    const rawTaxRate = getValues('tax_rate');
    const taxRate = (rawTaxRate !== '' && rawTaxRate !== undefined && rawTaxRate !== null && !Number.isNaN(Number(rawTaxRate)))
      ? parseFloat(rawTaxRate)
      : 0;

    const subtotal = items.reduce((sum, item) => {
      const quantity = parseFloat(item?.quantity) || 0;
      const unitPrice = parseFloat(item?.unit_price) || 0;
      return sum + quantity * unitPrice;
    }, 0);

    const taxAmount = (subtotal * taxRate) / 100;
    const totalAmount = subtotal + taxAmount;

    setValue('subtotal', subtotal);
    setValue('tax_amount', taxAmount);
    setValue('total_amount', totalAmount);
  };

  // Watch values for calculations (live updates as user types)
  const watchedItems = watch('items');
  const watchedTaxRate = watch('tax_rate');

  useEffect(() => {
    recalculateTotals();
  }, [watchedItems, watchedTaxRate, setValue]);

  // On blur of Unit Price or Quantity, recalculate so totals update when user leaves the field (tax = 0 if not set)
  const withBlurRecalc = (registered) => ({
    ...registered,
    onBlur: (e) => {
      registered.onBlur(e);
      recalculateTotals();
    }
  });

  // Reset form when effective quotation is available (from prop or from fetch when opened from list)
  useEffect(() => {
    if (needsFullQuotation && !fullQuotation) {
      return; // wait for full quotation fetch when opened from list
    }
    if (effectiveQuotation) {
      reset({
        quote_number: effectiveQuotation.quote_number || '',
        client_id: effectiveQuotation.client_id ? String(effectiveQuotation.client_id) : '',
        project_id: effectiveQuotation.project_id ? String(effectiveQuotation.project_id) : '',
        quote_date: toDateOnly(effectiveQuotation.quote_date) || new Date().toISOString().split('T')[0],
        valid_till_date: toDateOnly(effectiveQuotation.valid_till_date) || '',
        status: effectiveQuotation.status || 'draft',
        subtotal: effectiveQuotation.subtotal || 0,
        tax_rate: effectiveQuotation.tax_rate || 0,
        tax_amount: effectiveQuotation.tax_amount || 0,
        total_amount: effectiveQuotation.total_amount || 0,
        currency: effectiveQuotation.currency || 'USD',
        notes: effectiveQuotation.notes || '',
        terms_conditions: effectiveQuotation.terms_conditions || '',
        items: effectiveQuotation.items?.length > 0 ? effectiveQuotation.items : [{ item_name: '', description: '', quantity: 1, unit_price: 0, total_price: 0 }]
      });
    } else {
      reset({
        quote_number: '',
        client_id: '',
        project_id: '',
        quote_date: new Date().toISOString().split('T')[0],
        valid_till_date: '',
        status: 'draft',
        subtotal: 0,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: 0,
        currency: 'USD',
        notes: '',
        terms_conditions: '',
        items: [{ item_name: '', description: '', quantity: 1, unit_price: 0, total_price: 0 }]
      });
    }
  }, [effectiveQuotation, fullQuotation, needsFullQuotation, reset]);

  // Client select: clear project when client changes
  const clientIdField = (() => {
    const { onChange, ...rest } = register('client_id', { required: 'Client is required' });
    return {
      ...rest,
      onChange: (e) => {
        onChange(e);
        setValue('project_id', '');
      },
    };
  })();

  // Create/Update mutation (use effectiveQuotation.id when editing so list-edit works after fetch)
  const mutation = useMutation(
    (data) => {
      const quoteId = effectiveQuotation?.id || quotation?.id;
      if (quoteId) {
        return quotationsAPI.update(quoteId, data);
      } else {
        return quotationsAPI.create(data);
      }
    },
    {
      onSuccess: () => {
        toast.success(quotation ? 'Quotation updated successfully' : 'Quotation created successfully');
        onSuccess();
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to save quotation');
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

    const quotationData = {
      ...data,
      quote_number: data.quote_number && data.quote_number.trim() !== '' ? data.quote_number.trim() : null,
      client_id: parseInt(data.client_id),
      project_id: data.project_id && data.project_id !== '' ? parseInt(data.project_id) : null,
      valid_till_date: data.valid_till_date && data.valid_till_date !== '' ? data.valid_till_date : null,
      subtotal: parseFloat(data.subtotal) || 0,
      tax_rate: parseFloat(data.tax_rate) || 0,
      tax_amount: parseFloat(data.tax_amount) || 0,
      total_amount: parseFloat(data.total_amount) || 0,
      currency: data.currency || 'USD',
      notes: data.notes || null,
      terms_conditions: data.terms_conditions || null,
      items: processedItems
    };

    mutation.mutate(quotationData);
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

  const showForm = !needsFullQuotation || fullQuotation;
  const showLoading = needsFullQuotation && isLoadingFullQuotation;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {quotation ? 'Edit Quotation' : 'Add New Quotation'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {showLoading && (
          <div className="p-12 text-center text-gray-500">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            <p className="mt-3">Loading quotation details…</p>
          </div>
        )}

        {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="form-label">Quote Number *</label>
              <input
                {...register('quote_number', { required: 'Quote number is required' })}
                className={`form-input ${errors.quote_number ? 'border-red-500' : ''}`}
                placeholder="QT-2024-0001"
              />
              {errors.quote_number && (
                <p className="text-red-500 text-sm mt-1">{errors.quote_number.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Client *</label>
              <select
                {...clientIdField}
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
                disabled={!selectedClientId}
              >
                <option value="">
                  {selectedClientId ? 'Select Project (Optional)' : 'Select client first'}
                </option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
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
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
                <option value="expired">Expired</option>
              </select>
              {errors.status && (
                <p className="text-red-500 text-sm mt-1">{errors.status.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Quote Date *</label>
              <input
                type="date"
                {...register('quote_date', { required: 'Quote date is required' })}
                className={`form-input ${errors.quote_date ? 'border-red-500' : ''}`}
              />
              {errors.quote_date && (
                <p className="text-red-500 text-sm mt-1">{errors.quote_date.message}</p>
              )}
            </div>

            <div>
              <label className="form-label">Valid Till Date</label>
              <input
                type="date"
                {...register('valid_till_date')}
                className="form-input"
              />
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
                        {...withBlurRecalc(register(`items.${index}.quantity`, { 
                          required: 'Quantity is required',
                          min: { value: 1, message: 'Quantity must be at least 1' }
                        }))}
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
                        {...withBlurRecalc(register(`items.${index}.unit_price`, { 
                          required: 'Unit price is required',
                          min: { value: 0, message: 'Unit price must be positive' }
                        }))}
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

          {/* Notes and Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="form-label">Notes</label>
              <textarea
                {...register('notes')}
                className="form-textarea"
                rows="4"
                placeholder="Additional notes..."
              />
            </div>

            <div>
              <label className="form-label">Terms & Conditions</label>
              <textarea
                {...register('terms_conditions')}
                className="form-textarea"
                rows="4"
                placeholder="Payment terms, delivery terms, etc..."
              />
            </div>
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
                  {quotation ? 'Update Quotation' : 'Create Quotation'}
                </>
              )}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default QuotationModal;
