import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';

const colors = { bgBase: '#F5F5F7', bgSurface: '#FFFFFF', bgSubtle: '#F0F0F4', borderSoft: '#E2E2E8', textPrimary: '#111111', textSecondary: '#6E6E73', textMuted: '#A1A1AA', accentPrimary: '#111111' };

interface ProductImage { id: string; url: string; style: string | null; }
interface GeneratedStyle { id: string; productId: string; style: StyleType; url: string; }
type StyleType = 'minimal' | 'props' | 'natural' | 'texture' | 'cinematic' | 'custom';

const STYLE_OPTIONS = [
    { id: 'minimal' as StyleType, name: 'Minimal', nameKo: '미니멀', desc: '깔끔한 배경', icon: '⬜' },
    { id: 'props' as StyleType, name: 'Props', nameKo: '소품', desc: '소품과 함께', icon: '🎁' },
    { id: 'natural' as StyleType, name: 'Natural', nameKo: '자연광', desc: '부드러운 빛', icon: '☀️' },
    { id: 'texture' as StyleType, name: 'Texture', nameKo: '텍스처', desc: '질감 강조', icon: '🧵' },
    { id: 'cinematic' as StyleType, name: 'Cinematic', nameKo: '시네마틱', desc: '영화적', icon: '🎬' },
    { id: 'custom' as StyleType, name: 'Custom', nameKo: '커스텀', desc: '직접 입력', icon: '✨' }
];

