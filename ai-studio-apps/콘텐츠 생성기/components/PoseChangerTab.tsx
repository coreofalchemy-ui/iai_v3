import React from 'react';
import { ImageUploader } from './ImageUploader';
import { PoseChanger } from './PoseChanger';
import { UploadFile } from '../types';
import { ArrowPathIcon, DownloadIcon } from './Icons';

interface PoseChangerTabProps {
  sourceFile: UploadFile | null;
  baseImageUrl: string | null;
  generatedImages: string[];
  isLoading: boolean;
  isGeneratingRandom: boolean;
  error: string | null;
  poses: { label: string; prompt: string }[];
  onFilesChange: (files: UploadFile[]) => void;
  onPoseSelect: (prompt: string) => void;
  onGenerateRandom: () => void;
  onReset: () => void;
}

export const PoseChangerTab: React.FC<PoseChangerTabProps> = ({
  sourceFile,
  baseImageUrl,
  generatedImages,
  isLoading,
  isGeneratingRandom,
  error,
  poses,
  onFilesChange,
  onPoseSelect,
  onGenerateRandom,
  onReset,
}) => {
  const [selectedIndex, setSelectedIndex] = React.useState<number>(0);
  
  // Reset selected index if images change
  React.useEffect(() => {
     if(baseImageUrl) {
        setSelectedIndex(0);
     }
  }, [baseImageUrl]);

  const displayImages = [baseImageUrl, ...generatedImages].filter((url): url is string => url !== null);
  const currentImage = displayImages[selectedIndex] || null;

  const handleSelectAndSetIndex = async (posePrompt: string) => {
    await onPoseSelect(posePrompt);
    // Select the newly added image
    setSelectedIndex(displayImages.length); 
  };
  
  const handleDownload = () => {
    if (!currentImage) return;
    const link = document.createElement('a');
    link.href = currentImage;
    const mimeType = currentImage.split(';')[0].split(':')[1];
    const extension = mimeType.split('/')[1] || 'png';
    link.download = `posed-image-${selectedIndex}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!sourceFile) {
    return (
      <div className="max-w-xl mx-auto">
        <ImageUploader
          title="자세 변경할 사진 업로드"
          description="자세를 변경할 인물 사진 1장을 업로드하세요."
          onFilesChange={onFilesChange}
          maxFiles={1}
          maxSizeMB={10}
        />
      </div>
    );
  }

  const isBusy = isLoading || isGeneratingRandom;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-white">자세 변경</h2>
        <button
          onClick={onReset}
          className="bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors flex items-center"
        >
          <ArrowPathIcon className="h-5 w-5 mr-2"/>
          새로운 사진으로 시작
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 relative">
          <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 aspect-[3/4] flex items-center justify-center">
            {currentImage && <img src={currentImage} alt="Model for pose change" className="w-full h-full object-contain" />}
            {isLoading && !isGeneratingRandom && (
              <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                <div className="w-12 h-12 border-4 border-t-4 border-gray-600 border-t-indigo-500 rounded-full animate-spin"></div>
                <p className="mt-4 text-white">모델의 자세를 변경 중...</p>
              </div>
            )}
          </div>
          {currentImage && (
            <button
              onClick={handleDownload}
              className="absolute top-4 right-4 bg-gray-900/70 text-white font-semibold py-2 px-3 rounded-lg hover:bg-indigo-600 transition-colors flex items-center backdrop-blur-sm"
              aria-label="Download image"
            >
              <DownloadIcon className="h-5 w-5 mr-2" />
              다운로드
            </button>
          )}
        </div>

        <div className="lg:col-span-1 flex flex-col space-y-6">
          <PoseChanger 
            poses={poses}
            onPoseSelect={handleSelectAndSetIndex}
            onGenerateRandom={onGenerateRandom}
            disabled={isBusy} 
            isGenerating={isGeneratingRandom}
          />
          
          <div>
            <h3 className="text-xl font-semibold text-gray-300 mb-4">생성된 포즈</h3>
            <div className="grid grid-cols-3 gap-4">
            {displayImages.map((img, index) => (
                <div 
                    key={index} 
                    className={`relative aspect-square cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${selectedIndex === index ? 'border-indigo-500 scale-105' : 'border-transparent hover:border-indigo-400'}`}
                    onClick={() => setSelectedIndex(index)}
                >
                <img src={img} alt={`Generated pose ${index}`} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs text-center p-1 truncate">
                    {index === 0 ? '원본' : `포즈 ${index}`}
                </div>
                </div>
            ))}
            </div>
          </div>
          {error && <p className="text-red-400 text-sm mt-2 text-center bg-red-900/20 p-2 rounded">{error}</p>}
        </div>
      </div>
    </div>
  );
};