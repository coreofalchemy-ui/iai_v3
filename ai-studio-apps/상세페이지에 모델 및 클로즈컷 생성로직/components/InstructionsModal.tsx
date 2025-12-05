
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { XIcon, DownloadIcon, UploadCloudIcon, RotateCcwIcon } from './icons';

interface InstructionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    savedInstructions: string;
    onSave: (instructions: string) => void;
    onResetToDefault: () => string;
}

const InstructionsModal: React.FC<InstructionsModalProps> = ({ isOpen, onClose, savedInstructions, onSave, onResetToDefault }) => {
    const [instructions, setInstructions] = useState(savedInstructions);

    useEffect(() => {
        if (isOpen) {
            setInstructions(savedInstructions);
        }
    }, [savedInstructions, isOpen]);

    if (!isOpen) {
        return null;
    }
    
    const handleSave = () => {
        onSave(instructions);
    };
    
    const handleReset = () => {
        const defaultInstructions = onResetToDefault();
        setInstructions(defaultInstructions);
        // Also save the reset state immediately to localStorage
        onSave(defaultInstructions);
    };

    const handleExportToFile = () => {
        const blob = new Blob([instructions], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'ai-instructions.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImportFromFile = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,text/plain';
        input.onchange = (event) => {
            const target = event.target as HTMLInputElement;
            const file = target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const text = e.target?.result as string;
                    setInstructions(text);
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };


    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800">지침 설정</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:bg-gray-100">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 flex-grow overflow-y-auto">
                    <p className="text-gray-600 mb-4">
                        AI 모델의 스타일, 사용하는 지식 등을 제어하기 위해 프로젝트에 맞춤 지침을 추가하세요. 변경사항은 브라우저에 자동 저장됩니다.
                    </p>
                    <div className="bg-gray-50 rounded-t-lg border border-gray-200 p-1">
                         <div className="flex items-center justify-between px-3 py-2">
                            <span className="font-semibold text-gray-700">나만의 지침 작성하기</span>
                             <div className="flex items-center gap-4">
                                <button onClick={handleImportFromFile} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors">
                                    <UploadCloudIcon className="w-3.5 h-3.5"/>
                                    파일에서 가져오기
                                </button>
                                <button onClick={handleExportToFile} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors">
                                    <DownloadIcon className="w-3.5 h-3.5"/>
                                    파일로 내보내기
                                </button>
                                <button onClick={handleReset} className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors">
                                    <RotateCcwIcon className="w-3 h-3"/>
                                    기본값 복원
                                </button>
                             </div>
                         </div>
                    </div>
                     <textarea
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        className="w-full h-80 p-4 border-x border-b border-gray-200 rounded-b-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent transition bg-white resize-none text-sm font-mono leading-relaxed"
                        style={{marginTop: '-1px'}}
                    />
                </div>
                <div className="flex items-center justify-end p-5 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                            취소
                        </button>
                        <button onClick={handleSave} className="px-5 py-2 text-sm font-semibold text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
                            저장하고 닫기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InstructionsModal;