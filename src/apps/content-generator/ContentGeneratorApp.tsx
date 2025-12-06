import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { batchReplaceShoes } from '../detail-generator/services/shoeReplacementService';

interface DraggableImage {
    id: string;
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isHeld: boolean;
}

export default function ContentGeneratorApp() {
    const navigate = useNavigate();
    const [shoeFiles, setShoeFiles] = useState<File[]>([]);
    const [contentFiles, setContentFiles] = useState<File[]>([]);
    const [images, setImages] = useState<DraggableImage[]>([]);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 });
    const canvasRef = useRef<HTMLDivElement>(null);
    const shoeInputRef = useRef<HTMLInputElement>(null);
    const contentInputRef = useRef<HTMLInputElement>(null);

    // 드래그 상태
    const [dragState, setDragState] = useState<{
        isDragging: boolean;
        startX: number;
        startY: number;
        initialX: number;
        initialY: number;
    }>({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });

    // 리사이즈 상태
    const [resizeState, setResizeState] = useState<{
        isResizing: boolean;
        startX: number;
        startY: number;
        initialWidth: number;
        initialHeight: number;
    }>({ isResizing: false, startX: 0, startY: 0, initialWidth: 0, initialHeight: 0 });

    // 신발 이미지 업로드
    const handleShoeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
        setShoeFiles(prev => [...prev, ...files].slice(0, 5));
    };

    // 콘텐츠 이미지 업로드 및 캔버스에 추가
    const handleContentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
        setContentFiles(prev => [...prev, ...files]);

        // 이미지를 캔버스에 추가
        for (const file of files) {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const newImage: DraggableImage = {
                    id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    url,
                    x: 100 + Math.random() * 200,
                    y: 100 + Math.random() * 200,
                    width: Math.min(300, img.naturalWidth),
                    height: Math.min(300, img.naturalHeight * (Math.min(300, img.naturalWidth) / img.naturalWidth)),
                    isHeld: false
                };
                setImages(prev => [...prev, newImage]);
            };
            img.src = url;
        }
    };

    // 신발 교체 실행
    const handleReplaceShoes = async () => {
        if (shoeFiles.length === 0) {
            alert('교체할 신발 이미지를 업로드하세요.');
            return;
        }
        if (images.length === 0) {
            alert('콘텐츠 이미지를 업로드하세요.');
            return;
        }

        setIsProcessing(true);
        setProcessProgress({ current: 0, total: images.length });

        try {
            // 첫 번째 신발 이미지를 Data URL로 변환
            const shoeDataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    resolve(e.target?.result as string);
                };
                reader.readAsDataURL(shoeFiles[0]);
            });

            // 이미지 URL들
            const imageUrls = images.map(img => img.url);
            const results = await batchReplaceShoes(
                imageUrls,
                shoeDataUrl,
                (current, total, message) => setProcessProgress({ current, total })
            );

            // 결과 이미지로 업데이트
            setImages(prev => prev.map((img, idx) => ({
                ...img,
                url: results[idx]?.success ? results[idx].url : img.url
            })));

            alert('신발 교체 완료!');
        } catch (error) {
            console.error('신발 교체 오류:', error);
            alert('신발 교체에 실패했습니다.');
        } finally {
            setIsProcessing(false);
            setProcessProgress({ current: 0, total: 0 });
        }
    };

    // 이미지 선택
    const handleImageClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedImageId(id);
    };

    // 드래그 시작
    const handleMouseDown = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        const image = images.find(img => img.id === id);
        if (!image) return;

        setSelectedImageId(id);
        setDragState({
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            initialX: image.x,
            initialY: image.y
        });
    };

    // 리사이즈 시작
    const handleResizeStart = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        const image = images.find(img => img.id === id);
        if (!image) return;

        setSelectedImageId(id);
        setResizeState({
            isResizing: true,
            startX: e.clientX,
            startY: e.clientY,
            initialWidth: image.width,
            initialHeight: image.height
        });
    };

    // 마우스 이동
    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragState.isDragging && selectedImageId) {
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;

            setImages(prev => prev.map(img =>
                img.id === selectedImageId
                    ? { ...img, x: dragState.initialX + dx, y: dragState.initialY + dy }
                    : img
            ));
        }

        if (resizeState.isResizing && selectedImageId) {
            const dx = e.clientX - resizeState.startX;
            const dy = e.clientY - resizeState.startY;

            setImages(prev => prev.map(img =>
                img.id === selectedImageId
                    ? {
                        ...img,
                        width: Math.max(100, resizeState.initialWidth + dx),
                        height: Math.max(100, resizeState.initialHeight + dy)
                    }
                    : img
            ));
        }
    };

    // 마우스 업
    const handleMouseUp = () => {
        setDragState(prev => ({ ...prev, isDragging: false }));
        setResizeState(prev => ({ ...prev, isResizing: false }));
    };

    // 이미지 삭제
    const handleDeleteImage = (id: string) => {
        setImages(prev => prev.filter(img => img.id !== id));
        if (selectedImageId === id) setSelectedImageId(null);
    };

    // 홀드 토글 (컬러 변경용)
    const handleToggleHold = (id: string) => {
        setImages(prev => prev.map(img =>
            img.id === id ? { ...img, isHeld: !img.isHeld } : img
        ));
    };

    // 캔버스 클릭 시 선택 해제
    const handleCanvasClick = () => {
        setSelectedImageId(null);
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#1e1e1e] text-white">
            {/* 헤더 */}
            <header className="h-14 bg-[#2c2c2c] border-b border-[#3c3c3c] flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white">
                        ← Back
                    </button>
                    <h1 className="text-lg font-bold text-white">콘텐츠 생성기</h1>
                </div>
                <button
                    onClick={handleReplaceShoes}
                    disabled={isProcessing || shoeFiles.length === 0 || images.length === 0}
                    className={`px-4 py-2 rounded text-sm font-bold transition-colors ${isProcessing || shoeFiles.length === 0 || images.length === 0
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-[#0d99ff] text-white hover:bg-[#0b87e0]'
                        }`}
                >
                    {isProcessing ? `처리 중 ${processProgress.current}/${processProgress.total}` : '신발 교체'}
                </button>
            </header>

            <div className="flex-grow flex">
                {/* 캔버스 영역 */}
                <div
                    ref={canvasRef}
                    className="flex-grow relative bg-[#1e1e1e] overflow-hidden"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onClick={handleCanvasClick}
                >
                    {/* 그리드 배경 */}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(circle, #3c3c3c 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}
                    />

                    {/* 드래그 가능한 이미지들 */}
                    {images.map(image => (
                        <div
                            key={image.id}
                            className={`absolute cursor-move ${selectedImageId === image.id ? 'ring-2 ring-[#0d99ff]' : ''
                                } ${image.isHeld ? 'ring-2 ring-red-500' : ''}`}
                            style={{
                                left: image.x,
                                top: image.y,
                                width: image.width,
                                height: image.height
                            }}
                            onClick={(e) => handleImageClick(e, image.id)}
                            onMouseDown={(e) => handleMouseDown(e, image.id)}
                        >
                            <img
                                src={image.url}
                                alt="Content"
                                className="w-full h-full object-cover"
                                draggable={false}
                            />

                            {/* 홀드 표시 */}
                            {image.isHeld && (
                                <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                                    HOLD
                                </div>
                            )}

                            {/* 선택된 이미지의 컨트롤 */}
                            {selectedImageId === image.id && (
                                <>
                                    {/* 리사이즈 핸들 */}
                                    <div
                                        className="absolute bottom-0 right-0 w-4 h-4 bg-[#0d99ff] cursor-se-resize"
                                        onMouseDown={(e) => handleResizeStart(e, image.id)}
                                    />

                                    {/* 툴바 */}
                                    <div className="absolute -top-10 left-0 flex gap-2 bg-[#2c2c2c] rounded p-1">
                                        <button
                                            onClick={() => handleToggleHold(image.id)}
                                            className={`px-2 py-1 text-xs rounded ${image.isHeld ? 'bg-red-500 text-white' : 'bg-gray-600 text-white hover:bg-gray-500'
                                                }`}
                                        >
                                            Hold
                                        </button>
                                        <button
                                            onClick={() => handleDeleteImage(image.id)}
                                            className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-red-500"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}

                    {/* 빈 캔버스 메시지 */}
                    {images.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                            <div className="text-center">
                                <p className="text-lg mb-2">이미지를 여기에 드롭하거나 아래 업로드 버튼을 사용하세요</p>
                                <p className="text-sm">이미지를 자유롭게 이동하고 크기를 조절할 수 있습니다</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 하단 업로드 영역 */}
            <div className="h-44 bg-[#252525] border-t border-[#3c3c3c] flex items-center gap-6 px-6">
                {/* 신발 이미지 업로드 */}
                <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-2 block">신발 이미지 (원본)</label>
                    <div
                        className="h-28 border-2 border-dashed border-[#3c3c3c] rounded-lg flex items-center justify-center cursor-pointer hover:border-[#0d99ff] transition-colors"
                        onClick={() => shoeInputRef.current?.click()}
                    >
                        <input
                            ref={shoeInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleShoeUpload}
                        />
                        {shoeFiles.length > 0 ? (
                            <div className="flex gap-2">
                                {shoeFiles.slice(0, 4).map((file, idx) => (
                                    <img
                                        key={idx}
                                        src={URL.createObjectURL(file)}
                                        alt="Shoe"
                                        className="w-12 h-12 object-cover rounded"
                                    />
                                ))}
                                {shoeFiles.length > 4 && (
                                    <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center text-xs">
                                        +{shoeFiles.length - 4}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <span className="text-gray-500 text-sm">+ 신발 업로드</span>
                        )}
                    </div>
                </div>

                {/* 콘텐츠 이미지 업로드 */}
                <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-2 block">콘텐츠 이미지 (타겟)</label>
                    <div
                        className="h-28 border-2 border-dashed border-[#3c3c3c] rounded-lg flex items-center justify-center cursor-pointer hover:border-[#0d99ff] transition-colors"
                        onClick={() => contentInputRef.current?.click()}
                    >
                        <input
                            ref={contentInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleContentUpload}
                        />
                        <span className="text-gray-500 text-sm">+ 캔버스에 추가 ({images.length})</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
