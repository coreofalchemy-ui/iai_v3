import React, { useState } from 'react';
import { ImageUploader } from './ImageUploader';
import { GeneratedImageGallery } from './GeneratedImageGallery';
import { UploadFile } from '../types';
import { SparklesIcon } from './Icons';
import { ClothingColorSettings } from '../services/geminiService';

type AppStep = 'upload' | 'generating' | 'results' | 'error';

interface ContentGeneratorProps {
  sourceImages: UploadFile[];
  productImages: UploadFile[];
  generatedImages: string[];
  step: AppStep;
  error: string | null;
  isSingleShoe: boolean;
  onSourceImagesChange: (files: UploadFile[]) => void;
  onProductImagesChange: (files: UploadFile[]) => void;
  onGenerate: (colorSettings: ClothingColorSettings) => void;
  onReset: () => void;
  onImageAdd: (index: number, newImageUrl: string) => void;
  onIsSingleShoeChange: (isSingle: boolean) => void;
}

const COLOR_CATEGORIES = [
    { id: 'outer', label: '아우터 (Outer)' },
    { id: 'inner', label: '상의/이너 (Inner)' },
    { id: 'pants', label: '하의 (Pants)' },
    { id: 'socks', label: '양말 (Socks)' },
];

const COLORS = [
    { id: 'White', hex: '#FFFFFF', border: 'border-gray-300', text: 'text-gray-900', bgClass: 'bg-white' },
    { id: 'Grey', hex: '#9CA3AF', border: 'border-transparent', text: 'text-white', bgClass: 'bg-gray-400' },
    { id: 'Black', hex: '#000000', border: 'border-gray-600', text: 'text-white', bgClass: 'bg-black' },
    { id: 'Navy', hex: '#1e3a8a', border: 'border-transparent', text: 'text-white', bgClass: 'bg-blue-900' },
    { id: 'Beige', hex: '#d4b996', border: 'border-transparent', text: 'text-black', bgClass: 'bg-[#d4b996]' },
    { id: 'Khaki', hex: '#8f8f5e', border: 'border-transparent', text: 'text-white', bgClass: 'bg-[#8f8f5e]' },
    { id: 'Blue', hex: '#2563eb', border: 'border-transparent', text: 'text-white', bgClass: 'bg-blue-600' },
    { id: 'Red', hex: '#dc2626', border: 'border-transparent', text: 'text-white', bgClass: 'bg-red-600' },
];

