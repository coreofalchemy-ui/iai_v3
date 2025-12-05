

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';
import { GeneratedData, TextContent, SpecContent, FontSizes, HeroTextContent, FilterSettings, FontStyles, HeroTextColors, NoticeContent } from '../App';
import { PlusIcon, MinusIcon, RefreshCwIcon, UploadCloudIcon, XIcon, ChevronDownIcon, RotateCcwIcon, PipetteIcon, BrainCircuitIcon, SparklesIcon } from './icons';
import Spinner from './Spinner';

interface AdjustmentPanelProps {
    data: GeneratedData;
    generationMode: 'original' | 'studio' | 'frame' | null;
    fontSizes: FontSizes;
    fontStyles: FontStyles;
    heroTextColors: HeroTextColors;
    onHeroTextColorsUpdate: (colors: HeroTextColors) => void;
    onFontSizesUpdate: (newFontSizes: FontSizes) => void;
    onFontStylesUpdate: (newFontStyles: FontStyles) => void;
    onHeroTextContentUpdate: (newHeroTextContent: HeroTextContent) => void;
    onRegenerate: () => void;
    isRegenerating: boolean;
    onAddModelImage: () => void;
    isAddingModelImage: boolean;
    onAddCloseupImage: () => void;
    isAddingCloseupImage: boolean;
    topFile: File | null;
    pantsFile: File | null;
    topPreview: string | null;
    pantsPreview: string | null;
    onTopFileChange: (file: File | null) => void;
    onPantsFileChange: (file: File | null) => void;
    newFaceFiles: File[];
    onNewFaceFilesChange: (files: File[]) => void;
    isFaceLearned: boolean;
    isFaceLearning: boolean;
    onLearnFace: () => void;
    isFaceSwapping: boolean;
    onChangeFace: () => void;
    productImageUrls: string[];
    onAddProductImage: (files: File[]) => void;
    onDeleteProductImage: (index: number) => void;
    modelFiles: File[];
    onModelFilesUpdate: (files: File[]) => void;
    onToggleHeroSectionVisibility: () => void;
    onToggleStudioWornCloseupVisibility: () => void;
    onToggleFinalConceptShotVisibility: () => void;
    productEnhancementPreset: string;
    onApplyProductEnhancementPreset: (preset: string) => void;
    isBatchEnhancing: boolean;
    filterPreset: string;
    onSetFilterPreset: (preset: string) => void;
    onAddCollageBlock: (layout: '2x1' | '2x2', section: 'model' | 'closeup') => void;
}

const HERO_FIELD_CONFIG: { key: keyof HeroTextContent, label: string, multiline?: boolean }[] = [
    { key: 'brandName', label: '브랜드 이름' },
    { key: 'slogan', label: '슬로건' },
    { key: 'descriptionAndTags', label: '제품설명 & 해시태그', multiline: true },
];

const FONT_GROUPS = {
    title: [
      { name: 'M', value: "'Montserrat', sans-serif" },
      { name: 'P', value: "'Playfair Display', serif" },
      { name: 'N', value: "'Noto Sans KR', sans-serif" },
      { name: 'O', value: "'Oswald', sans-serif" },
      { name: 'W', value: "'Merriweather', serif" },
    ],
    description: [
      { name: 'N', value: "'Noto Sans KR', sans-serif" },
      { name: 'R', value: "'Roboto', sans-serif" },
      { name: 'S', value: "'Source Serif 4', serif" },
      { name: 'L', value: "'Lora', serif" },
      { name: 'I', value: "'IBM Plex Sans KR', sans-serif" },
    ],
    heroBrand: [
      { name: 'G', value: "'Gaegu', cursive" },
      { name: 'V', value: "'Great Vibes', cursive" },
      { name: 'S', value: "'Sacramento', cursive" },
      { name: 'M', value: "'Montserrat', sans-serif" },
      { name: 'D', value: "'Dancing Script', cursive" },
    ],
    heroMain: [
      { name: 'M', value: "'Montserrat', sans-serif" },
      { name: 'O', value: "'Oswald', sans-serif" },
      { name: 'B', value: "'Bebas Neue', sans-serif" },
      { name: 'A', value: "'Anton', sans-serif" },
      { name: 'N', value: "'Noto Sans KR', sans-serif" },
    ],
    specTable: [
        { name: 'N', value: "'Noto Sans KR', sans-serif" },
        { name: 'R', value: "'Roboto', sans-serif" },
        { name: 'L', value: "'Lato', sans-serif" },
        { name: 'S', value: "'Source Sans 3', sans-serif" },
        { name: 'I', value: "'IBM Plex Sans KR', sans-serif" },
    ]
};


