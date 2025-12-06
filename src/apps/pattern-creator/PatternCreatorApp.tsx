import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI } from "@google/genai";
import html2canvas from 'html2canvas';

const colors = { bgBase: '#F5F5F7', bgSurface: '#FFFFFF', bgSubtle: '#F0F0F4', borderSoft: '#E2E2E8', textPrimary: '#111111', textSecondary: '#6E6E73', textMuted: '#A1A1AA', accentPrimary: '#111111' };

interface ShoeImage { id: string; url: string; }
interface PatternImage { id: string; url: string; name: string; }
interface AppliedPattern { id: string; shoeId: string; patternId: string; offsetX: number; offsetY: number; scale: number; rotation: number; opacity: number; blendMode: BlendMode; }
type BlendMode = 'normal' | 'multiply' | 'overlay' | 'screen';

const BLEND_MODES = [{ id: 'normal' as BlendMode, name: '일반' }, { id: 'multiply' as BlendMode, name: '곱하기' }, { id: 'overlay' as BlendMode, name: '오버레이' }, { id: 'screen' as BlendMode, name: '스크린' }];
const SAMPLE_PATTERNS = [{ name: '체크', emoji: '🔲' }, { name: '스트라이프', emoji: '📊' }, { name: '도트', emoji: '🔘' }, { name: '플라워', emoji: '🌸' }, { name: '기하학', emoji: '🔷' }, { name: '카모', emoji: '🌿' }];

