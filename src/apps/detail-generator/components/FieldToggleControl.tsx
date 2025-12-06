import React from 'react';
import { MinimalSlider } from './MinimalSlider';

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
    collapsible?: boolean;
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
    fieldId,
    collapsible = false
}) => {
    // If collapsible, we use isVisible to control the expanded state directly.
    // The triangle toggle controls both visibility and expansion.
    const handleToggle = () => {
        onToggleVisibility();
    };

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
                    <div
                        className="flex items-center gap-1.5 cursor-pointer select-none"
                        onClick={handleToggle}
                    >
                        {collapsible && (
                            <span className={`text-[10px] text-[#888] transition-transform ${isVisible ? 'rotate-90' : ''}`}>▶</span>
                        )}
                        <label className={`text-[13px] font-bold cursor-pointer ${isVisible ? 'text-white' : 'text-[#666]'}`}>
                            {label}
                        </label>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {/* Font Size Slider - Shows only when visible (expanded) */}
                    {!collapsible && showFontControl && isVisible && onFontSizeChange && (
                        <div className="flex items-center gap-0.5">
                            <span className="text-[7px] text-[#444]">T</span>
                            <MinimalSlider
                                value={fontSize}
                                min={10}
                                max={48}
                                onChange={onFontSizeChange}
                                className="w-28"
                            />
                            <span className="text-[9px] text-[#555] w-4 text-right">{fontSize}</span>
                        </div>
                    )}
                    {/* Toggle Switch REMOVED - Controls are now via Header/Triangle */}
                </div>
            </div>
            {/* Content - Visible only when isVisible is true */}
            {isVisible && (
                <div className="mt-2 space-y-2">
                    {/* Collapsible fields have Font Size Control inside */}
                    {collapsible && showFontControl && onFontSizeChange && (
                        <div className="flex items-center gap-2 pl-1 mb-1 border-none outline-none ring-0">
                            <span className="text-[10px] text-[#888]">Font Size</span>
                            <div className="flex-1 border-none outline-none ring-0">
                                <MinimalSlider
                                    value={fontSize}
                                    min={10}
                                    max={60}
                                    onChange={onFontSizeChange}
                                    className="w-full border-none outline-none"
                                />
                            </div>
                            <span className="text-[10px] text-[#888] w-6 text-right">{fontSize}</span>
                        </div>
                    )}
                    {children}
                </div>
            )}
        </div>
    );
};