const FONT_SIZE_MAP: { [K in keyof HeroTextContent]: keyof FontSizes } = {
    brandName: 'heroBrandName',
    slogan: 'slogan',
    descriptionAndTags: 'heroDescriptionAndTags',
};

const ENHANCEMENT_PRESETS = [
    { id: 'off', name: '원본' },
    { id: 'beautify', name: '미화' },
    { id: 'studio', name: '스튜디오' },
    { id: 'outdoor', name: '자연광' },
    { id: 'cinematic', name: '영화처럼' },
    { id: 'side-lighting', name: '측면 조명' },
];

const FILTER_BAR_PRESETS = [
    { id: 'off', name: '기본' },
    { id: 'wconcept', name: 'W컨셉' },
    { id: 'musinsa', name: '무신사' },
    { id: 'cm29', name: '29CM' },
    { id: 'krem', name: '크림' },
    { id: 'global', name: '글로벌' },
];


const ImageUploader: React.FC<{
    label: string;
    preview: string | null;
    onFileChange: (file: File | null) => void;
}> = ({ label, preview, onFileChange }) => {
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files ? e.target.files[0] : null;
        onFileChange(file);
         // Reset input value to allow re-uploading the same file
        e.target.value = '';
    };

    const handleRemove = () => {
        onFileChange(null);
    };

    return (
        <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
            {preview ? (
                <div className="relative group">
                    <img src={preview} alt={`${label} preview`} className="w-full h-24 object-cover rounded-md border" />
                    <button 
                        onClick={handleRemove}
                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <UploadCloudIcon className="w-6 h-6 text-gray-400 mb-1" />
                    <p className="text-xs text-center text-gray-500">{label} 업로드</p>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
                </label>
            )}
        </div>
    );
};

