import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { Inbox, Loader, Mail, User, Calendar, Building2, X, MessageSquare, Tag } from 'lucide-react';
import { inquiriesAPI } from '../../services/api';
import toast from 'react-hot-toast';

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ENQUIRY_TYPE_LABELS = {
  contact: 'Get in touch',
  get_started: 'Get started',
};

const EnquiryTypeBadge = ({ type }) => {
  const label = ENQUIRY_TYPE_LABELS[type] || type || '—';
  const isContact = type === 'contact';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isContact ? 'bg-blue-100 text-blue-800' : 'bg-violet-100 text-violet-800'
      }`}
    >
      <Tag className="h-3 w-3 mr-1" />
      {label}
    </span>
  );
};

export default function Inquiries() {
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const { data, isLoading, error } = useQuery(
    'inquiries',
    () => inquiriesAPI.getAll().then((res) => res.data.data),
    {
      onError: (err) => {
        if (err.response?.status === 403) {
          toast.error('Super admin access required');
        } else {
          toast.error(err.response?.data?.message || 'Failed to load inquiries');
        }
      },
    }
  );

  const inquiries = data?.inquiries || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader className="h-10 w-10 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error?.response?.status === 403) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium">Super admin access required to view inquiries.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Website inquiries</h1>
        <p className="text-gray-600 mt-1">
          Get in touch and Get started form submissions from the public website. Only visible to super admins.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {inquiries.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Inbox className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No inquiries yet.</p>
            <p className="text-sm mt-1">Submissions from the public contact and get started pages will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    From
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Subject / Company
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inquiries.map((inq) => (
                  <tr key={inq.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <EnquiryTypeBadge type={inq.enquiry_type} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{inq.name}</div>
                          <a
                            href={`mailto:${inq.email}`}
                            className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1"
                          >
                            <Mail className="h-3 w-3" />
                            {inq.email}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <span className="text-sm text-gray-900">
                        {inq.enquiry_type === 'get_started' ? (inq.company || '—') : (inq.subject || '—')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <span className="inline-flex items-center text-xs text-gray-500">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDate(inq.created_at)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 max-w-md line-clamp-2" title={inq.message}>
                        {inq.message || '—'}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedInquiry(inq)}
                        className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-modal="true" role="dialog">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setSelectedInquiry(null)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <h2 className="text-lg font-semibold text-gray-900">Inquiry details</h2>
                <button
                  type="button"
                  onClick={() => setSelectedInquiry(null)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-500">Type:</span>
                  <EnquiryTypeBadge type={selectedInquiry.enquiry_type} />
                </div>
                <div>
                  <span className="text-gray-500 block mb-1">From</span>
                  <p className="font-medium text-gray-900">{selectedInquiry.name}</p>
                  <a href={`mailto:${selectedInquiry.email}`} className="text-primary-600 hover:underline">
                    {selectedInquiry.email}
                  </a>
                </div>
                {selectedInquiry.company && (
                  <div>
                    <span className="text-gray-500 flex items-center gap-1 mb-1">
                      <Building2 className="h-4 w-4" /> Company
                    </span>
                    <p className="text-gray-900">{selectedInquiry.company}</p>
                  </div>
                )}
                {selectedInquiry.subject && (
                  <div>
                    <span className="text-gray-500 block mb-1">Subject</span>
                    <p className="text-gray-900">{selectedInquiry.subject}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 flex items-center gap-1 mb-1">
                    <MessageSquare className="h-4 w-4" /> Message
                  </span>
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedInquiry.message || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-500 flex items-center gap-1 mb-1">
                    <Calendar className="h-4 w-4" /> Submitted
                  </span>
                  <p className="text-gray-900">{formatDate(selectedInquiry.created_at)}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedInquiry(null)}
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
