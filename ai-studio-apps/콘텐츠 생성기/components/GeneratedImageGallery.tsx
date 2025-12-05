import React, { useState } from 'react';
import { ArrowPathIcon, DownloadIcon } from './Icons';
import { changeImagePose, generatePosePrompts, changeClothingDetail } from '../services/geminiService';
import { PoseChanger } from './PoseChanger';
import { ColorChanger } from './ColorChanger';
import { UploadFile } from '../types';
import { dataURLtoFile } from '../utils/fileUtils';

const initialPoses = [
  { label: '정면 클로즈업', prompt: '신발의 앞모습이 프레임 중앙에 오도록 촬영한 정면 클로즈업 샷. 신발의 전체적인 모양과 발등 디테일이 잘 보이도록.' },
  { label: '좌측면 샷', prompt: '신발의 왼쪽 측면 전체가 보이도록 촬영한 샷. 아웃솔 디자인과 측면 로고, 실루엣을 강조.' },
  { label: '우측면 샷', prompt: '신발의 오른쪽 측면 전체가 보이도록 촬영한 샷. 아웃솔 디자인과 측면 로고, 실루엣을 강조.' },
  { label: '로우앵글 사선', prompt: '낮은 카메라 각도에서 신발을 사선으로 바라본 샷. 신발의 입체감과 아웃솔의 두께를 강조.' },
  { label: '발등 굽힘', prompt: '발가락을 아래로 향하게 하여 발등을 자연스럽게 굽히는 자세. 신발의 유연성과 발등 부분의 소재감이 잘 드러나도록.' },
  { label: '앞코 접힘', prompt: '발끝으로 서는 것처럼 앞코 부분을 바닥에 대고 살짝 구부려, 신발 앞부분이 자연스럽게 접히는 모습을 보여주는 자세.' },
  { label: '측면 실루엣', prompt: '한쪽 발을 다른 발 앞에 살짝 교차시켜 세워, 신발의 바깥쪽 측면 실루엣과 뒷굽 라인을 강조하는 자세.' },
  { label: '힐업 토탭', prompt: '발끝(토)은 바닥에 가볍게 대고 뒤꿈치(힐)를 살짝 들어 올려, 신발의 아치와 측면 라인이 잘 보이도록 하는 자세.' },
  { label: '걷는 순간', prompt: '한 발이 땅을 박차고 앞으로 나아가는 듯한 걷는 동작의 순간을 포착한 샷. 신발의 역동적인 모습을 강조.' },
  { label: '서서 측면 보기', prompt: '차렷 자세로 서서 몸을 옆으로 돌려 신발의 옆모습을 보여주는 가장 기본적인 측면 자세.' },
];

interface GeneratedImageGalleryProps {
  images: string[];
  onReset: () => void;
  onImageAdd: (index: number, newImageUrl: string) => void;
}

