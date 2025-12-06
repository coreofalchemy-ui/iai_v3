import React from 'react';
import { MinimalSlider } from './MinimalSlider';

const colors = { bgBase: '#F5F5F7', bgSurface: '#FFFFFF', bgSubtle: '#F0F0F4', borderSoft: '#E2E2E8', textPrimary: '#111111', textSecondary: '#6E6E73', textMuted: '#A1A1AA', accentPrimary: '#111111' };

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
    label, isVisible, onToggleVisibility, fontSize = 14, onFontSizeChange, children, showFontControl = true,
    draggable = false, onDragStart, onDragOver, onDrop, fieldId, collapsible = false
}) => {
    return (
        <div
            style={{ background: isVisible ? colors.bgSurface : colors.bgSubtle, borderRadius: 10, padding: 10, opacity: isVisible ? 1 : 0.6, border: `1px solid ${colors.borderSoft}` }}
            className={draggable ? 'cursor-grab active:cursor-grabbing' : ''}
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
                        <svg style={{ color: colors.textMuted }} className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                            <circle cx="4" cy="4" r="1.5" /><circle cx="4" cy="8" r="1.5" /><circle cx="4" cy="12" r="1.5" />
                            <circle cx="8" cy="4" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="12" r="1.5" />
                        </svg>
                    )}
                    <div className="flex items-center gap-1.5 cursor-pointer select-none" onClick={onToggleVisibility}>
                        {collapsible && <span style={{ color: colors.textMuted, fontSize: 10, transition: 'transform 0.2s' }} className={isVisible ? 'rotate-90' : ''}>▶</span>}
                        <label style={{ fontSize: 13, fontWeight: 600, color: isVisible ? colors.textPrimary : colors.textMuted, cursor: 'pointer' }}>{label}</label>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {!collapsible && showFontControl && isVisible && onFontSizeChange && (
                        <div className="flex items-center gap-0.5">
                            <span style={{ fontSize: 7, color: colors.textMuted }}>T</span>
                            <MinimalSlider value={fontSize} min={10} max={48} onChange={onFontSizeChange} className="w-28" />
                            <span style={{ fontSize: 9, color: colors.textMuted, width: 16, textAlign: 'right' }}>{fontSize}</span>
                        </div>
                    )}
                </div>
            </div>
            {isVisible && (
                <div className="mt-2 space-y-2">
                    {collapsible && showFontControl && onFontSizeChange && (
                        <div className="flex items-center gap-2 pl-1 mb-1">
                            <span style={{ fontSize: 10, color: colors.textSecondary }}>Font Size</span>
                            <div className="flex-1"><MinimalSlider value={fontSize} min={10} max={60} onChange={onFontSizeChange} className="w-full" /></div>
                            <span style={{ fontSize: 10, color: colors.textSecondary, width: 24, textAlign: 'right' }}>{fontSize}</span>
                        </div>
                    )}
                    {children}
                </div>
            )}
        </div>
    );
};
