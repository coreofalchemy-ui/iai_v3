import React, { useState } from 'react';

interface ColorPickerDialogProps {
    visible: boolean;
    onConfirm: (color: string, colorName: string) => void;
    onCancel: () => void;
}

const PRESET_COLORS = [
    { name: '블랙', value: '#000000' },
    { name: '화이트', value: '#FFFFFF' },
    { name: '그레이', value: '#808080' },
    { name: '네이비', value: '#1E3A5F' },
    { name: '베이지', value: '#D4C4A8' },
    { name: '카키', value: '#8B7355' },
    { name: '브라운', value: '#5C4033' },
    { name: '버건디', value: '#722F37' },
    { name: '레드', value: '#DC143C' },
    { name: '핑크', value: '#FFB6C1' },
    { name: '오렌지', value: '#FF6B35' },
    { name: '옐로우', value: '#FFD700' },
    { name: '그린', value: '#228B22' },
    { name: '민트', value: '#98FF98' },
    { name: '스카이블루', value: '#87CEEB' },
    { name: '블루', value: '#0066CC' },
    { name: '퍼플', value: '#7B68EE' },
    { name: '라벤더', value: '#E6E6FA' },
];

export const ColorPickerDialog: React.FC<ColorPickerDialogProps> = ({
    visible,
    onConfirm,
    onCancel
}) => {
    const [selectedColor, setSelectedColor] = useState<{ name: string; value: string } | null>(null);

    if (!visible) return null;

    const handleConfirm = () => {
        if (selectedColor) {
            onConfirm(selectedColor.value, selectedColor.name);
            setSelectedColor(null);
        }
    };

    const handleCancel = () => {
        setSelectedColor(null);
        onCancel();
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99998]"
            onClick={handleCancel}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl p-6 w-[400px] max-h-[80vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        🎨 색상 변경
                    </h3>
                    <button
                        onClick={handleCancel}
                        className="text-gray-400 hover:text-gray-600 text-2xl"
                    >
                        ×
                    </button>
                </div>

                {/* Description */}
                <p className="text-gray-500 text-sm mb-4">
                    변경할 색상을 선택하세요. AI가 의류의 색상을 변경합니다.
                </p>

                {/* Color Grid */}
                <div className="grid grid-cols-6 gap-3 mb-6">
                    {PRESET_COLORS.map((color) => (
                        <button
                            key={color.value}
                            className={`w-12 h-12 rounded-xl shadow-md transition-all hover:scale-110 ${selectedColor?.value === color.value
                                ? 'ring-4 ring-black scale-110'
                                : 'ring-1 ring-gray-200'
                                }`}
                            style={{ backgroundColor: color.value }}
                            onClick={() => setSelectedColor(color)}
                            title={color.name}
                        />
                    ))}
                </div>

                {/* Selected Color Preview */}
                {selectedColor && (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4">
                        <div
                            className="w-10 h-10 rounded-lg shadow"
                            style={{ backgroundColor: selectedColor.value }}
                        />
                        <div>
                            <div className="font-semibold text-gray-800">{selectedColor.name}</div>
                            <div className="text-xs text-gray-500">{selectedColor.value}</div>
                        </div>
                    </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleCancel}
                        className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 font-semibold hover:bg-gray-50 transition"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedColor}
                        className={`flex-1 py-3 rounded-xl font-semibold transition ${selectedColor
                            ? 'bg-black text-white hover:bg-gray-800'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        색상 적용
                    </button>
                </div>
            </div>
        </div>
    );
};