export const ContentGenerator: React.FC<ContentGeneratorProps> = ({
  sourceImages,
  productImages,
  generatedImages,
  step,
  error,
  isSingleShoe,
  onSourceImagesChange,
  onProductImagesChange,
  onGenerate,
  onReset,
  onImageAdd,
  onIsSingleShoeChange,
}) => {
  
  // State for Color Preferences
  const [colorSettings, setColorSettings] = useState<ClothingColorSettings>({
      outer: null,
      inner: null,
      pants: null,
      socks: null,
  });

  const toggleColor = (category: keyof ClothingColorSettings, colorId: string) => {
      setColorSettings(prev => ({
          ...prev,
          [category]: prev[category] === colorId ? null : colorId
      }));
  };

  const handleGenerateClick = () => {
      onGenerate(colorSettings);
  };

  // If we have results, delegate to the Gallery component
  if (step === 'results' && generatedImages.length > 0) {
    return (
        <GeneratedImageGallery
          images={generatedImages}
          onReset={onReset}
          onImageAdd={onImageAdd}
        />
    );
  }

  // Upload / Initial State Layout
  return (
    <div className="flex h-full font-sans bg-[#09090b]">
        {/* Left Sidebar - Input Panel */}
        <div className="w-[420px] min-w-[420px] bg-[#111318] border-r border-gray-800 flex flex-col z-20 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-800 bg-[#161920]">
                <h2 className="text-white font-bold text-xl tracking-tight flex items-center">
                     <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full mr-3 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></span>
                     AI 패션 스튜디오
                </h2>
                <p className="text-xs text-indigo-400 font-medium tracking-wider mt-1.5 ml-5">GEMINI 3.0 PRO VFX ENGINE</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                
                {/* 01. Shoes (Target) */}
                <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                        <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide">01. 신발 제품 (SHOES)</h3>
                        <span className="text-xs text-indigo-400 font-medium">필수</span>
                    </div>
                    <ImageUploader
                        title="제품 사진"
                        description=""
                        onFilesChange={onProductImagesChange}
                        maxFiles={5}
                        maxSizeMB={5}
                        isMultiple
                        compact
                    />
                    <div className="pl-1 pt-1">
                        <label className="flex items-center space-x-3 cursor-pointer group p-2 rounded-md hover:bg-gray-800/50 transition-colors">
                             <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSingleShoe ? 'bg-indigo-600 border-indigo-600' : 'border-gray-500 bg-gray-900 group-hover:border-gray-400'}`}>
                                {isSingleShoe && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                             </div>
                             <input type="checkbox" checked={isSingleShoe} onChange={(e) => onIsSingleShoeChange(e.target.checked)} className="hidden" />
                             <span className="text-sm text-gray-300 font-medium group-hover:text-white">한쪽 신발만 교체 (외발 생성 모드)</span>
                        </label>
                    </div>
                </div>

                {/* 02. Face ID (Placeholder) */}
                <div className="space-y-3 opacity-60 pointer-events-none grayscale">
                    <div className="flex justify-between items-baseline">
                        <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide">02. 모델 얼굴 (FACE ID)</h3>
                        <span className="text-xs text-gray-500">준비중</span>
                    </div>
                    <div className="border border-dashed border-gray-700 rounded-xl h-24 flex flex-col items-center justify-center bg-gray-800/30">
                         <svg className="w-8 h-8 text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                         <span className="text-xs text-gray-500 font-medium">고해상도 얼굴 사진 업로드</span>
                    </div>
                </div>

                {/* 03. Model (Source) */}
                <div className="space-y-3">
                     <div className="flex justify-between items-baseline">
                        <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide">03. 모델 원본 (MODEL)</h3>
                        <span className="text-xs text-indigo-400 font-medium">필수</span>
                    </div>
                    <ImageUploader
                        title="모델 전신 사진"
                        description=""
                        onFilesChange={onSourceImagesChange}
                        maxFiles={10}
                        maxSizeMB={10}
                        isMultiple
                        aspectRatio="1/1" 
                        compact
                    />
                    <p className="text-xs text-gray-400 mt-1 pl-1 font-medium">* 이 모델의 의상과 포즈를 베이스로 사용합니다. (1:1 비율 자동 조정)</p>
                </div>

                 {/* 04. Clothing Color Settings */}
                <div className="pt-6 border-t border-gray-700">
                     <h3 className="text-sm font-bold text-gray-200 mb-4 uppercase tracking-wide flex items-center">
                        04. 의상 색상 변경 (Optional)
                        <span className="ml-2 px-1.5 py-0.5 bg-gray-800 text-[10px] text-gray-400 rounded border border-gray-700">AI Recolor</span>
                     </h3>
                     
                     <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-5 space-y-5">
                        {COLOR_CATEGORIES.map((cat) => (
                            <div key={cat.id}>
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs font-bold text-gray-300 tracking-wide">{cat.label}</span>
                                    {colorSettings[cat.id as keyof ClothingColorSettings] && (
                                        <button 
                                            onClick={() => toggleColor(cat.id as keyof ClothingColorSettings, colorSettings[cat.id as keyof ClothingColorSettings]!)}
                                            className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline"
                                        >
                                            초기화
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {COLORS.map((color) => {
                                        const isSelected = colorSettings[cat.id as keyof ClothingColorSettings] === color.id;
                                        return (
                                            <button
                                                key={color.id}
                                                onClick={() => toggleColor(cat.id as keyof ClothingColorSettings, color.id)}
                                                className={`
                                                    h-9 rounded-md border flex items-center justify-center transition-all duration-200 relative group
                                                    ${isSelected 
                                                        ? 'border-indigo-500 ring-1 ring-indigo-500 bg-gray-800' 
                                                        : 'border-gray-700 bg-gray-900 hover:border-gray-500 hover:bg-gray-800'}
                                                `}
                                                title={color.id}
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <div className={`w-3 h-3 rounded-full border border-gray-600/30 ${color.bgClass}`}></div>
                                                    <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>
                                                        {color.id}
                                                    </span>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                     </div>
                </div>

            </div>

            <div className="p-6 border-t border-gray-800 bg-[#161920]">
                <button
                    onClick={handleGenerateClick}
                    disabled={sourceImages.length === 0 || productImages.length === 0}
                    className={`w-full py-4 text-base font-bold rounded-xl transition-all flex items-center justify-center shadow-lg
                        ${sourceImages.length === 0 || productImages.length === 0
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/40 hover:shadow-indigo-900/60 transform hover:-translate-y-0.5'
                        }`}
                >
                    <SparklesIcon className="w-5 h-5 mr-2" />
                    캠페인 생성 시작
                </button>
            </div>
        </div>

        {/* Right Main Content - Placeholder */}
        <div className="flex-1 bg-[#09090b] relative flex items-center justify-center p-10">
            {error ? (
                 <div className="max-w-md w-full bg-red-950/30 border border-red-900/50 rounded-xl p-8 text-center backdrop-blur-sm">
                    <h3 className="text-red-400 font-bold text-lg mb-2">오류가 발생했습니다</h3>
                    <p className="text-gray-300 text-sm">{error}</p>
                 </div>
            ) : (
                <div className="text-center opacity-80">
                    <div className="w-32 h-32 bg-gray-800/30 border border-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-8">
                        <SparklesIcon className="w-12 h-12 text-gray-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Studio Ready</h2>
                    <p className="text-gray-400 text-base max-w-md mx-auto leading-relaxed font-medium">
                        좌측 사이드바에서 신발과 모델 사진을 업로드하세요.<br/>
                        Gemini 3.0 Pro 엔진이 <span className="text-indigo-400">자동으로 합성을 진행</span>합니다.
                    </p>
                </div>
            )}
        </div>
    </div>
  );
};