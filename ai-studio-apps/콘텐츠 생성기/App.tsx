import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { ContentGenerator } from './components/ContentGenerator';
import { PoseChangerTab } from './components/PoseChangerTab';
import { UploadFile } from './types';
import { cropImageToTargetSize } from './utils/fileUtils';
import { replaceShoesInImage, changeImagePose, generatePosePrompts, ClothingColorSettings } from './services/geminiService';
import { Loader } from './components/Loader';


type ActiveTab = 'content' | 'pose';
type AppStep = 'upload' | 'generating' | 'results' | 'error';

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


const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('content');

  // State for ContentGenerator
  const [sourceImages, setSourceImages] = useState<UploadFile[]>([]);
  const [productImages, setProductImages] = useState<UploadFile[]>([]);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [contentStep, setContentStep] = useState<AppStep>('upload');
  const [contentError, setContentError] = useState<string | null>(null);
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isSingleShoe, setIsSingleShoe] = useState(false);

  // State for PoseChangerTab
  const [poseSourceFile, setPoseSourceFile] = useState<UploadFile | null>(null);
  const [poseBaseImageUrl, setPoseBaseImageUrl] = useState<string | null>(null);
  const [poseGeneratedImages, setPoseGeneratedImages] = useState<string[]>([]);
  const [isChangingPose, setIsChangingPose] = useState(false);
  const [isGeneratingRandomPoses, setIsGeneratingRandomPoses] = useState(false);
  const [poseError, setPoseError] = useState<string | null>(null);
  const [poses, setPoses] = useState(initialPoses);


  // Handlers for ContentGenerator
  const handleSourceImagesChange = async (files: UploadFile[]) => {
    setIsGeneratingContent(true); // Use loader while cropping
    try {
        const croppedFiles = await Promise.all(files.map(f => cropImageToTargetSize(f.file)));
        setSourceImages(croppedFiles);
    } catch(e) {
        setContentError("이미지를 자르는 중 오류가 발생했습니다.");
    } finally {
        setIsGeneratingContent(false);
    }
  };

  const handleGenerateContent = useCallback(async (colorSettings: ClothingColorSettings) => {
    if (sourceImages.length === 0 || productImages.length === 0) {
      setContentError('교체할 사진과 제품 사진을 하나 이상 업로드해주세요.');
      setContentStep('error');
      return;
    }
    setIsGeneratingContent(true);
    setContentStep('generating');
    setContentError(null);

    try {
      const generationPromises = sourceImages.map(sourceImage =>
        replaceShoesInImage(sourceImage, productImages, isSingleShoe, colorSettings)
      );
      
      const settledResults = await Promise.allSettled(generationPromises);
      
      const successfulResults = settledResults
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<string>).value);
        
      const failedCount = settledResults.length - successfulResults.length;

      if (successfulResults.length === 0) {
          const firstError = settledResults[0].status === 'rejected' ? (settledResults[0] as PromiseRejectedResult).reason : '알 수 없는 오류';
          const errorMessage = firstError instanceof Error ? firstError.message : String(firstError);
          throw new Error(`모든 이미지 생성에 실패했습니다. (${errorMessage})`);
      }

      setGeneratedImages(successfulResults);

      if (failedCount > 0) {
          const firstErrorReason = settledResults.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
          let reasonText = 'API 오류 또는 안전 설정';
          if(firstErrorReason) {
            const reason = firstErrorReason.reason;
            reasonText = reason instanceof Error ? reason.message : String(reason);
          }
          setContentError(`${sourceImages.length}개 중 ${failedCount}개 이미지 생성에 실패했습니다. 원인: ${reasonText}`);
      }

      setContentStep('results');
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : '이미지 생성 중 알 수 없는 오류가 발생했습니다.';
      setContentError(`생성에 실패했습니다. ${errorMessage}. 자세한 내용은 콘솔을 확인하고 다시 시도해주세요.`);
      setContentStep('error');
    } finally {
      setIsGeneratingContent(false);
    }
  }, [sourceImages, productImages, isSingleShoe]);

  const handleContentReset = () => {
    setSourceImages([]);
    setProductImages([]);
    setGeneratedImages([]);
    setContentError(null);
    setContentStep('upload');
    setIsSingleShoe(false);
  };

  const handleContentImageAdd = (index: number, newImageUrl: string) => {
    setGeneratedImages(prevImages => {
      const newImages = [...prevImages];
      newImages.splice(index + 1, 0, newImageUrl);
      return newImages;
    });
  };

  // Handlers for PoseChangerTab
  const handlePoseFileChange = useCallback(async (files: UploadFile[]) => {
    const file = files[0] || null;
    if (file) {
      setIsChangingPose(true);
      setPoseError(null);
      try {
        const croppedFile = await cropImageToTargetSize(file.file);
        setPoseSourceFile(croppedFile);
        setPoseBaseImageUrl(croppedFile.previewUrl);
        setPoseGeneratedImages([]);
        setPoses(initialPoses);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : '이미지를 로드하고 자르는 중 오류가 발생했습니다.';
        setPoseError(errorMessage);
        setPoseBaseImageUrl(null);
        setPoseSourceFile(null);
      } finally {
        setIsChangingPose(false);
      }
    } else {
      setPoseSourceFile(null);
      setPoseBaseImageUrl(null);
    }
  }, []);

  const handlePoseSelect = async (posePrompt: string) => {
    if (!poseBaseImageUrl || isChangingPose || isGeneratingRandomPoses || !poseSourceFile) return;

    setIsChangingPose(true);
    setPoseError(null);
    try {
      const newImage = await changeImagePose(poseSourceFile, posePrompt);
      setPoseGeneratedImages(prev => [...prev, newImage]);
    } catch (e) {
      console.error("Failed to change pose:", e);
      const errorMessage = e instanceof Error ? e.message : '자세 변경 중 오류가 발생했습니다.';
      setPoseError(errorMessage);
    } finally {
      setIsChangingPose(false);
    }
  };

  const handleGenerateRandomPoses = async () => {
    if (!poseBaseImageUrl || isChangingPose || isGeneratingRandomPoses || !poseSourceFile) return;

    setIsGeneratingRandomPoses(true);
    setPoseError(null);
    const existingPrompts = poses.map(p => p.prompt);
    try {
      const newPoses = await generatePosePrompts(existingPrompts);
      setPoses(prevPoses => [...prevPoses, ...newPoses]);
      
      const newPosePrompts = newPoses.map(p => p.prompt);
      const generationPromises = newPosePrompts.map(prompt => changeImagePose(poseSourceFile, prompt));
      const newImages = await Promise.all(generationPromises);

      setPoseGeneratedImages(prev => [...prev, ...newImages]);
      
    } catch (e) {
      console.error("Failed to generate random poses:", e);
      const errorMessage = e instanceof Error ? e.message : '랜덤 포즈 생성 중 오류가 발생했습니다.';
      setPoseError(errorMessage);
    } finally {
      setIsGeneratingRandomPoses(false);
    }
  };

  const handlePoseReset = () => {
    setPoseSourceFile(null);
    setPoseBaseImageUrl(null);
    setPoseGeneratedImages([]);
    setIsChangingPose(false);
    setIsGeneratingRandomPoses(false);
    setPoseError(null);
    setPoses(initialPoses);
  };


  const tabStyles = {
    inactive: "text-gray-500 hover:text-gray-300",
    active: "text-white border-b-2 border-indigo-500"
  };

  const isGlobalLoading = isGeneratingContent;

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden">
      {isGlobalLoading && <Loader />}
      <Header />
      
      {/* Tab Navigation moved inside a thin bar below header */}
      <div className="bg-[#0f1115] border-b border-gray-800 px-6">
         <nav className="flex space-x-6">
            <button
              onClick={() => setActiveTab('content')}
              className={`py-3 text-sm font-medium transition-colors ${activeTab === 'content' ? tabStyles.active : tabStyles.inactive}`}
            >
              스튜디오 모드 (Studio)
            </button>
            <button
              onClick={() => setActiveTab('pose')}
              className={`py-3 text-sm font-medium transition-colors ${activeTab === 'pose' ? tabStyles.active : tabStyles.inactive}`}
            >
              단독 포즈 변경 (Pose Only)
            </button>
         </nav>
      </div>

      <main className="flex-1 relative overflow-hidden">
        {activeTab === 'content' && (
          <ContentGenerator
            sourceImages={sourceImages}
            productImages={productImages}
            generatedImages={generatedImages}
            step={contentStep}
            error={contentError}
            isSingleShoe={isSingleShoe}
            onSourceImagesChange={handleSourceImagesChange}
            onProductImagesChange={setProductImages}
            onGenerate={handleGenerateContent}
            onReset={handleContentReset}
            onImageAdd={handleContentImageAdd}
            onIsSingleShoeChange={setIsSingleShoe}
          />
        )}
        {activeTab === 'pose' && (
           <div className="container mx-auto px-4 py-8 overflow-y-auto h-full">
            <PoseChangerTab
                sourceFile={poseSourceFile}
                baseImageUrl={poseBaseImageUrl}
                generatedImages={poseGeneratedImages}
                isLoading={isChangingPose}
                isGeneratingRandom={isGeneratingRandomPoses}
                error={poseError}
                poses={poses}
                onFilesChange={handlePoseFileChange}
                onPoseSelect={handlePoseSelect}
                onGenerateRandom={handleGenerateRandomPoses}
                onReset={handlePoseReset}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;