export default function PatternCreatorApp() {
    const navigate = useNavigate();
    const [shoes, setShoes] = useState<ShoeImage[]>([]);
    const [selectedShoeId, setSelectedShoeId] = useState<string | null>(null);
    const [patterns, setPatterns] = useState<PatternImage[]>([]);
    const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
    const [applied, setApplied] = useState<AppliedPattern[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [patternPrompt, setPatternPrompt] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const shoeInputRef = useRef<HTMLInputElement>(null);
    const patternInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const genAI = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

    const handleShoeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        Array.from(e.target.files || []).filter(f => f.type.startsWith('image/')).forEach(file => {
            const newShoe = { id: `shoe-${Date.now()}`, url: URL.createObjectURL(file) };
            setShoes(prev => [...prev, newShoe]);
            if (!selectedShoeId) setSelectedShoeId(newShoe.id);
        });
    };

    const handlePatternUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        Array.from(e.target.files || []).filter(f => f.type.startsWith('image/')).forEach(file => {
            setPatterns(prev => [...prev, { id: `pattern-${Date.now()}`, url: URL.createObjectURL(file), name: file.name.split('.')[0] }]);
        });
    };

    const handleGeneratePattern = async () => {
        if (!patternPrompt.trim()) return;
        setIsGenerating(true);
        try {
            await genAI.models.generateContent({ model: 'gemini-2.0-flash', contents: `패턴 생성: ${patternPrompt}` });
            await new Promise(r => setTimeout(r, 1500));
            setPatterns(prev => [...prev, { id: `pattern-${Date.now()}`, url: 'data:image/svg+xml,' + encodeURIComponent('<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><pattern id="p" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="5" fill="#666"/></pattern><rect width="100" height="100" fill="url(#p)"/></svg>'), name: patternPrompt.slice(0, 20) }]);
            setPatternPrompt('');
        } catch (e) { console.error(e); }
        finally { setIsGenerating(false); }
    };

    const handleApplyPattern = () => {
        if (!selectedShoeId || !selectedPatternId) return;
        setApplied(prev => [...prev, { id: `applied-${Date.now()}`, shoeId: selectedShoeId, patternId: selectedPatternId, offsetX: 50, offsetY: 50, scale: 1, rotation: 0, opacity: 0.8, blendMode: 'multiply' }]);
    };

    const handlePatternAdjust = (id: string, updates: Partial<AppliedPattern>) => setApplied(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));

    const handleMouseDown = (e: React.MouseEvent) => { e.preventDefault(); setIsDragging(true); setDragStart({ x: e.clientX, y: e.clientY }); };
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging) return;
        const current = applied.find(p => p.shoeId === selectedShoeId);
        if (!current) return;
        handlePatternAdjust(current.id, { offsetX: current.offsetX + e.clientX - dragStart.x, offsetY: current.offsetY + e.clientY - dragStart.y });
        setDragStart({ x: e.clientX, y: e.clientY });
    }, [isDragging, dragStart, applied, selectedShoeId]);
    const handleMouseUp = useCallback(() => setIsDragging(false), []);

    useEffect(() => {
        if (isDragging) { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); }
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const handleSave = useCallback(async () => {
        if (!canvasRef.current) return;
        const canvas = await html2canvas(canvasRef.current, { backgroundColor: colors.bgBase, scale: 2 });
        const link = document.createElement('a'); link.download = `custom-pattern-${Date.now()}.png`; link.href = canvas.toDataURL(); link.click();
    }, []);

    const selectedShoe = shoes.find(s => s.id === selectedShoeId);
    const selectedPattern = patterns.find(p => p.id === selectedPatternId);
    const currentApplied = applied.find(p => p.shoeId === selectedShoeId);

    return (
        <div className="min-h-screen flex flex-col" style={{ background: colors.bgBase, fontFamily: "-apple-system, sans-serif" }}>
            <header style={{ height: 56, borderBottom: `1px solid ${colors.borderSoft}` }} className="flex items-center justify-between px-8 sticky top-0 z-50 bg-[#F5F5F7]">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate('/')} style={{ color: colors.textSecondary }}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg></button>
                    <h1 style={{ fontSize: 17, fontWeight: 600, color: colors.textPrimary }}>Custom Pattern</h1>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleApplyPattern} disabled={!selectedShoeId || !selectedPatternId} style={{ background: colors.accentPrimary, color: '#FFF', padding: '8px 16px', borderRadius: 980, fontSize: 13 }} className="disabled:opacity-40">패턴 적용</button>
                    {currentApplied && <button onClick={handleSave} style={{ background: colors.accentPrimary, color: '#FFF', padding: '8px 16px', borderRadius: 980, fontSize: 13 }}>저장</button>}
                </div>
            </header>
            <div className="flex-grow flex p-6 gap-6 overflow-hidden">
                <div style={{ width: 300, background: colors.bgSubtle, borderRadius: 16 }} className="flex flex-col overflow-y-auto">
                    {/* Shoe Upload */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12 }} className="p-4">
                        <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary }} className="uppercase mb-3">베이스 신발</h3>
                        <div style={{ border: `2px dashed ${colors.borderSoft}`, borderRadius: 12, height: 70 }} className="flex items-center justify-center cursor-pointer" onClick={() => shoeInputRef.current?.click()}>
                            <input ref={shoeInputRef} type="file" accept="image/*" className="hidden" onChange={handleShoeUpload} />
                            <span style={{ fontSize: 12, color: colors.textMuted }}>+ 신발 업로드</span>
                        </div>
                        {shoes.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{shoes.map(s => (
                            <div key={s.id} style={{ border: selectedShoeId === s.id ? `2px solid ${colors.accentPrimary}` : `1px solid ${colors.borderSoft}`, borderRadius: 8 }} className="aspect-square overflow-hidden cursor-pointer" onClick={() => setSelectedShoeId(s.id)}>
                                <img src={s.url} className="w-full h-full object-cover" />
                            </div>
                        ))}</div>}
                    </div>
                    {/* Pattern Upload/Generate */}
                    <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12 }} className="p-4">
                        <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary }} className="uppercase mb-3">패턴</h3>
                        <div style={{ border: `2px dashed ${colors.borderSoft}`, borderRadius: 12, height: 60 }} className="flex items-center justify-center cursor-pointer mb-3" onClick={() => patternInputRef.current?.click()}>
                            <input ref={patternInputRef} type="file" accept="image/*" className="hidden" onChange={handlePatternUpload} />
                            <span style={{ fontSize: 12, color: colors.textMuted }}>+ 패턴 업로드</span>
                        </div>
                        <div style={{ background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 12 }} className="p-3">
                            <label style={{ fontSize: 11, color: colors.textMuted }} className="block mb-2">AI 패턴 생성</label>
                            <input type="text" value={patternPrompt} onChange={e => setPatternPrompt(e.target.value)} placeholder="예: 빈티지 체크" style={{ background: colors.bgSurface, border: 'none', borderRadius: 8, fontSize: 12, color: colors.textPrimary }} className="w-full px-3 py-2 outline-none" />
                            <button onClick={handleGeneratePattern} disabled={isGenerating || !patternPrompt.trim()} style={{ background: colors.accentPrimary, color: '#FFF', borderRadius: 8, fontSize: 12 }} className="w-full mt-2 py-2 disabled:opacity-40">{isGenerating ? '생성 중...' : 'AI 생성'}</button>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">{SAMPLE_PATTERNS.map((s, i) => (
                            <button key={i} onClick={() => setPatternPrompt(s.name)} style={{ background: colors.bgSubtle, border: `1px solid ${colors.borderSoft}`, borderRadius: 8 }} className="p-2 text-center">
                                <span className="text-lg block">{s.emoji}</span><span style={{ fontSize: 10, color: colors.textMuted }}>{s.name}</span>
                            </button>
                        ))}</div>
                        {patterns.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{patterns.map(p => (
                            <div key={p.id} style={{ border: selectedPatternId === p.id ? `2px solid ${colors.accentPrimary}` : `1px solid ${colors.borderSoft}`, borderRadius: 8 }} className="aspect-square overflow-hidden cursor-pointer" onClick={() => setSelectedPatternId(p.id)}>
                                <img src={p.url} className="w-full h-full object-cover" />
                            </div>
                        ))}</div>}
                    </div>
                    {/* Pattern Adjustments */}
                    {currentApplied && selectedPattern && (
                        <div style={{ background: colors.bgSurface, borderRadius: 12, margin: 12 }} className="p-4">
                            <h3 style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary }} className="uppercase mb-3">패턴 조정</h3>
                            <div className="space-y-3">
                                <div><label style={{ fontSize: 11, color: colors.textMuted }} className="block mb-1">크기</label><input type="range" min="0.1" max="3" step="0.1" value={currentApplied.scale} onChange={e => handlePatternAdjust(currentApplied.id, { scale: parseFloat(e.target.value) })} className="w-full accent-gray-900" /></div>
                                <div><label style={{ fontSize: 11, color: colors.textMuted }} className="block mb-1">회전</label><input type="range" min="0" max="360" value={currentApplied.rotation} onChange={e => handlePatternAdjust(currentApplied.id, { rotation: parseInt(e.target.value) })} className="w-full accent-gray-900" /></div>
                                <div><label style={{ fontSize: 11, color: colors.textMuted }} className="block mb-1">투명도</label><input type="range" min="0" max="1" step="0.1" value={currentApplied.opacity} onChange={e => handlePatternAdjust(currentApplied.id, { opacity: parseFloat(e.target.value) })} className="w-full accent-gray-900" /></div>
                                <div><label style={{ fontSize: 11, color: colors.textMuted }} className="block mb-1">블렌드</label>
                                    <div className="flex flex-wrap gap-1">{BLEND_MODES.map(m => (
                                        <button key={m.id} onClick={() => handlePatternAdjust(currentApplied.id, { blendMode: m.id })} style={{ background: currentApplied.blendMode === m.id ? colors.accentPrimary : colors.bgSubtle, color: currentApplied.blendMode === m.id ? '#FFF' : colors.textPrimary, border: `1px solid ${colors.borderSoft}`, borderRadius: 6, padding: '4px 8px', fontSize: 10 }}>{m.name}</button>
                                    ))}</div>
                                </div>
                                <button onClick={() => setApplied(prev => prev.filter(p => p.id !== currentApplied.id))} style={{ color: '#FF3B30', fontSize: 12 }} className="w-full py-2">패턴 제거</button>
                            </div>
                        </div>
                    )}
                </div>
                {/* Canvas */}
                <div className="flex-grow flex items-center justify-center">
                    <div ref={canvasRef} style={{ width: 500, height: 500, background: colors.bgSurface, border: `1px solid ${colors.borderSoft}`, borderRadius: 16, boxShadow: '0 18px 45px rgba(0,0,0,0.08)' }} className="relative overflow-hidden">
                        {selectedShoe ? (<>
                            <img src={selectedShoe.url} className="absolute inset-0 w-full h-full object-contain" />
                            {currentApplied && selectedPattern && (
                                <div className="absolute cursor-move" style={{ left: currentApplied.offsetX, top: currentApplied.offsetY, transform: `scale(${currentApplied.scale}) rotate(${currentApplied.rotation}deg)`, opacity: currentApplied.opacity, mixBlendMode: currentApplied.blendMode }} onMouseDown={handleMouseDown}>
                                    <img src={selectedPattern.url} className="w-48 h-48 object-cover pointer-events-none" draggable={false} />
                                </div>
                            )}
                        </>) : (
                            <div className="absolute inset-0 flex items-center justify-center"><div className="text-center"><span className="text-4xl block mb-3">👟</span><p style={{ fontSize: 13, color: colors.textMuted }}>신발 이미지 업로드</p></div></div>
                        )}
                    </div>
                </div>
            </div>
            {isGenerating && <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"><div style={{ background: colors.bgSurface, borderRadius: 20 }} className="p-8 text-center"><div style={{ borderColor: colors.borderSoft, borderTopColor: colors.accentPrimary }} className="w-12 h-12 border-3 rounded-full animate-spin mx-auto mb-4" /><p style={{ fontSize: 15, color: colors.textPrimary }}>패턴 생성 중...</p></div></div>}
        </div>
    );
}
