
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';

interface ProductEnhancementPanelProps {
    activePreset: string;
    onSelectPreset: (preset: string) => void;
    isLoading: boolean;
}

const ENHANCEMENT_PRESETS = [
    { id: 'off', name: '원본' },
    { id: 'beautify', name: '미화' },
    { id: 'studio', name: '스튜디오' },
    { id: 'outdoor', name: '자연광' },
    { id: 'cinematic', name: '영화처럼' },
    { id: 'side-lighting', name: '측면 조명' },
];

const ProductEnhancementPanel: React.FC<ProductEnhancementPanelProps> = ({ activePreset, onSelectPreset, isLoading }) => {
    return (
        <div id="product-enhancement-bar-wrapper" className="py-8 px-4 bg-white border-y border-gray-100">
            <h3 className="text-center text-lg font-bold text-gray-800 mb-4">제품 이미지 보정</h3>
            <div className="flex items-center justify-center gap-2 flex-wrap">
                {ENHANCEMENT_PRESETS.map(preset => (
                    <button
                        key={preset.id}
                        onClick={() => onSelectPreset(preset.id)}
                        disabled={isLoading}
                        className={`px-4 py-2 text-sm font-bold rounded-full transition-all duration-200 outline-none focus:outline-none disabled:opacity-50 disabled:cursor-wait ${
                            activePreset === preset.id
                                ? 'bg-gray-800 text-white shadow-md'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                    >
                        {preset.name}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default ProductEnhancementPanel;