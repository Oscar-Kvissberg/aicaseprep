import React from 'react';

interface GradientBorderButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function GradientBorderButton({ 
  children, 
  onClick, 
  className = '', 
  disabled = false,
  type = 'button'
}: GradientBorderButtonProps) {
  return (
    <button 
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`gradient-border text-sm font-medium text-gray-900 rounded-xl px-5 py-2.5 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-p-custom/20 dark:focus:ring-p-custom/40 transition-all duration-200 ${className}`}
    >
      {children}
    </button>
  );
}