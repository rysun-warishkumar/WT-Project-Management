import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from 'react-query';
import { X, CreditCard, DollarSign } from 'lucide-react';
import { invoicesAPI } from '../../services/api';
import toast from 'react-hot-toast';

const PaymentModal = ({ isOpen, onClose, onSuccess, invoice }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      amount: '',
      payment_method: '',
      payment_date: new Date().toISOString().split('T')[0],
      reference_number: '',
      notes: ''
    }
  });

  const watchedAmount = watch('amount');

  // Record payment mutation
  const mutation = useMutation(
    (data) => invoicesAPI.recordPayment(invoice?.id, data),
    {
      onSuccess: (response) => {
        const data = response?.data?.data;
        if (data) {
          toast.success('Payment recorded successfully');
          // Update invoice data if provided
          if (data.invoice) {
            // The parent component should refetch invoice data
          }
        } else {
          toast.success('Payment recorded successfully');
        }
        onSuccess();
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || 'Failed to record payment';
        toast.error(errorMessage);
        console.error('Payment error:', error);
      },
      onSettled: () => {
        setIsSubmitting(false);
      },
    }
  );

  const onSubmit = (data) => {
    setIsSubmitting(true);
    
    const paymentAmount = parseFloat(data.amount);
    
    // Validate payment amount
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      setIsSubmitting(false);
      return;
    }
    
    if (paymentAmount > outstandingAmount) {
      toast.error(`Payment amount cannot exceed outstanding amount of ${formatCurrency(outstandingAmount)}`);
      setIsSubmitting(false);
      return;
    }
    
    const paymentData = {
      ...data,
      amount: paymentAmount,
      payment_date: data.payment_date
    };

    mutation.mutate(paymentData);
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getOutstandingAmount = () => {
    if (!invoice) return 0;
    const total = parseFloat(invoice.total_amount) || 0;
    const paid = parseFloat(invoice.paid_amount) || 0;
    const outstanding = total - paid;
    return Math.max(0, outstanding); // Ensure non-negative
  };

  const outstandingAmount = getOutstandingAmount();

  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">
            Record Payment
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Invoice Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Invoice Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice Number:</span>
                <span className="font-medium">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Client:</span>
                <span className="font-medium">{invoice.client_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-medium">{formatCurrency(invoice.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Paid Amount:</span>
                <span className="font-medium">{formatCurrency(invoice.paid_amount || 0)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-900 font-medium">Outstanding:</span>
                <span className={`font-bold ${outstandingAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(outstandingAmount)}
                </span>
              </div>
              {outstandingAmount === 0 && (
                <div className="mt-2 text-xs text-green-600 font-medium">
                  ✓ Invoice is fully paid
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Payment Amount */}
            <div>
              <label className="form-label">Payment Amount *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={outstandingAmount}
                  {...register('amount', { 
                    required: 'Payment amount is required',
                    min: { value: 0.01, message: 'Amount must be greater than 0' },
                    max: { value: outstandingAmount, message: `Amount cannot exceed ${formatCurrency(outstandingAmount)}` }
                  })}
                  className={`form-input pl-10 ${errors.amount ? 'border-red-500' : ''}`}
                  placeholder="0.00"
                />
              </div>
              {errors.amount && (
                <p className="text-red-500 text-sm mt-1">{errors.amount.message}</p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                Maximum payment: {formatCurrency(outstandingAmount)}
              </p>
            </div>

            {/* Payment Method */}
            <div>
              <label className="form-label">Payment Method *</label>
              <select
                {...register('payment_method', { required: 'Payment method is required' })}
                className={`form-select ${errors.payment_method ? 'border-red-500' : ''}`}
              >
                <option value="">Select Payment Method</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="credit_card">Credit Card</option>
                <option value="debit_card">Debit Card</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="paypal">PayPal</option>
                <option value="stripe">Stripe</option>
                <option value="other">Other</option>
              </select>
              {errors.payment_method && (
                <p className="text-red-500 text-sm mt-1">{errors.payment_method.message}</p>
              )}
            </div>

            {/* Payment Date */}
            <div>
              <label className="form-label">Payment Date *</label>
              <input
                type="date"
                {...register('payment_date', { required: 'Payment date is required' })}
                className={`form-input ${errors.payment_date ? 'border-red-500' : ''}`}
              />
              {errors.payment_date && (
                <p className="text-red-500 text-sm mt-1">{errors.payment_date.message}</p>
              )}
            </div>

            {/* Reference Number */}
            <div>
              <label className="form-label">Reference Number</label>
              <input
                type="text"
                {...register('reference_number')}
                className="form-input"
                placeholder="Transaction ID, check number, etc."
              />
            </div>

            {/* Notes */}
            <div>
              <label className="form-label">Notes</label>
              <textarea
                {...register('notes')}
                className="form-textarea"
                rows="3"
                placeholder="Additional payment notes..."
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t mt-6 flex-shrink-0">
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
                className="btn btn-success"
                disabled={isSubmitting || !watchedAmount || parseFloat(watchedAmount) <= 0 || parseFloat(watchedAmount) > outstandingAmount}
              >
                {isSubmitting ? (
                  <>
                    <div className="spinner h-4 w-4 mr-2"></div>
                    Recording...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Record Payment
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
