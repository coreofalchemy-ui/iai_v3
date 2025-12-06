import React, { useState, useRef } from 'react';

const colors = { bgBase: '#F5F5F7', bgSurface: '#FFFFFF', bgSubtle: '#F0F0F4', borderSoft: '#E2E2E8', textPrimary: '#111111', textSecondary: '#6E6E73', textMuted: '#A1A1AA', accentPrimary: '#111111' };

interface ShoeUploadModalProps { visible: boolean; onClose: () => void; onGenerate: (shoes: File[]) => void; onGenerateWithoutShoes: () => void; }

const MAX_SHOES = 10;

export default function ShoeUploadModal({ visible, onClose, onGenerate, onGenerateWithoutShoes }: ShoeUploadModalProps) {
    const [uploadedShoes, setUploadedShoes] = useState<{ file: File; preview: string }[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!visible) return null;

    const handleFileSelect = (files: FileList | null) => {
        if (!files) return;
        const remaining = MAX_SHOES - uploadedShoes.length;
        const newFiles = Array.from(files).slice(0, remaining);
        setUploadedShoes(prev => [...prev, ...newFiles.map(file => ({ file, preview: URL.createObjectURL(file) }))]);
    };

    const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files); };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);

    const removeShoe = (index: number) => {
        setUploadedShoes(prev => { const n = [...prev]; URL.revokeObjectURL(n[index].preview); n.splice(index, 1); return n; });
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ fontFamily: "-apple-system, sans-serif" }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div style={{ background: colors.bgSurface, borderRadius: 20, boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }} className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div style={{ borderBottom: `1px solid ${colors.borderSoft}` }} className="p-6 flex justify-between items-center">
                    <div>
                        <h2 style={{ fontSize: 28, fontWeight: 600, color: colors.textPrimary, letterSpacing: '-0.02em' }}>Style Transfer</h2>
                        <p style={{ fontSize: 13, color: colors.textMuted }} className="mt-1">신발 이미지를 업로드하세요 (최대 {MAX_SHOES}장)</p>
                    </div>
                    <button onClick={onClose} style={{ width: 36, height: 36, background: colors.bgSubtle, borderRadius: 18, color: colors.textSecondary, fontSize: 20 }} className="flex items-center justify-center hover:bg-gray-200">×</button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Drop Zone */}
                        <div onClick={() => fileInputRef.current?.click()} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                            style={{ border: `2px dashed ${isDragging ? colors.accentPrimary : colors.borderSoft}`, borderRadius: 16, background: isDragging ? colors.bgSubtle : colors.bgSurface, minHeight: 280 }}
                            className={`flex flex-col items-center justify-center cursor-pointer transition-all hover:border-gray-400 ${uploadedShoes.length >= MAX_SHOES ? 'opacity-50 pointer-events-none' : ''}`}>
                            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => handleFileSelect(e.target.files)} className="hidden" />
                            <div style={{ width: 80, height: 80, background: colors.bgSubtle, borderRadius: 24 }} className="flex items-center justify-center mb-4">
                                <svg className="w-8 h-8" style={{ color: colors.textSecondary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                            </div>
                            <p style={{ fontSize: 18, fontWeight: 600, color: colors.textPrimary }}>{uploadedShoes.length >= MAX_SHOES ? '최대 개수 도달' : '파일을 드롭하세요'}</p>
                            <p style={{ fontSize: 13, color: colors.textMuted }} className="mt-1">또는 클릭하여 선택</p>
                            <div className="mt-4 flex items-center gap-1">
                                {Array.from({ length: MAX_SHOES }).map((_, i) => (
                                    <div key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i < uploadedShoes.length ? colors.accentPrimary : colors.borderSoft }} />
                                ))}
                            </div>
                            <p style={{ fontSize: 11, color: colors.textMuted }} className="mt-2">{uploadedShoes.length} / {MAX_SHOES}</p>
                        </div>

                        {/* Uploaded Grid */}
                        <div style={{ background: colors.bgSubtle, borderRadius: 16, minHeight: 280 }} className="p-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, letterSpacing: '0.06em' }} className="uppercase">업로드됨</h3>
                                {uploadedShoes.length > 0 && <span style={{ fontSize: 11, background: colors.accentPrimary, color: '#FFF', padding: '2px 8px', borderRadius: 10 }}>{uploadedShoes.length}장</span>}
                            </div>
                            {uploadedShoes.length === 0 ? (
                                <div className="h-[200px] flex flex-col items-center justify-center">
                                    <span style={{ fontSize: 32, color: colors.textMuted }}>👟</span>
                                    <p style={{ fontSize: 12, color: colors.textMuted }} className="mt-2">아직 없음</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                                    {uploadedShoes.map((shoe, idx) => (
                                        <div key={idx} style={{ border: `1px solid ${colors.borderSoft}`, borderRadius: 12 }} className="relative group aspect-square overflow-hidden bg-white">
                                            <img src={shoe.preview} alt="" className="w-full h-full object-cover" />
                                            <button onClick={(e) => { e.stopPropagation(); removeShoe(idx); }}
                                                style={{ background: '#FF3B30' }} className="absolute top-1 right-1 w-5 h-5 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center">×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ borderTop: `1px solid ${colors.borderSoft}` }} className="p-6 flex gap-3">
                    <button onClick={onGenerateWithoutShoes} style={{ flex: 1, padding: '14px 24px', background: 'transparent', border: `1px solid ${colors.borderSoft}`, borderRadius: 12, fontSize: 14, fontWeight: 500, color: colors.textPrimary }} className="hover:bg-gray-50">건너뛰기</button>
                    <button onClick={() => onGenerate(uploadedShoes.map(s => s.file))} disabled={uploadedShoes.length === 0}
                        style={{ flex: 1, padding: '14px 24px', background: uploadedShoes.length > 0 ? colors.accentPrimary : colors.borderSoft, color: uploadedShoes.length > 0 ? '#FFF' : colors.textMuted, borderRadius: 12, fontSize: 14, fontWeight: 500 }}
                        className="disabled:cursor-not-allowed">
                        {uploadedShoes.length}장으로 생성
                    </button>
                </div>
            </div>
        </div>
    );
}
