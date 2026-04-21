import React, { useState, useEffect } from 'react';

// Controlled text input that stores a raw string while editing,
// committing the parsed number to onChange only on blur.
// This prevents leading-zero issues and allows natural typing.
export function InputField({
  label,
  value,
  onChange,
  type = 'number',
  prefix,
  suffix,
  min,
  max,
  step,
  helper,
  placeholder,
  decimals = 0,
}) {
  const [raw, setRaw] = useState('');
  const [focused, setFocused] = useState(false);

  // Sync external value → display when not focused
  useEffect(() => {
    if (!focused) {
      if (type === 'number') {
        setRaw(decimals > 0 ? Number(value).toFixed(decimals) : String(value ?? ''));
      } else {
        setRaw(String(value ?? ''));
      }
    }
  }, [value, focused, type, decimals]);

  function handleFocus() {
    setFocused(true);
    // Show plain number while editing (no commas)
    setRaw(type === 'number' ? String(value ?? '') : String(value ?? ''));
  }

  function handleChange(e) {
    setRaw(e.target.value);
  }

  function handleBlur() {
    setFocused(false);
    if (type === 'number') {
      const parsed = parseFloat(raw.replace(/,/g, ''));
      const clamped = isNaN(parsed) ? (min ?? 0) : Math.min(Math.max(parsed, min ?? -Infinity), max ?? Infinity);
      onChange(clamped);
      setRaw(decimals > 0 ? clamped.toFixed(decimals) : String(clamped));
    } else {
      onChange(raw);
    }
  }

  // Display value with comma formatting when not focused
  const displayValue = focused
    ? raw
    : type === 'number'
      ? (decimals > 0
          ? Number(value).toFixed(decimals)
          : Number(value).toLocaleString('en-CA', { maximumFractionDigits: 0 }))
      : raw;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <div className="flex items-center rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
        {prefix && (
          <span className="px-3 text-slate-400 text-sm border-r border-slate-200 bg-slate-50 rounded-l-lg py-2.5">
            {prefix}
          </span>
        )}
        <input
          type="text"
          inputMode={type === 'number' ? 'decimal' : 'text'}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="flex-1 px-3 py-2.5 text-sm text-slate-900 bg-transparent outline-none rounded-lg"
        />
        {suffix && (
          <span className="px-3 text-slate-400 text-sm border-l border-slate-200 bg-slate-50 rounded-r-lg py-2.5">
            {suffix}
          </span>
        )}
      </div>
      {helper && <p className="text-xs text-slate-400">{helper}</p>}
    </div>
  );
}

export function SelectField({ label, value, onChange, options, helper }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {helper && <p className="text-xs text-slate-400">{helper}</p>}
    </div>
  );
}

export function SliderField({ label, value, onChange, min, max, step, format, helper }) {
  const formatted = format ? format(value) : value;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className="text-sm font-semibold text-indigo-600">{formatted}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-indigo-600"
      />
      <div className="flex justify-between text-xs text-slate-400">
        <span>{format ? format(min) : min}</span>
        <span>{format ? format(max) : max}</span>
      </div>
      {helper && <p className="text-xs text-slate-400">{helper}</p>}
    </div>
  );
}

export function SectionCard({ title, subtitle, children, accent }) {
  const accentClasses = {
    blue: 'border-l-blue-500',
    green: 'border-l-emerald-500',
    purple: 'border-l-purple-500',
    orange: 'border-l-orange-500',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`border-l-4 ${accentClasses[accent] || 'border-l-indigo-500'} px-6 py-4 border-b border-slate-100`}>
        <h3 className="font-semibold text-slate-900 text-base">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-6 py-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

export function Collapsible({ title, subtitle, defaultOpen = false, children }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div>
          <span className="font-medium text-slate-800 text-sm">{title}</span>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
  );
}
