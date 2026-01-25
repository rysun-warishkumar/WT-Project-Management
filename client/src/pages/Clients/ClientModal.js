import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { X, Save, User, Building, Mail, Phone, MapPin, Calendar } from 'lucide-react';
import { clientsAPI } from '../../services/api';
import toast from 'react-hot-toast';

const ClientModal = ({ isOpen, onClose, onSuccess, client }) => {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
  } = useForm();

  // Create/Update client mutation
  const mutation = useMutation(
    (data) => {
      if (client) {
        return clientsAPI.update(client.id, data);
      } else {
        return clientsAPI.create(data);
      }
    },
    {
      onSuccess: (response) => {
        toast.success(
          client ? 'Client updated successfully' : 'Client created successfully'
        );
        onSuccess();
      },
      onError: (error) => {
        toast.error(
          error.response?.data?.message || 
          (client ? 'Failed to update client' : 'Failed to create client')
        );
      },
      onSettled: () => {
        setIsSubmitting(false);
      },
    }
  );

  // Reset form when modal opens/closes or client changes
  useEffect(() => {
    if (isOpen) {
      if (client) {
        // Edit mode - populate form with client data
        setValue('company_name', client.company_name || '');
        setValue('full_name', client.full_name || '');
        setValue('email', client.email || '');
        setValue('phone', client.phone || '');
        setValue('whatsapp', client.whatsapp || '');
        setValue('business_type', client.business_type || '');
        setValue('gst_number', client.gst_number || '');
        setValue('tax_id', client.tax_id || '');
        setValue('address', client.address || '');
        setValue('city', client.city || '');
        setValue('state', client.state || '');
        setValue('country', client.country || '');
        setValue('postal_code', client.postal_code || '');
        setValue('onboarding_date', client.onboarding_date || '');
        setValue('status', client.status || 'active');
        setValue('notes', client.notes || '');
      } else {
        // Create mode - reset form
        reset();
        setValue('status', 'active');
      }
    }
  }, [isOpen, client, setValue, reset]);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    
    // Convert tags to array if it's a string
    if (data.tags && typeof data.tags === 'string') {
      data.tags = data.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    // Convert empty strings to null for optional fields
    Object.keys(data).forEach(key => {
      if (data[key] === '') {
        data[key] = null;
      }
    });

    mutation.mutate(data);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <div className="p-2 bg-primary-100 rounded-lg mr-3">
              <User className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {client ? 'Edit Client' : 'Add New Client'}
              </h2>
              <p className="text-sm text-gray-600">
                {client ? 'Update client information' : 'Create a new client record'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  {...register('full_name', { required: 'Full name is required' })}
                  className={`form-input ${errors.full_name ? 'border-danger-500' : ''}`}
                  placeholder="Enter full name"
                />
                {errors.full_name && (
                  <p className="form-error">{errors.full_name.message}</p>
                )}
              </div>

              <div>
                <label className="form-label">Company Name</label>
                <input
                  type="text"
                  {...register('company_name')}
                  className="form-input"
                  placeholder="Enter company name"
                />
              </div>

              <div>
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  {...register('email', { 
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  className={`form-input ${errors.email ? 'border-danger-500' : ''}`}
                  placeholder="Enter email address"
                />
                {errors.email && (
                  <p className="form-error">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="form-label">Business Type</label>
                <input
                  type="text"
                  {...register('business_type')}
                  className="form-input"
                  placeholder="e.g., Technology, Healthcare, Retail"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Phone className="h-5 w-5 mr-2" />
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  {...register('phone')}
                  className="form-input"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="form-label">WhatsApp</label>
                <input
                  type="tel"
                  {...register('whatsapp')}
                  className="form-input"
                  placeholder="Enter WhatsApp number"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Address Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="form-label">Address</label>
                <textarea
                  {...register('address')}
                  rows={3}
                  className="form-textarea"
                  placeholder="Enter full address"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    {...register('city')}
                    className="form-input"
                    placeholder="Enter city"
                  />
                </div>

                <div>
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    {...register('state')}
                    className="form-input"
                    placeholder="Enter state"
                  />
                </div>

                <div>
                  <label className="form-label">Country</label>
                  <input
                    type="text"
                    {...register('country')}
                    className="form-input"
                    placeholder="Enter country"
                  />
                </div>

                <div>
                  <label className="form-label">Postal Code</label>
                  <input
                    type="text"
                    {...register('postal_code')}
                    className="form-input"
                    placeholder="Enter postal code"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Business Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Building className="h-5 w-5 mr-2" />
              Business Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">GST Number</label>
                <input
                  type="text"
                  {...register('gst_number')}
                  className="form-input"
                  placeholder="Enter GST number"
                />
              </div>

              <div>
                <label className="form-label">Tax ID</label>
                <input
                  type="text"
                  {...register('tax_id')}
                  className="form-input"
                  placeholder="Enter tax ID"
                />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Additional Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Onboarding Date</label>
                <input
                  type="date"
                  {...register('onboarding_date')}
                  className="form-input"
                />
              </div>

              <div>
                <label className="form-label">Status</label>
                <select
                  {...register('status')}
                  className="form-select"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="prospect">Prospect</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="form-label">Notes</label>
              <textarea
                {...register('notes')}
                rows={3}
                className="form-textarea"
                placeholder="Enter any additional notes about the client"
              />
            </div>
          </div>

          {/* Form Actions */}
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
              disabled={isSubmitting}
              className="btn btn-primary"
            >
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {client ? 'Updating...' : 'Creating...'}
                </div>
              ) : (
                <div className="flex items-center">
                  <Save className="h-4 w-4 mr-2" />
                  {client ? 'Update Client' : 'Create Client'}
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientModal;
