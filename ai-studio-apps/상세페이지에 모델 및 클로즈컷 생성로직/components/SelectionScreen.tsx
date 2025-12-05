/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { ImageAsset } from '../App';
import { CheckCircleIcon } from './icons';

interface SelectionScreenProps {
  modelShots: ImageAsset[];
  closeupShots: ImageAsset[];
  onConfirm: (selectedModelShots: ImageAsset[], selectedCloseupShots: ImageAsset[]) => void;
  onCancel: () => void;
  isConfirming: boolean;
}

const ImageGrid = ({ title, images, selectedIndices, onSelect, maxSelection = 5 }: { title: string, images: ImageAsset[], selectedIndices: Set<number>, onSelect: (index: number) => void, maxSelection?: number }) => {
    const selectedCount = selectedIndices.size;
    return (
        <div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">{title} ({selectedCount} / {maxSelection} 선택)</h3>
            <div className="grid grid-cols-5 gap-4">
                {images.map((asset, index) => {
                    const isSelected = selectedIndices.has(index);
                    return (
                        <div key={index} className="relative aspect-[3/4] cursor-pointer group" onClick={() => onSelect(index)}>
                            <img src={asset.url} alt={`Generated image ${index + 1}`} className={`w-full h-full object-cover rounded-lg transition-all duration-200 ${isSelected ? 'ring-4 ring-offset-2 ring-blue-500' : 'ring-1 ring-gray-200 group-hover:ring-2 group-hover:ring-blue-400'}`} />
                            {isSelected && (
                                <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full">
                                    <CheckCircleIcon className="w-6 h-6" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const SelectionScreen: React.FC<SelectionScreenProps> = ({ modelShots, closeupShots, onConfirm, onCancel, isConfirming }) => {
  const [selectedModelIndices, setSelectedModelIndices] = useState(new Set<number>());
  const [selectedCloseupIndices, setSelectedCloseupIndices] = useState(new Set<number>());
  
  const MAX_MODEL_SELECTIONS = 5;
  const MAX_CLOSEUP_SELECTIONS = 5;

  const handleSelectModel = (index: number) => {
    setSelectedModelIndices(prev => {
        const newSet = new Set(prev);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else if (newSet.size < MAX_MODEL_SELECTIONS) {
            newSet.add(index);
        }
        return newSet;
    });
  };
  
  const handleSelectCloseup = (index: number) => {
    setSelectedCloseupIndices(prev => {
        const newSet = new Set(prev);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else if (newSet.size < MAX_CLOSEUP_SELECTIONS) {
            newSet.add(index);
        }
        return newSet;
    });
  };

  const handleConfirmClick = () => {
    // FIX: The original sorting logic was inefficient and caused a TypeScript error.
    // This revised logic first sorts the selected indices numerically and then maps
    // them to the corresponding image assets, which is cleaner and more performant.
    // FIX: Explicitly type callback parameters to resolve type inference errors.
    const selectedModels = Array.from(selectedModelIndices)
        .sort((a: number, b: number) => a - b)
        .map((i: number) => modelShots[i]);
    const selectedCloseups = Array.from(selectedCloseupIndices)
        .sort((a: number, b: number) => a - b)
        .map((i: number) => closeupShots[i]);
    onConfirm(selectedModels, selectedCloseups);
  };

  const totalSelected = selectedModelIndices.size + selectedCloseupIndices.size;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">모델 이미지 선택</h2>
            <p className="mt-4 text-lg leading-8 text-gray-600">
                상세페이지에 사용할 이미지를 선택해주세요. 선택한 이미지를 기반으로 페이지가 생성됩니다.
            </p>
        </div>

        <div className="space-y-12">
            <ImageGrid title="모델 컷" images={modelShots} selectedIndices={selectedModelIndices} onSelect={handleSelectModel} maxSelection={MAX_MODEL_SELECTIONS} />
            <ImageGrid title="클로즈업 컷" images={closeupShots} selectedIndices={selectedCloseupIndices} onSelect={handleSelectCloseup} maxSelection={MAX_CLOSEUP_SELECTIONS}/>
        </div>
        
        <div className="mt-12 flex items-center justify-center gap-4">
            <button 
                onClick={onCancel}
                disabled={isConfirming}
                className="px-8 py-3 text-base font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
                취소하고 돌아가기
            </button>
            <button 
                onClick={handleConfirmClick}
                disabled={totalSelected === 0 || isConfirming}
                className="px-8 py-3 text-base font-semibold text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
                 {isConfirming ? '페이지 생성 중...' : `✔ 선택 완료 및 페이지 생성 (${totalSelected}장)`}
            </button>
        </div>
    </div>
  );
};

export default SelectionScreen;
