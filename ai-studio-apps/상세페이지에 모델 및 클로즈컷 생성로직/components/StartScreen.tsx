

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback } from 'react';
import { ArrowRightIcon, UploadCloudIcon, XIcon, SparklesIcon, RotateCcwIcon, ArrowLeftIcon, CameraIcon, Wand2Icon, LayoutTemplateIcon } from './icons';
import Spinner from './Spinner';


interface StartScreenProps {
  onGenerate: (
    productFiles: File[],
    modelFiles: File[],
    mode: 'original' | 'studio' | 'frame'
  ) => void;
  isLoading: boolean;
  onOpenInstructions: () => void;
  onHtmlImport: (htmlFile: File) => void;
}

// Helper function to sort files based on numbers in their filenames
const sortFilesByNumberInName = (files: File[]): File[] => {
  const getNumber = (name: string): number => {
    const match = name.match(/(\d+)/);
    return match ? parseInt(match[0], 10) : Infinity;
  };

  return [...files].sort((a, b) => {
    const numA = getNumber(a.name);
    const numB = getNumber(b.name);
    return numA - numB;
  });
};

const FileUploader: React.FC<{
    title: string;
    description: string;
    files: File[];
    onFilesAdded: (files: FileList | null) => void;
    onFileRemoved: (index: number) => void;
    maxFiles?: number;
}> = ({ title, description, files, onFilesAdded, onFileRemoved, maxFiles }) => {
    const [isDragging, setIsDragging] = useState(false);
    
    return (
        <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
            <p className="text-sm text-gray-500 mb-4 flex-grow">{description}</p>
            <div className="space-y-2 mb-3 max-h-60 overflow-y-auto pr-2">
                {files.map((file, index) => (
                    <div key={index} className="relative p-3 bg-gray-50 rounded-md border text-sm flex items-center justify-between">
                        <span className="truncate pr-4 font-medium text-gray-700">{file.name}</span>
                        <button onClick={() => onFileRemoved(index)} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600">
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
            <label 
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragging ? 'border-gray-500 bg-gray-100' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); onFilesAdded(e.dataTransfer.files); }}
            >
                <UploadCloudIcon className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm text-center text-gray-500">클릭하여 파일 추가 또는 드래그 앤 드롭</p>
                <input 
                    type="file" 
                    multiple 
                    className="hidden" 
                    accept="image/*" 
                    onChange={(e) => onFilesAdded(e.target.files)} 
                />
            </label>
        </div>
    );
};

