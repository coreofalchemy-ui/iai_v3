import React from 'react';

interface FieldToggleControlProps {
    label: string;
    emoji?: string;
    isVisible: boolean;
    onToggleVisibility: () => void;
    fontSize?: number;
    onFontSizeChange?: (size: number) => void;
    children: React.ReactNode;
    showFontControl?: boolean;
    draggable?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    fieldId?: string;
}

export const FieldToggleControl: React.FC<FieldToggleControlProps> = ({
    label,
    isVisible,
    onToggleVisibility,
    fontSize = 14,
    onFontSizeChange,
    children,
    showFontControl = true,
    draggable = false,
    onDragStart,
    onDragOver,
    onDrop,
    fieldId
}) => {
    return (
        <div
            className={`rounded-lg p-2.5 transition-all ${isVisible ? 'bg-[#252525]' : 'bg-[#1e1e1e] opacity-50'} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
            draggable={draggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            data-field-id={fieldId}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                    {draggable && (
                        <svg className="w-3 h-3 text-[#666]" fill="currentColor" viewBox="0 0 16 16">
                            <circle cx="4" cy="4" r="1.5" />
                            <circle cx="4" cy="8" r="1.5" />
                            <circle cx="4" cy="12" r="1.5" />
                            <circle cx="8" cy="4" r="1.5" />
                            <circle cx="8" cy="8" r="1.5" />
                            <circle cx="8" cy="12" r="1.5" />
                        </svg>
                    )}
                    <label className={`text-[13px] font-bold ${isVisible ? 'text-white' : 'text-[#666]'}`}>
                        {label}
                    </label>
                </div>
                <div className="flex items-center gap-1">
                    {/* Font Size Slider */}
                    {showFontControl && isVisible && onFontSizeChange && (
                        <div className="flex items-center gap-0.5">
                            <span className="text-[7px] text-[#444]">T</span>
                            <input
                                type="range"
                                min="10"
                                max="48"
                                value={fontSize}
                                onChange={(e) => onFontSizeChange(Number(e.target.value))}
                                className="w-36 h-[2px] appearance-none bg-[#3c3c3c] rounded cursor-pointer"
                                style={{ accentColor: '#0d99ff' }}
                                title={`${fontSize}px`}
                            />
                            <span className="text-[7px] text-[#444] w-2.5 text-right">{fontSize}</span>
                        </div>
                    )}
                    {/* Toggle Switch */}
                    <button
                        onClick={onToggleVisibility}
                        className={`relative w-5 h-2.5 rounded-full transition-colors ml-1 ${isVisible ? 'bg-[#0d99ff]' : 'bg-[#3c3c3c]'}`}
                    >
                        <div
                            className={`absolute top-[2px] w-1.5 h-1.5 bg-white rounded-full shadow transition-transform ${isVisible ? 'translate-x-2.5' : 'translate-x-0.5'}`}
                        />
                    </button>
                </div>
            </div>
            {/* Content */}
            {isVisible && (
                <div className="mt-2">
                    {children}
                </div>
            )}
        </div>
    );
};
