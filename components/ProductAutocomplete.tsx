'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MasterProduct } from '@/lib/types';
import { Package, PlusCircle, Check } from 'lucide-react';

interface ProductAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  masterProducts: MasterProduct[];
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export default function ProductAutocomplete({
  value,
  onChange,
  masterProducts,
  placeholder = 'ابحث أو اكتب اسم الكتاب...',
  className = '',
  required = false,
}: ProductAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    const matches = masterProducts.filter(mp => 
      mp.name.toLowerCase().includes(query) || (mp.category && mp.category.toLowerCase().includes(query))
    );

    const hasExactMatch = masterProducts.some(
      mp => mp.name.trim().toLowerCase() === query
    );

    const result: Array<{ id: string; name: string; category?: string; available_stock?: number; isCustom?: boolean }> = matches.map(m => ({
      id: m.id,
      name: m.name,
      category: m.category,
      available_stock: m.available_stock,
      isCustom: false,
    }));

    if (query.length > 0 && !hasExactMatch) {
      result.unshift({
        id: 'custom-new-item',
        name: value.trim(),
        category: 'عنصر جديد',
        isCustom: true,
      });
    }

    return result;
  }, [value, masterProducts]);

  // Ensure focused index stays within bounds
  useEffect(() => {
    if (focusedIndex >= suggestions.length) {
      setFocusedIndex(suggestions.length - 1);
    }
  }, [suggestions.length, focusedIndex]);

  // Scroll focused element into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const itemEl = listRef.current.children[focusedIndex] as HTMLElement;
      if (itemEl) {
        itemEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex, isOpen]);

  const handleSelect = (name: string) => {
    onChange(name);
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (focusedIndex >= 0 && focusedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[focusedIndex].name);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <input
        type="text"
        required={required}
        placeholder={placeholder}
        value={value}
        onFocus={() => setIsOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setFocusedIndex(0);
        }}
        onKeyDown={handleKeyDown}
        className="w-full bg-white/90 border border-neutral-200/80 rounded-2xl px-4 h-10 text-xs sm:text-sm text-neutral-900 focus:bg-white focus:outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 font-medium transition-all shadow-xs"
      />

      {isOpen && suggestions.length > 0 && (
        <div
          ref={listRef}
          className="absolute top-full left-0 right-0 mt-1.5 w-full z-50 bg-white/95 backdrop-blur-md border border-neutral-200/80 rounded-2xl shadow-2xl overflow-hidden max-h-[460px] overflow-y-auto overscroll-contain divide-y divide-neutral-100 animate-in fade-in zoom-in-95 duration-150"
        >
          {suggestions.map((item, index) => {
            const isFocused = index === focusedIndex;
            const isExactSelected = item.name.trim().toLowerCase() === value.trim().toLowerCase();

            if (item.isCustom) {
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item.name)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={`px-3.5 py-2.5 cursor-pointer transition-colors flex items-center justify-between gap-2 text-orange-700 bg-orange-50/80 hover:bg-orange-100/80 min-h-[40px] ${
                    isFocused ? 'bg-orange-100 text-orange-900 font-bold' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <PlusCircle className="w-4 h-4 text-orange-600 shrink-0" />
                    <span className="text-xs font-bold truncate">
                      إضافة كعنصر مخصص: &quot;{item.name}&quot;
                    </span>
                  </div>
                  <span className="text-[10px] font-bold bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full shrink-0">
                    جديد
                  </span>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item.name)}
                onMouseEnter={() => setFocusedIndex(index)}
                className={`px-3.5 py-2.5 cursor-pointer transition-colors flex items-center justify-between gap-2 min-h-[40px] ${
                  isFocused || isExactSelected ? 'bg-neutral-100 text-neutral-900 font-bold' : 'hover:bg-neutral-50 text-neutral-800'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-medium truncate">{item.name}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.category && (
                    <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 border border-neutral-200/60 px-2 py-0.5 rounded-full">
                      {item.category}
                    </span>
                  )}
                  {isExactSelected && (
                    <Check className="w-3.5 h-3.5 text-neutral-900 shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
