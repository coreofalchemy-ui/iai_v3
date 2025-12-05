
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { synthesizeCampaignImage, refineImage, generatePoseVariation } from './services/geminiService';
import { getFriendlyErrorMessage } from './lib/utils';
import Spinner from './components/Spinner';
import StartScreen from './components/StartScreen';
import { UploadCloudIcon, Trash2Icon, ShirtIcon, XIcon, PlusIcon, DownloadIcon, SparklesIcon, ZoomInIcon, Wand2Icon, CameraIcon, CheckSquareIcon, FileDownIcon, StarIcon, UserIcon, CheckCircleIcon, ArrowRightIcon, ChevronRightIcon } from './components/icons';

type GeneratedModel = {
    id: string;
    url: string;
    type: 'campaign' | 'detail' | 'pose-variation';
    originalFileIndex: number; // To track which base model file was used
    seed: number; // For deterministic regeneration (Hard Lock)
};

const POSE_PRESETS = [
    { id: 'runway', label: '런웨이 워킹 (Runway)', prompt: 'Model walking confidently on a fashion runway, full body shot, dynamic movement.' },
    { id: 'sitting', label: '다리 꼬고 앉기 (Sitting)', prompt: 'Model sitting on a chair with legs crossed, elegant pose, looking at camera.' },
    { id: 'leaning', label: '벽에 기대기 (Leaning)', prompt: 'Model leaning casually against a wall, relaxed yet stylish posture.' },
    { id: 'low_angle', label: '로우 앵글 (Low Angle)', prompt: 'Low angle shot looking up at the model, empowering and tall stance.' },
    { id: 'back_view', label: '뒤돌아보기 (Looking Back)', prompt: 'Model standing with back to camera, looking back over shoulder, highlighting shoes.' },
    { id: 'front', label: '정면 클로즈업 (Front Full)', prompt: 'Straight on front view, symmetrical standing pose, arms at sides.' },
    { id: 'kneeling', label: '한쪽 무릎 꿇기 (Kneeling)', prompt: 'Model kneeling on one knee, fashion editorial style pose.' },
    { id: 'dynamic', label: '역동적인 점프 (Dynamic)', prompt: 'Model mid-air or in a dynamic motion pose, hair moving, energetic.' },
    { id: 'pockets', label: '주머니 손 (Hands in Pockets)', prompt: 'Model standing coolly with hands in pockets, casual chic vibe.' },
    { id: 'stroll', label: '자연스러운 걷기 (Stroll)', prompt: 'Model walking naturally on a street, candid style paparazzi shot.' },
];

const GARMENT_COLORS = [
    { id: 'white', label: 'White', hex: '#FFFFFF', class: 'bg-white border-gray-300' },
    { id: 'melange', label: 'Grey', hex: '#9CA3AF', class: 'bg-gray-400 border-transparent' },
    { id: 'charcoal', label: 'Charcoal', hex: '#374151', class: 'bg-gray-700 border-transparent' },
    { id: 'black', label: 'Black', hex: '#000000', class: 'bg-black border-gray-700' },
    { id: 'navy', label: 'Navy', hex: '#172554', class: 'bg-blue-950 border-transparent' },
    { id: 'deep_blue', label: 'Deep Blue', hex: '#1E40AF', class: 'bg-blue-800 border-transparent' },
    { id: 'beige', label: 'Beige', hex: '#D2B48C', class: 'bg-[#D2B48C] border-transparent' },
    { id: 'khaki', label: 'Khaki', hex: '#57534E', class: 'bg-stone-600 border-transparent' },
];

