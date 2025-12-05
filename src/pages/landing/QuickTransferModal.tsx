import React, { useState, useRef } from 'react';

interface QuickTransferModalProps {
    visible: boolean;
    onClose: () => void;
    onGenerate: (options: QuickTransferOptions) => void;
}

export interface QuickTransferOptions {
    models: { name: string; url: string }[];
    shoes: { name: string; url: string }[];
    beautify: boolean;
    studio: boolean;
    modelCuts: number;
    closeupCuts: number;
}

const MAX_MODELS = 5;
const MAX_SHOES = 10;

// 10가지 포즈 (중복 방지용)
export const POSE_VARIATIONS = [
    'standing-front',
    'standing-side',
    'walking-casual',
    'sitting-relaxed',
    'leaning-wall',
    'stepping-forward',
    'cross-leg-stand',
    'dynamic-motion',
    'fashion-pose',
    'street-style'
] as const;

export default function QuickTransferModal({
    visible,
    onClose,
    onGenerate
}: QuickTransferModalProps) {
    const [uploadedModels, setUploadedModels] = useState<{ file: File; preview: string }[]>([]);
    const [uploadedShoes, setUploadedShoes] = useState<{ file: File; preview: string }[]>([]);
    const [beautify, setBeautify] = useState(true);
    const [studio, setStudio] = useState(true);
    const [modelCuts, setModelCuts] = useState(3);
    const [closeupCuts, setCloseupCuts] = useState(3);
    const [isDraggingModel, setIsDraggingModel] = useState(false);
    const [isDraggingShoe, setIsDraggingShoe] = useState(false);

    const modelInputRef = useRef<HTMLInputElement>(null);
    const shoeInputRef = useRef<HTMLInputElement>(null);

    if (!visible) return null;

    const handleModelFileSelect = (files: FileList | null) => {
        if (!files) return;
        const remaining = MAX_MODELS - uploadedModels.length;
        const newFiles = Array.from(files).slice(0, remaining);
        const newModels = newFiles.map(file => ({
            file,
            preview: URL.createObjectURL(file)
        }));
        setUploadedModels(prev => [...prev, ...newModels]);
    };

    const handleShoeFileSelect = (files: FileList | null) => {
        if (!files) return;
        const remaining = MAX_SHOES - uploadedShoes.length;
        const newFiles = Array.from(files).slice(0, remaining);
        const newShoes = newFiles.map(file => ({
            file,
            preview: URL.createObjectURL(file)
        }));
        setUploadedShoes(prev => [...prev, ...newShoes]);
    };

    const removeModel = (index: number) => {
        setUploadedModels(prev => {
            const newModels = [...prev];
            URL.revokeObjectURL(newModels[index].preview);
            newModels.splice(index, 1);
            return newModels;
        });
    };

    const removeShoe = (index: number) => {
        setUploadedShoes(prev => {
            const newShoes = [...prev];
            URL.revokeObjectURL(newShoes[index].preview);
            newShoes.splice(index, 1);
            return newShoes;
        });
    };

    const handleGenerate = () => {
        onGenerate({
            models: uploadedModels.map(m => ({ name: m.file.name, url: m.preview })),
            shoes: uploadedShoes.map(s => ({ name: s.file.name, url: s.preview })),
            beautify,
            studio,
            modelCuts,
            closeupCuts
        });
    };

    const canGenerate = uploadedModels.length > 0 && uploadedShoes.length > 0;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-[#f2f0e9] border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-black p-6 flex justify-between items-center">
                    <div>
                        <h2 className="text-4xl md:text-5xl font-bold text-white uppercase tracking-tight" style={{ fontFamily: 'Oswald, sans-serif' }}>
                            QUICK TRANSFER
                        </h2>
                        <p className="text-white/60 text-sm mt-1 uppercase tracking-widest" style={{ fontFamily: 'Courier Prime, monospace' }}>
                            MODEL + SHOE COMPOSITE
                        </p>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 border-2 border-white text-white flex items-center justify-center text-2xl font-bold hover:bg-[#d00000] hover:border-[#d00000] transition-colors">
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-6 md:p-8 space-y-6">
                    {/* Model Upload Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div
                            onClick={() => modelInputRef.current?.click()}
                            onDrop={(e) => { e.preventDefault(); setIsDraggingModel(false); handleModelFileSelect(e.dataTransfer.files); }}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingModel(true); }}
                            onDragLeave={() => setIsDraggingModel(false)}
                            className={`min-h-[200px] border-4 cursor-pointer transition-all flex flex-col items-center justify-center ${isDraggingModel ? 'border-[#d00000] bg-red-50 scale-[1.01]' : 'border-dashed border-black/40 bg-white hover:border-black hover:bg-gray-50'} ${uploadedModels.length >= MAX_MODELS ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            <input ref={modelInputRef} type="file" accept="image/*" multiple onChange={(e) => handleModelFileSelect(e.target.files)} className="hidden" />
                            <div className="w-16 h-16 border-4 border-black mb-4 flex items-center justify-center bg-white">
                                <span className="text-3xl">👤</span>
                            </div>
                            <p className="text-xl font-bold uppercase tracking-wider" style={{ fontFamily: 'Oswald, sans-serif' }}>MODEL PHOTOS</p>
                            <p className="text-xs text-black/50 mt-1 uppercase tracking-widest" style={{ fontFamily: 'Courier Prime, monospace' }}>MAX {MAX_MODELS} IMAGES</p>
                            <div className="mt-4 flex items-center gap-1">
                                {Array.from({ length: MAX_MODELS }).map((_, i) => (
                                    <div key={i} className={`w-3 h-3 border border-black ${i < uploadedModels.length ? 'bg-[#d00000]' : 'bg-white'}`} />
                                ))}
                            </div>
                        </div>

                        {/* Uploaded Models */}
                        <div className="min-h-[200px] bg-black/5 border-2 border-black p-4">
                            <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-black">
                                <h3 className="text-lg font-bold uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>MODELS</h3>
                                {uploadedModels.length > 0 && (
                                    <span className="bg-[#d00000] text-white text-xs px-2 py-0.5 font-bold uppercase" style={{ fontFamily: 'Courier Prime, monospace' }}>
                                        {uploadedModels.length} ITEMS
                                    </span>
                                )}
                            </div>
                            {uploadedModels.length === 0 ? (
                                <div className="h-[140px] flex flex-col items-center justify-center text-black/30">
                                    <span className="text-2xl mb-2">×</span>
                                    <p className="text-xs uppercase tracking-widest" style={{ fontFamily: 'Courier Prime, monospace' }}>NO MODELS YET</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 gap-2">
                                    {uploadedModels.map((model, idx) => (
                                        <div key={idx} className="relative group aspect-square border-2 border-black bg-white overflow-hidden shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                            <img src={model.preview} alt={`Model ${idx + 1}`} className="w-full h-full object-cover" />
                                            <button onClick={(e) => { e.stopPropagation(); removeModel(idx); }} className="absolute top-0 right-0 w-6 h-6 bg-black text-white text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-[#d00000]">×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Shoe Upload Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div
                            onClick={() => shoeInputRef.current?.click()}
                            onDrop={(e) => { e.preventDefault(); setIsDraggingShoe(false); handleShoeFileSelect(e.dataTransfer.files); }}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingShoe(true); }}
                            onDragLeave={() => setIsDraggingShoe(false)}
                            className={`min-h-[200px] border-4 cursor-pointer transition-all flex flex-col items-center justify-center ${isDraggingShoe ? 'border-[#d00000] bg-red-50 scale-[1.01]' : 'border-dashed border-black/40 bg-white hover:border-black hover:bg-gray-50'} ${uploadedShoes.length >= MAX_SHOES ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            <input ref={shoeInputRef} type="file" accept="image/*" multiple onChange={(e) => handleShoeFileSelect(e.target.files)} className="hidden" />
                            <div className="w-16 h-16 border-4 border-black mb-4 flex items-center justify-center bg-white">
                                <span className="text-3xl">👟</span>
                            </div>
                            <p className="text-xl font-bold uppercase tracking-wider" style={{ fontFamily: 'Oswald, sans-serif' }}>SHOE IMAGES</p>
                            <p className="text-xs text-black/50 mt-1 uppercase tracking-widest" style={{ fontFamily: 'Courier Prime, monospace' }}>MAX {MAX_SHOES} IMAGES</p>
                            <div className="mt-4 flex items-center gap-1">
                                {Array.from({ length: MAX_SHOES }).map((_, i) => (
                                    <div key={i} className={`w-2 h-2 border border-black ${i < uploadedShoes.length ? 'bg-[#d00000]' : 'bg-white'}`} />
                                ))}
                            </div>
                        </div>

                        {/* Uploaded Shoes */}
                        <div className="min-h-[200px] bg-black/5 border-2 border-black p-4">
                            <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-black">
                                <h3 className="text-lg font-bold uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>SHOES</h3>
                                {uploadedShoes.length > 0 && (
                                    <span className="bg-[#d00000] text-white text-xs px-2 py-0.5 font-bold uppercase" style={{ fontFamily: 'Courier Prime, monospace' }}>
                                        {uploadedShoes.length} ITEMS
                                    </span>
                                )}
                            </div>
                            {uploadedShoes.length === 0 ? (
                                <div className="h-[140px] flex flex-col items-center justify-center text-black/30">
                                    <span className="text-2xl mb-2">×</span>
                                    <p className="text-xs uppercase tracking-widest" style={{ fontFamily: 'Courier Prime, monospace' }}>NO SHOES YET</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-5 gap-2">
                                    {uploadedShoes.map((shoe, idx) => (
                                        <div key={idx} className="relative group aspect-square border-2 border-black bg-white overflow-hidden shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                            <img src={shoe.preview} alt={`Shoe ${idx + 1}`} className="w-full h-full object-cover" />
                                            <button onClick={(e) => { e.stopPropagation(); removeShoe(idx); }} className="absolute top-0 right-0 w-6 h-6 bg-black text-white text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-[#d00000]">×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Options Section */}
                    <div className="bg-white border-4 border-black p-5">
                        <h3 className="text-xl font-bold uppercase mb-4 border-b-2 border-black pb-2" style={{ fontFamily: 'Oswald, sans-serif' }}>OPTIONS</h3>

                        {/* Checkboxes */}
                        <div className="flex flex-wrap gap-6 mb-6">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-6 h-6 border-3 border-black flex items-center justify-center transition-colors ${beautify ? 'bg-[#d00000]' : 'bg-white hover:bg-gray-100'}`} onClick={() => setBeautify(!beautify)}>
                                    {beautify && <span className="text-white font-bold">✓</span>}
                                </div>
                                <div>
                                    <span className="font-bold uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>BEAUTIFY</span>
                                    <span className="text-xs text-gray-500 ml-2">(6장 자동 생성)</span>
                                </div>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className={`w-6 h-6 border-3 border-black flex items-center justify-center transition-colors ${studio ? 'bg-[#d00000]' : 'bg-white hover:bg-gray-100'}`} onClick={() => setStudio(!studio)}>
                                    {studio && <span className="text-white font-bold">✓</span>}
                                </div>
                                <div>
                                    <span className="font-bold uppercase" style={{ fontFamily: 'Oswald, sans-serif' }}>STUDIO</span>
                                    <span className="text-xs text-gray-500 ml-2">(배경 변환)</span>
                                </div>
                            </label>
                        </div>

                        {/* Cut Selectors */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="font-bold uppercase text-sm mb-2 block" style={{ fontFamily: 'Oswald, sans-serif' }}>MODEL CUTS</label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5, 6].map(num => (
                                        <button
                                            key={num}
                                            onClick={() => setModelCuts(num)}
                                            className={`w-10 h-10 border-3 border-black font-bold text-lg transition-all ${modelCuts === num ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
                                            style={{ fontFamily: 'Oswald, sans-serif' }}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="font-bold uppercase text-sm mb-2 block" style={{ fontFamily: 'Oswald, sans-serif' }}>CLOSE-UP CUTS</label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5, 6].map(num => (
                                        <button
                                            key={num}
                                            onClick={() => setCloseupCuts(num)}
                                            className={`w-10 h-10 border-3 border-black font-bold text-lg transition-all ${closeupCuts === num ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
                                            style={{ fontFamily: 'Oswald, sans-serif' }}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t-4 border-black bg-white p-6 flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 px-8 py-4 border-4 border-black bg-white text-black font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-3px] hover:translate-y-[-3px] hover:shadow-[9px_9px_0px_0px_rgba(0,0,0,1)]"
                        style={{ fontFamily: 'Oswald, sans-serif' }}
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={!canGenerate}
                        className={`flex-1 px-8 py-4 border-4 font-bold uppercase tracking-wider transition-all ${canGenerate ? 'border-[#d00000] bg-[#d00000] text-white hover:bg-black hover:border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-3px] hover:translate-y-[-3px] hover:shadow-[9px_9px_0px_0px_rgba(208,0,0,1)]' : 'border-gray-300 bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        style={{ fontFamily: 'Oswald, sans-serif' }}
                    >
                        GENERATE ({modelCuts + closeupCuts + (beautify ? 6 : 0)} IMAGES)
                    </button>
                </div>
            </div>
        </div>
    );
}
