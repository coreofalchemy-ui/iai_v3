/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { GeneratedData, TextContent, SpecContent } from '../App';
// FIX: Corrected function import from 'generateModelImages' to 'regenerateModelImages' to match exported member.
import { regenerateModelImages } from '../services/geminiService';
import { getFriendlyErrorMessage } from '../lib/utils';
import Spinner from './Spinner';
import { RefreshCwIcon } from './icons';
import { PREDEFINED_POSES, PREDEFINED_CLOSEUP_POSES } from './PreviewPanel';

interface AdjustmentPanelProps {
    data: GeneratedData;
    onModelImagesUpdate: (newModelUrls: string[]) => void;
    onTextContentUpdate: (newTextContent: TextContent) => void;
    onSpecContentUpdate: (newSpecContent: SpecContent) => void;
}

const AdjustmentPanel: React.FC<AdjustmentPanelProps> = ({ 
    data, 
    onModelImagesUpdate,
    onTextContentUpdate,
    onSpecContentUpdate 
}) => {
    const [textContent, setTextContent] = useState<TextContent>(data.textContent);
    const [specContent, setSpecContent] = useState<SpecContent>(data.specContent);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regenerateError, setRegenerateError] = useState<string | null>(null);

    useEffect(() => {
        setTextContent(data.textContent);
        setSpecContent(data.specContent);
    }, [data]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setTextContent(prev => ({ ...prev, [name]: value }));
    };

    const handleSpecChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSpecContent(prev => ({ ...prev, [name]: value }));
    };
    
    // Debounce updates to parent
    useEffect(() => {
        const handler = setTimeout(() => {
            onTextContentUpdate(textContent);
        }, 500);
        return () => clearTimeout(handler);
    }, [textContent, onTextContentUpdate]);

    useEffect(() => {
        const handler = setTimeout(() => {
            onSpecContentUpdate(specContent);
        }, 500);
        return () => clearTimeout(handler);
    }, [specContent, onSpecContentUpdate]);

    const handleRegenerateImages = async () => {
        // FIX: Check for modelFiles array instead of single modelFile.
        if (!data.modelFiles || data.modelFiles.length === 0) return;
        setIsRegenerating(true);
        setRegenerateError(null);
        try {
            // FIX: The `regenerateModelImages` function expects 2 arguments.
            // The old logic for generating random prompts has been removed as it's now handled by the service.
            const { newModelShots, newCloseupShots } = await regenerateModelImages(
                data.productFiles,
                data.modelFiles,
            );
            onModelImagesUpdate([...newModelShots, ...newCloseupShots].map(asset => asset.url));
        } catch (e) {
            setRegenerateError(getFriendlyErrorMessage(e, '이미지 재생성에 실패했습니다'));
        } finally {
            setIsRegenerating(false);
        }
    };
    
    return (
        <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 h-full overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">콘텐츠 수정</h2>

             {regenerateError && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 text-sm rounded mb-4" role="alert">
                    <p>{regenerateError}</p>
                </div>
            )}
            
            <div className="space-y-6">
                {/* Image Regeneration */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">모델 이미지</h3>
                    <button
                        onClick={handleRegenerateImages}
                        disabled={isRegenerating}
                        className="w-full flex items-center justify-center text-center bg-gray-100 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors duration-200 ease-in-out hover:bg-gray-200 active:scale-95 text-sm disabled:opacity-60 disabled:cursor-wait"
                    >
                        {isRegenerating ? (
                            <>
                                <Spinner />
                                <span className="ml-2">재생성 중...</span>
                            </>
                        ) : (
                            <>
                                <RefreshCwIcon className="w-4 h-4 mr-2" />
                                모델 이미지 다시 생성하기
                            </>
                        )}
                    </button>
                </div>

                {/* Text Content */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">광고 문구</h3>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-gray-600 mb-1">제목</label>
                            <input type="text" id="title" name="title" value={textContent.title} onChange={handleTextChange} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent transition" />
                        </div>
                        <div>
                            <label htmlFor="descriptionPara1" className="block text-sm font-medium text-gray-600 mb-1">설명 문단 1</label>
                            <textarea id="descriptionPara1" name="descriptionPara1" value={textContent.descriptionPara1} onChange={handleTextChange} rows={4} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent transition" />
                        </div>
                         <div>
                            <label htmlFor="descriptionPara2" className="block text-sm font-medium text-gray-600 mb-1">설명 문단 2</label>
                            <textarea id="descriptionPara2" name="descriptionPara2" value={textContent.descriptionPara2} onChange={handleTextChange} rows={4} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent transition" />
                        </div>
                    </div>
                </div>

                {/* Spec Content */}
                <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">제품 정보</h3>
                    <div className="space-y-3">
                        {Object.entries(specContent).map(([key, value]) => (
                             <div key={key}>
                                <label htmlFor={key} className="block text-sm font-medium text-gray-600 mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                                <input type="text" id={key} name={key} value={value} onChange={handleSpecChange} className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent transition" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdjustmentPanel;