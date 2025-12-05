/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import StartScreen from './components/StartScreen';
import LoadingOverlay from './components/LoadingOverlay';
import Header from './components/Header';
import Footer from './components/Footer';
import { PreviewPanel, PREDEFINED_POSES, PREDEFINED_CLOSEUP_POSES } from './components/PreviewPanel';
import AdjustmentPanel from './components/AdjustmentPanel';
import InstructionsModal from './components/InstructionsModal';
import ChangelogModal from './components/ChangelogModal';
import { generateTextContentOnly, regenerateModelImages, regenerateSingleModelImage, generateConceptShot, generateAdditionalModelImage, generateFinalConceptShot, generateAdditionalCloseupImage, generateStudioWornCloseupShot, regenerateSingleCloseupImage, regenerateImageWithSpecificPose, populateTemplate, enhanceProductImageWithPreset, regenerateShoesOnly, changeModelFace, LAYOUT_TEMPLATE_HTML, generateStudioImageSet, regenerateStudioImageWithSpecificPose, generateInitialOriginalSet, regenerateSingleStudioModelShot, regenerateSingleStudioCloseupShot } from './services/geminiService';
import { getFriendlyErrorMessage, fileToDataUrl, parseImportedHtml, resizeImage } from './lib/utils';
import { DownloadIcon, SparklesIcon, FileCodeIcon } from './components/icons';
import { toPng, toJpeg } from 'html-to-image';
import Spinner from './components/Spinner';


export interface ImageAsset {
    url: string;
    generatingParams: {
        pose: string; // e.g., the prompt used
        // future params like filter could be added here
    };
}

// Type definitions moved here to be accessible by other components
export interface FontSizes {
  title: string;
  descriptionPara1: string;
  descriptionPara2: string;
  table: string;
  heroBrandName: string;
  slogan: string;
  heroDescriptionAndTags: string;
}

export interface FontStyles {
  title: string;
  description: string;
  heroBrand: string;
  heroMain: string;
  specTable: string;
}

export interface TextContent {
  title: string;
  descriptionPara1: string;
  descriptionPara2: string;
}

export interface HeroTextContent {
  brandName: string;
  slogan: string;
  descriptionAndTags: string;
}

export interface HeroTextColors {
  brandName: string;
  slogan: string;
  descriptionAndTags: string;
}


export interface SpecContent {
  sizeGuide: string;
  productName: string;
  color: string;
  upper: string;
  lining: string;
  insole: string;
  outsole: string;
  totalHeelHeight: string;
  components: string;
  countryOfOrigin: string;
  productionInfo: string;
}

export interface NoticeContent {
  para1: string;
  para2: string;
}

export interface FilterSettings {
    preset: string;
    contrast: number;
    saturation: number;
    grain: number;
}
export interface CollageBlock {
  id: string;
  layout: '2x1' | '2x2';
  images: ImageAsset[];
  section?: 'model' | 'closeup';
}

export interface GeneratedData {
  textContent: TextContent;
  specContent: SpecContent;
  heroTextContent: HeroTextContent;
  noticeContent: NoticeContent;
  imageUrls: {
    products: string[];
    modelShots: ImageAsset[];
    closeupShots: ImageAsset[];
    conceptShot: string;
    studioWornCloseup: string;
    finalConceptShot: string;
  };
  collageBlocks: CollageBlock[];
  layoutHtml: string;
  modelFiles: File[];
  productFiles: File[];
  originalProductFiles: File[];
  enhancedProductImageIndexes: number[];
  isHeroSectionVisible?: boolean;
  isStudioWornCloseupVisible?: boolean;
  isFinalConceptShotVisible?: boolean;
}

const DEFAULT_INSTRUCTIONS = `// AI에게 전달할 특별 지침입니다.

항상 다음 규칙을 따라주세요:
* 제품 설명에 이모지를 절대 사용하지 마세요.
* 전문적인 톤을 유지하되, 친근한 느낌을 잃지 마세요.
* 모든 해시태그는 영어로 작성해주세요.`;

// Using 100% width/height in SVG to let CSS aspect-ratio control the size
// Updated to 1000x1333 (3:4 ratio)
const PLACEHOLDER_URL_STRING = "data:image/svg+xml,%3Csvg width='100%25' height='100%25' viewBox='0 0 1000 1333' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='%23f3f4f6'/%3E%3Crect width='calc(100%25 - 40px)' height='calc(100%25 - 40px)' x='20' y='20' fill='none' stroke='%23d1d5db' stroke-width='4' stroke-dasharray='24%2C12'/%3E%3C/svg%3E";
export const PLACEHOLDER_ASSET: ImageAsset = { url: PLACEHOLDER_URL_STRING, generatingParams: { pose: 'placeholder' } };


const validateFile = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        
        reader.onload = (e) => {
            if (e.target?.result) {
                img.onload = () => {
                    URL.revokeObjectURL(img.src); 
                    resolve();
                };
                img.onerror = () => {
                    URL.revokeObjectURL(img.src); 
                    reject(new Error(`'${file.name}' 파일을 열 수 없습니다. 파일이 손상되었거나 지원되지 않는 형식일 수 있습니다.`));
                };
                img.src = e.target.result as string;
            } else {
                 reject(new Error(`'${file.name}' 파일을 읽을 수 없습니다.`));
            }
        };
        
        reader.onerror = (e) => {
            reject(new Error(`'${file.name}' 파일을 읽는 중 오류가 발생했습니다.`));
        };
        
        reader.readAsDataURL(file);
    });
};

// Helper to ensure all images in a cloned element are fully loaded
const waitForImages = async (element: HTMLElement) => {
    const images = element.querySelectorAll('img');
    const promises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve; // Resolve even on error to prevent hanging
        });
    });
    return Promise.all(promises);
};


// --- Main App Component ---

