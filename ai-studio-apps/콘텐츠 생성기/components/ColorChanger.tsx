import React, { useState } from 'react';

interface ColorChangerProps {
  onColorChange: (item: string, color: string) => void;
  disabled: boolean;
  isGenerating: boolean;
}

const ITEMS = [
  { id: 'socks', label: '양말' },
  { id: 'coat', label: '아우터' },
  { id: 'inner', label: '이너' },
  { id: 'pants', label: '바지' },
];

const COLORS = [
  { id: 'White', label: 'White', bgClass: 'bg-white', textClass: 'text-gray-900' },
  { id: 'Grey', label: 'Grey', bgClass: 'bg-gray-400', textClass: 'text-white' },
  { id: 'Black', label: 'Black', bgClass: 'bg-black', textClass: 'text-white' },
  { id: 'Navy', label: 'Navy', bgClass: 'bg-blue-900', textClass: 'text-white' },
  { id: 'Beige', label: 'Beige', bgClass: 'bg-[#d4b996]', textClass: 'text-gray-900' },
  { id: 'Khaki', label: 'Khaki', bgClass: 'bg-[#8f8f5e]', textClass: 'text-white' },
  { id: 'Deep Blue', label: 'Blue', bgClass: 'bg-blue-600', textClass: 'text-white' },
  { id: 'Charcoal', label: 'Dark', bgClass: 'bg-gray-800', textClass: 'text-white' },
];

export const ColorChanger: React.FC<ColorChangerProps> = ({ 
  onColorChange, 
  disabled, 
  isGenerating 
}) => {
  const [selectedItem, setSelectedItem] = useState(ITEMS[0].id);

  return (
    <div className="border border-gray-700 rounded-xl p-5 bg-gray-800/40">
      {/* Item Selection */}
      <div className="mb-5 space-y-3">
        <label className="text-xs text-gray-300 font-bold uppercase tracking-wider block flex items-center">
            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2"></span>
            타겟 의상 선택
        </label>
        <div className="grid grid-cols-4 gap-2">
            {ITEMS.map((item) => (
                <button
                    key={item.id}
                    onClick={() => setSelectedItem(item.id)}
                    disabled={disabled}
                    className={`py-2.5 px-1 text-xs font-bold rounded-lg transition-all border
                        ${selectedItem === item.id 
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                            : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 hover:bg-gray-800'
                        }`}
                >
                    {item.label}
                </button>
            ))}
        </div>
      </div>

      {/* Color Selection */}
      <div>
        <label className="text-xs text-gray-300 font-bold uppercase tracking-wider mb-3 block flex items-center">
            <span className="w-1.5 h-1.5 bg-pink-500 rounded-full mr-2"></span>
            변경할 색상 선택
        </label>
        <div className="grid grid-cols-4 gap-2">
            {COLORS.map((color) => (
                <button
                    key={color.id}
                    onClick={() => onColorChange(selectedItem, color.id)}
                    disabled={disabled || isGenerating}
                    className={`
                        col-span-1
                        h-10 rounded-lg text-xs font-bold transition-all transform hover:-translate-y-0.5
                        border border-transparent hover:border-white/30 hover:shadow-lg
                        flex items-center justify-center space-x-1.5
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        bg-gray-900
                    `}
                    title={color.label}
                >
                    <div className={`w-3 h-3 rounded-full border border-white/10 ${color.bgClass}`}></div>
                    <span className="text-gray-300 text-[10px]">{color.label}</span>
                </button>
            ))}
        </div>
      </div>
    </div>
  );
};