export default function ModelGeneratorApp() {
    const navigate = useNavigate();
    const [products, setProducts] = useState<ProductImage[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedStyle, setSelectedStyle] = useState<StyleType | null>(null);
    const [results, setResults] = useState<GeneratedStyle[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');
    const [showCustom, setShowCustom] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const galleryRef = useRef<HTMLDivElement>(null);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        Array.from(e.target.files || []).filter(f => f.type.startsWith('image/')).forEach(file => {
            setProducts(prev => [...prev, { id: `p-${Date.now()}`, url: URL.createObjectURL(file), style: null }]);
        });
    };

    const handleApply = async (styleId: StyleType) => {
        if (!selectedId) return;
        if (styleId === 'custom' && !customPrompt.trim()) { setShowCustom(true); setSelectedStyle('custom'); return; }
        setIsProcessing(true); setSelectedStyle(styleId);
        await new Promise(r => setTimeout(r, 2000));
        const p = products.find(x => x.id === selectedId);
        if (p) setResults(prev => [...prev, { id: `g-${Date.now()}`, productId: selectedId, style: styleId, url: p.url }]);
        setIsProcessing(false);
    };

    const handleSave = useCallback(async () => {
        if (!galleryRef.current) return;
        const canvas = await html2canvas(galleryRef.current, { backgroundColor: colors.bgBase, scale: 2 });
        const link = document.createElement('a'); link.download = `shoe-studio-${Date.now()}.png`; link.href = canvas.toDataURL(); link.click();
    }, []);

    const handleDownload = async (url: string, name: string) => {
        const res = await fetch(url); const blob = await res.blob();
        const link = document.createElement('a'); link.download = `shoe-${name}-${Date.now()}.png`; link.href = URL.createObjectURL(blob); link.click();
    };

    const selected = products.find(p => p.id === selectedId);

    return (
        <div className="min-h-screen flex flex-col" style={{ background: colors.bgBase, fontFamily: "-apple-system, sans-serif" }}>
            <header style={{ height: 56, borderBottom: `1px solid ${colors.borderSoft}` }} className="flex items-center justify-between px-8 sticky top-0 z-50 bg-[#F5F5F7]">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate('/')} style={{ color: colors.textSecondary }}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg></button>
                    <h1 style={{ fontSize: 17, fontWeight: 600, color: colors.textPrimary }}>Shoe Studio</h1>
                </div>
                {results.length > 0 && <button onClick={handleSave} style={{ background: colors.accentPrimary, color: '#FFF', padding: '8px 20px', borderRadius: 980, fontSize: 14 }}>저장</button>}
            </header>
            <div className="flex-grow flex p-6 gap-6 overflow-hidden">
                <div style={{ width: 300, background: colors.bgSubtle, borderRadius: 16 }} className="flex flex-col">
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12 }} className="p-4">
                        <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary }} className="uppercase mb-3">제품 이미지</h3>
                        <div style={{ border: `2px dashed ${colors.borderSoft}`, borderRadius: 12, height: 80 }} className="flex items-center justify-center cursor-pointer" onClick={() => inputRef.current?.click()}>
                            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
                            <span style={{ fontSize: 12, color: colors.textMuted }}>+ 신발 업로드</span>
                        </div>
                        {products.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{products.map(p => (
                            <div key={p.id} style={{ border: selectedId === p.id ? `2px solid ${colors.accentPrimary}` : `1px solid ${colors.borderSoft}`, borderRadius: 8 }} className="aspect-square overflow-hidden cursor-pointer" onClick={() => setSelectedId(p.id)}>
                                <img src={p.url} className="w-full h-full object-cover" />
                            </div>
                        ))}</div>}
                    </div>
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12 }} className="p-4 flex-grow overflow-y-auto">
                        <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary }} className="uppercase mb-3">스타일</h3>
                        {STYLE_OPTIONS.map(s => (
                            <button key={s.id} onClick={() => handleApply(s.id)} disabled={isProcessing || !selectedId}
                                style={{ background: selectedStyle === s.id ? colors.accentPrimary : colors.bgSubtle, color: selectedStyle === s.id ? '#FFF' : colors.textPrimary, border: `1px solid ${colors.borderSoft}`, borderRadius: 10 }}
                                className="w-full p-3 mb-2 text-left flex items-center gap-3 disabled:opacity-40">
                                <span className="text-xl">{s.icon}</span>
                                <div><div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div><div style={{ fontSize: 11, opacity: 0.7 }}>{s.desc}</div></div>
                            </button>
                        ))}
                        {showCustom && <div style={{ background: colors.bgSubtle, borderRadius: 12 }} className="p-3 mt-2">
                            <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} placeholder="스타일 설명..." style={{ background: colors.bgSurface, borderRadius: 8, fontSize: 12 }} className="w-full h-16 p-2 outline-none" />
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => { setShowCustom(false); handleApply('custom'); }} style={{ background: colors.accentPrimary, color: '#FFF', borderRadius: 8, fontSize: 12 }} className="flex-1 py-2">적용</button>
                                <button onClick={() => setShowCustom(false)} style={{ background: colors.bgSurface, borderRadius: 8, fontSize: 12 }} className="flex-1 py-2">취소</button>
                            </div>
                        </div>}
                    </div>
                </div>
                <div style={{ background: colors.bgSurface, borderRadius: 16, boxShadow: '0 18px 45px rgba(0,0,0,0.08)' }} className="flex-grow p-6 overflow-y-auto">
                    {selected ? (<>
                        <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary }} className="uppercase mb-3">선택된 제품</h3>
                        <div style={{ width: 140, border: `1px solid ${colors.borderSoft}`, borderRadius: 12 }} className="aspect-square overflow-hidden mb-6"><img src={selected.url} className="w-full h-full object-cover" /></div>
                        <div ref={galleryRef}>
                            <h3 style={{ fontSize: 11, color: colors.textSecondary }} className="uppercase mb-3">결과 ({results.filter(r => r.productId === selectedId).length})</h3>
                            {results.filter(r => r.productId === selectedId).length === 0 ? <p style={{ color: colors.textMuted, fontSize: 13 }} className="text-center py-8">스타일 선택하세요</p> :
                                <div className="grid grid-cols-3 gap-4">{results.filter(r => r.productId === selectedId).map(g => (
                                    <div key={g.id} style={{ background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 12 }} className="overflow-hidden group">
                                        <div className="aspect-square relative"><img src={g.url} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2">
                                                <button onClick={() => handleDownload(g.url, g.style)} style={{ background: colors.accentPrimary, color: '#FFF', borderRadius: 8, fontSize: 12, padding: '6px 12px' }}>저장</button>
                                            </div>
                                        </div>
                                        <div className="p-3"><span style={{ fontSize: 12, fontWeight: 500 }}>{STYLE_OPTIONS.find(s => s.id === g.style)?.icon} {STYLE_OPTIONS.find(s => s.id === g.style)?.name}</span></div>
                                    </div>
                                ))}</div>}
                        </div>
                    </>) : (
                        <div className="h-full flex items-center justify-center text-center">
                            <div><div style={{ width: 100, height: 100, background: colors.bgSubtle, borderRadius: 28 }} className="mx-auto mb-6 flex items-center justify-center"><span className="text-4xl">👟</span></div>
                                <h2 style={{ fontSize: 32, fontWeight: 600, color: colors.textPrimary }}>Shoe Studio</h2>
                                <p style={{ fontSize: 15, color: colors.textSecondary }} className="mt-4">신발 이미지 업로드 후<br />스타일 선택</p></div>
                        </div>
                    )}
                </div>
            </div>
            {isProcessing && <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"><div style={{ background: colors.bgSurface, borderRadius: 20 }} className="p-8 text-center"><div style={{ borderColor: colors.borderSoft, borderTopColor: colors.accentPrimary }} className="w-12 h-12 border-3 rounded-full animate-spin mx-auto mb-4" /><p style={{ fontSize: 15, color: colors.textPrimary }}>스타일 적용 중...</p></div></div>}
        </div>
    );
}