const App: React.FC = () => {
  const [screen, setScreen] = useState<'start' | 'result'>('start');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("AI가 상세페이지를 만들고 있어요...");
  const [error, setError] = useState<string | null>(null);
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(null);
  const [sourceFiles, setSourceFiles] = useState<{ productFiles: File[], modelFiles: File[] } | null>(null);
  const [generationMode, setGenerationMode] = useState<'original' | 'studio' | 'frame' | null>(null);


  const [singleImageLoadingState, setSingleImageLoadingState] = useState<{ type: string; index: number } | null>(null);
  const [singlePoseLoadingState, setSinglePoseLoadingState] = useState<{ type: string; index: number } | null>(null);
  const [placeholderLoadingState, setPlaceholderLoadingState] = useState<{ type: string; index: number } | null>(null);
  const [shoeRegenLoadingState, setShoeRegenLoadingState] = useState<{ type: string; index: number } | null>(null);
  const [isConceptLoading, setIsConceptLoading] = useState(false);
  const [isStudioWornCloseupLoading, setIsStudioWornCloseupLoading] = useState(false);
  const [isFinalConceptLoading, setIsFinalConceptLoading] = useState(false);
  const [isAddingModelShot, setIsAddingModelShot] = useState(false);
  const [isAddingCloseupShot, setIsAddingCloseupShot] = useState(false);
  const [isBatchEnhancing, setIsBatchEnhancing] = useState(false);
  const [productEnhancementPreset, setProductEnhancementPreset] = useState<string>('off');
  const [singleProductEnhanceLoading, setSingleProductEnhanceLoading] = useState<number | null>(null);
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
  const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);
  
  // New state for face swapping
  const [newFaceFiles, setNewFaceFiles] = useState<File[]>([]);
  const [isFaceLearned, setIsFaceLearned] = useState(false);
  const [isFaceLearning, setIsFaceLearning] = useState(false);
  const [isFaceSwapping, setIsFaceSwapping] = useState(false);

  const [imageZoomLevels, setImageZoomLevels] = useState<{ [key: string]: number }>({});
  const [customInstructions, setCustomInstructions] = useState(DEFAULT_INSTRUCTIONS);
  
  useEffect(() => {
    const saved = localStorage.getItem('customInstructions');
    if (saved) {
      setCustomInstructions(saved);
    }
  }, []);
  
  const defaultHeroTextColors: HeroTextColors = {
    brandName: '#FFFFFF',
    slogan: '#FFFFFF',
    descriptionAndTags: '#FFFFFF',
  };

  const [heroTextColors, setHeroTextColors] = useState<HeroTextColors>(defaultHeroTextColors);
  
  const [fontSizes, setFontSizes] = useState<FontSizes>({
    title: '39',
    descriptionPara1: '23',
    descriptionPara2: '22',
    table: '23',
    heroBrandName: '48',
    slogan: '20',
    heroDescriptionAndTags: '16',
  });

  const [fontStyles, setFontStyles] = useState<FontStyles>({
    title: "'Montserrat', sans-serif",
    description: "'Noto Sans KR', sans-serif",
    heroBrand: "'Gaegu', cursive",
    heroMain: "'Montserrat', sans-serif",
    specTable: "'Noto Sans KR', sans-serif",
  });

  const [topFile, setTopFile] = useState<File | null>(null);
  const [pantsFile, setPantsFile] = useState<File | null>(null);
  const [topPreview, setTopPreview] = useState<string | null>(null);
  const [pantsPreview, setPantsPreview] = useState<string | null>(null);

  const [filterPreset, setFilterPreset] = useState<string>('off');

  const handleBackToStart = () => {
    setGeneratedData(null);
    setError(null);
    setSourceFiles(null);
    setGenerationMode(null);
    setScreen('start');
  };

  const handleGenerate = async (productFiles: File[], modelFiles: File[], mode: 'original' | 'studio' | 'frame') => {
      setGenerationMode(mode);
      setIsLoading(true);
      setError(null);
      
      const filesToValidate = mode === 'frame' ? productFiles : [...productFiles, ...modelFiles];
      if ( (mode === 'original' || mode === 'studio') && modelFiles.length === 0) {
          setError('모델 이미지는 필수입니다.');
          setIsLoading(false);
          return;
      }
       if (mode === 'frame' && productFiles.length === 0) {
          setError('제품 이미지는 필수입니다.');
          setIsLoading(false);
          return;
      }
      
      setLoadingMessage("파일 유효성 검사 중...");
      try {
          await Promise.all(filesToValidate.map(validateFile));
      } catch (e) {
          setIsLoading(false);
          if (e instanceof Error) {
              setError(e.message);
          } else {
              setError('파일을 확인하는 중 알 수 없는 오류가 발생했습니다.');
          }
          return;
      }

      setSourceFiles({ productFiles, modelFiles });
      
      try {
          let initialModelShots: ImageAsset[] = [];
          let initialCloseupShots: ImageAsset[] = [];
          const onProgress = (message: string) => setLoadingMessage(message);

          if (mode === 'studio') {
              setLoadingMessage("스튜디오 샷을 생성하는 중...");
              // Returns 6 images (3 full body + 3 closeups)
              const result = await generateStudioImageSet(productFiles, modelFiles, onProgress);
              initialModelShots = result.modelShots;
              initialCloseupShots = result.closeupShots;
          } else if (mode === 'original') {
              setLoadingMessage("원본 이미지를 변환하는 중...");
              // Returns 6 images (3 full body + 3 closeups)
              const result = await generateInitialOriginalSet(productFiles, modelFiles, onProgress);
              initialModelShots = result.modelShots;
              initialCloseupShots = result.closeupShots;
          } else { // frame mode
              setLoadingMessage("AI가 상세페이지 프레임을 만들고 있어요...");
              const textPromise = generateTextContentOnly(productFiles, customInstructions);
              const productUrlsPromise = Promise.all(productFiles.map(fileToDataUrl));
              
              const [textData, productImageUrls] = await Promise.all([textPromise, productUrlsPromise]);
              
              setGeneratedData({
                  textContent: textData.textContent,
                  specContent: textData.specContent,
                  heroTextContent: textData.heroTextContent,
                  noticeContent: textData.noticeContent,
                  imageUrls: {
                      products: productImageUrls,
                      modelShots: [PLACEHOLDER_ASSET],
                      closeupShots: [PLACEHOLDER_ASSET],
                      conceptShot: PLACEHOLDER_URL_STRING,
                      studioWornCloseup: PLACEHOLDER_URL_STRING,
                      finalConceptShot: PLACEHOLDER_URL_STRING,
                  },
                  collageBlocks: [],
                  layoutHtml: LAYOUT_TEMPLATE_HTML,
                  modelFiles: modelFiles,
                  productFiles,
                  originalProductFiles: [...productFiles],
                  enhancedProductImageIndexes: [],
                  isHeroSectionVisible: true,
                  isStudioWornCloseupVisible: true,
                  isFinalConceptShotVisible: true,
              });
              setScreen('result');
              setIsLoading(false);
              return;
          }

          setLoadingMessage("페이지 콘텐츠를 생성하는 중...");
          const textPromise = generateTextContentOnly(productFiles, customInstructions);
          const productUrlsPromise = Promise.all(productFiles.map(fileToDataUrl));

          const [
              textData,
              productImageUrls,
          ] = await Promise.all([
              textPromise,
              productUrlsPromise,
          ]);
          
          setGeneratedData({
              textContent: textData.textContent,
              specContent: textData.specContent,
              heroTextContent: textData.heroTextContent,
              noticeContent: textData.noticeContent,
              imageUrls: {
                  products: productImageUrls,
                  modelShots: initialModelShots,
                  closeupShots: initialCloseupShots,
                  conceptShot: PLACEHOLDER_URL_STRING,
                  studioWornCloseup: PLACEHOLDER_URL_STRING,
                  finalConceptShot: PLACEHOLDER_URL_STRING,
              },
              collageBlocks: [],
              layoutHtml: LAYOUT_TEMPLATE_HTML,
              modelFiles,
              productFiles,
              originalProductFiles: [...productFiles],
              enhancedProductImageIndexes: [],
              isHeroSectionVisible: true,
              isStudioWornCloseupVisible: true,
              isFinalConceptShotVisible: true,
          });
          setScreen('result');

      } catch (e) {
           const friendlyError = getFriendlyErrorMessage(e, '페이지 생성에 실패했습니다.');
           setError(friendlyError);
           setScreen('start');
      } finally {
           setIsLoading(false);
      }
  };
  
  const handleRegenerateModelImagesWithOptions = async () => {
    if (!generatedData || !generatedData.modelFiles || !generatedData.productFiles) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const onProgress = (message: string) => setLoadingMessage(message);

      if (generationMode === 'studio') {
          const { modelShots, closeupShots } = await generateStudioImageSet(
              generatedData.productFiles,
              generatedData.modelFiles,
              onProgress,
              topFile,
              pantsFile
          );
          setGeneratedData(prevData => {
            if (!prevData) return null;
            return {
              ...prevData,
              imageUrls: { 
                  ...prevData.imageUrls, 
                  modelShots: modelShots,
                  closeupShots: closeupShots,
                  conceptShot: PLACEHOLDER_URL_STRING,
                  studioWornCloseup: PLACEHOLDER_URL_STRING,
                  finalConceptShot: PLACEHOLDER_URL_STRING,
                }
            };
          });

      } else { // Original mode
          const { newModelShots, newCloseupShots } = await regenerateModelImages(
              generatedData.productFiles,
              generatedData.modelFiles,
              onProgress
          );
          
          setGeneratedData(prevData => {
            if (!prevData) return null;
            return {
              ...prevData,
              imageUrls: { 
                  ...prevData.imageUrls, 
                  modelShots: newModelShots,
                  closeupShots: newCloseupShots,
                }
            };
          });
      }

    } catch (e) {
      alert(getFriendlyErrorMessage(e, '이미지 재생성에 실패했습니다'));
    } finally {
      setIsLoading(false);
      setLoadingMessage("AI가 상세페이지를 만들고 있어요...");
    }
  };

  const handleRegenerateSingleModelImage = async (type: 'modelShots' | 'closeupShots', index: number) => {
    if (!generatedData || !generatedData.modelFiles || !generatedData.productFiles) return;
        
    setSingleImageLoadingState({ type, index });
    
    try {
        let newAsset: ImageAsset;
        if (generationMode === 'studio') {
             if (type === 'modelShots') {
                newAsset = await regenerateSingleStudioModelShot(generatedData.productFiles, generatedData.modelFiles);
            } else { // closeupShots
                const baseModelAsset = generatedData.imageUrls.modelShots[0];
                if (!baseModelAsset) throw new Error("A base model shot is required to regenerate a studio closeup.");
                newAsset = await regenerateSingleStudioCloseupShot(baseModelAsset.url);
            }
        } else {
            if (type === 'modelShots') {
                newAsset = await regenerateSingleModelImage(generatedData.productFiles, generatedData.modelFiles);
            } else {
                const baseModelAsset = generatedData.imageUrls.modelShots[0];
                if (!baseModelAsset) throw new Error("A base model shot is required to regenerate a closeup.");
                newAsset = await regenerateSingleCloseupImage(baseModelAsset.url);
            }
        }
        
        if (newAsset) {
            setGeneratedData(prevData => {
                if (!prevData) return null;
                const newImageUrls = { ...prevData.imageUrls };
                const targetArray = [...newImageUrls[type]];
                if (index < targetArray.length) {
                    targetArray[index] = newAsset;
                }
                newImageUrls[type] = targetArray;
                return { ...prevData, imageUrls: newImageUrls };
            });
        }
    } catch(e) {
        alert(getFriendlyErrorMessage(e, '모델 원본 복원에 실패했습니다'));
    } finally {
        setSingleImageLoadingState(null);
    }
  };

  const handleRegenerateImageWithSpecificPose = async (type: 'modelShots' | 'closeupShots', index: number, pose: string) => {
    if (!generatedData || !generatedData.modelFiles || !generatedData.productFiles) return;
    
    const baseAsset = generatedData.imageUrls[type][index];
    if (!baseAsset) return;

    setSinglePoseLoadingState({ type, index });
    
    let finalPose = pose;

    if (pose === 'random') {
        const poseSet = type === 'modelShots' ? PREDEFINED_POSES : PREDEFINED_CLOSEUP_POSES;
        finalPose = poseSet[Math.floor(Math.random() * poseSet.length)].prompt;
    }

    try {
        const regenFn = generationMode === 'studio' ? regenerateStudioImageWithSpecificPose : regenerateImageWithSpecificPose;
        const newAsset = await regenFn(baseAsset.url, finalPose);

        if (newAsset) {
            setGeneratedData(prevData => {
                if (!prevData) return null;
                const newImageUrls = { ...prevData.imageUrls };
                const targetArray = [...newImageUrls[type]];
                if (index < targetArray.length) {
                    targetArray[index] = newAsset;
                }
                newImageUrls[type] = targetArray;
                return { ...prevData, imageUrls: newImageUrls };
            });
        }
    } catch(e) {
        alert(getFriendlyErrorMessage(e, '선택한 포즈로 변경하는 데 실패했습니다'));
    } finally {
        setSinglePoseLoadingState(null);
    }
  };

  const handleRegenerateShoesOnly = async (type: 'modelShots' | 'closeupShots', index: number) => {
    if (!generatedData) return;
    setShoeRegenLoadingState({ type, index });
    try {
        const baseAsset = generatedData.imageUrls[type][index];
        const newUrl = await regenerateShoesOnly(baseAsset.url, generatedData.productFiles);

        if (newUrl) {
            setGeneratedData(prevData => {
                if (!prevData) return null;
                const newImageUrls = { ...prevData.imageUrls };
                const targetArray = [...newImageUrls[type]];
                if (index < targetArray.length) {
                    targetArray[index] = { 
                        url: newUrl, 
                        generatingParams: { pose: `swapped_from_${baseAsset.generatingParams.pose}` } 
                    };
                }
                newImageUrls[type] = targetArray;
                return { ...prevData, imageUrls: newImageUrls };
            });
        }
    } catch (e) {
      alert(getFriendlyErrorMessage(e, '신발 재생성에 실패했습니다'));
    } finally {
        setShoeRegenLoadingState(null);
    }
  };
  
  const handleNewFaceFilesChange = (files: File[]) => {
    setNewFaceFiles(files);
    setIsFaceLearned(false); 
  };

  const handleLearnFace = async () => {
    setIsFaceLearning(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsFaceLearned(true);
    setIsFaceLearning(false);
  };
  
  const handleChangeFace = async () => {
    if (!generatedData || newFaceFiles.length === 0 || !isFaceLearned) return;

    setLoadingMessage("모델 컷의 얼굴을 변경하고 있어요...");
    setIsFaceSwapping(true);
    setError(null);
    try {
        const originalModelAssets = generatedData.imageUrls.modelShots;
        const { newModelShots } = await changeModelFace(
            originalModelAssets.map(asset => asset.url),
            newFaceFiles
        );
        
        const newModelAssets = originalModelAssets.map((asset, index) => ({
            ...asset,
            url: newModelShots[index] || asset.url, 
        }));

        setGeneratedData(prevData => {
            if (!prevData) return null;
            return {
                ...prevData,
                imageUrls: {
                    ...prevData.imageUrls,
                    modelShots: newModelAssets,
                }
            };
        });
    } catch (e) {
      alert(getFriendlyErrorMessage(e, '얼굴 변경에 실패했습니다'));
    } finally {
      setIsFaceSwapping(false);
    }
  };

  const handleRegenerateConceptShot = async () => {
    if (!generatedData || !generatedData.productFiles || !generatedData.modelFiles) return;

    setIsConceptLoading(true);
    setError(null);
    try {
      const newConceptUrl = await generateConceptShot(
        generatedData.productFiles,
        generatedData.modelFiles,
        generatedData.textContent.title
      );
      setGeneratedData(prevData => {
        if (!prevData) return null;
        return {
          ...prevData,
          imageUrls: { ...prevData.imageUrls, conceptShot: newConceptUrl }
        };
      });
    } catch (e) {
      alert(getFriendlyErrorMessage(e, '컨셉샷 이미지 재생성에 실패했습니다'));
    } finally {
      setIsConceptLoading(false);
    }
  };

  const handleRegenerateStudioWornCloseupShot = async () => {
    if (!generatedData || !generatedData.productFiles || !generatedData.modelFiles) return;

    setIsStudioWornCloseupLoading(true);
    setError(null);
    try {
      const newCloseupUrl = await generateStudioWornCloseupShot(
        generatedData.productFiles,
        generatedData.modelFiles
      );
      setGeneratedData(prevData => {
        if (!prevData) return null;
        return {
          ...prevData,
          imageUrls: { ...prevData.imageUrls, studioWornCloseup: newCloseupUrl }
        };
      });
    } catch (e) {
      alert(getFriendlyErrorMessage(e, '스튜디오 클로즈업샷 재생성에 실패했습니다'));
    } finally {
      setIsStudioWornCloseupLoading(false);
    }
  };
  
  const handleRegenerateFinalConceptShot = async () => {
    if (!generatedData || !generatedData.productFiles || !generatedData.modelFiles) return;

    setIsFinalConceptLoading(true);
    setError(null);
    try {
      const newConceptUrl = await generateFinalConceptShot(
        generatedData.productFiles,
        generatedData.modelFiles
      );
      setGeneratedData(prevData => {
        if (!prevData) return null;
        return {
          ...prevData,
          imageUrls: { ...prevData.imageUrls, finalConceptShot: newConceptUrl }
        };
      });
    } catch (e) {
      alert(getFriendlyErrorMessage(e, '마지막 컨셉샷 재생성에 실패했습니다'));
    } finally {
      setIsFinalConceptLoading(false);
    }
  };


  const handleDeleteImage = (type: 'modelShots' | 'closeupShots', index: number) => {
    setGeneratedData(prevData => {
        try {
            if (!prevData) {
                console.error("handleDeleteImage: Aborting due to no previous state.");
                return prevData;
            }

            if (!prevData.imageUrls?.[type] || !Array.isArray(prevData.imageUrls[type])) {
                console.error(`handleDeleteImage: Aborting due to invalid image array at path: imageUrls.${type}`);
                return prevData;
            }

            const targetArray = prevData.imageUrls[type];

            if (index < 0 || index >= targetArray.length) {
                console.warn(`handleDeleteImage: Attempted to delete out-of-bounds index ${index} for ${type}.`);
                return prevData;
            }

            // FIX: If it's the last image, replace with placeholder instead of removing.
            // This preserves the layout and "Add Image" button context.
            if (targetArray.length <= 1) {
                const newArray = [PLACEHOLDER_ASSET];
                 return {
                    ...prevData,
                    imageUrls: {
                        ...prevData.imageUrls,
                        [type]: newArray,
                    },
                };
            }

            const newArray = targetArray.filter((_, i) => i !== index);

            return {
                ...prevData,
                imageUrls: {
                    ...prevData.imageUrls,
                    [type]: newArray,
                },
            };
        } catch (e) {
            console.error("CRITICAL ERROR in handleDeleteImage. Reverting to prevent data loss.", e);
            return prevData;
        }
    });
  };

  const handleDeleteProductImage = (index: number) => {
    setGeneratedData(prevData => {
        try {
            if (!prevData) {
                 console.error("handleDeleteProductImage: Aborting due to no previous state.");
                return prevData;
            }

            if (
                !prevData.imageUrls?.products || !Array.isArray(prevData.imageUrls.products) ||
                !prevData.productFiles || !Array.isArray(prevData.productFiles) ||
                !prevData.originalProductFiles || !Array.isArray(prevData.originalProductFiles)
            ) {
                console.error("handleDeleteProductImage: Aborting due to invalid previous state structure.");
                return prevData;
            }

            const productsArray = prevData.imageUrls.products;
            if (index < 0 || index >= productsArray.length) {
                console.warn(`handleDeleteProductImage: Attempted to delete out-of-bounds index ${index}.`);
                return prevData;
            }
            
            if (productsArray.length <= 1) {
                alert('최소 1개의 제품 이미지는 유지해야 합니다.');
                return prevData;
            }

            const newProductUrls = prevData.imageUrls.products.filter((_, i) => i !== index);
            const newProductFiles = prevData.productFiles.filter((_, i) => i !== index);
            const newOriginalProductFiles = prevData.originalProductFiles.filter((_, i) => i !== index);
            
            return {
                ...prevData,
                imageUrls: {
                    ...prevData.imageUrls,
                    products: newProductUrls,
                },
                productFiles: newProductFiles,
                originalProductFiles: newOriginalProductFiles,
            };
        } catch (e) {
            console.error("CRITICAL ERROR in handleDeleteProductImage. Reverting to prevent data loss.", e);
            return prevData;
        }
    });
  };


  const handleDeleteFinalConceptShot = () => {
      if (!generatedData) return;
      const placeholderUrl = "data:image/svg+xml,%3Csvg width='1000' height='1333' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='%23ffffff' stroke='%23dddddd' stroke-width='2' stroke-dasharray='20%2C10'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='48' fill='%23cccccc' dominant-baseline='middle' text-anchor='middle'%3E%EC%9D%B4%EB%AF%B8%EC%A7%80%20%EC%82%AD%EC%A0%9C%EB%90%A8%3C/text%3E%3C/svg%3E";

      setGeneratedData(prevData => {
          if (!prevData) return null;
          return { 
            ...prevData, 
            imageUrls: { ...prevData.imageUrls, finalConceptShot: placeholderUrl } 
          };
      });
  };

  const handleToggleHeroSectionVisibility = () => {
    setGeneratedData(prevData => {
      if (!prevData) return null;
      return {
        ...prevData,
        isHeroSectionVisible: !(prevData.isHeroSectionVisible ?? true),
      };
    });
  };

  const handleToggleStudioWornCloseupVisibility = () => {
    setGeneratedData(prevData => {
      if (!prevData) return null;
      return {
        ...prevData,
        isStudioWornCloseupVisible: !(prevData.isStudioWornCloseupVisible ?? true),
      };
    });
  };

  const handleToggleFinalConceptShotVisibility = () => {
    setGeneratedData(prevData => {
      if (!prevData) return null;
      return {
        ...prevData,
        isFinalConceptShotVisible: !(prevData.isFinalConceptShotVisible ?? true),
      };
    });
  };


  const handleAddModelImage = async () => {
    if (!generatedData || isAddingModelShot) return;

    setIsAddingModelShot(true);
    try {
        const lastShot = generatedData.imageUrls.modelShots.slice(-1)[0];
        if (!lastShot || lastShot.url === PLACEHOLDER_URL_STRING) {
            throw new Error("A valid base model shot is required to generate another one.");
        }

        const newAsset = await generateAdditionalModelImage(lastShot.url);
        
        setGeneratedData(prevData => {
            if (!prevData) return null;
            return {
                ...prevData,
                imageUrls: {
                    ...prevData.imageUrls,
                    modelShots: [...prevData.imageUrls.modelShots, newAsset],
                }
            };
        });
    } catch (e) {
        alert(getFriendlyErrorMessage(e, '새 모델 컷 추가에 실패했습니다.'));
    } finally {
        setIsAddingModelShot(false);
    }
  };
  
  const handleAddCloseupImage = async () => {
    if (!generatedData || isAddingCloseupShot) return;
    
    setIsAddingCloseupShot(true);
    try {
        const lastShot = generatedData.imageUrls.closeupShots.slice(-1)[0];
        if (!lastShot || lastShot.url === PLACEHOLDER_URL_STRING) {
            throw new Error("A valid base closeup shot is required to generate another one.");
        }

        const newAsset = await generateAdditionalCloseupImage(lastShot.url);

        setGeneratedData(prevData => {
            if (!prevData) return null;
            return {
                ...prevData,
                imageUrls: {
                    ...prevData.imageUrls,
                    closeupShots: [...prevData.imageUrls.closeupShots, newAsset],
                }
            };
        });
    } catch(e) {
        alert(getFriendlyErrorMessage(e, '새 클로즈업 컷 추가에 실패했습니다.'));
    } finally {
        setIsAddingCloseupShot(false);
    }
  };

  const handleAddProductImage = async (files: File[]) => {
    if (!generatedData || files.length === 0) return;
    
    setLoadingMessage(`이미지 최적화 중... (0/${files.length})`);
    setIsLoading(true);
    try {
        const resizedFiles = await Promise.all(files.map(async (file, index) => {
            setLoadingMessage(`이미지 최적화 중... (${index + 1}/${files.length})`);
            return await resizeImage(file, 1000); // 1000px width
        }));

        const newUrls = await Promise.all(resizedFiles.map(fileToDataUrl));

        setGeneratedData(prevData => {
            if (!prevData) return null;
            return {
                ...prevData,
                productFiles: [...prevData.productFiles, ...resizedFiles],
                originalProductFiles: [...prevData.originalProductFiles, ...resizedFiles], 
                imageUrls: {
                    ...prevData.imageUrls,
                    products: [...prevData.imageUrls.products, ...newUrls],
                }
            };
        });
    } catch(e) {
        alert(getFriendlyErrorMessage(e, "이미지 추가에 실패했습니다."));
    } finally {
        setIsLoading(false);
        setLoadingMessage("AI가 상세페이지를 만들고 있어요...");
    }
  };

  const handleModelFilesUpdate = (files: File[]) => {
    setGeneratedData(prev => {
        if (!prev) return null;
        return { ...prev, modelFiles: files };
    });
  };

  const handleGenerateForPlaceholder = async (type: 'modelShots' | 'closeupShots', index: number) => {
    if (!generatedData || !generatedData.productFiles) return;

    setPlaceholderLoadingState({ type, index });
    try {
        let newAsset: ImageAsset;
        const lastModelShot = [...generatedData.imageUrls.modelShots].reverse().find(shot => !shot.url.startsWith('data:image/svg+xml'));
        
        if (!lastModelShot) { // Frame mode, first generation
            if (!generatedData.modelFiles || generatedData.modelFiles.length === 0) {
                alert("모델 컷을 생성하려면 먼저 '콘텐츠 수정 > 모델 레퍼런스 이미지'에서 원본 모델 이미지를 업로드해주세요.");
                throw new Error("Model reference files are missing for frame mode generation.");
            }
            if (type === 'closeupShots') {
                 alert("모델 컷을 먼저 최소 1개 생성해야 클로즈업 컷을 만들 수 있습니다.");
                throw new Error("Cannot generate closeup shot without a base model shot.");
            }
            newAsset = await regenerateSingleModelImage(generatedData.productFiles, generatedData.modelFiles);
        } else { // Normal placeholder generation
            if (type === 'modelShots') {
                newAsset = await generateAdditionalModelImage(lastModelShot.url);
            } else { // closeupShots
                newAsset = await generateAdditionalCloseupImage(lastModelShot.url);
            }
        }


        setGeneratedData(prevData => {
            if (!prevData) return null;
            const newImageUrls = { ...prevData.imageUrls };
            const targetArray = [...newImageUrls[type]];
            if (index < targetArray.length) {
                targetArray[index] = newAsset;
            }
            newImageUrls[type] = targetArray;
            return { ...prevData, imageUrls: newImageUrls };
        });

    } catch (e) {
        if (e instanceof Error && e.message.includes("alert")) {
           console.error("Placeholder generation failed:", e);
        } else {
            alert(getFriendlyErrorMessage(e, '이미지 생성에 실패했습니다.'));
        }
        setGeneratedData(prevData => {
             if (!prevData) return null;
            const newImageUrls = { ...prevData.imageUrls };
            newImageUrls[type] = prevData.imageUrls[type].filter((_, i) => i !== index);
            return { ...prevData, imageUrls: newImageUrls };
        });
    } finally {
        setPlaceholderLoadingState(null);
    }
  };

  const handleAddCollageBlock = (layout: '2x1' | '2x2', section: 'model' | 'closeup') => {
    if (!generatedData) return;
    const imageCount = layout === '2x1' ? 2 : 4;
    const newBlock: CollageBlock = {
      id: `collage-${Date.now()}`,
      layout,
      images: Array(imageCount).fill(PLACEHOLDER_ASSET),
      section,
    };
    setGeneratedData(prev => prev ? { ...prev, collageBlocks: [...(prev.collageBlocks || []), newBlock] } : null);
  };

  const handleDeleteCollageBlock = (blockId: string) => {
    setGeneratedData(prev => {
      if (!prev || !prev.collageBlocks) return prev;
      return {
        ...prev,
        collageBlocks: prev.collageBlocks.filter(block => block.id !== blockId),
      };
    });
  };

  const handleReplaceCollageImage = async (blockId: string, imageIndex: number, file: File) => {
    if (!generatedData) return;
    const newUrl = await fileToDataUrl(file);
    setGeneratedData(prevData => {
      if (!prevData || !prevData.collageBlocks) return prevData;
      const newCollageBlocks = prevData.collageBlocks.map(block => {
        if (block.id === blockId) {
          const newImages = [...block.images];
          if (imageIndex < newImages.length) {
            newImages[imageIndex] = { url: newUrl, generatingParams: { pose: 'user_upload' } };
          }
          return { ...block, images: newImages };
        }
        return block;
      });
      return { ...prevData, collageBlocks: newCollageBlocks };
    });
  };
  
  const handleDeleteCollageImage = (blockId: string, imageIndex: number) => {
    setGeneratedData(prevData => {
      if (!prevData || !prevData.collageBlocks) return prevData;
      const newCollageBlocks = prevData.collageBlocks.map(block => {
        if (block.id === blockId) {
          const newImages = [...block.images];
          if (imageIndex < newImages.length) {
            newImages[imageIndex] = PLACEHOLDER_ASSET;
          }
          return { ...block, images: newImages };
        }
        return block;
      });
      return { ...prevData, collageBlocks: newCollageBlocks };
    });
  };
  
  const handleReorderCollageImage = (blockId: string, dragIndex: number, dropIndex: number) => {
    if (dragIndex === dropIndex) return;
    setGeneratedData(prevData => {
      if (!prevData || !prevData.collageBlocks) return prevData;
      const newCollageBlocks = prevData.collageBlocks.map(block => {
        if (block.id === blockId) {
          const newImages = [...block.images];
          const [draggedItem] = newImages.splice(dragIndex, 1);
          newImages.splice(dropIndex, 0, draggedItem);
          return { ...block, images: newImages };
        }
        return block;
      });
      return { ...prevData, collageBlocks: newCollageBlocks };
    });
  };

  const handleHeroTextContentUpdate = (newHeroTextContent: HeroTextContent) => {
    setGeneratedData(prevData => prevData ? { ...prevData, heroTextContent: newHeroTextContent } : null);
  };

  const handleFontSizesUpdate = (newFontSizes: FontSizes) => {
    setFontSizes(newFontSizes);
  };

  const handleFontStylesUpdate = (newFontStyles: FontStyles) => {
    setFontStyles(newFontStyles);
  };
  
  const handleHeroTextColorsUpdate = (newHeroTextColors: HeroTextColors) => {
    setHeroTextColors(newHeroTextColors);
  };

  const handleImageReplace = async (galleryType: keyof GeneratedData['imageUrls'], index: number, file: File) => {
    if (!generatedData) return;

    if (galleryType === 'products') {
        const resizedFile = await resizeImage(file, 1000); // 1000px width
        const newUrl = await fileToDataUrl(resizedFile);
        
        setGeneratedData(prevData => {
            if (!prevData) return null;
            const newImageUrls = { ...prevData.imageUrls };
            const newProductFiles = [...prevData.productFiles];
            const newOriginalProductFiles = [...prevData.originalProductFiles];

            const newUrlsArray = [...newImageUrls.products];
            if (index < newUrlsArray.length) newUrlsArray[index] = newUrl;
            if (index < newProductFiles.length) newProductFiles[index] = resizedFile;
            if (index < newOriginalProductFiles.length) newOriginalProductFiles[index] = resizedFile;

            return { 
                ...prevData, 
                imageUrls: { ...newImageUrls, products: newUrlsArray },
                productFiles: newProductFiles,
                originalProductFiles: newOriginalProductFiles
            };
        });
    } else {
        const newUrl = await fileToDataUrl(file);
        setGeneratedData(prevData => {
            if (!prevData) return null;
            const newImageUrls = { ...prevData.imageUrls };
            if (galleryType === 'modelShots' || galleryType === 'closeupShots') {
                const targetArray = [...newImageUrls[galleryType]];
                if (index < targetArray.length) {
                    targetArray[index] = { url: newUrl, generatingParams: { pose: 'user_upload' } };
                }
                newImageUrls[galleryType] = targetArray;
            } else if (galleryType === 'conceptShot' || galleryType === 'studioWornCloseup' || galleryType === 'finalConceptShot') {
                newImageUrls[galleryType] = newUrl;
            }
            return { ...prevData, imageUrls: newImageUrls };
        });
    }
  };

  const handleReorderSectionItem = (section: 'model' | 'closeup', index: number, direction: 'up' | 'down') => {
    setGeneratedData(prevData => {
      if (!prevData) return prevData;

      const singleShots = section === 'model' ? prevData.imageUrls.modelShots : prevData.imageUrls.closeupShots;
      const sectionCollages = prevData.collageBlocks.filter(b => b.section === section);

      const items: ({ type: 'single', data: ImageAsset } | { type: 'collage', data: CollageBlock })[] = [
          ...singleShots.map(asset => ({ type: 'single' as const, data: asset })),
          ...sectionCollages.map(block => ({ type: 'collage' as const, data: block }))
      ];

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= items.length) return prevData;

      const [movedItem] = items.splice(index, 1);
      items.splice(newIndex, 0, movedItem);

      const newSingleShots = items.filter(i => i.type === 'single').map(i => i.data as ImageAsset);
      const newSectionCollages = items.filter(i => i.type === 'collage').map(i => i.data as CollageBlock);
      const otherSectionCollages = prevData.collageBlocks.filter(b => b.section !== section);
      
      const newCollageBlocks = [...otherSectionCollages, ...newSectionCollages];
      
      const updatedData = { ...prevData };
      if (section === 'model') {
        updatedData.imageUrls = { ...prevData.imageUrls, modelShots: newSingleShots };
      } else {
        updatedData.imageUrls = { ...prevData.imageUrls, closeupShots: newSingleShots };
      }
      updatedData.collageBlocks = newCollageBlocks;
      
      return updatedData;
    });
  };
  
  const handleReorderProductImage = (dragIndex: number, dropIndex: number) => {
    if (dragIndex === dropIndex) return;
    setGeneratedData(prevData => {
      if (!prevData) return prevData;

      const products = [...prevData.imageUrls.products];
      const productFiles = [...prevData.productFiles];
      const originalProductFiles = [...prevData.originalProductFiles];
      
      if (dropIndex < 0 || dropIndex >= products.length) {
          return prevData;
      }

      const [movedProduct] = products.splice(dragIndex, 1);
      products.splice(dropIndex, 0, movedProduct);

      const [movedProductFile] = productFiles.splice(dragIndex, 1);
      productFiles.splice(dropIndex, 0, movedProductFile);
      
      const [movedOriginalProductFile] = originalProductFiles.splice(dragIndex, 1);
      originalProductFiles.splice(dropIndex, 0, movedOriginalProductFile);

      return {
        ...prevData,
        imageUrls: {
          ...prevData.imageUrls,
          products: products,
        },
        productFiles: productFiles,
        originalProductFiles: originalProductFiles,
      };
    });
  };

  const handleDuplicateImage = (type: 'modelShots' | 'closeupShots' | 'products', index: number) => {
    if (!generatedData) return;
    
    setGeneratedData(prevData => {
        if (!prevData) return null;
        
        if (type === 'products') {
            const productToCopy = prevData.imageUrls.products[index];
            const productFileToCopy = prevData.productFiles[index];
            const originalProductFileToCopy = prevData.originalProductFiles[index];

            if (!productToCopy || !productFileToCopy || !originalProductFileToCopy) return prevData;

            const newProducts = [...prevData.imageUrls.products];
            newProducts.splice(index + 1, 0, productToCopy);

            const newProductFiles = [...prevData.productFiles];
            newProductFiles.splice(index + 1, 0, productFileToCopy);
            
            const newOriginalProductFiles = [...prevData.originalProductFiles];
            newOriginalProductFiles.splice(index + 1, 0, originalProductFileToCopy);

            return {
                ...prevData,
                imageUrls: {
                    ...prevData.imageUrls,
                    products: newProducts,
                },
                productFiles: newProductFiles,
                originalProductFiles: newOriginalProductFiles,
            };
        } else { // modelShots or closeupShots
            const assetToCopy = prevData.imageUrls[type][index];
            if (!assetToCopy || assetToCopy.url === PLACEHOLDER_URL_STRING) return prevData;

            const gallery = [...prevData.imageUrls[type]];
            // FIX: Add (Copy) and timestamp to pose to ensure unique key and trigger re-render
            const newAsset = { 
                ...assetToCopy,
                generatingParams: {
                    ...assetToCopy.generatingParams,
                    pose: `${assetToCopy.generatingParams.pose} (Copy ${Date.now()})`
                }
            };
            gallery.splice(index + 1, 0, newAsset);

            return {
                ...prevData,
                imageUrls: {
                    ...prevData.imageUrls,
                    [type]: gallery,
                }
            };
        }
    });
};

  const handleImageZoom = (key: string, direction: 'in' | 'out') => {
      setImageZoomLevels(prev => {
          const currentZoom = prev[key] || 1.0;
          let newZoom;
          const step = 0.1;
          if (direction === 'in') {
              newZoom = Math.min(3.0, currentZoom + step); // Max zoom 300%
          } else {
              newZoom = Math.max(0.2, currentZoom - step); // Min zoom 20%
          }
          newZoom = Math.round(newZoom * 100) / 100;
          return { ...prev, [key]: newZoom };
      });
  };

   const handleDownloadSingleImage = (type: 'modelShots' | 'closeupShots' | 'products' | 'conceptShot' | 'studioWornCloseup' | 'finalConceptShot', index: number) => {
        if (!generatedData) return;
        
        let url: string;
        if (type === 'modelShots' || type === 'closeupShots') {
            const asset = generatedData.imageUrls[type][index];
            url = asset.url;
        } else if (type === 'products') {
            url = generatedData.imageUrls.products[index];
        } else {
            url = generatedData.imageUrls[type];
        }

        try {
            const link = document.createElement('a');
            link.href = url;
            link.download = `generated_image_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Error downloading image:', error);
            alert('이미지를 다운로드하는 데 실패했습니다.');
        }
    };

    const handleDownloadHtml = () => {
        if (!generatedData) return;
        try {
            const elementToCapture = document.getElementById('preview-content-wrapper');
            if (!elementToCapture) throw new Error("Preview element not found");
            
            const fullHtml = populateTemplate(
                generatedData.textContent,
                generatedData.specContent,
                generatedData.heroTextContent,
                generatedData.noticeContent,
                generatedData.imageUrls,
                fontSizes,
                fontStyles,
                generatedData.layoutHtml,
                heroTextColors,
                generatedData.collageBlocks,
                true, // forExport
                generatedData.isHeroSectionVisible ?? true,
                generatedData.isStudioWornCloseupVisible ?? true,
                generatedData.isFinalConceptShotVisible ?? true,
                imageZoomLevels
            );

            const blob = new Blob([fullHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'product_detail_page.html';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (e) {
            alert('HTML 저장에 실패했습니다.');
        }
    };

  const handleDownload = async () => {
    const elementToCapture = document.getElementById('capture-target');
    if (!elementToCapture) return;

    setIsLoading(true);
    setLoadingMessage("이미지 파일 생성 중... (잠시만 기다려주세요)");

    try {
        // Create a dedicated container for capture to isolate from main layout
        const container = document.createElement('div');
        // Use absolute positioning to ensure it renders fully in the DOM flow before capture
        // IMPORTANT: Must be in DOM to load images
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '1000px'; 
        container.style.zIndex = '-9999';
        // Ensure container allows content to dictate height
        container.style.height = 'auto';
        container.style.overflow = 'hidden'; 
        document.body.appendChild(container);

        const clone = elementToCapture.cloneNode(true) as HTMLElement;
        
        // Reset styles on clone to ensure it expands fully
        clone.style.transform = 'none';
        clone.style.boxShadow = 'none';
        clone.style.margin = '0';
        clone.style.padding = '0';
        clone.style.width = '1000px';
        clone.style.height = 'auto';
        clone.style.minHeight = 'auto';
        clone.style.maxHeight = 'none';
        clone.style.overflow = 'visible';
        
        container.appendChild(clone);

        // Crucial: Wait for images inside the clone to load
        await waitForImages(clone);

        // Extra buffer time for rendering
        await new Promise(resolve => setTimeout(resolve, 800));

        const height = clone.offsetHeight; // Use offsetHeight of the visible clone

        const dataUrl = await toPng(clone, {
            quality: 1,
            backgroundColor: '#ffffff',
            cacheBust: true,
            width: 1000,
            height: height,
            style: {
                height: 'auto',
                maxHeight: 'none',
                overflow: 'visible'
            },
            pixelRatio: 2,
        });

        document.body.removeChild(container);

        const link = document.createElement('a');
        link.download = `product-page-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
    } catch (err) {
        console.error('Could not download image', err);
        alert('이미지를 다운로드하는 데 실패했습니다. 다시 시도해주세요.');
    } finally {
        setIsLoading(false);
        setLoadingMessage("AI가 상세페이지를 만들고 있어요...");
    }
  };
  
  const handleDownloadJpg = async () => {
    const elementToCapture = document.getElementById('capture-target');
    if (!elementToCapture) return;

    setIsLoading(true);
    setLoadingMessage("JPG 파일 생성 중... (잠시만 기다려주세요)");

    try {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '1000px';
        container.style.zIndex = '-9999';
        container.style.height = 'auto';
        container.style.overflow = 'hidden';
        document.body.appendChild(container);

        const clone = elementToCapture.cloneNode(true) as HTMLElement;

        clone.style.transform = 'none';
        clone.style.boxShadow = 'none';
        clone.style.margin = '0';
        clone.style.padding = '0';
        clone.style.width = '1000px';
        clone.style.height = 'auto';
        clone.style.minHeight = 'auto';
        clone.style.maxHeight = 'none';
        clone.style.overflow = 'visible';
        
        container.appendChild(clone);
        
        // Crucial: Wait for images inside the clone to load
        await waitForImages(clone);

        await new Promise(resolve => setTimeout(resolve, 800));

        const height = clone.offsetHeight;

        const dataUrl = await toJpeg(clone, {
            quality: 0.95,
            backgroundColor: '#ffffff',
            cacheBust: true,
            width: 1000,
            height: height,
            style: {
                height: 'auto',
                maxHeight: 'none',
                overflow: 'visible'
            },
            pixelRatio: 2,
        });

        document.body.removeChild(container);

        const link = document.createElement('a');
        link.download = `product-page-${Date.now()}.jpg`;
        link.href = dataUrl;
        link.click();
    } catch (err) {
        console.error('Could not download image', err);
        alert('이미지를 다운로드하는 데 실패했습니다. 다시 시도해주세요.');
    } finally {
        setIsLoading(false);
        setLoadingMessage("AI가 상세페이지를 만들고 있어요...");
    }
  };
  
  return (
    <div className="flex flex-col h-screen bg-gray-50 text-gray-800 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-hidden">
        <Header 
            onBackToStart={screen === 'result' ? handleBackToStart : undefined} 
            onOpenChangelog={() => setIsChangelogModalOpen(true)}
        />

        <main className="flex-grow overflow-hidden relative">
            {screen === 'start' && (
                <div className="h-full overflow-y-auto p-4 md:p-8 animate-fade-in">
                    <StartScreen 
                        onGenerate={handleGenerate} 
                        isLoading={isLoading} 
                        onOpenInstructions={() => setIsInstructionsModalOpen(true)}
                        onHtmlImport={async (file) => {
                             setLoadingMessage("HTML 파일 불러오는 중...");
                             setIsLoading(true);
                             try {
                                 const text = await file.text();
                                 const parser = new DOMParser();
                                 const doc = parser.parseFromString(text, 'text/html');
                                 const { content, styles } = parseImportedHtml(doc);
                                 
                                 setGeneratedData({
                                     ...content,
                                     collageBlocks: [], // Imported HTMLs usually don't have collage block data preserved perfectly, reset for now
                                     layoutHtml: LAYOUT_TEMPLATE_HTML, // Use default template structure but populated with imported content
                                     modelFiles: [],
                                     productFiles: [],
                                     originalProductFiles: [],
                                     enhancedProductImageIndexes: [],
                                     isHeroSectionVisible: true,
                                     isStudioWornCloseupVisible: true,
                                     isFinalConceptShotVisible: true,
                                 });
                                 setFontSizes(styles.fontSizes);
                                 setFontStyles(styles.fontStyles);
                                 setHeroTextColors(styles.heroTextColors);
                                 setScreen('result');
                             } catch (e) {
                                 alert(getFriendlyErrorMessage(e, "HTML 파일 가져오기 실패"));
                             } finally {
                                 setIsLoading(false);
                             }
                        }}
                    />
                </div>
            )}

            {screen === 'result' && generatedData && (
                <div className="flex h-full animate-fade-in">
                    {/* Left Panel: Adjustments */}
                    <div className="w-[450px] flex-shrink-0 border-r border-gray-200 bg-white h-full overflow-y-auto z-10 shadow-xl hidden md:block">
                         <AdjustmentPanel 
                            data={generatedData}
                            generationMode={generationMode}
                            fontSizes={fontSizes}
                            fontStyles={fontStyles}
                            heroTextColors={heroTextColors}
                            onHeroTextColorsUpdate={handleHeroTextColorsUpdate}
                            onFontSizesUpdate={handleFontSizesUpdate}
                            onFontStylesUpdate={handleFontStylesUpdate}
                            onHeroTextContentUpdate={handleHeroTextContentUpdate}
                            onRegenerate={handleRegenerateModelImagesWithOptions}
                            isRegenerating={isLoading}
                            onAddModelImage={handleAddModelImage}
                            isAddingModelImage={isAddingModelShot}
                            onAddCloseupImage={handleAddCloseupImage}
                            isAddingCloseupImage={isAddingCloseupShot}
                            topFile={topFile}
                            pantsFile={pantsFile}
                            topPreview={topPreview}
                            pantsPreview={pantsPreview}
                            onTopFileChange={(file) => {
                                setTopFile(file);
                                if (file) setTopPreview(URL.createObjectURL(file));
                                else setTopPreview(null);
                            }}
                            onPantsFileChange={(file) => {
                                setPantsFile(file);
                                if (file) setPantsPreview(URL.createObjectURL(file));
                                else setPantsPreview(null);
                            }}
                            newFaceFiles={newFaceFiles}
                            onNewFaceFilesChange={handleNewFaceFilesChange}
                            isFaceLearned={isFaceLearned}
                            isFaceLearning={isFaceLearning}
                            onLearnFace={handleLearnFace}
                            isFaceSwapping={isFaceSwapping}
                            onChangeFace={handleChangeFace}
                            productImageUrls={generatedData.imageUrls.products}
                            onAddProductImage={handleAddProductImage}
                            onDeleteProductImage={handleDeleteProductImage}
                            modelFiles={generatedData.modelFiles}
                            onModelFilesUpdate={handleModelFilesUpdate}
                            onToggleHeroSectionVisibility={handleToggleHeroSectionVisibility}
                            onToggleStudioWornCloseupVisibility={handleToggleStudioWornCloseupVisibility}
                            onToggleFinalConceptShotVisibility={handleToggleFinalConceptShotVisibility}
                            productEnhancementPreset={productEnhancementPreset}
                            onApplyProductEnhancementPreset={(preset) => {
                                setProductEnhancementPreset(preset);
                                if (preset !== 'off') {
                                    setIsBatchEnhancing(true);
                                    // Trigger enhancements for all products sequentially or parallel
                                    // For simplicity in this UI update, we might just set state.
                                    // Real implementation would loop generatedData.productFiles
                                    // and call enhanceProductImageWithPreset, updating generatedData.imageUrls.products
                                    const enhanceAll = async () => {
                                        try {
                                            const newFiles = await Promise.all(generatedData.productFiles.map(async (file, idx) => {
                                                 setSingleProductEnhanceLoading(idx);
                                                 const res = await enhanceProductImageWithPreset(file, preset);
                                                 setSingleProductEnhanceLoading(null);
                                                 return res;
                                            }));
                                            
                                            const newUrls = await Promise.all(newFiles.map(fileToDataUrl));
                                            
                                            setGeneratedData(prev => {
                                                if (!prev) return null;
                                                return {
                                                    ...prev,
                                                    imageUrls: { ...prev.imageUrls, products: newUrls }
                                                };
                                            });
                                        } catch (e) {
                                            alert(getFriendlyErrorMessage(e, "일괄 보정 실패"));
                                        } finally {
                                            setIsBatchEnhancing(false);
                                        }
                                    }
                                    enhanceAll();
                                }
                            }}
                            isBatchEnhancing={isBatchEnhancing}
                            filterPreset={filterPreset}
                            onSetFilterPreset={setFilterPreset}
                            onAddCollageBlock={handleAddCollageBlock}
                        />
                    </div>

                    {/* Main Preview Area */}
                    <div className="flex-grow h-full bg-gray-100 overflow-hidden relative flex flex-col">
                         <div className="absolute top-4 right-8 z-20 flex gap-2">
                             <button
                                onClick={handleDownloadHtml}
                                className="bg-white/90 backdrop-blur text-gray-700 hover:text-blue-600 px-4 py-2 rounded-lg shadow-sm border border-gray-200 text-sm font-semibold flex items-center gap-2 transition-all hover:shadow-md"
                            >
                                <FileCodeIcon className="w-4 h-4" />
                                HTML 저장
                            </button>
                             <button
                                onClick={handleDownloadJpg}
                                className="bg-white/90 backdrop-blur text-gray-700 hover:text-blue-600 px-4 py-2 rounded-lg shadow-sm border border-gray-200 text-sm font-semibold flex items-center gap-2 transition-all hover:shadow-md"
                            >
                                <DownloadIcon className="w-4 h-4" />
                                JPG 저장
                            </button>
                            <button
                                onClick={handleDownload}
                                className="bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-700 text-sm font-semibold flex items-center gap-2 transition-all hover:shadow-xl"
                            >
                                <DownloadIcon className="w-4 h-4" />
                                이미지 다운로드 (PNG)
                            </button>
                        </div>

                        <PreviewPanel 
                            data={generatedData} 
                            fontSizes={fontSizes}
                            fontStyles={fontStyles}
                            heroTextColors={heroTextColors}
                            filterPreset={filterPreset}
                            imageZoomLevels={imageZoomLevels}
                            onImageZoom={handleImageZoom}
                            productEnhancementPreset={productEnhancementPreset}
                            onImageReplace={handleImageReplace}
                            onAddProductImage={handleAddProductImage}
                            onReorderSectionItem={handleReorderSectionItem}
                            onReorderProductImage={handleReorderProductImage}
                            onDuplicateImage={handleDuplicateImage}
                            onRegenerateSingle={handleRegenerateSingleModelImage}
                            onRegenerateShoesOnly={handleRegenerateShoesOnly}
                            shoeRegenLoadingState={shoeRegenLoadingState}
                            onRegenerateSingleProduct={async (index) => {
                                if (productEnhancementPreset === 'off') return;
                                setSingleProductEnhanceLoading(index);
                                try {
                                    const file = generatedData.productFiles[index];
                                    const newFile = await enhanceProductImageWithPreset(file, productEnhancementPreset);
                                    const newUrl = await fileToDataUrl(newFile);
                                     setGeneratedData(prev => {
                                        if (!prev) return null;
                                        const newUrls = [...prev.imageUrls.products];
                                        newUrls[index] = newUrl;
                                        return { ...prev, imageUrls: { ...prev.imageUrls, products: newUrls } };
                                    });
                                } catch (e) {
                                    alert(getFriendlyErrorMessage(e, "이미지 보정에 실패했습니다."));
                                } finally {
                                    setSingleProductEnhanceLoading(null);
                                }
                            }}
                            singleProductEnhanceLoading={singleProductEnhanceLoading}
                            onRegenerateWithSpecificPose={handleRegenerateImageWithSpecificPose}
                            onDownloadSingle={handleDownloadSingleImage}
                            onDeleteImage={handleDeleteImage}
                            onDeleteProductImage={handleDeleteProductImage}
                            onDeleteFinalConceptShot={handleDeleteFinalConceptShot}
                            singleImageLoadingState={singleImageLoadingState}
                            singlePoseLoadingState={singlePoseLoadingState}
                            placeholderLoadingState={placeholderLoadingState}
                            onGenerateForPlaceholder={handleGenerateForPlaceholder}
                            onRegenerateConceptShot={handleRegenerateConceptShot}
                            isConceptLoading={isConceptLoading}
                            onRegenerateStudioWornCloseupShot={handleRegenerateStudioWornCloseupShot}
                            isStudioWornCloseupLoading={isStudioWornCloseupLoading}
                            onRegenerateFinalConceptShot={handleRegenerateFinalConceptShot}
                            isFinalConceptLoading={isFinalConceptLoading}
                            onAddCollageBlock={handleAddCollageBlock}
                            onDeleteCollageBlock={handleDeleteCollageBlock}
                            onReplaceCollageImage={handleReplaceCollageImage}
                            onDeleteCollageImage={handleDeleteCollageImage}
                            onReorderCollageImage={handleReorderCollageImage}
                        />
                    </div>
                </div>
            )}

            <InstructionsModal 
                isOpen={isInstructionsModalOpen}
                onClose={() => setIsInstructionsModalOpen(false)}
                savedInstructions={customInstructions}
                onSave={(newInstructions) => {
                    setCustomInstructions(newInstructions);
                    localStorage.setItem('customInstructions', newInstructions);
                    setIsInstructionsModalOpen(false);
                }}
                onResetToDefault={() => DEFAULT_INSTRUCTIONS}
            />

            <ChangelogModal
                isOpen={isChangelogModalOpen}
                onClose={() => setIsChangelogModalOpen(false)}
            />
            
            {isLoading && (
                <LoadingOverlay message={loadingMessage} />
            )}
        </main>
    </div>
  );
};

export default App;