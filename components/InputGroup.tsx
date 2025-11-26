import React from 'react';

interface InputGroupProps {
  label: string;
  value: number | string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  step?: string;
  min?: string;
  helperText?: string;
  className?: string;
}

export const InputGroup: React.FC<InputGroupProps> = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  prefix,
  suffix,
  step,
  min,
  helperText,
  className = ''
}) => {
  return (
    <div className={`flex flex-col ${className}`}>
      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
        {label}
      </label>
      <div className="relative flex items-center">
        {prefix && (
          <div className="absolute left-3 text-gray-400 pointer-events-none">
            {prefix}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          step={step}
          min={min}
          placeholder={placeholder}
          onWheel={(e) => e.currentTarget.blur()}
          className={`w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white rounded-lg py-2.5 ${prefix ? 'pl-10' : 'pl-3'} ${suffix ? 'pr-10' : 'pr-3'} focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all shadow-sm`}
        />
        {suffix && (
          <div className="absolute right-3 text-gray-400 pointer-events-none text-sm font-medium">
            {suffix}
          </div>
        )}
      </div>
      {helperText && (
        <span className="text-xs text-gray-400 mt-1">{helperText}</span>
      )}
    </div>
  );
};