export const GeneratedImageGallery: React.FC<GeneratedImageGalleryProps> = ({ images, onReset, onImageAdd }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poses, setPoses] = useState(initialPoses);
  const [processingLabel, setProcessingLabel] = useState<string>('');

  const selectedImage = images[selectedIndex] || null;

  const handleDownload = () => {
    if (!selectedImage) return;
    const link = document.createElement('a');
    link.href = selectedImage;
    const mimeType = selectedImage.split(';')[0].split(':')[1];
    const extension = mimeType.split('/')[1] || 'png';
    link.download = `generated-fashion-image.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePoseChange = async (posePrompt: string) => {
    if (!selectedImage || isProcessing) return;

    setIsProcessing(true);
    setProcessingLabel('모델의 자세를 변경 중...');
    setError(null);
    try {
      const file = dataURLtoFile(selectedImage, `generated_image_${selectedIndex}.jpeg`);
      const uploadFile: UploadFile = { file, previewUrl: selectedImage };
      const newImage = await changeImagePose(uploadFile, posePrompt);
      onImageAdd(selectedIndex, newImage);
      setSelectedIndex(selectedIndex + 1);
    } catch (e) {
      console.error("Failed to change pose:", e);
      const errorMessage = e instanceof Error ? e.message : '자세 변경 중 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleColorChange = async (item: string, color: string) => {
    if (!selectedImage || isProcessing) return;
    
    setIsProcessing(true);
    setProcessingLabel(`${item} 색상 변경 중 (${color})...`);
    setError(null);

    try {
        const file = dataURLtoFile(selectedImage, `generated_base_color_${Date.now()}.jpg`);
        const uploadFile: UploadFile = { file, previewUrl: selectedImage };
        
        const newImage = await changeClothingDetail(uploadFile, item, color);
        onImageAdd(selectedIndex, newImage);
        setSelectedIndex(selectedIndex + 1);
    } catch (e) {
        console.error("Failed to change color:", e);
        const errorMessage = e instanceof Error ? e.message : '색상 변경 중 오류가 발생했습니다.';
        setError(errorMessage);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleGenerateRandom = async () => {
    if (!selectedImage || isProcessing) return;

    setIsProcessing(true);
    setProcessingLabel('랜덤 포즈 3종 생성 중...');
    setError(null);
    
    try {
      const file = dataURLtoFile(selectedImage, `generated_base_${Date.now()}.jpg`);
      const uploadFile: UploadFile = { file, previewUrl: selectedImage };

      const existingPrompts = poses.map(p => p.prompt);
      const newPoses = await generatePosePrompts(existingPrompts);
      setPoses(prevPoses => [...prevPoses, ...newPoses]);

      const generationPromises = newPoses.map(pose => 
        changeImagePose(uploadFile, pose.prompt)
      );

      const newImages = await Promise.all(generationPromises);

      newImages.forEach((img) => {
        onImageAdd(selectedIndex, img);
      });

    } catch (e) {
      console.error("Failed to generate random poses:", e);
      const errorMessage = e instanceof Error ? e.message : '랜덤 포즈 이미지 생성 중 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  if (images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#09090b] flex flex-col lg:flex-row font-sans">
        {/* Left Sidebar - Tools Panel */}
        <div className="w-[420px] min-w-[420px] bg-[#111318] border-r border-gray-800 flex flex-col h-full z-20 shadow-2xl">
            {/* Sidebar Header */}
            <div className="p-6 border-b border-gray-800 bg-[#161920]">
                <div>
                    <h2 className="text-white font-bold text-xl tracking-tight flex items-center">
                         <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full mr-3 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></span>
                         결과물 편집
                    </h2>
                    <p className="text-xs text-indigo-400 font-medium tracking-wider mt-1.5 ml-5">GEMINI 3.0 PRO STUDIO</p>
                </div>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                
                {/* 01. History */}
                <div>
                    <h3 className="text-sm font-bold text-gray-200 mb-4 uppercase tracking-wide flex items-center">
                        <span className="w-1.5 h-1.5 bg-gray-500 rounded-full mr-2"></span>
                        01. 히스토리 (History)
                    </h3>
                    <div className="grid grid-cols-4 gap-3">
                        {images.map((img, index) => (
                            <div 
                                key={index}
                                onClick={() => setSelectedIndex(index)}
                                className={`aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all relative group
                                    ${selectedIndex === index ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-gray-700 hover:border-gray-500'}`}
                            >
                                <img src={img} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-sm text-white font-bold">{index + 1}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 02. Color Changer */}
                <div>
                     <h3 className="text-sm font-bold text-gray-200 mb-4 uppercase tracking-wide flex items-center">
                        <span className="w-1.5 h-1.5 bg-gray-500 rounded-full mr-2"></span>
                        02. 의상 색상 변경 (Color)
                     </h3>
                     <ColorChanger 
                        onColorChange={handleColorChange}
                        disabled={isProcessing}
                        isGenerating={isProcessing}
                     />
                </div>

                {/* 03. Pose Changer */}
                <div>
                    <h3 className="text-sm font-bold text-gray-200 mb-4 uppercase tracking-wide flex items-center">
                        <span className="w-1.5 h-1.5 bg-gray-500 rounded-full mr-2"></span>
                        03. 포즈 변경 (Pose)
                    </h3>
                    <PoseChanger
                        poses={poses}
                        onPoseSelect={handlePoseChange}
                        onGenerateRandom={handleGenerateRandom}
                        disabled={isProcessing}
                        isGenerating={isProcessing}
                    />
                </div>
            </div>

            {/* Sidebar Footer */}
            <div className="p-6 border-t border-gray-800 bg-[#161920]">
                <button 
                    onClick={onReset}
                    className="w-full py-3.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl transition-colors flex items-center justify-center text-sm font-bold border border-gray-600 hover:border-gray-500"
                >
                    <ArrowPathIcon className="w-4 h-4 mr-2 text-gray-400"/>
                    새로운 캠페인 시작
                </button>
            </div>
        </div>

        {/* Right Main Content - Image Preview */}
        <div className="flex-1 bg-[#09090b] relative flex flex-col h-full overflow-hidden">
             {/* Main Header */}
             <div className="h-20 border-b border-gray-800 flex items-center justify-between px-10 bg-[#09090b]">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">캠페인 결과물 (Campaign)</h1>
                    <p className="text-sm text-gray-500 mt-1 font-medium">{images.length}장 생성됨</p>
                </div>
                
                {selectedImage && (
                    <button 
                        onClick={handleDownload}
                        className="bg-white text-black hover:bg-gray-200 px-6 py-2.5 rounded-lg text-sm font-bold flex items-center transition-colors shadow-lg"
                    >
                        <DownloadIcon className="w-4 h-4 mr-2" />
                        이미지 다운로드
                    </button>
                )}
             </div>

             {/* Canvas Area */}
             <div className="flex-1 p-10 flex items-center justify-center relative overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-800/20 via-[#09090b] to-[#09090b]">
                 {selectedImage ? (
                     <div className="relative w-full h-full flex items-center justify-center">
                        {/* Ensure object-contain to show full 1:1 image including any potential letterboxing that user needs to see to judge outpainting quality */}
                        <img 
                            src={selectedImage} 
                            alt="Main preview" 
                            className="max-w-full max-h-full object-contain shadow-2xl drop-shadow-2xl rounded-md bg-black"
                        />
                     </div>
                 ) : (
                    <div className="text-gray-500 font-medium">이미지를 선택해주세요</div>
                 )}

                 {/* Loading Overlay */}
                 {isProcessing && (
                     <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-30 flex flex-col items-center justify-center">
                        <div className="w-20 h-20 border-4 border-gray-700 border-t-indigo-500 rounded-full animate-spin mb-8"></div>
                        <h3 className="text-2xl font-bold text-white tracking-tight">{processingLabel}</h3>
                        <p className="text-gray-400 mt-3 text-base tracking-wide font-medium">Gemini 3.0 Pro가 정밀 작업 중입니다...</p>
                     </div>
                 )}
                 
                 {error && (
                     <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-red-950/90 text-red-200 px-8 py-4 rounded-xl shadow-2xl backdrop-blur-md z-40 border border-red-800 font-medium text-sm">
                        ⚠️ {error}
                     </div>
                 )}
             </div>
        </div>
    </div>
  );
};