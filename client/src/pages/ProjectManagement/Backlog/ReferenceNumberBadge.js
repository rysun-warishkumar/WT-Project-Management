import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const ReferenceNumberBadge = ({ referenceNumber, size = 'sm', showIcon = true, className = '' }) => {
  const [copied, setCopied] = useState(false);

  if (!referenceNumber) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(referenceNumber);
      setCopied(true);
      toast.success('Reference number copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy reference number');
    }
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        ${sizeClasses[size]}
        bg-gray-100 text-gray-700
        rounded font-mono font-medium
        cursor-pointer hover:bg-gray-200
        transition-colors
        border border-gray-200
        ${className}
      `}
      onClick={handleCopy}
      title="Click to copy reference number"
    >
      {showIcon && (
        copied ? (
          <Check className="h-3 w-3 text-green-600" />
        ) : (
          <Copy className="h-3 w-3 text-gray-500" />
        )
      )}
      <span>{referenceNumber}</span>
    </span>
  );
};

export default ReferenceNumberBadge;