const App: React.FC = () => {
    const [hasApiKey, setHasApiKey] = useState(false);
    const [isStarted, setIsStarted] = useState(false);
    
    // Inputs
    const [shoeFiles, setShoeFiles] = useState<File[]>([]);
    const [shoeImageUrls, setShoeImageUrls] = useState<string[]>([]);
    const [faceFile, setFaceFile] = useState<File | null>(null);
    const [faceImageUrl, setFaceImageUrl] = useState<string | null>(null);
    const [baseModelFiles, setBaseModelFiles] = useState<File[]>([]);
    const [baseModelImageUrls, setBaseModelImageUrls] = useState<string[]>([]);
    const [isStudioMode, setIsStudioMode] = useState(false);
    
    // Top & Bottom Inputs
    const [topFiles, setTopFiles] = useState<File[]>([]);
    const [topImageUrls, setTopImageUrls] = useState<string[]>([]);
    const [topColor, setTopColor] = useState<string | null>(null);

    const [bottomFiles, setBottomFiles] = useState<File[]>([]);
    const [bottomImageUrls, setBottomImageUrls] = useState<string[]>([]);
    const [bottomColor, setBottomColor] = useState<string | null>(null);

    // Socks Inputs
    const [socksColor, setSocksColor] = useState<string | null>(null);

    // Output & State
    const [generatedModels, setGeneratedModels] = useState<GeneratedModel[]>([]);
    const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
    const [viewingModel, setViewingModel] = useState<GeneratedModel | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRefining, setIsRefining] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Drag States
    const [isDraggingShoe, setIsDraggingShoe] = useState(false);
    const [isDraggingFace, setIsDraggingFace] = useState(false);
    const [isDraggingModel, setIsDraggingModel] = useState(false);
    const [isDraggingTop, setIsDraggingTop] = useState(false);
    const [isDraggingBottom, setIsDraggingBottom] = useState(false);

    const MAX_FILES = 10;

    useEffect(() => {
        const checkApiKey = async () => {
            if ((window as any).aistudio?.hasSelectedApiKey && await (window as any).aistudio.hasSelectedApiKey()) {
                setHasApiKey(true);
            }
        };
        checkApiKey();
    }, []);

    const handleConnectApiKey = async () => {
        try {
            if ((window as any).aistudio?.openSelectKey) {
                await (window as any).aistudio.openSelectKey();
                setHasApiKey(true);
            } else {
                setError("AI Studio API 초기화 실패.");
            }
        } catch (e: any) {
             if (e.message?.includes("Requested entity was not found")) {
                 setHasApiKey(false);
                 setError("API 키 연결 실패. 다시 시도해주세요.");
            }
        }
    };

    // Helper for file selection
    const handleFileSelect = (files: FileList | null, setFiles: React.Dispatch<React.SetStateAction<File[]>>, setUrls: React.Dispatch<React.SetStateAction<string[]>>) => {
        if (!files) return;
        const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (newFiles.length === 0) return;
        setFiles(prev => [...prev, ...newFiles].slice(0, MAX_FILES));
        newFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = () => setUrls(prev => [...prev, reader.result as string]);
            reader.readAsDataURL(file);
        });
    };

    const handleShoeSelect = (files: FileList | null) => handleFileSelect(files, setShoeFiles, setShoeImageUrls);
    const handleModelSelect = (files: FileList | null) => handleFileSelect(files, setBaseModelFiles, setBaseModelImageUrls);
    const handleTopSelect = (files: FileList | null) => handleFileSelect(files, setTopFiles, setTopImageUrls);
    const handleBottomSelect = (files: FileList | null) => handleFileSelect(files, setBottomFiles, setBottomImageUrls);

    const handleFaceSelect = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        if (!file.type.startsWith('image/')) return;
        setFaceFile(file);
        const reader = new FileReader();
        reader.onload = () => setFaceImageUrl(reader.result as string);
        reader.readAsDataURL(file);
    };

    const removeFile = (index: number, setFiles: React.Dispatch<React.SetStateAction<File[]>>, setUrls: React.Dispatch<React.SetStateAction<string[]>>) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
        setUrls(prev => prev.filter((_, i) => i !== index));
    };

    const removeShoe = (index: number) => removeFile(index, setShoeFiles, setShoeImageUrls);
    const removeModel = (index: number) => removeFile(index, setBaseModelFiles, setBaseModelImageUrls);
    const removeTop = (index: number) => removeFile(index, setTopFiles, setTopImageUrls);
    const removeBottom = (index: number) => removeFile(index, setBottomFiles, setBottomImageUrls);

    const handleDrag = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

    const handleGenerateCampaign = async () => {
        if (!hasApiKey) { handleConnectApiKey(); return; }
        if (isGenerating) return;
        
        // Remove check for shoeFiles to allow face swap only
        if (!faceFile || baseModelFiles.length === 0) {
            setError("필수 요소를 업로드해주세요: 얼굴, 모델 사진");
            return;
        }
        setIsGenerating(true);
        setError(null);
        setGeneratedModels([]);
        const total = baseModelFiles.length;
        setProgress({ current: 0, total });

        try {
            for (let i = 0; i < baseModelFiles.length; i++) {
                setLoadingMessage(`${i + 1}/${total} Face ID 구조 동기화 중...`);
                setProgress({ current: i + 1, total });
                const targetShot = baseModelFiles[i];
                // Generate a random seed for this new generation
                const seed = Math.floor(Math.random() * 1000000); 

                const newUrl = await synthesizeCampaignImage(
                    targetShot, 
                    faceFile, 
                    shoeFiles,
                    topFiles,
                    bottomFiles,
                    topColor,
                    bottomColor,
                    socksColor,
                    isStudioMode,
                    seed
                );
                setGeneratedModels(prev => [...prev, { 
                    id: `campaign-${Date.now()}-${i}`, 
                    url: newUrl, 
                    type: 'campaign',
                    originalFileIndex: i,
                    seed: seed
                }]);
            }
            setLoadingMessage("최종 렌더링 완료...");
        } catch (err) {
            setError(getFriendlyErrorMessage(err, '캠페인 생성 실패'));
            if ((err as any)?.message?.includes("API key")) {
                setHasApiKey(false);
            }
        } finally {
            setIsGenerating(false);
            setLoadingMessage('');
            setProgress({ current: 0, total: 0 });
        }
    };

    const handleModifySelected = async () => {
        if (!hasApiKey) { handleConnectApiKey(); return; }
        if (isGenerating || selectedImageIds.length === 0) return;
        
        // Face file is required for modification
        if (!faceFile) {
            setError("얼굴 이미지가 선택되지 않았습니다.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        const selectedModels = generatedModels.filter(m => selectedImageIds.includes(m.id));
        const total = selectedModels.length;
        setProgress({ current: 0, total });

        try {
            let processedCount = 0;
            for (const model of selectedModels) {
                 if (model.originalFileIndex === undefined || !baseModelFiles[model.originalFileIndex]) {
                     continue; // Skip if original file is missing
                 }
                 processedCount++;
                 setLoadingMessage(`${processedCount}/${total} 텍스처 및 조명 재조정 중...`);
                 setProgress({ current: processedCount, total });

                 const targetShot = baseModelFiles[model.originalFileIndex];
                 
                 // Reuse the existing seed to "Hard Lock" the generation
                 const newUrl = await synthesizeCampaignImage(
                    targetShot,
                    faceFile, 
                    shoeFiles,
                    topFiles,
                    bottomFiles,
                    topColor,
                    bottomColor,
                    socksColor,
                    isStudioMode,
                    model.seed 
                 );

                 setGeneratedModels(prev => prev.map(m => 
                     m.id === model.id ? { ...m, url: newUrl } : m
                 ));
            }
        } catch (err) {
            setError(getFriendlyErrorMessage(err, '수정 실패'));
             if ((err as any)?.message?.includes("API key")) {
                setHasApiKey(false);
            }
        } finally {
            setIsGenerating(false);
            setLoadingMessage('');
            setProgress({ current: 0, total: 0 });
            setSelectedImageIds([]); // Clear selection after modify
        }
    };

    const handleRefine = async () => {
        if (isRefining || selectedImageIds.length === 0) {
             if (selectedImageIds.length === 0) setError("보정할 이미지를 선택해주세요.");
             return;
        }
        setIsRefining(true);
        setError(null);
        setLoadingMessage("초고해상도 텍스처 보정 중...");
        try {
            const selectedModels = generatedModels.filter(m => selectedImageIds.includes(m.id));
            for (const model of selectedModels) {
                 const refinedUrl = await refineImage(shoeFiles, model.url);
                 setGeneratedModels(prev => prev.map(m => m.id === model.id ? { ...m, url: refinedUrl } : m));
            }
        } catch (err) {
            setError(getFriendlyErrorMessage(err, '보정 실패'));
        } finally {
            setIsRefining(false);
            setLoadingMessage('');
        }
    };

    const handlePoseVariation = async (pose: { id: string, label: string, prompt: string }) => {
        if (!viewingModel || !faceFile) return;
        setIsGenerating(true);
        setLoadingMessage(`'${pose.label}' 포즈 생성 및 의상 시뮬레이션 중...`);
        try {
            const newUrl = await generatePoseVariation(
                viewingModel.url, 
                faceFile, 
                shoeFiles, 
                topFiles, 
                bottomFiles, 
                pose.prompt,
                topColor,
                bottomColor,
                socksColor,
                isStudioMode,
                viewingModel.seed // Use seed for pose variation consistency too
            );
            const newModel: GeneratedModel = { 
                id: `pose-${pose.id}-${Date.now()}`, 
                url: newUrl, 
                type: 'pose-variation',
                originalFileIndex: viewingModel.originalFileIndex,
                seed: viewingModel.seed
            };
            setGeneratedModels(prev => [newModel, ...prev]);
            setViewingModel(newModel);
        } catch (err) {
             setError(getFriendlyErrorMessage(err, '자세 변경 실패'));
        } finally {
            setIsGenerating(false);
            setLoadingMessage('');
        }
    };

    const downloadImage = (url: string, filename: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadSelected = () => {
        generatedModels.filter(m => selectedImageIds.includes(m.id)).forEach((model, i) => {
            setTimeout(() => downloadImage(model.url, `campaign-shot-${i}.png`), i * 200);
        });
    };

    const toggleSelection = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedImageIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const openModal = (model: GeneratedModel) => setViewingModel(model);
    const closeModal = () => setViewingModel(null);

    const isLoading = isGenerating || isRefining;
    // Allow generation without shoes
    const canGenerate = faceFile !== null && baseModelFiles.length > 0 && !isLoading;

    const renderFileSection = (
        title: string,
        subtitle: string,
        files: File[],
        urls: string[],
        isDragging: boolean,
        setIsDragging: (v: boolean) => void,
        handleSelect: (files: FileList | null) => void,
        remove: (index: number) => void,
        Icon: React.ElementType,
        isFace = false,
        colorConfig?: { selected: string | null; onSelect: (color: string) => void; label: string }
    ) => (
        <section>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    {title}
                    {files.length > 0 && <CheckCircleIcon className="w-4 h-4 text-emerald-500" />}
                </h2>
                {!isFace && <span className="text-xs text-gray-500 font-medium">최대 10장</span>}
            </div>
            <div 
                className={`border border-dashed rounded-lg p-5 transition-all duration-300 ${isDragging ? 'border-indigo-500 bg-white/5' : 'border-white/10 bg-[#18181B] hover:border-white/20'}`}
                onDragEnter={() => setIsDragging(true)}
                onDragLeave={() => setIsDragging(false)}
                onDragOver={handleDrag}
                onDrop={(e) => { handleDrag(e); setIsDragging(false); handleSelect(e.dataTransfer.files); }}
            >
                {urls.length > 0 ? (
                    isFace ? (
                        <div className="relative aspect-[3/4] rounded bg-black overflow-hidden group border border-white/5 mx-auto max-w-[180px]">
                            <img src={urls[0]} className="w-full h-full object-cover opacity-90" />
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50" />
                            <div className="absolute bottom-2 left-2 text-xs text-white font-medium">Face ID Locked</div>
                            <button onClick={() => { setFaceFile(null); setFaceImageUrl(null); }} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all"><XIcon className="w-4 h-4"/></button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3">
                            {urls.map((url, i) => (
                                <div key={i} className="relative aspect-square rounded bg-black overflow-hidden group border border-white/5">
                                    <img src={url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                    <button onClick={() => remove(i)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all"><XIcon className="w-3 h-3"/></button>
                                </div>
                            ))}
                            <label className="flex items-center justify-center aspect-square bg-white/5 rounded border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                                <PlusIcon className="w-5 h-5 text-gray-500" />
                                <input type="file" multiple className="hidden" onChange={(e) => handleSelect(e.target.files)} accept="image/*" />
                            </label>
                        </div>
                    )
                ) : (
                    <label className={`flex flex-col items-center justify-center ${isFace ? 'h-48' : 'h-36'} cursor-pointer group`}>
                        <Icon className="w-8 h-8 mb-3 text-gray-600 group-hover:text-indigo-400 transition-colors" />
                        <span className="text-sm font-medium text-center text-gray-500 group-hover:text-gray-300" dangerouslySetInnerHTML={{ __html: subtitle }} />
                        <input type="file" multiple={!isFace} className="hidden" onChange={(e) => handleSelect(e.target.files)} accept="image/*" />
                    </label>
                )}
            </div>
            {colorConfig && (
                <div className="mt-4">
                    <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">{colorConfig.label}</p>
                    <div className="grid grid-cols-4 gap-2">
                        {GARMENT_COLORS.map((color) => {
                             const isSelected = colorConfig.selected === color.label;
                             return (
                                <button
                                    key={color.id}
                                    onClick={() => colorConfig.onSelect(colorConfig.selected === color.label ? '' : color.label)}
                                    className={`h-9 rounded flex items-center justify-center border transition-all relative overflow-hidden group
                                        ${isSelected ? 'border-white ring-1 ring-white/50' : 'border-white/5 hover:border-white/30'}
                                    `}
                                    title={color.label}
                                >
                                    <div className={`absolute inset-0 ${color.class} opacity-80 group-hover:opacity-100 transition-opacity`} />
                                    {isSelected && <CheckCircleIcon className="w-4 h-4 text-white relative z-10 drop-shadow-md" />}
                                    <span className={`text-[10px] font-bold relative z-10 uppercase tracking-tighter ${['white', 'beige', 'melange'].includes(color.id) ? 'text-black' : 'text-white'}`}>
                                        {isSelected ? '' : color.label}
                                    </span>
                                </button>
                             );
                        })}
                    </div>
                </div>
            )}
        </section>
    );

    if (!isStarted) {
        return (
            <StartScreen 
                onStart={() => setIsStarted(true)} 
                hasApiKey={hasApiKey} 
                onConnectApiKey={handleConnectApiKey} 
            />
        );
    }

    return (
        <div className="flex h-screen w-full bg-[#F4F4F5] overflow-hidden font-sans text-gray-900 selection:bg-indigo-500 selection:text-white">
            <aside className="w-[400px] bg-[#0F0F10] text-gray-300 flex flex-col shrink-0 z-30 shadow-2xl relative">
                <div className="px-8 py-8 border-b border-white/5 bg-[#0F0F10]">
                    <div className="flex items-center gap-3 text-white mb-1">
                        <CameraIcon className="w-6 h-6" />
                        <h1 className="text-2xl font-bold tracking-tight">AI 패션 스튜디오</h1>
                    </div>
                    <p className="text-xs text-gray-500 tracking-wider uppercase pl-9 font-medium">Gemini 3.0 Pro VFX Engine</p>
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-10 custom-scrollbar-dark">
                    {renderFileSection("01. 신발 제품 (Shoes) [선택]", "이미지 드래그 또는<br/>클릭하여 업로드 (선택)", shoeFiles, shoeImageUrls, isDraggingShoe, setIsDraggingShoe, handleShoeSelect, removeShoe, UploadCloudIcon)}
                    
                    {renderFileSection("02. 모델 얼굴 (Face ID)", "고해상도 얼굴 사진<br/>(정면 사진 권장)", faceFile ? [faceFile] : [], faceImageUrl ? [faceImageUrl] : [], isDraggingFace, setIsDraggingFace, handleFaceSelect, () => {}, UserIcon, true)}
                    
                    {renderFileSection("03. 패션 모델 (Fashion Models)", "모델 전신 사진<br/>(이 모델의 의상과 포즈를 베이스로 사용)", baseModelFiles, baseModelImageUrls, isDraggingModel, setIsDraggingModel, handleModelSelect, removeModel, ShirtIcon)}

                    {/* Studio Mode Toggle */}
                    <div className="bg-[#18181B] rounded-lg border border-white/10 p-4">
                         <label className="flex items-start gap-4 cursor-pointer group w-full">
                            <div className={`mt-1 w-6 h-6 border-2 rounded flex items-center justify-center transition-all flex-shrink-0 ${isStudioMode ? 'bg-indigo-600 border-indigo-600' : 'border-gray-500 bg-transparent'}`}>
                                {isStudioMode && <CheckSquareIcon className="w-4 h-4 text-white" />}
                            </div>
                            <input 
                                type="checkbox" 
                                className="hidden" 
                                checked={isStudioMode} 
                                onChange={(e) => setIsStudioMode(e.target.checked)} 
                            />
                            <div className="flex flex-col">
                                <span className={`text-base font-bold transition-colors mb-1 ${isStudioMode ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                                    콘크리트 스튜디오 모드
                                </span>
                                <span className="text-xs text-gray-500 font-medium leading-relaxed group-hover:text-gray-400">
                                    빈티지한 회색 콘크리트 배경과 은은한 조명으로 실제 촬영 현장처럼 변경합니다.
                                </span>
                            </div>
                        </label>
                    </div>

                    {renderFileSection(
                        "04. 상의 (Tops) [선택]", 
                        "상의 제품 이미지<br/>(선택 사항)", 
                        topFiles, 
                        topImageUrls, 
                        isDraggingTop, 
                        setIsDraggingTop, 
                        handleTopSelect, 
                        removeTop, 
                        ShirtIcon,
                        false,
                        { selected: topColor, onSelect: setTopColor, label: '상의 색상' }
                    )}

                    {renderFileSection(
                        "05. 하의 (Bottoms) [선택]", 
                        "하의 제품 이미지<br/>(선택 사항)", 
                        bottomFiles, 
                        bottomImageUrls, 
                        isDraggingBottom, 
                        setIsDraggingBottom, 
                        handleBottomSelect, 
                        removeBottom, 
                        CheckSquareIcon,
                        false,
                        { selected: bottomColor, onSelect: setBottomColor, label: '하의 색상' }
                    )}

                    {/* Socks Color Section */}
                     <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                06. 양말 (Socks) [선택]
                                {socksColor && <CheckCircleIcon className="w-4 h-4 text-emerald-500" />}
                            </h2>
                        </div>
                        <div className="bg-[#18181B] border border-white/10 rounded-lg p-5">
                            <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">양말 색상 변경</p>
                            <div className="grid grid-cols-4 gap-2">
                                {GARMENT_COLORS.map((color) => {
                                     const isSelected = socksColor === color.label;
                                     return (
                                        <button
                                            key={color.id}
                                            onClick={() => setSocksColor(isSelected ? null : color.label)}
                                            className={`h-9 rounded flex items-center justify-center border transition-all relative overflow-hidden group
                                                ${isSelected ? 'border-white ring-1 ring-white/50' : 'border-white/5 hover:border-white/30'}
                                            `}
                                            title={color.label}
                                        >
                                            <div className={`absolute inset-0 ${color.class} opacity-80 group-hover:opacity-100 transition-opacity`} />
                                            {isSelected && <CheckCircleIcon className="w-4 h-4 text-white relative z-10 drop-shadow-md" />}
                                            <span className={`text-[10px] font-bold relative z-10 uppercase tracking-tighter ${['white', 'beige', 'melange'].includes(color.id) ? 'text-black' : 'text-white'}`}>
                                                {isSelected ? '' : color.label}
                                            </span>
                                        </button>
                                     );
                                })}
                            </div>
                        </div>
                    </section>
                </div>
                
                <div className="p-6 border-t border-white/5 bg-[#0F0F10]">
                    {!hasApiKey && (
                         <div className="mb-4 p-3 bg-indigo-900/20 border border-indigo-500/30 rounded text-xs font-bold text-indigo-300 flex items-center justify-between">
                            <span>API 키 연결 필요</span>
                            <button onClick={handleConnectApiKey} className="underline hover:text-white">연결하기</button>
                         </div>
                    )}
                    <button 
                        onClick={handleGenerateCampaign} 
                        disabled={!canGenerate && hasApiKey} 
                        className={`w-full py-5 rounded-lg text-lg font-bold transition-all shadow-xl flex items-center justify-center gap-3 relative overflow-hidden tracking-wide
                            ${canGenerate 
                                ? 'bg-white text-black hover:bg-gray-100' 
                                : 'bg-[#27272A] text-gray-500 cursor-not-allowed'}`}
                    >
                        {isGenerating ? (
                            <>
                                <Spinner />
                                <span className="text-sm font-bold uppercase">생성 중...</span>
                            </>
                        ) : (
                            <>
                                <SparklesIcon className={`w-6 h-6 ${canGenerate ? 'text-indigo-600' : 'text-gray-600'}`} />
                                <span>캠페인 생성 시작</span>
                            </>
                        )}
                    </button>
                    {!hasApiKey && (
                        <button onClick={handleConnectApiKey} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" aria-label="Connect API Key"></button>
                    )}
                </div>
            </aside>
            <main className="flex-1 relative flex flex-col h-full overflow-hidden">
                {/* Subtle top loading indicator */}
                <AnimatePresence>
                    {isLoading && (
                        <motion.div 
                            initial={{ scaleX: 0, opacity: 0 }} 
                            animate={{ scaleX: 1, opacity: 1 }} 
                            exit={{ scaleX: 1, opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 z-50 origin-left"
                        >
                            <motion.div 
                                className="absolute inset-0 bg-white/30"
                                initial={{ x: '-100%' }}
                                animate={{ x: '100%' }}
                                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <header className="absolute top-0 left-0 right-0 h-28 px-10 flex items-center justify-between z-20 bg-gradient-to-b from-[#F4F4F5] via-[#F4F4F5]/95 to-transparent pointer-events-none">
                    <div className="pointer-events-auto mt-6">
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">캠페인 결과물 (Campaign)</h2>
                            {isLoading && (
                                <span className="text-sm text-indigo-600 font-bold animate-pulse flex items-center gap-2">
                                    <Spinner />
                                    {loadingMessage}
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mt-2 font-medium">
                            {generatedModels.length} 장 생성됨
                        </p>
                    </div>
                    <div className="flex items-center gap-3 pointer-events-auto mt-6">
                        <AnimatePresence>
                            {selectedImageIds.length > 0 && (
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex items-center gap-2">
                                    <button onClick={handleModifySelected} disabled={isGenerating} className="px-6 py-3 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-700 transition-all text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                                        {isGenerating ? <Spinner /> : <Wand2Icon className="w-4 h-4" />}
                                        선택 항목 수정
                                    </button>
                                    <button onClick={handleRefine} disabled={isRefining} className="px-6 py-3 bg-white border border-gray-200 text-gray-900 rounded-lg shadow-sm hover:shadow-md hover:border-gray-300 transition-all text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                                        <StarIcon className="w-4 h-4 text-indigo-500" />
                                        필름 질감 보정
                                    </button>
                                    <button onClick={handleDownloadSelected} className="px-6 py-3 bg-black text-white rounded-lg shadow-lg hover:bg-gray-800 transition-all text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                                        <FileDownIcon className="w-4 h-4" />
                                        다운로드 ({selectedImageIds.length})
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </header>
                <AnimatePresence>
                    {error && (
                        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute top-32 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-8 py-4 rounded-lg shadow-2xl text-base font-bold flex items-center gap-3">
                            <XIcon className="w-5 h-5 cursor-pointer opacity-80 hover:opacity-100" onClick={() => setError(null)}/>
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>
                <div className="flex-1 overflow-y-auto pt-32 pb-12 px-10 custom-scrollbar">
                    {isLoading && generatedModels.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center">
                            <Spinner />
                            <p className="mt-8 text-2xl font-bold text-gray-800 animate-pulse tracking-tight">{loadingMessage}</p>
                            <p className="mt-3 text-sm text-gray-400 font-medium uppercase tracking-widest">Gemini 3.0 Pro Visual Synthesis</p>
                        </div>
                    ) : generatedModels.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                            {generatedModels.map((model) => {
                                const isSelected = selectedImageIds.includes(model.id);
                                return (
                                    <div key={model.id} className="group relative">
                                        <div 
                                            onClick={() => openModal(model)}
                                            className={`aspect-[3/4] bg-white rounded-xl overflow-hidden cursor-pointer shadow-sm transition-all duration-500 relative
                                                ${isSelected ? 'ring-4 ring-offset-4 ring-indigo-500 shadow-2xl' : 'hover:shadow-2xl hover:-translate-y-2'}`}
                                        >
                                            <img src={model.url} alt="Generated" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                 <span className="bg-white/95 backdrop-blur text-black text-xs px-3 py-1.5 rounded-md font-bold uppercase tracking-wider shadow-sm">
                                                     {model.type === 'pose-variation' ? '자세 변경' : '캠페인'}
                                                 </span>
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center justify-between px-2">
                                            <span className="text-xs text-gray-400 font-mono font-medium uppercase truncate w-24">ID: {model.id.split('-').pop()}</span>
                                            <button 
                                                onClick={(e) => toggleSelection(e, model.id)} 
                                                className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors
                                                    ${isSelected ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-200'}`}
                                            >
                                                {isSelected ? <CheckSquareIcon className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 border-2 border-current rounded-sm" />}
                                                {isSelected ? '선택됨' : '선택'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-50">
                            <div className="w-28 h-28 rounded-full bg-gray-200 flex items-center justify-center mb-8">
                                <SparklesIcon className="w-10 h-10 text-gray-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-3 tracking-tight">스튜디오가 준비되었습니다</h3>
                            <p className="text-base text-gray-500 max-w-sm text-center leading-relaxed font-medium">
                                좌측 사이드바에서 신발, 얼굴, 모델 사진을 업로드하여<br/>현대적인 VFX 패션 캠페인을 완성하세요.
                            </p>
                        </div>
                    )}
                </div>
            </main>
            <AnimatePresence>
                {viewingModel && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal}
                        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex"
                    >
                        <div className="flex-1 flex items-center justify-center p-12 relative">
                            <motion.img 
                                key={viewingModel.url}
                                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
                                src={viewingModel.url} alt="Detail View" onClick={(e) => e.stopPropagation()}
                                className="max-w-full max-h-full object-contain shadow-2xl bg-[#0a0a0a]" 
                            />
                            <button onClick={(e) => { e.stopPropagation(); closeModal(); }} className="absolute top-8 left-8 text-white/50 hover:text-white transition-colors">
                                <XIcon className="w-10 h-10" />
                            </button>
                        </div>
                        <motion.div 
                            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} onClick={(e) => e.stopPropagation()}
                            className="w-[360px] bg-[#121212] border-l border-white/10 flex flex-col overflow-hidden"
                        >
                            <div className="p-8 border-b border-white/10">
                                <h3 className="text-white font-bold text-2xl tracking-tight">자세 변경 (Pose)</h3>
                                <p className="text-gray-500 text-sm mt-2 font-medium">현재 모델과 얼굴/의상을 유지하며 자세만 변경합니다.</p>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar-dark">
                                <div className="space-y-3">
                                    {POSE_PRESETS.map((pose) => (
                                        <button
                                            key={pose.id}
                                            onClick={() => handlePoseVariation(pose)}
                                            disabled={isGenerating}
                                            className="w-full text-left p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/20 transition-all flex items-center justify-between group"
                                        >
                                            <div className="text-gray-200 text-sm font-bold">{pose.label}</div>
                                            <ChevronRightIcon className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="p-8 border-t border-white/10 space-y-4">
                                <button 
                                    onClick={() => downloadImage(viewingModel!.url, `vfx-campaign-${viewingModel!.id}.png`)}
                                    className="w-full py-4 bg-white text-black rounded-lg font-bold uppercase tracking-widest text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-3"
                                >
                                    <DownloadIcon className="w-5 h-5" />
                                    다운로드
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
export default App;
