import React, { useState, useRef } from 'react';

interface ShoeUploadModalProps {
    visible: boolean;
    onClose: () => void;
    onGenerate: (shoes: File[]) => void;
    onGenerateWithoutShoes: () => void;
}

const MAX_SHOES = 10;

export default function ShoeUploadModal({
    visible,
    onClose,
    onGenerate,
    onGenerateWithoutShoes
}: ShoeUploadModalProps) {
    const [uploadedShoes, setUploadedShoes] = useState<{ file: File; preview: string }[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!visible) return null;

    const handleFileSelect = (files: FileList | null) => {
        if (!files) return;

        const remaining = MAX_SHOES - uploadedShoes.length;
        const newFiles = Array.from(files).slice(0, remaining);

        const newShoes = newFiles.map(file => ({
            file,
            preview: URL.createObjectURL(file)
        }));

        setUploadedShoes(prev => [...prev, ...newShoes]);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
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
        onGenerate(uploadedShoes.map(s => s.file));
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80"
                onClick={onClose}
            />

            {/* Modal - Large Size */}
            <div className="relative bg-[#f2f0e9] border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-black p-6 flex justify-between items-center">
                    <div>
                        <h2 className="text-4xl md:text-5xl font-bold text-white uppercase tracking-tight" style={{ fontFamily: 'Oswald, sans-serif' }}>
                            UPLOAD SHOES
                        </h2>
                        <p className="text-white/60 text-sm mt-1 uppercase tracking-widest" style={{ fontFamily: 'Courier Prime, monospace' }}>
                            MAX {MAX_SHOES} IMAGES
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-12 h-12 border-2 border-white text-white flex items-center justify-center text-2xl font-bold hover:bg-[#d00000] hover:border-[#d00000] transition-colors"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-6 md:p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Drop Zone - Left Side */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            className={`
                                min-h-[350px] border-4 cursor-pointer transition-all flex flex-col items-center justify-center
                                ${isDragging
                                    ? 'border-[#d00000] bg-red-50 scale-[1.01]'
                                    : 'border-dashed border-black/40 bg-white hover:border-black hover:bg-gray-50'
                                }
                                ${uploadedShoes.length >= MAX_SHOES ? 'opacity-50 pointer-events-none' : ''}
                            `}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => handleFileSelect(e.target.files)}
                                className="hidden"
                            />

                            {/* Upload Icon */}
                            <div className="w-20 h-20 border-4 border-black mb-6 flex items-center justify-center bg-white">
                                <svg className="w-10 h-10 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                            </div>

                            <p className="text-2xl font-bold uppercase tracking-wider text-center" style={{ fontFamily: 'Oswald, sans-serif' }}>
                                {uploadedShoes.length >= MAX_SHOES
                                    ? 'MAXIMUM REACHED'
                                    : 'DROP FILES HERE'
                                }
                            </p>
                            <p className="text-sm text-black/50 mt-2 uppercase tracking-widest" style={{ fontFamily: 'Courier Prime, monospace' }}>
                                OR CLICK TO BROWSE
                            </p>

                            {/* Progress indicator */}
                            <div className="mt-6 flex items-center gap-2">
                                {Array.from({ length: MAX_SHOES }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-3 h-3 border border-black transition-colors ${i < uploadedShoes.length ? 'bg-[#d00000]' : 'bg-white'
                                            }`}
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-black/40 mt-2 uppercase" style={{ fontFamily: 'Courier Prime, monospace' }}>
                                {uploadedShoes.length} / {MAX_SHOES}
                            </p>
                        </div>

                        {/* Uploaded Shoes Grid - Right Side */}
                        <div className="min-h-[350px] bg-black/5 border-2 border-black p-4">
                            <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-black">
                                <h3 className="text-xl font-bold uppercase tracking-wider" style={{ fontFamily: 'Oswald, sans-serif' }}>
                                    UPLOADED
                                </h3>
                                {uploadedShoes.length > 0 && (
                                    <span className="bg-[#d00000] text-white text-sm px-3 py-1 font-bold uppercase" style={{ fontFamily: 'Courier Prime, monospace' }}>
                                        {uploadedShoes.length} ITEMS
                                    </span>
                                )}
                            </div>

                            {uploadedShoes.length === 0 ? (
                                <div className="h-[280px] flex flex-col items-center justify-center text-black/30">
                                    <div className="w-16 h-16 border-2 border-dashed border-black/30 mb-4 flex items-center justify-center">
                                        <span className="text-3xl">×</span>
                                    </div>
                                    <p className="text-sm uppercase tracking-widest" style={{ fontFamily: 'Courier Prime, monospace' }}>
                                        NO ITEMS YET
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                                    {uploadedShoes.map((shoe, idx) => (
                                        <div
                                            key={idx}
                                            className="relative group aspect-square border-2 border-black bg-white overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(208,0,0,1)] transition-all"
                                        >
                                            <img
                                                src={shoe.preview}
                                                alt={`Shoe ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeShoe(idx); }}
                                                className="absolute top-0 right-0 w-7 h-7 bg-black text-white text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-[#d00000]"
                                            >
                                                ×
                                            </button>
                                            <div className="absolute bottom-0 left-0 right-0 bg-black text-white text-[10px] text-center py-1 uppercase" style={{ fontFamily: 'Courier Prime, monospace' }}>
                                                SHOE_{String(idx + 1).padStart(2, '0')}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t-4 border-black bg-white p-6 flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={onGenerateWithoutShoes}
                        className="flex-1 px-8 py-4 border-4 border-black bg-white text-black font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-3px] hover:translate-y-[-3px] hover:shadow-[9px_9px_0px_0px_rgba(0,0,0,1)]"
                        style={{ fontFamily: 'Oswald, sans-serif' }}
                    >
                        SKIP & GENERATE
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={uploadedShoes.length === 0}
                        className={`
                            flex-1 px-8 py-4 border-4 font-bold uppercase tracking-wider transition-all
                            ${uploadedShoes.length > 0
                                ? 'border-[#d00000] bg-[#d00000] text-white hover:bg-black hover:border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-3px] hover:translate-y-[-3px] hover:shadow-[9px_9px_0px_0px_rgba(208,0,0,1)]'
                                : 'border-gray-300 bg-gray-200 text-gray-400 cursor-not-allowed'
                            }
                        `}
                        style={{ fontFamily: 'Oswald, sans-serif' }}
                    >
                        GENERATE WITH {uploadedShoes.length} SHOES
                    </button>
                </div>
            </div>
        </div>
    );
}
