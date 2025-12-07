/**
 * Region Overlay Component
 * 모델 홀드 상태에서 의류 부위별 호버 하이라이트 및 상호작용 처리
 */

import React, { useState, useCallback } from 'react';
import { ClothingRegion } from '../services/modelSegmentationService';

interface RegionOverlayProps {
    regions: ClothingRegion[];
    isActive: boolean; // 모델 홀드 상태
    onRegionClick?: (region: ClothingRegion, event: React.MouseEvent) => void;
    onRegionRightClick?: (region: ClothingRegion, event: React.MouseEvent) => void;
    onRegionDrop?: (region: ClothingRegion, file: File) => void;
    containerWidth: number;
    containerHeight: number;
}

export const RegionOverlay: React.FC<RegionOverlayProps> = ({
    regions,
    isActive,
    onRegionClick,
    onRegionRightClick,
    onRegionDrop,
    containerWidth,
    containerHeight
}) => {
    const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
    const [dragOverRegion, setDragOverRegion] = useState<string | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent, region: ClothingRegion) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverRegion(region.type);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOverRegion(null);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, region: ClothingRegion) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverRegion(null);

        const files = e.dataTransfer.files;
        if (files.length > 0 && onRegionDrop) {
            onRegionDrop(region, files[0]);
        }
    }, [onRegionDrop]);

    if (!isActive || regions.length === 0) {
        return null;
    }

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 25
            }}
        >
            {regions.map((region) => {
                const isHovered = hoveredRegion === region.type;
                const isDragOver = dragOverRegion === region.type;

                return (
                    <div
                        key={region.type}
                        style={{
                            position: 'absolute',
                            left: `${region.bounds.x}%`,
                            top: `${region.bounds.y}%`,
                            width: `${region.bounds.width}%`,
                            height: `${region.bounds.height}%`,
                            pointerEvents: 'auto',
                            cursor: 'pointer',
                            backgroundColor: isHovered || isDragOver
                                ? 'rgba(255, 255, 255, 0.15)'
                                : 'transparent',
                            border: isHovered || isDragOver
                                ? '2px dashed rgba(255, 255, 255, 0.5)'
                                : '2px dashed transparent',
                            borderRadius: '8px',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        onMouseEnter={() => setHoveredRegion(region.type)}
                        onMouseLeave={() => setHoveredRegion(null)}
                        onClick={(e) => {
                            e.stopPropagation();
                            onRegionClick?.(region, e);
                        }}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRegionRightClick?.(region, e);
                        }}
                        onDragOver={(e) => handleDragOver(e, region)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, region)}
                    >
                        {/* 라벨 표시 (호버 또는 드래그 시) */}
                        {(isHovered || isDragOver) && (
                            <div
                                style={{
                                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                                    color: '#fff',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                                }}
                            >
                                {isDragOver ? `${region.label}에 드롭` : region.label}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// 색상 선택 팝업 컴포넌트
interface ColorPickerPopupProps {
    visible: boolean;
    x: number;
    y: number;
    region: ClothingRegion | null;
    onColorSelect: (color: string) => void;
    onClose: () => void;
}

import ReactDOM from 'react-dom';

// ... (existing code, ensure imports overlap correctly if needed, or I will use multi_replace for safer partial edits)
// Actually, sticking to the bottom part for safer replacement

export const ColorPickerPopup: React.FC<ColorPickerPopupProps> = ({
    visible,
    x,
    y,
    region,
    onColorSelect,
    onClose
}) => {
    const colors = [
        { name: 'Black', value: '#000000', label: '블랙' },
        { name: 'White', value: '#FFFFFF', label: '화이트' },
        { name: 'Navy', value: '#1a237e', label: '네이비' },
        { name: 'Gray', value: '#757575', label: '그레이' },
        { name: 'Beige', value: '#d7ccc8', label: '베이지' },
        { name: 'Brown', value: '#5d4037', label: '브라운' },
        { name: 'Red', value: '#c62828', label: '레드' },
        { name: 'Blue', value: '#1565c0', label: '블루' },
        { name: 'Green', value: '#2e7d32', label: '그린' },
        { name: 'Pink', value: '#e91e63', label: '핑크' },
    ];

    if (!visible || !region) return null;

    // Use Portal to render outside of any stacking context (e.g. transform, overflow:hidden)
    return ReactDOM.createPortal(
        <>
            {/* 배경 클릭 시 닫기 */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 999998
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
            />
            <div
                style={{
                    position: 'fixed',
                    top: y,
                    left: x,
                    zIndex: 999999,
                    backgroundColor: '#1a1a1a',
                    borderRadius: '12px',
                    padding: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    border: '1px solid #333'
                }}
                onClick={(e) => e.stopPropagation()}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
            >
                <div style={{
                    fontSize: '11px',
                    color: '#888',
                    marginBottom: '8px',
                    fontWeight: 600
                }}>
                    {region.label} 색상 변경
                </div>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: '6px'
                }}>
                    {colors.map((color) => (
                        <button
                            key={color.value}
                            title={color.label}
                            onClick={(e) => {
                                e.stopPropagation();
                                onColorSelect(color.name);
                                onClose();
                            }}
                            style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                backgroundColor: color.value,
                                border: color.value === '#FFFFFF'
                                    ? '2px solid #333'
                                    : '2px solid transparent',
                                cursor: 'pointer',
                                transition: 'transform 0.15s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.15)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        />
                    ))}
                </div>
            </div>
        </>,
        document.body
    );
};

export default RegionOverlay;