const StartScreen: React.FC<StartScreenProps> = ({ onGenerate, isLoading, onOpenInstructions, onHtmlImport }) => {
  const [mode, setMode] = useState<'select' | 'original' | 'studio' | 'frame'>('select');
  const [productFiles, setProductFiles] = useState<File[]>([]);
  const [modelFiles, setModelFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingHtml, setIsDraggingHtml] = useState(false);

  const handleProductFiles = (files: FileList | null) => {
    const selectedFiles = Array.from(files || []).filter(file => file.type.startsWith('image/'));
    if (selectedFiles.length === 0) return;
    const newFiles = [...productFiles, ...selectedFiles];
    setProductFiles(newFiles);
  };

  const handleModelFiles = (files: FileList | null) => {
    const selectedFiles = Array.from(files || []).filter(file => file.type.startsWith('image/'));
    if (selectedFiles.length === 0) return;
    setModelFiles(prev => {
        const newFiles = [...prev, ...selectedFiles];
        const limit = mode === 'original' ? 5 : undefined; // Original mode has a limit
        return limit ? newFiles.slice(0, limit) : newFiles;
    });
  };

  const handleHtmlFile = (files: FileList | null) => {
    if (files && files[0]) {
      if (files[0].type === 'text/html') {
        setError(null);
        onHtmlImport(files[0]);
      } else {
        setError('HTML 파일만 업로드할 수 있습니다.');
      }
    }
  };

  const handleRemoveProductFile = (index: number) => {
    setProductFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleRemoveModelFile = (index: number) => {
    setModelFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerateClick = () => {
    if (productFiles.length === 0) {
      setError('최소 1개 이상의 제품 이미지를 업로드해주세요.');
      return;
    }
    if (mode === 'studio' && modelFiles.length === 0) {
      setError('최소 1개 이상의 모델 이미지를 업로드해주세요.');
      return;
    }
    setError(null);
    const sortedProductFiles = sortFilesByNumberInName(productFiles);
    onGenerate(sortedProductFiles, modelFiles, mode as 'original' | 'studio' | 'frame');
  };
  
  const handleBackToSelect = () => {
      setMode('select');
      setProductFiles([]);
      setModelFiles([]);
      setError(null);
  };

  const isButtonDisabled = isLoading || productFiles.length === 0 || (mode === 'studio' && modelFiles.length === 0);

  if (mode === 'select') {
    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">AI로 상세페이지 만들기</h2>
                <p className="mt-4 text-lg leading-8 text-gray-600">
                    원하는 생성 방식을 선택해주세요.
                </p>
                <p className="mt-2 text-sm text-gray-500">
                    <button onClick={onOpenInstructions} className="underline hover:text-gray-700 transition-colors">
                        AI 생성 방식을 제어하고 싶으신가요? (지침 설정)
                    </button>
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <button onClick={() => setMode('original')} className="p-8 bg-white rounded-lg shadow-sm border border-gray-200 text-left hover:border-gray-400 hover:shadow-lg transition-all duration-300 group">
                    <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg mb-4 group-hover:bg-gray-800 transition-colors">
                        <CameraIcon className="w-7 h-7 text-gray-600 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">원본 생성</h3>
                    <p className="text-gray-600">사용자가 업로드한 모델과 제품 이미지를 합성하여 상세페이지를 생성합니다.</p>
                </button>
                 <button onClick={() => setMode('studio')} className="p-8 bg-white rounded-lg shadow-sm border border-gray-200 text-left hover:border-gray-400 hover:shadow-lg transition-all duration-300 group">
                    <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg mb-4 group-hover:bg-gray-800 transition-colors">
                        <Wand2Icon className="w-7 h-7 text-gray-600 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">스튜디오 생성</h3>
                    <p className="text-gray-600">스튜디오 배경에서 AI가 레퍼런스를 기반으로 새로운 모델과 착장을 생성합니다.</p>
                </button>
                <button onClick={() => setMode('frame')} className="p-8 bg-white rounded-lg shadow-sm border border-gray-200 text-left hover:border-gray-400 hover:shadow-lg transition-all duration-300 group">
                    <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg mb-4 group-hover:bg-gray-800 transition-colors">
                        <LayoutTemplateIcon className="w-7 h-7 text-gray-600 group-hover:text-white transition-colors" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">프레임 생성</h3>
                    <p className="text-gray-600">제품 사진만으로 페이지의 기본 틀을 잡고, 나중에 모델 컷을 추가합니다.</p>
                </button>
            </div>
            <div className="text-center pt-2">
                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-gray-300" /></div>
                    <div className="relative flex justify-center"><span className="bg-gray-50 px-2 text-sm text-gray-500">또는</span></div>
                </div>
                <label
                  className={`inline-flex items-center justify-center px-6 py-3 border shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-all duration-200 ${
                    isDraggingHtml ? 'border-dashed border-2 border-blue-500 scale-105' : 'border-gray-300'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingHtml(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDraggingHtml(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingHtml(false);
                    handleHtmlFile(e.dataTransfer.files);
                  }}
                >
                    <UploadCloudIcon className="w-5 h-5 mr-2 text-gray-500"/>
                    <span>{isDraggingHtml ? '여기에 파일을 놓으세요' : 'HTML 파일에서 수정하기 (드래그 앤 드롭 가능)'}</span>
                    <input type="file" className="hidden" accept=".html,text/html" onChange={(e) => handleHtmlFile(e.target.files)} />
                </label>
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="relative text-center">
        <button onClick={handleBackToSelect} className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-800">
            <ArrowLeftIcon className="w-4 h-4" />
            뒤로
        </button>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {mode === 'original' && '원본 생성'}
            {mode === 'studio' && '스튜디오 생성'}
            {mode === 'frame' && '프레임 생성'}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        <FileUploader 
            title="1. 제품 이미지 업로드"
            description={
                mode === 'original' ? "상세페이지에 사용할 제품 이미지를 업로드하세요. (권장: 7장)" :
                mode === 'studio' ? "AI가 분석할 '주인공' 신발 사진을 업로드하세요. 여러 각도일수록 좋습니다." :
                "상세페이지의 기본 틀을 생성할 제품 이미지를 업로드하세요."
            }
            files={productFiles}
            onFilesAdded={handleProductFiles}
            onFileRemoved={handleRemoveProductFile}
        />
        <FileUploader 
            title={mode === 'frame' ? "2. 모델 이미지 (선택사항)" : "2. 모델 이미지 (필수)"}
            description={
                 mode === 'original' ? "첫 이미지는 얼굴 클로즈업, 두 번째 이미지는 전신 샷으로 사용됩니다. (최대 5장)" :
                 mode === 'studio' ? "원하는 '분위기'와 '스타일'(의상, 비율, 피부톤)이 담긴 사진을 업로드하세요." :
                 "페이지 생성 후 모델 컷을 추가할 수 있지만, 지금 업로드하면 AI가 페이지 텍스트 생성 시 참고할 수 있습니다."
            }
            files={modelFiles}
            onFilesAdded={handleModelFiles}
            onFileRemoved={handleRemoveModelFile}
            maxFiles={mode === 'original' ? 5 : undefined}
        />
      </div>

      {error && <p className="text-red-600 text-center font-bold mt-4">{error}</p>}
      
      <div className="pt-4">
        <button
          onClick={handleGenerateClick}
          disabled={isButtonDisabled}
          className="w-full flex items-center justify-center text-center bg-gray-800 text-white font-semibold py-4 px-6 rounded-lg transition-colors duration-200 ease-in-out hover:bg-gray-700 active:scale-95 text-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
                <Spinner />
                <span className="ml-2">AI가 상세페이지를 만들고 있어요...</span>
            </>
          ) : (
             <>
                {mode === 'original' && '상세페이지 생성하기'}
                {mode === 'studio' && '스튜디오 모델 생성하기'}
                {mode === 'frame' && '페이지 프레임 생성하기'}
                <ArrowRightIcon className="w-5 h-5 ml-2" />
             </>
          )}
        </button>
      </div>
    </div>
  );
};

export default StartScreen;