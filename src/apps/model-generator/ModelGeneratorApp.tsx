import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface ModelImage {
    id: string;
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
    isHeld: boolean;
    faceGenerated: boolean;
}

export default function ModelGeneratorApp() {
    const navigate = useNavigate();
    const [images, setImages] = useState<ModelImage[]>([]);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processType, setProcessType] = useState<string>('');
    const canvasRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const faceInputRef = useRef<HTMLInputElement>(null);

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

    // 이미지 업로드
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));

        for (const file of files) {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const newImage: ModelImage = {
                    id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    url,
                    x: 100 + Math.random() * 200,
                    y: 100 + Math.random() * 200,
                    width: Math.min(350, img.naturalWidth),
                    height: Math.min(500, img.naturalHeight * (Math.min(350, img.naturalWidth) / img.naturalWidth)),
                    isHeld: false,
                    faceGenerated: false
                };
                setImages(prev => [...prev, newImage]);
            };
            img.src = url;
        }
    };

    // 얼굴 생성
    const handleGenerateFace = async () => {
        if (!selectedImageId) return;
        setIsProcessing(true);
        setProcessType('Generating Faces...');

        // TODO: 실제 face generation 서비스 연결
        setTimeout(() => {
            setImages(prev => prev.map(img =>
                img.id === selectedImageId ? { ...img, faceGenerated: true } : img
            ));
            setIsProcessing(false);
            setProcessType('');
            alert('Face generated!');
        }, 2000);
    };

    // 얼굴 교체 (파일 선택 후)
    const handleFaceSwap = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0 || !selectedImageId) return;

        setIsProcessing(true);
        setProcessType('Swapping Face...');

        // TODO: 실제 face swap 서비스 연결
        setTimeout(() => {
            setIsProcessing(false);
            setProcessType('');
            alert('Face swapped!');
        }, 2000);
    };

    // 포즈 변경
    const handleChangePose = async () => {
        if (!selectedImageId) return;
        setIsProcessing(true);
        setProcessType('Changing Pose...');

        // TODO: 실제 pose change 서비스 연결
        setTimeout(() => {
            setIsProcessing(false);
            setProcessType('');
            alert('Pose changed!');
        }, 2000);
    };

    // 의상 변경
    const handleChangeOutfit = async () => {
        if (!selectedImageId) return;
        setIsProcessing(true);
        setProcessType('Changing Outfit...');

        // TODO: 실제 outfit change 서비스 연결
        setTimeout(() => {
            setIsProcessing(false);
            setProcessType('');
            alert('Outfit changed!');
        }, 2000);
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

    // 홀드 토글
    const handleToggleHold = (id: string) => {
        setImages(prev => prev.map(img =>
            img.id === id ? { ...img, isHeld: !img.isHeld } : img
        ));
    };

    // 캔버스 클릭 시 선택 해제
    const handleCanvasClick = () => {
        setSelectedImageId(null);
    };

    const selectedImage = images.find(img => img.id === selectedImageId);

    return (
        <div className="min-h-screen flex flex-col bg-[#1e1e1e] text-white">
            {/* 헤더 */}
            <header className="h-14 bg-[#2c2c2c] border-b border-[#3c3c3c] flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white">
                        ← Back
                    </button>
                    <h1 className="text-lg font-bold text-white">모델 생성기</h1>
                </div>

                {/* 선택된 이미지용 액션 버튼들 */}
                {selectedImage && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleGenerateFace}
                            disabled={isProcessing}
                            className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-500 disabled:opacity-50"
                        >
                            얼굴 생성
                        </button>
                        <button
                            onClick={() => faceInputRef.current?.click()}
                            disabled={isProcessing}
                            className="px-3 py-1.5 bg-pink-600 text-white text-sm rounded hover:bg-pink-500 disabled:opacity-50"
                        >
                            얼굴 교체
                        </button>
                        <button
                            onClick={handleChangePose}
                            disabled={isProcessing}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 disabled:opacity-50"
                        >
                            포즈 변경
                        </button>
                        <button
                            onClick={handleChangeOutfit}
                            disabled={isProcessing}
                            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-500 disabled:opacity-50"
                        >
                            의상 변경
                        </button>
                        <input
                            ref={faceInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFaceSwap}
                        />
                    </div>
                )}
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
                            className={`absolute cursor-move transition-shadow ${selectedImageId === image.id ? 'ring-2 ring-[#0d99ff] shadow-2xl' : ''
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
                                alt="Model"
                                className="w-full h-full object-cover rounded-lg shadow-lg"
                                draggable={false}
                            />

                            {/* 홀드 표시 */}
                            {image.isHeld && (
                                <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                                    HOLD
                                </div>
                            )}

                            {/* 얼굴 생성 완료 표시 */}
                            {image.faceGenerated && (
                                <div className="absolute top-2 right-2 bg-purple-500 text-white text-xs px-2 py-1 rounded">
                                    AI Face
                                </div>
                            )}

                            {/* 선택된 이미지의 컨트롤 */}
                            {selectedImageId === image.id && (
                                <>
                                    {/* 리사이즈 핸들 */}
                                    <div
                                        className="absolute bottom-0 right-0 w-5 h-5 bg-[#0d99ff] cursor-se-resize rounded-tl"
                                        onMouseDown={(e) => handleResizeStart(e, image.id)}
                                    />

                                    {/* 툴바 */}
                                    <div className="absolute -top-10 left-0 flex gap-2 bg-[#2c2c2c] rounded p-1 shadow-lg">
                                        <button
                                            onClick={() => handleToggleHold(image.id)}
                                            className={`px-2 py-1 text-xs rounded ${image.isHeld ? 'bg-red-500 text-white' : 'bg-gray-600 text-white hover:bg-gray-500'
                                                }`}
                                        >
                                            Hold
                                        </button>
                                        <button
                                            onClick={() => handleDeleteImage(image.id)}
                                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500"
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
                                <p className="text-lg mb-2">모델 이미지를 업로드하여 시작하세요</p>
                                <p className="text-sm">얼굴 생성, 얼굴 교체, 포즈 및 의상 변경</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 하단 업로드 영역 */}
            <div className="h-28 bg-[#252525] border-t border-[#3c3c3c] flex items-center justify-center px-6">
                <div
                    className="w-full max-w-lg h-20 border-2 border-dashed border-[#3c3c3c] rounded-lg flex items-center justify-center cursor-pointer hover:border-[#0d99ff] transition-colors"
                    onClick={() => inputRef.current?.click()}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleUpload}
                    />
                    <span className="text-gray-400 text-sm">+ 모델 업로드 ({images.length}개 캔버스)</span>
                </div>
            </div>

            {/* 프로세싱 오버레이 */}
            {isProcessing && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-[#2c2c2c] p-8 rounded-lg text-center">
                        <div className="w-12 h-12 border-4 border-[#0d99ff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-white">{processType}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
