import React, { useState } from 'react';

interface ClothingTypeSelectDialogProps {
    visible: boolean;
    onConfirm: (clothingType: string) => void;
    onCancel: () => void;
}

const CLOTHING_TYPES = [
    { type: 'top', label: '상의', emoji: '👕', color: 'bg-gray-700' },
    { type: 'bottom', label: '하의', emoji: '👖', color: 'bg-gray-600' },
    { type: 'inner', label: '내의', emoji: '🩱', color: 'bg-gray-500' },
    { type: 'shoes', label: '신발/양말', emoji: '👟', color: 'bg-gray-800' },
    { type: 'hat', label: '모자', emoji: '🧢', color: 'bg-gray-400' },
    { type: 'hair', label: '머리색', emoji: '💇', color: 'bg-gray-900' },
];

export const ClothingTypeSelectDialog: React.FC<ClothingTypeSelectDialogProps> = ({
    visible,
    onConfirm,
    onCancel
}) => {
    const [selectedType, setSelectedType] = useState<string | null>(null);

    if (!visible) return null;

    const handleConfirm = () => {
        if (selectedType) {
            onConfirm(selectedType);
            setSelectedType(null);
        }
    };

    const handleCancel = () => {
        setSelectedType(null);
        onCancel();
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99996]"
            onClick={handleCancel}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl p-6 w-[350px]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        👔 변경할 의류 선택
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
                    어떤 의류의 색상을 변경하시겠습니까?
                </p>

                {/* Clothing Type Grid */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {CLOTHING_TYPES.map((item) => (
                        <button
                            key={item.type}
                            className={`p-4 rounded-xl transition-all flex flex-col items-center gap-2 ${selectedType === item.type
                                ? `${item.color} text-white scale-105 shadow-lg`
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            onClick={() => setSelectedType(item.type)}
                        >
                            <span className="text-2xl">{item.emoji}</span>
                            <span className="text-xs font-bold">{item.label}</span>
                        </button>
                    ))}
                </div>

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
                        disabled={!selectedType}
                        className={`flex-1 py-3 rounded-xl font-semibold transition ${selectedType
                            ? 'bg-black text-white hover:bg-gray-800'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        선택 완료
                    </button>
                </div>
            </div>
        </div>
    );
};