const AdjustmentPanel: React.FC<AdjustmentPanelProps> = (props) => {
    const { 
        data, 
        generationMode,
        fontSizes: propFontSizes,
        fontStyles: propFontStyles,
        heroTextColors,
        onHeroTextColorsUpdate,
        onFontSizesUpdate,
        onFontStylesUpdate,
        onHeroTextContentUpdate,
        onRegenerate,
        isRegenerating,
        onAddModelImage,
        isAddingModelImage,
        onAddCloseupImage,
        isAddingCloseupImage,
        topPreview,
        pantsPreview,
        onTopFileChange,
        onPantsFileChange,
        newFaceFiles,
        onNewFaceFilesChange,
        isFaceLearned,
        isFaceLearning,
        onLearnFace,
        isFaceSwapping,
        onChangeFace,
        productImageUrls,
        onAddProductImage,
        onDeleteProductImage,
        modelFiles,
        onModelFilesUpdate,
        onToggleHeroSectionVisibility,
        onToggleStudioWornCloseupVisibility,
        onToggleFinalConceptShotVisibility,
        productEnhancementPreset,
        onApplyProductEnhancementPreset,
        isBatchEnhancing,
        filterPreset,
        onSetFilterPreset,
        onAddCollageBlock,
    } = props;
    
    const [heroTextContent, setHeroTextContent] = useState<HeroTextContent>(data.heroTextContent);
    const [facePreviews, setFacePreviews] = useState<string[]>([]);
    const [modelFilePreviews, setModelFilePreviews] = useState<string[]>([]);

    useEffect(() => {
        setHeroTextContent(data.heroTextContent);
    }, [data.heroTextContent]);
    
    useEffect(() => {
        const urls = newFaceFiles.map(file => URL.createObjectURL(file));
        setFacePreviews(urls);
        return () => {
            urls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [newFaceFiles]);

    useEffect(() => {
        const urls = modelFiles.map(file => URL.createObjectURL(file));
        setModelFilePreviews(urls);
        return () => {
            urls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [modelFiles]);

    const handleHeroTextChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setHeroTextContent(prev => ({ ...prev, [name]: value as any }));
    };
    
    const handleHeroColorUpdate = (key: keyof HeroTextColors, color: string) => {
        onHeroTextColorsUpdate({ ...heroTextColors, [key]: color });
    };

    const handleFontSizeUpdate = (key: keyof FontSizes, delta: number) => {
        const newFontSizes = { ...propFontSizes };
        const currentSize = parseInt(newFontSizes[key], 10) || 0;
        const newSize = Math.max(8, currentSize + delta);
        newFontSizes[key] = String(newSize);
        onFontSizesUpdate(newFontSizes);
    };
    
    const handleFontStyleUpdate = (key: keyof FontStyles, fontValue: string) => {
        onFontStylesUpdate({ ...propFontStyles, [key]: fontValue });
    };

    const handleEyedropper = async (key: keyof HeroTextColors) => {
        if (!('EyeDropper' in window)) {
            alert('사용하시는 브라우저는 스포이트 기능을 지원하지 않습니다.');
            return;
        }
        try {
            // @ts-ignore
            const eyeDropper = new window.EyeDropper();
            const result = await eyeDropper.open();
            onHeroTextColorsUpdate({ ...heroTextColors, [key]: result.sRGBHex });
        } catch (e) {
            console.log('EyeDropper was cancelled by the user.');
        }
    };

    useEffect(() => {
        const handler = setTimeout(() => onHeroTextContentUpdate(heroTextContent), 500);
        return () => clearTimeout(handler);
    }, [heroTextContent, onHeroTextContentUpdate]);
    
    const handleFaceFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            const combined = [...newFaceFiles, ...files].slice(0, 10);
            onNewFaceFilesChange(combined);
        }
        e.target.value = ''; // Allow re-uploading
    };
    
    const handleProductFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            onAddProductImage(files);
        }
        e.target.value = ''; // Allow re-uploading
    };

    const handleModelFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            onModelFilesUpdate([...modelFiles, ...files]);
        }
        e.target.value = '';
    };

    const handleRemoveFaceFile = (index: number) => {
        onNewFaceFilesChange(newFaceFiles.filter((_, i) => i !== index));
    };

    const handleRemoveModelFile = (index: number) => {
        onModelFilesUpdate(modelFiles.filter((_, i) => i !== index));
    };

    const FontSizeControl = ({ value, onUpdate }: { value: string, onUpdate: (delta: number) => void }) => (
      <div className="flex items-center gap-1">
          <button onClick={() => onUpdate(-1)} className="p-1.5 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"><MinusIcon className="w-4 h-4" /></button>
          <span className="w-10 text-center font-medium text-gray-700 tabular-nums text-sm">{value}px</span>
          <button onClick={() => onUpdate(1)} className="p-1.5 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"><PlusIcon className="w-4 h-4" /></button>
      </div>
    );

    const FontButtonSelector = ({ value, options, onUpdate }: { value: string; options: { name: string; value: string }[]; onUpdate: (font: string) => void; }) => (
      <div className="flex items-center gap-1">
          {options.map(font => (
              <button
                  key={font.name}
                  onClick={() => onUpdate(font.value)}
                  className={`w-7 h-7 flex items-center justify-center text-sm font-bold rounded-md border transition-colors ${
                      value === font.value
                          ? 'bg-gray-800 text-white border-gray-800'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                  }`}
                  style={{ fontFamily: font.value }}
                  title={font.value.split(',')[0].replace(/'/g, '')}
              >
                  {font.name}
              </button>
          ))}
      </div>
    );
    
    const ColorControl = ({ value, onUpdate, onEyedrop }: { value: string, onUpdate: (color: string) => void, onEyedrop: () => void }) => (
        <div className="flex items-center gap-2">
            <div className="relative">
                <input 
                    type="color" 
                    value={value} 
                    onChange={(e) => onUpdate(e.target.value)} 
                    className="p-1 h-8 w-10 block bg-white border border-gray-300 rounded-md cursor-pointer" 
                />
            </div>
            <button onClick={onEyedrop} className="p-1.5 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors">
                <PipetteIcon className="w-4 h-4 text-gray-600" />
            </button>
        </div>
    );

    const totalImages = data.imageUrls.modelShots.length;
    const isMaxImages = totalImages >= 9;
    const isAnyLoading = isRegenerating || isAddingModelImage || isAddingCloseupImage || isFaceSwapping || isFaceLearning || isBatchEnhancing;

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 h-full overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">콘텐츠 수정</h2>
            
            <div className="space-y-8">
                
                 {/* Hero Text Content */}
                <section>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">히어로 이미지 문구</h3>
                    <div className="space-y-4 pt-2">
                        {HERO_FIELD_CONFIG.map(({ key, label, multiline }) => {
                            const fontSizeKey = FONT_SIZE_MAP[key];
                            const isBrand = key === 'brandName';
                            const fontGroup = isBrand ? FONT_GROUPS.heroBrand : FONT_GROUPS.heroMain;
                            const fontStyleKey = isBrand ? 'heroBrand' : 'heroMain';

                            return (
                                <div key={key}>
                                    <div className="flex items-center justify-between mb-2">
                                        <label htmlFor={key} className="block text-sm font-medium text-gray-600">{label}</label>
                                        <div className="flex items-center gap-2">
                                            <FontButtonSelector value={propFontStyles[fontStyleKey]} options={fontGroup} onUpdate={(font) => handleFontStyleUpdate(fontStyleKey, font)} />
                                            <ColorControl 
                                                value={heroTextColors[key]} 
                                                onUpdate={(color) => handleHeroColorUpdate(key, color)} 
                                                onEyedrop={() => handleEyedropper(key)}
                                            />
                                            <FontSizeControl 
                                                value={propFontSizes[fontSizeKey]} 
                                                onUpdate={(delta) => handleFontSizeUpdate(fontSizeKey, delta)} 
                                            />
                                        </div>
                                    </div>
                                    {multiline ? (
                                        <textarea 
                                            id={key} 
                                            name={key} 
                                            value={heroTextContent[key]} 
                                            onChange={handleHeroTextChange} 
                                            rows={5}
                                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent transition bg-white" 
                                        />
                                    ) : (
                                        <input 
                                            type="text" 
                                            id={key} 
                                            name={key} 
                                            value={heroTextContent[key]} 
                                            onChange={handleHeroTextChange} 
                                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-transparent transition bg-white" 
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Product Image Management */}
                <section>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">제품 이미지 관리</h3>
                    <div className="space-y-4 pt-2">
                        <p className="text-sm text-gray-500">
                            상세페이지에 표시될 제품 이미지를 관리합니다. (최소 1장)
                        </p>
                        <div className="grid grid-cols-5 gap-2">
                            {productImageUrls.map((url, index) => (
                                <div key={index} className="relative group aspect-square">
                                    <img src={url} alt={`Product image ${index + 1}`} className="w-full h-full object-cover rounded-md border" />
                                    {productImageUrls.length > 1 && (
                                        <button onClick={() => onDeleteProductImage(index)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <label className="flex flex-col items-center justify-center w-full aspect-square border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                                <UploadCloudIcon className="w-6 h-6 text-gray-400" />
                                <input type="file" multiple className="hidden" accept="image/*" onChange={handleProductFilesSelect} />
                            </label>
                        </div>
                    </div>
                </section>
                
                {/* Product Enhancement */}
                <section>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">제품 이미지 보정</h3>
                    <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
                        {ENHANCEMENT_PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => onApplyProductEnhancementPreset(preset.id)}
                                disabled={isBatchEnhancing}
                                className={`px-3 py-1.5 text-sm font-bold rounded-full transition-all duration-200 outline-none focus:outline-none disabled:opacity-50 disabled:cursor-wait ${
                                    productEnhancementPreset === preset.id
                                        ? 'bg-gray-800 text-white shadow-md'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                {preset.name}
                            </button>
                        ))}
                    </div>
                </section>
                
                {/* Model Image Filter */}
                <section>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">모델 이미지 필터</h3>
                     <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
                        {FILTER_BAR_PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => onSetFilterPreset(preset.id)}
                                className={`px-3 py-1.5 text-sm font-bold rounded-full transition-all duration-200 outline-none focus:outline-none ${
                                    filterPreset === preset.id
                                        ? 'bg-gray-800 text-white shadow-md'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                {preset.name}
                            </button>
                        ))}
                    </div>
                </section>

                {generationMode === 'frame' && (
                    <section>
                        <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">모델 레퍼런스 이미지</h3>
                        <div className="space-y-4 pt-2">
                            <p className="text-sm text-gray-500">
                                모델 컷 생성을 위해 AI가 참고할 원본 모델 이미지를 업로드하세요. (얼굴, 전신 샷 등)
                            </p>
                            <div className="grid grid-cols-5 gap-2">
                                {modelFilePreviews.map((preview, index) => (
                                    <div key={index} className="relative group aspect-square">
                                        <img src={preview} alt={`Model preview ${index + 1}`} className="w-full h-full object-cover rounded-md border" />
                                        <button onClick={() => handleRemoveModelFile(index)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <XIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                <label className="flex flex-col items-center justify-center w-full aspect-square border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                                    <UploadCloudIcon className="w-6 h-6 text-gray-400" />
                                    <input type="file" multiple className="hidden" accept="image/*" onChange={handleModelFilesSelect} />
                                </label>
                            </div>
                        </div>
                    </section>
                )}
                
                 {/* Model Regeneration */}
                <section>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">모델 이미지 관리</h3>
                    <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                           <button onClick={onAddModelImage} disabled={isAnyLoading} className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200 ease-in-out hover:bg-gray-100 active:scale-95 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
                                {isAddingModelImage ? (
                                    <><Spinner /><span className="ml-2">추가 중...</span></>
                                ) : (
                                    <><PlusIcon className="w-4 h-4 mr-2" />
                                    {generationMode === 'original' ? '자세 변경 추가' : '모델 컷 추가'}
                                    </>
                                )}
                            </button>
                        </div>

                        <hr className="my-2"/>

                        <div className="space-y-2">
                             <button onClick={onAddCloseupImage} disabled={isAnyLoading} className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200 ease-in-out hover:bg-gray-100 active:scale-95 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
                                {isAddingCloseupImage ? (
                                    <><Spinner /><span className="ml-2">추가 중...</span></>
                                ) : (
                                    <><PlusIcon className="w-4 h-4 mr-2" />
                                     {generationMode === 'original' ? '자세 변경 추가' : '클로즈업 컷 추가'}
                                    </>
                                )}
                            </button>
                        </div>
                        
                        {isMaxImages && <p className="text-xs text-center text-gray-500 pt-2">모델 이미지는 최대 9개까지 추가할 수 있습니다.</p>}
                        
                        <hr className="my-4" />

                        <div className="space-y-4">
                            <h4 className="text-md font-semibold text-gray-600">모델 다시 만들기 (의상 지정)</h4>
                            <div className="grid grid-cols-2 gap-3">
                               <ImageUploader label="상의" preview={topPreview} onFileChange={onTopFileChange} />
                               <ImageUploader label="하의" preview={pantsPreview} onFileChange={onPantsFileChange} />
                            </div>
                        </div>

                        <button onClick={onRegenerate} disabled={isAnyLoading} className="w-full flex items-center justify-center bg-gray-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200 ease-in-out hover:bg-gray-800 active:scale-95 text-sm disabled:opacity-60 disabled:cursor-wait">
                            {isRegenerating ? (
                                <><Spinner /><span className="ml-2">생성 중...</span></>
                            ) : (
                                <><RefreshCwIcon className="w-4 h-4 mr-2" />모델 다시 만들기</>
                            )}
                        </button>
                    </div>
                </section>
                
                 {/* Collage Block Addition */}
                <section>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">콜라주 블록 추가</h3>
                    <div className="space-y-4 pt-2">
                        <div>
                            <h4 className="text-md font-medium text-gray-600 mb-2">모델 컷 섹션</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => onAddCollageBlock('2x1', 'model')} disabled={isAnyLoading} className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors hover:bg-gray-100 text-sm disabled:opacity-60">
                                    + 2x1 그리드
                                </button>
                                <button onClick={() => onAddCollageBlock('2x2', 'model')} disabled={isAnyLoading} className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors hover:bg-gray-100 text-sm disabled:opacity-60">
                                    + 2x2 그리드
                                </button>
                            </div>
                        </div>
                         <div>
                            <h4 className="text-md font-medium text-gray-600 mb-2">클로즈업 컷 섹션</h4>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => onAddCollageBlock('2x1', 'closeup')} disabled={isAnyLoading} className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors hover:bg-gray-100 text-sm disabled:opacity-60">
                                    + 2x1 그리드
                                </button>
                                <button onClick={() => onAddCollageBlock('2x2', 'closeup')} disabled={isAnyLoading} className="w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors hover:bg-gray-100 text-sm disabled:opacity-60">
                                    + 2x2 그리드
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
                
                 {/* Layout Management */}
                <section>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">레이아웃 관리</h3>
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between p-2 rounded-md bg-gray-50">
                            <span className="text-sm font-medium text-gray-700">히어로 이미지 섹션</span>
                            <button
                                onClick={onToggleHeroSectionVisibility}
                                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 ${
                                    data.isHeroSectionVisible ?? true ? 'bg-gray-800' : 'bg-gray-300'
                                }`}
                            >
                                <span
                                    className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                                        data.isHeroSectionVisible ?? true ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-md bg-gray-50">
                            <span className="text-sm font-medium text-gray-700">스튜디오 클로즈업 섹션</span>
                            <button
                                onClick={onToggleStudioWornCloseupVisibility}
                                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 ${
                                    data.isStudioWornCloseupVisible ?? true ? 'bg-gray-800' : 'bg-gray-300'
                                }`}
                            >
                                <span
                                    className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                                        data.isStudioWornCloseupVisible ?? true ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-md bg-gray-50">
                            <span className="text-sm font-medium text-gray-700">마지막 컨셉샷</span>
                            <button
                                onClick={onToggleFinalConceptShotVisibility}
                                className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 ${
                                    data.isFinalConceptShotVisible ?? true ? 'bg-gray-800' : 'bg-gray-300'
                                }`}
                            >
                                <span
                                    className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                                        data.isFinalConceptShotVisible ?? true ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                    </div>
                </section>


                 {/* Face Swapping */}
                <section>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">모델 얼굴 변경</h3>
                    <div className="space-y-4 pt-2">
                        <p className="text-sm text-gray-500">
                            새로운 모델의 얼굴과 헤어스타일 이미지를 업로드하세요. (최대 10장)
                            AI가 얼굴과 머리카락을 학습하여 모델 컷에만 자연스럽게 적용합니다. 다양한 각도의 선명한 사진을 사용하세요.
                        </p>
                        <div className="grid grid-cols-5 gap-2">
                            {facePreviews.map((preview, index) => (
                                <div key={index} className="relative group aspect-square">
                                    <img src={preview} alt={`Face preview ${index + 1}`} className="w-full h-full object-cover rounded-md border" />
                                    <button onClick={() => handleRemoveFaceFile(index)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <XIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {newFaceFiles.length < 10 && (
                                <label className="flex flex-col items-center justify-center w-full aspect-square border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                                    <UploadCloudIcon className="w-6 h-6 text-gray-400" />
                                    <input type="file" multiple className="hidden" accept="image/*" onChange={handleFaceFilesSelect} />
                                </label>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={onLearnFace} 
                                disabled={newFaceFiles.length === 0 || isFaceLearned || isAnyLoading}
                                className={`w-full flex items-center justify-center font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm disabled:cursor-not-allowed ${
                                    isFaceLearned 
                                    ? 'bg-green-600 text-white' 
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-60'
                                }`}
                            >
                                {isFaceLearning ? (
                                    <><Spinner /><span className="ml-2">학습 중...</span></>
                                ) : isFaceLearned ? (
                                    '✔ 학습 완료'
                                ) : (
                                    <><BrainCircuitIcon className="w-4 h-4 mr-2" />얼굴 학습하기</>
                                )}
                            </button>
                            <button 
                                onClick={onChangeFace} 
                                disabled={!isFaceLearned || isAnyLoading}
                                className="w-full flex items-center justify-center bg-gray-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors hover:bg-gray-800 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isFaceSwapping ? (
                                     <><Spinner /><span className="ml-2">변경 중...</span></>
                                ) : (
                                     <><SparklesIcon className="w-4 h-4 mr-2" />모든 모델 컷 얼굴 변경</>
                                )}
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AdjustmentPanel;