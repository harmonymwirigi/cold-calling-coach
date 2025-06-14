// src/components/ui/LoadingSpinner.jsx
import React from 'react';

const LoadingSpinner = ({ 
  size = 'medium', 
  color = 'blue', 
  className = '',
  text = null 
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8', 
    large: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const colorClasses = {
    blue: 'border-blue-600',
    white: 'border-white',
    gray: 'border-gray-600',
    green: 'border-green-600',
    red: 'border-red-600'
  };

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div 
        className={`
          animate-spin rounded-full border-2 border-t-transparent
          ${sizeClasses[size]}
          ${colorClasses[color]}
        `}
      />
      {text && (
        <p className={`mt-2 text-sm ${color === 'white' ? 'text-white' : 'text-gray-600'}`}>
          {text}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;