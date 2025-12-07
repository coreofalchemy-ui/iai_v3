import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import html2canvas from 'html2canvas';
import AdjustmentPanel from './components/AdjustmentPanel';
import { PreviewPanel } from './components/PreviewPanel';
import { NavigationMinimap } from './components/NavigationMinimap';
import { SimpleContextMenu } from './components/SimpleContextMenu';
import { NumberInputDialog } from './components/NumberInputDialog';
import { ColorPickerDialog } from './components/ColorPickerDialog';
import { ClothingTypeSelectDialog } from './components/ClothingTypeSelectDialog';
import { TextElement } from './components/PreviewRenderer';
import { analyzeModelImage, detectItemType, compositeClothingItem, changeItemColor, ModelAnalysis } from './services/analyzeModel';
import { generatePoseBatch, PoseGenerationResult } from './services/poseService';
import { executeQuickTransferPipeline, QuickTransferPipelineOptions } from './services/quickTransferService';
import { generateAICopywriting } from './services/geminiAICopywriter';
import { FilterPresetName } from './services/photoFilterService';

// Helper to read file as Data URL
const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const LAYOUT_TEMPLATE_HTML = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Product Detail</title>
    <style>
        body { margin: 0; padding: 0; font-family: 'Noto Sans KR', sans-serif; }
        .container { max-width: 800px; margin: 0 auto; }
        img { max-width: 100%; display: block; }
        .section { margin-bottom: 0; }
    </style>
</head>
<body>
    <div class="container" id="root">
        <!-- Content will be injected here -->
    </div>
</body>
</html>
`;

export default function DetailGeneratorApp() {
    const navigate = useNavigate();
    // Start directly in result screen, bypassing StartScreen
    const [screen, setScreen] = useState<'start' | 'result'>('result');
    const [isLoading, setLoading] = useState(false);
    // Auto-initialize with default data
    const [generatedData, setGeneratedData] = useState<any>({
        textContent: {},
        specContent: {},
        heroTextContent: {
            productName: 'Premium Leather Derby',
            brandLine: 'BRAND NAME',
            subName: 'Black / Classic',
            stylingMatch: '와이드 팬츠나 슬랙스와 매치하면 댄디한 무드를 연출할 수 있습니다.\n캐주얼한 데님과 함께하면 클래식한 스트리트 룩이 완성됩니다.\n정장과 코디하면 격식 있는 비즈니스 캐주얼 스타일에 적합합니다.\n오버사이즈 코트와 함께 레이어드하면 세련된 시즌 룩을 완성합니다.',
            craftsmanship: '프리미엄 풀그레인 가죽을 사용해 내구성과 고급스러움을 모두 갖췄습니다.\n핸드메이드 스티칭으로 디테일의 완성도를 높였습니다.\n이중 봉제 기법을 적용해 오랜 착용에도 형태가 유지됩니다.\n천연 가죽 특유의 에이징으로 시간이 지날수록 깊어지는 색감을 경험하세요.',
            technology: '미끄럼 방지 패턴이 적용된 고무 아웃솔로 우천시에도 안정적입니다.\n쿠셔닝 인솔이 장시간 착용에도 편안한 착화감을 제공합니다.\n통기성 좋은 내피 소재로 발 건강을 배려했습니다.\n인체공학적 라스트 설계로 발에 자연스럽게 피팅됩니다.'
        },
        noticeContent: {},
        imageUrls: {
            products: [],
            modelShots: [],
            closeupShots: [],
        },
        layoutHtml: LAYOUT_TEMPLATE_HTML,
        productFiles: [],
        modelFiles: [],
        sectionOrder: ['hero']
    });
    const [activeSection, setActiveSection] = useState<string>('hero');
    const [previewHtml, setPreviewHtml] = useState<string>('');
    const [sectionOrder, setSectionOrder] = useState<string[]>(['hero']);
    const [showAIAnalysis, setShowAIAnalysis] = useState(false);
    const [isMinimapVisible, setIsMinimapVisible] = useState(true); // 기본 켜짐

    // Text Editing State
    const [textElements, setTextElements] = useState<TextElement[]>([]);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; targetId: string | null }>({
        visible: false, x: 0, y: 0, targetId: null
    });

    // Zoom State
    const [imageZoomLevels, setImageZoomLevels] = useState<{ [key: string]: number }>({});
    const [imageTransforms, setImageTransforms] = useState<{ [key: string]: { scale: number, x: number, y: number } }>({});

    // Section Heights
    const [sectionHeights, setSectionHeights] = useState<{ [key: string]: number }>({});

    // Preview Device State
    const [previewDevice, setPreviewDevice] = useState<'mobile' | 'tablet' | 'desktop' | 'responsive'>('mobile');
    const [previewWidth, setPreviewWidth] = useState('100%');
    const [autoScale, setAutoScale] = useState(1);
    const [previewScale, setPreviewScale] = useState(1); // 전체 프리뷰 줌 스케일


    // Model Hold & Analysis State
    const [heldSections, setHeldSections] = useState<Set<string>>(new Set());
    const [modelAnalysis, setModelAnalysis] = useState<{ [key: string]: ModelAnalysis }>({});
    const [analyzingModels, setAnalyzingModels] = useState<Set<string>>(new Set());
    const [isProcessing, setIsProcessing] = useState(false); // For global loading overlay

    // Force Edit State
    const [forceEditSections, setForceEditSections] = useState<Set<string>>(new Set());

    // Product Tab State
    const [uploadedProducts, setUploadedProducts] = useState<Array<{ id: string; type: string; url: string; file: File }>>([]);

    // Pose Generation State
    const [usedPoseIds, setUsedPoseIds] = useState<Set<string>>(new Set());
    const [poseDialogState, setPoseDialogState] = useState<{
        visible: boolean;
        type: 'full' | 'closeup';
        sectionId: string | null;
    }>({ visible: false, type: 'full', sectionId: null });
    const [poseGenerationProgress, setPoseGenerationProgress] = useState<{
        isGenerating: boolean;
        current: number;
        total: number;
        message: string;
    }>({ isGenerating: false, current: 0, total: 0, message: '' });

    const [colorPickerState, setColorPickerState] = useState<{
        step: 'selectType' | 'selectColor' | null;
        sectionId: string | null;
        clothingType: string | null;
    }>({ step: null, sectionId: null, clothingType: null });

    // Flipped Sections State (horizontal flip)
    const [flippedSections, setFlippedSections] = useState<Set<string>>(new Set());

    const previewRef = useRef<HTMLDivElement>(null);
    const middlePanelRef = useRef<HTMLDivElement>(null);

    // Selected Sections - for individual section selection via context menu
    const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());

    // Processing Sections - sections currently being processed by AI
    const [processingSections, setProcessingSections] = useState<Set<string>>(new Set());

    // Global Edit Mode (MINIMAP toggle) - when ON, all sections can be wheel/drag edited
    const [isHoldOn, setIsHoldOn] = useState(false); // 기본 OFF

    // Grid Sections State - 그리드/콜라주 섹션 데이터
    const [gridSections, setGridSections] = useState<{
        [sectionId: string]: {
            cols: number;
            rows: number;
            height: number;
            cells: (string | null)[]
        }
    }>({});

    // Line Elements State - 선 요소 데이터
    interface LineElement {
        id: string;
        sectionId: string;
        type: 'straight' | 'curved' | 'angled';
        strokeWidth: number;
        strokeColor: string;
        lineCap: 'round' | 'square' | 'arrow' | 'butt';
        lineEnd: 'none' | 'arrow';
        x1?: number;
        y1?: number;
        x2?: number;
        y2?: number;
    }
    const [lineElements, setLineElements] = useState<LineElement[]>([]);

    // AI Analysis Feature Toggles - 각 기능 끄고 키기
    const [aiAnalysisToggles, setAiAnalysisToggles] = useState({
        sizeGuide: true,      // SIZE GUIDE (신발 측면 스케치)
        asInfo: true,         // A/S 안내
        cautions: true,       // 기타 주의사항
    });

    // Active Photo Filter
    const [activeFilter, setActiveFilter] = useState<FilterPresetName>('original');


    // AI Generated Content
    const [aiGeneratedContent, setAiGeneratedContent] = useState<{
        sizeGuideImage?: string;   // 스케치 변환된 이미지
        asInfo?: string;           // A/S 안내 텍스트
        cautions?: string;         // 기타 주의사항 텍스트
    }>({});

    // Image History for Undo - 섹션별 이미지 히스토리 (되돌리기용)
    const [imageHistory, setImageHistory] = useState<{ [sectionId: string]: string[] }>({});

    // Get navigation state for shoe data
    const location = useLocation();
    const [initialShoesProcessed, setInitialShoesProcessed] = useState(false);

    // Process shoes from navigation state on mount
    useEffect(() => {
        if (!initialShoesProcessed && location.state?.shoes && location.state.shoes.length > 0) {
            const shoes = location.state.shoes as { name: string; url: string }[];

            // Create sections for each shoe
            const newSections: string[] = ['hero'];
            const newImageUrls: { [key: string]: string } = {};
            const newProducts: { id: string; type: string; url: string }[] = [];

            // Process each shoe and calculate natural height based on image dimensions
            const processShoes = async () => {
                const productFilesFromBlob: File[] = [];

                const heightPromises = shoes.map((shoe, idx) => {
                    return new Promise<{ sectionId: string; height: number }>(async (resolve) => {
                        const sectionId = `shoe-${Date.now()}-${idx}`;
                        newSections.push(sectionId);
                        newImageUrls[sectionId] = shoe.url;
                        newProducts.push({
                            id: sectionId,
                            type: 'shoe',
                            url: shoe.url
                        });

                        // Convert blob URL to File for productFiles display
                        try {
                            const response = await fetch(shoe.url);
                            const blob = await response.blob();
                            const file = new File([blob], shoe.name || `shoe_${idx + 1}.png`, { type: blob.type || 'image/png' });
                            productFilesFromBlob.push(file);
                        } catch (e) {
                            console.error('Failed to convert blob URL to file:', e);
                        }

                        // Load image to get natural dimensions
                        const img = new Image();
                        img.onload = () => {
                            // Calculate height based on 1000px width (preview panel width)
                            const aspectRatio = img.naturalHeight / img.naturalWidth;
                            const calculatedHeight = Math.round(1000 * aspectRatio);
                            resolve({ sectionId, height: calculatedHeight });
                        };
                        img.onerror = () => {
                            // Fallback height if image fails to load
                            resolve({ sectionId, height: 800 });
                        };
                        img.src = shoe.url;
                    });
                });

                const heights = await Promise.all(heightPromises);
                const newHeights: { [key: string]: number } = {};
                heights.forEach(h => {
                    newHeights[h.sectionId] = h.height;
                });

                setGeneratedData((prev: any) => ({
                    ...prev,
                    imageUrls: {
                        ...prev.imageUrls,
                        ...newImageUrls
                    },
                    sectionOrder: newSections,
                    productFiles: [...(prev.productFiles || []), ...productFilesFromBlob]
                }));
                setSectionOrder(newSections);
                setSectionHeights(prev => ({ ...prev, ...newHeights }));
                setUploadedProducts(newProducts as any);
            };

            processShoes();
            setInitialShoesProcessed(true);
        }
    }, [location.state, initialShoesProcessed]);

    // Process QuickTransfer options from navigation state
    const [quickTransferProcessed, setQuickTransferProcessed] = useState(false);
    const [quickTransferProgress, setQuickTransferProgress] = useState<{ status: string; current: number; total: number } | null>(null);

    useEffect(() => {
        console.log('=== Quick Transfer Debug ===');
        console.log('location.state:', location.state);
        console.log('quickTransferProcessed:', quickTransferProcessed);
        console.log('location.state?.quickTransfer:', location.state?.quickTransfer);

        if (!quickTransferProcessed && location.state?.quickTransfer) {
            const options = location.state.quickTransfer as QuickTransferPipelineOptions;
            console.log('Starting Quick Transfer Pipeline with options:', options);
            setQuickTransferProcessed(true);
            setLoading(true);
            setQuickTransferProgress({ status: '파이프라인 시작 중...', current: 0, total: 1 });

            const runPipeline = async () => {
                try {
                    console.log('Executing pipeline...');

                    // =============================================
                    // 1. 먼저 플레이스홀더 섹션 생성 (로딩 상태 표시)
                    // =============================================
                    const beautifyCount = options.beautify ? 6 : 0;
                    const newSections: string[] = ['hero'];
                    const newImageUrls: { [key: string]: string } = {};
                    const newHeights: { [key: string]: number } = {};
                    const sectionIdMap: { [key: string]: string } = {}; // type-index -> sectionId

                    // 미화 ON: 6개 플레이스홀더 생성
                    // 미화 OFF: 원본 신발 사진 모두 추가
                    if (options.beautify) {
                        // 미화 섹션 플레이스홀더
                        for (let i = 0; i < beautifyCount; i++) {
                            const sectionId = `beautified-${Date.now()}-${i}`;
                            newSections.push(sectionId);
                            newImageUrls[sectionId] = 'loading'; // 로딩 표시용
                            newHeights[sectionId] = 800;
                            sectionIdMap[`beautify-${i}`] = sectionId;
                        }
                    } else {
                        // 미화 OFF: 원본 신발 사진 직접 추가
                        for (let i = 0; i < options.shoes.length; i++) {
                            const shoe = options.shoes[i];
                            const sectionId = `product-${Date.now()}-${i}`;
                            newSections.push(sectionId);
                            newImageUrls[sectionId] = shoe.url; // 원본 URL 직접 사용
                            newHeights[sectionId] = 800;
                            sectionIdMap[`product-${i}`] = sectionId;
                        }
                    }

                    // 모델컷 섹션 플레이스홀더
                    for (let i = 0; i < options.modelCuts; i++) {
                        const sectionId = `model-cut-${Date.now()}-${i}`;
                        newSections.push(sectionId);
                        newImageUrls[sectionId] = 'loading';
                        newHeights[sectionId] = 1200;
                        sectionIdMap[`modelCut-${i}`] = sectionId;
                    }

                    // 클로즈업 섹션 플레이스홀더
                    for (let i = 0; i < options.closeupCuts; i++) {
                        const sectionId = `closeup-${Date.now()}-${i}`;
                        newSections.push(sectionId);
                        newImageUrls[sectionId] = 'loading';
                        newHeights[sectionId] = 800;
                        sectionIdMap[`closeup-${i}`] = sectionId;
                    }

                    // 플레이스홀더로 UI 먼저 업데이트
                    setGeneratedData((prev: any) => ({
                        ...prev,
                        imageUrls: { ...prev.imageUrls, ...newImageUrls },
                        sectionOrder: newSections
                    }));
                    setSectionOrder(newSections);
                    setSectionHeights(prev => ({ ...prev, ...newHeights }));

                    // =============================================
                    // 2. AI 카피라이팅 동시 실행 (사용자가 읽으면서 수정 가능)
                    // =============================================
                    // =============================================
                    // 2. 제품 정밀 분석 & 콘텐츠 생성 (백그라운드 병렬 실행)
                    // =============================================
                    const shoeUrl = options.shoes[0]?.url;
                    if (shoeUrl) {
                        // Import dynamically if needed or assume imported at top (Added import in separate edit if strict, but here we assume we can add it or it's available. 
                        // Actually, better to add the import at the top first? I'll assume I can add the proper logic here using the service.)

                        // We need to convert blob URL to base64 for the service
                        fetch(shoeUrl)
                            .then(r => r.blob())
                            .then(blob => {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    const base64 = reader.result as string;

                                    setQuickTransferProgress({ status: 'AI 제품 정밀 분석 중...', current: 0, total: 1 });

                                    // Lazy import/call to avoid circular dep issues if any, or just call directly. 
                                    // I will use valid import in previous step or assume global availability? 
                                    // Wait, I strictly need to import 'analyzeProductAndGenerate'. 
                                    // I will replace this block assuming I also added the import at the top.

                                    import('./services/productAnalysisService').then(({ analyzeProductAndGenerate }) => {
                                        analyzeProductAndGenerate(base64, {
                                            generateSizeGuide: true,
                                            generateAS: true,
                                            generateCautions: true
                                        }, (status) => {
                                            console.log('Analysis status:', status);
                                        }).then(results => {
                                            console.log('✅ Product Analysis Complete:', results);

                                            setGeneratedData((prev: any) => {
                                                const newData = { ...prev };
                                                const newSectionOrder = [...(prev.sectionOrder || [])];

                                                // 1. Hero Text & Info + Specs
                                                if (results.analysisResult) {
                                                    const analysis = results.analysisResult;
                                                    newData.heroTextContent = {
                                                        ...prev.heroTextContent,
                                                        ...(analysis.heroCopy || {}),
                                                        // Specs 적용
                                                        specColor: analysis.specs?.color || prev.heroTextContent?.specColor,
                                                        specUpper: analysis.specs?.upper || prev.heroTextContent?.specUpper,
                                                        specLining: analysis.specs?.lining || prev.heroTextContent?.specLining,
                                                        specOutsole: analysis.specs?.outsole || prev.heroTextContent?.specOutsole,
                                                        specOrigin: analysis.specs?.origin || prev.heroTextContent?.specOrigin,
                                                        // Heel Height (Product Spec용)
                                                        heelHeight: analysis.heelHeight || prev.heroTextContent?.heelHeight,
                                                        // Height Spec 적용 (cm 형식)
                                                        outsole: analysis.heightSpec?.outsole || prev.heroTextContent?.outsole || '3cm',
                                                        insole: analysis.heightSpec?.insole || prev.heroTextContent?.insole || '0.5cm',
                                                        totalHeight: analysis.heightSpec?.total || prev.heroTextContent?.totalHeight || '3.5cm',
                                                        // Size Guide
                                                        sizeGuide: analysis.sizeGuide || prev.heroTextContent?.sizeGuide
                                                    };
                                                }

                                                // 2. Size Guide Image
                                                if (results.sizeGuideImage) {
                                                    // Ensure size-guide section exists
                                                    if (!newSectionOrder.includes('size-guide')) {
                                                        newSectionOrder.push('size-guide');
                                                    }
                                                    newData.detailTextContent = {
                                                        ...prev.detailTextContent,
                                                        sizeGuide: { visible: true }
                                                    };
                                                    newData.imageUrls['sizeGuide-0'] = results.sizeGuideImage;
                                                }

                                                // 3. AS Info
                                                if (results.asInfo) {
                                                    if (!newSectionOrder.includes('as-info')) {
                                                        newSectionOrder.push('as-info');
                                                    }
                                                    newData.detailTextContent = { ...newData.detailTextContent, asInfo: true };
                                                    newData.aiGeneratedContent = { ...prev.aiGeneratedContent, asInfo: results.asInfo };
                                                }

                                                // 4. Cautions
                                                if (results.cautions) {
                                                    if (!newSectionOrder.includes('precautions')) {
                                                        newSectionOrder.push('precautions');
                                                    }
                                                    newData.detailTextContent = { ...newData.detailTextContent, precautions: true };
                                                    newData.aiGeneratedContent = { ...newData.aiGeneratedContent, cautions: results.cautions };
                                                }

                                                // Sync sectionOrder state
                                                setSectionOrder(newSectionOrder);

                                                return { ...newData, sectionOrder: newSectionOrder };
                                            });
                                        });
                                    });
                                };
                                reader.readAsDataURL(blob);
                            });
                    }

                    // =============================================
                    // 3. 이미지 스트리밍 - 생성되는대로 바로 표시
                    // =============================================
                    const productFilesFromBlob: File[] = [];

                    const result = await executeQuickTransferPipeline(
                        options,
                        (status, current, total) => {
                            console.log(`Pipeline progress: ${status} (${current}/${total})`);
                            setQuickTransferProgress({ status, current, total });
                        },
                        // 스트리밍 콜백: 이미지 생성되면 즉시 UI 업데이트
                        (type, imageUrl, index, poseName) => {
                            const mapKey = `${type}-${index}`;
                            const sectionId = sectionIdMap[mapKey];
                            if (sectionId) {
                                console.log(`🖼️ Streaming ${type} ${index + 1} to section ${sectionId}`);
                                if (imageUrl === 'error') {
                                    setGeneratedData((prev: any) => ({
                                        ...prev,
                                        imageUrls: {
                                            ...prev.imageUrls,
                                            [sectionId]: 'https://placehold.co/800x1200?text=Generation+Failed'
                                        }
                                    }));
                                } else {
                                    setGeneratedData((prev: any) => ({
                                        ...prev,
                                        imageUrls: {
                                            ...prev.imageUrls,
                                            [sectionId]: imageUrl
                                        }
                                    }));
                                }
                            }
                        }
                    );

                    // 미화된 신발 이미지를 제품 파일로 변환
                    for (let i = 0; i < result.beautifiedShoes.length; i++) {
                        try {
                            const response = await fetch(result.beautifiedShoes[i]);
                            const blob = await response.blob();
                            productFilesFromBlob.push(new File([blob], `beautified_${i + 1}.png`, { type: 'image/png' }));
                        } catch (e) { /* ignore */ }
                    }

                    // 원본 업로드 신발 이미지도 제품 파일로 추가
                    if (options.shoes && options.shoes.length > 0) {
                        for (let i = 0; i < options.shoes.length; i++) {
                            try {
                                const shoe = options.shoes[i];
                                // file 객체가 직접 있으면 사용, 없으면 url로 변환
                                if ((shoe as any).file) {
                                    productFilesFromBlob.push((shoe as any).file);
                                } else if (shoe.url) {
                                    const response = await fetch(shoe.url);
                                    const blob = await response.blob();
                                    productFilesFromBlob.push(new File([blob], shoe.name || `product_${i + 1}.png`, { type: blob.type || 'image/png' }));
                                }
                            } catch (e) { console.error('Error processing original shoe:', e); }
                        }
                    }

                    // 모델 이미지 처리 (초기에 넣은 모델)
                    const modelFilesFromBlob: File[] = [];
                    const modelReq = (options as any).modelRequest; // QuickTransferOptions에 modelRequest가 있다고 가정
                    // 혹은 options 안에 modelImage 같은게 있는지 확인 필요. 
                    // 보통 poseService 호출시 사용됨. 
                    // options.referenceFace 확인
                    if ((options as any).referenceFace) {
                        try {
                            const refFace = (options as any).referenceFace; // URL string
                            const response = await fetch(refFace);
                            const blob = await response.blob();
                            modelFilesFromBlob.push(new File([blob], `model_ref.png`, { type: blob.type || 'image/png' }));
                        } catch (e) { console.error('Error processing model ref:', e); }
                    }

                    setGeneratedData((prev: any) => ({
                        ...prev,
                        productFiles: [...(prev.productFiles || []), ...productFilesFromBlob],
                        modelFiles: [...(prev.modelFiles || []), ...modelFilesFromBlob]
                    }));

                    setQuickTransferProgress(null);
                    setLoading(false);

                } catch (error) {
                    console.error('Quick Transfer pipeline error:', error);
                    setQuickTransferProgress(null);
                    setLoading(false);
                }
            };

            runPipeline();
        }
    }, [location.state, quickTransferProcessed]);


    // Close context menu on click outside
    useEffect(() => {
        const handleGlobalClick = () => {
            if (contextMenu.visible) {
                setContextMenu({ visible: false, x: 0, y: 0, targetId: null });
            }
        };
        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, [contextMenu.visible]);

    // Calculate auto-scale for responsive preview
    useEffect(() => {
        if (middlePanelRef.current) {
            const updateScale = () => {
                const containerWidth = middlePanelRef.current?.clientWidth || 1000;
                const targetWidth = 1000; // Base width
                const scale = Math.min(1, (containerWidth - 64) / targetWidth); // 64px padding
                setAutoScale(scale);
            };

            updateScale();
            window.addEventListener('resize', updateScale);
            return () => window.removeEventListener('resize', updateScale);
        }
    }, [screen]);

    // Auto-capture HTML sections for minimap
    // Optimized to run sequentially and avoid freezing
    useEffect(() => {
        if (screen !== 'result') return;

        const captureTimer = setTimeout(async () => {
            const sectionsToCapture = ['hero', ...sectionOrder.filter(id => {
                if (id === 'hero') return true;
                const isAISection =
                    (generatedData.detailTextContent?.sizeGuide && id.includes('sizeGuide')) ||
                    (generatedData.detailTextContent?.precautions && id.includes('precautions')) ||
                    (generatedData.detailTextContent?.asInfo && id.includes('asInfo')) ||
                    (generatedData.noticeContent && id.includes('notice'));
                if (id.startsWith('grid-')) return true;
                // Only capture custom/product sections if they don't have an image OR if force update needed
                if (id.startsWith('product-') || id.startsWith('shoe-') || id.startsWith('custom-')) {
                    // Check if we already have a valid image URL for this section
                    // If it's a raw blob or data URL, we might want to skip capturing unless specific events happen
                    const existing = generatedData.imageUrls?.[id];
                    if (!existing || existing === 'loading') return true;
                    // Otherwise, assume it's stable and don't re-capture heavily
                    return false;
                }
                return isAISection;
            })];

            // Sequential processing to prevent UI freeze
            for (const sectionId of sectionsToCapture) {
                // Double check if we need to capture inside the loop (state might have changed)
                // For AI/HTML sections, we always want to ensure they are up to date if they are in the list
                try {
                    // Small delay between captures to yield control to UI
                    await new Promise(resolve => setTimeout(resolve, 100));

                    const imageUrl = await captureSectionAsImage(sectionId);
                    if (imageUrl) {
                        // Only update if different (simple check) or just update
                        setGeneratedData((prev: any) => {
                            // Avoid unnecessary updates if URL is same (though dataURL is huge, maybe just update)
                            return {
                                ...prev,
                                imageUrls: {
                                    ...prev.imageUrls,
                                    [sectionId]: imageUrl
                                }
                            };
                        });

                        // Also update height
                        const sectionEl = document.querySelector(`[data-section="${sectionId}"]`) as HTMLElement;
                        if (sectionEl) {
                            setSectionHeights((prev: any) => ({
                                ...prev,
                                [sectionId]: sectionEl.offsetHeight
                            }));
                        }
                    }
                } catch (e) {
                    // console.warn(`Auto-capture skipped for ${sectionId}`);
                }
            }
        }, 3000); // Increased delay to 3s to let initial render settle

        return () => clearTimeout(captureTimer);
    }, [
        screen,
        sectionOrder,
        generatedData.heroTextContent, // Triggers when hero text changes
        generatedData.textContent,
        generatedData.specContent,
        generatedData.noticeContent,
        generatedData.detailTextContent, // Simplified dependency
        gridSections // Include gridSections to trigger re-capture when grids change
    ]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Delete key
            if (e.key === 'Delete' || e.key === 'Backspace') {
                // Ignore if typing in input
                if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

                if (contextMenu.targetId) {
                    // Delete section
                    if (confirm('선택한 섹션을 삭제하시겠습니까?')) {
                        setSectionOrder(prev => prev.filter(id => id !== contextMenu.targetId));
                        setContextMenu({ visible: false, x: 0, y: 0, targetId: null });
                    }
                } else if (selectedSections.size > 0) {
                    if (confirm(`${selectedSections.size}개의 선택된 섹션을 삭제하시겠습니까?`)) {
                        setSectionOrder(prev => prev.filter(id => !selectedSections.has(id)));
                        setSelectedSections(new Set());
                    }
                }
            }

            // Undo (Ctrl+Z)
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                // Implement global undo if needed, currently mainly for section images
                if (contextMenu.targetId) {
                    handleUndoSection();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [contextMenu.targetId, selectedSections]);

    const handleDeviceChange = (device: 'mobile' | 'tablet' | 'desktop' | 'responsive') => {
        setPreviewDevice(device);
        switch (device) {
            case 'mobile': setPreviewWidth('640'); break;
            case 'tablet': setPreviewWidth('768'); break;
            case 'desktop': setPreviewWidth('1000'); break;
            case 'responsive': setPreviewWidth('100%'); break;
        }
    };

    // 새로 만들기 핸들러
    const handleNewProject = () => {
        if (!window.confirm('현재 작업을 초기화하고 새 프로젝트를 시작하시겠습니까?')) return;
        setGeneratedData({
            textContent: {},
            specContent: {},
            heroTextContent: {
                productName: 'New Product',
                brandLine: 'BRAND NAME',
                subName: 'Color / Model',
                stylingMatch: '',
                craftsmanship: '',
                technology: ''
            },
            noticeContent: {},
            imageUrls: { products: [], modelShots: [], closeupShots: [] },
            layoutHtml: LAYOUT_TEMPLATE_HTML,
            productFiles: [],
            modelFiles: [],
            sectionOrder: ['hero']
        });
        setSectionOrder(['hero']);
        setSectionHeights({});
        setImageTransforms({});
        setTextElements([]);
    };

    // JPG 내보내기 핸들러
    const handleExportJPG = async () => {
        if (!previewRef.current) {
            alert('프리뷰 영역을 찾을 수 없습니다.');
            return;
        }

        const targetWidth = previewDevice === 'desktop' ? 1000 : (previewDevice === 'tablet' ? 768 : 640);
        setLoading(true);

        try {
            // blob URL을 base64로 변환하는 함수
            const convertBlobUrlToBase64 = async (blobUrl: string): Promise<string> => {
                try {
                    const response = await fetch(blobUrl);
                    const blob = await response.blob();
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    console.error('Failed to convert blob URL:', e);
                    return blobUrl;
                }
            };

            // 프리뷰 내 모든 이미지를 base64로 변환
            const images = previewRef.current.querySelectorAll('img');
            const originalSrcs: { img: HTMLImageElement; src: string }[] = [];

            for (const img of Array.from(images)) {
                const src = img.src;
                if (src.startsWith('blob:')) {
                    originalSrcs.push({ img, src });
                    try {
                        const base64 = await convertBlobUrlToBase64(src);
                        img.src = base64;
                    } catch (e) {
                        console.error('Failed to convert image:', e);
                    }
                }
            }

            // 이미지 로딩 완료 대기
            await new Promise(resolve => setTimeout(resolve, 200));

            // 전체 콘텐츠 크기 계산
            const scrollHeight = previewRef.current.scrollHeight;

            const canvas = await html2canvas(previewRef.current, {
                scale: 1.5, // 품질과 성능 균형
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                width: targetWidth,
                height: scrollHeight,
                windowWidth: targetWidth,
                windowHeight: scrollHeight,
                scrollX: 0,
                scrollY: 0,
                logging: false,
                imageTimeout: 20000,
            });

            // 원본 src 복원
            originalSrcs.forEach(({ img, src }) => {
                img.src = src;
            });

            const link = document.createElement('a');
            link.download = `detail_page_${previewDevice}_${Date.now()}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.95);
            link.click();
        } catch (error) {
            console.error('JPG 내보내기 오류:', error);
            alert('JPG 내보내기에 실패했습니다. 콘솔을 확인해주세요.');
        } finally {
            setLoading(false);
        }
    };

    // HTML 내보내기 (이미지 base64 포함, 선택한 디바이스 너비 고정)
    const handleExportHTML = async () => {
        setLoading(true);
        const targetWidth = previewDevice === 'desktop' ? 1000 : (previewDevice === 'tablet' ? 768 : 640);

        try {
            // blob URL을 base64로 변환하는 함수
            const convertBlobUrlToBase64 = async (blobUrl: string): Promise<string> => {
                if (!blobUrl.startsWith('blob:')) return blobUrl;
                try {
                    const response = await fetch(blobUrl);
                    const blob = await response.blob();
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    console.error('Failed to convert blob URL:', e);
                    return blobUrl;
                }
            };

            // 모든 섹션 이미지를 base64로 변환
            const convertedImages: { [key: string]: string } = {};
            for (const sectionId of sectionOrder) {
                if (sectionId === 'hero') continue;
                const imageUrl = generatedData.imageUrls?.[sectionId];
                if (imageUrl && imageUrl !== 'SPACER' && imageUrl !== 'loading') {
                    convertedImages[sectionId] = await convertBlobUrlToBase64(imageUrl);
                }
            }

            const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${generatedData.heroTextContent?.productName || 'Product Detail'}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Noto Sans KR', -apple-system, sans-serif; 
            background: #f5f5f5; 
            display: flex;
            justify-content: center;
        }
        .container { 
            width: ${targetWidth}px; 
            max-width: ${targetWidth}px;
            min-width: ${targetWidth}px;
            background: #fff; 
        }
        img { width: 100%; height: auto; display: block; }
        .section { margin-bottom: 0; }
    </style>
</head>
<body>
    <div class="container">
        ${sectionOrder.map(sectionId => {
                if (sectionId === 'hero') return '';
                const imageUrl = convertedImages[sectionId] || generatedData.imageUrls?.[sectionId];
                if (imageUrl && imageUrl !== 'SPACER' && imageUrl !== 'loading') {
                    return `<div class="section"><img src="${imageUrl}" alt="Section ${sectionId}" /></div>`;
                }
                return '';
            }).join('\n        ')}
    </div>
</body>
</html>`;

            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${generatedData.heroTextContent?.productName || 'detail_page'}.html`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('HTML 내보내기 오류:', error);
            alert('HTML 내보내기에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // Text Handlers
    const handleAddTextElement = (text: TextElement) => {
        setTextElements(prev => [...prev, text]);
    };

    const handleUpdateTextElement = (id: string, prop: keyof TextElement, value: any) => {
        setTextElements(prev => prev.map(t => t.id === id ? { ...t, [prop]: value } : t));
    };

    const handleDeleteTextElement = (id: string) => {
        setTextElements(prev => prev.filter(t => t.id !== id));
    };

    const handleUpdateAllTextElements = (elements: TextElement[]) => {
        setTextElements(elements);
    };

    // Section Handlers
    const handleAddSection = (type: string) => {
        const newId = `custom-${Date.now()}`;
        setGeneratedData((prev: any) => ({
            ...prev,
            imageUrls: {
                ...prev.imageUrls,
                [newId]: 'https://via.placeholder.com/800x400?text=New+Section'
            }
        }));
        setSectionOrder(prev => [...prev, newId]);
        setSectionHeights(prev => ({ ...prev, [newId]: 400 }));
    };

    const handleAddSpacerSection = () => {
        const newId = `spacer-${Date.now()}`;
        setGeneratedData((prev: any) => ({
            ...prev,
            imageUrls: {
                ...prev.imageUrls,
                [newId]: 'SPACER'
            }
        }));
        setSectionOrder(prev => [...prev, newId]);
        setSectionHeights(prev => ({ ...prev, [newId]: 100 }));
    };

    // Add grid/collage section
    const handleAddGridSection = (grid: { cols: number; rows: number; height: number; cells: (string | null)[] }) => {
        const newId = `grid-${Date.now()}`;

        // gridSections 상태에 추가
        setGridSections(prev => ({
            ...prev,
            [newId]: {
                cols: grid.cols,
                rows: grid.rows,
                height: grid.height,
                cells: grid.cells
            }
        }));

        // sectionOrder에 추가 (size-guide/as-info/precautions 앞에 삽입)
        setSectionOrder(prev => {
            const detailSections = ['size-guide', 'as-info', 'precautions'];
            const firstDetailIndex = prev.findIndex(id => detailSections.some(ds => id === ds || id.startsWith(ds + '-')));
            if (firstDetailIndex === -1) {
                return [...prev, newId]; // 디테일 섹션이 없으면 끝에 추가
            }
            return [...prev.slice(0, firstDetailIndex), newId, ...prev.slice(firstDetailIndex)];
        });

        // 섹션 높이 설정
        setSectionHeights(prev => ({ ...prev, [newId]: grid.height }));

        console.log(`그리드 섹션 추가됨: ${newId} (${grid.cols}x${grid.rows})`);
    };

    // Update grid cell with image
    const handleUpdateGridCell = (sectionId: string, cellIndex: number, imageUrl: string) => {
        setGridSections(prev => {
            const grid = prev[sectionId];
            if (!grid) return prev;

            const newCells = [...grid.cells];
            newCells[cellIndex] = imageUrl;

            return {
                ...prev,
                [sectionId]: {
                    ...grid,
                    cells: newCells
                }
            };
        });
    };

    // Add line element
    const handleAddLineElement = (line: LineElement) => {
        // 기본 위치 설정 (프리뷰 중앙에 배치)
        const newLine: LineElement = {
            ...line,
            x1: 50,
            y1: 50,
            x2: 200,
            y2: 50
        };
        setLineElements(prev => [...prev, newLine]);
        console.log(`선 추가됨: ${line.id} (${line.type})`);
    };

    // Delete line element
    const handleDeleteLineElement = (id: string) => {
        setLineElements(prev => prev.filter(l => l.id !== id));
    };

    // Update line element position (for drag functionality)
    const handleUpdateLineElement = (id: string, updates: { x1?: number; y1?: number; x2?: number; y2?: number }) => {
        setLineElements(prev => prev.map(line =>
            line.id === id ? { ...line, ...updates } : line
        ));
    };

    // Add section with pre-generated image (for product effects)
    const handleAddSectionWithImage = (imageUrl: string, sectionName?: string) => {
        const newId = `product-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

        // Create an image element to get natural dimensions
        const img = new Image();
        img.onload = () => {
            const aspectRatio = img.naturalHeight / img.naturalWidth;
            const calculatedHeight = 1000 * aspectRatio;

            setGeneratedData((prev: any) => ({
                ...prev,
                imageUrls: {
                    ...prev.imageUrls,
                    [newId]: imageUrl
                }
            }));
            // sectionOrder에 추가 (size-guide/as-info/precautions 앞에 삽입)
            setSectionOrder(prev => {
                const detailSections = ['size-guide', 'as-info', 'precautions'];
                const firstDetailIndex = prev.findIndex(id => detailSections.some(ds => id === ds || id.startsWith(ds + '-')));
                if (firstDetailIndex === -1) {
                    return [...prev, newId]; // 디테일 섹션이 없으면 끝에 추가
                }
                return [...prev.slice(0, firstDetailIndex), newId, ...prev.slice(firstDetailIndex)];
            });
            setSectionHeights(prev => ({ ...prev, [newId]: calculatedHeight }));
        };
        img.src = imageUrl;
    };

    const handleDeleteSection = (sectionId: string) => {
        setGeneratedData((prev: any) => {
            const newData = { ...prev };
            delete newData.imageUrls[sectionId];
            return newData;
        });
        setSectionOrder(prev => prev.filter(id => id !== sectionId));
        setSectionHeights(prev => {
            const newHeights = { ...prev };
            delete newHeights[sectionId];
            return newHeights;
        });
    };

    const handleUpdateSectionHeight = (id: string, height: number) => {
        setSectionHeights(prev => ({ ...prev, [id]: height }));
    };

    const handleUpdateImageTransform = (sectionId: string, transform: { scale: number, x: number, y: number }) => {
        setImageTransforms(prev => ({ ...prev, [sectionId]: transform }));
    };

    // Model Analysis Handler
    const analyzeModel = async (sectionId: string) => {
        const imageUrl = generatedData.imageUrls[sectionId];
        if (!imageUrl) return;

        setAnalyzingModels(prev => new Set(prev).add(sectionId));
        try {
            console.log(`🔍 Analyzing model in section ${sectionId}...`);
            const result = await analyzeModelImage(imageUrl);
            console.log('✅ Analysis result:', result);
            setModelAnalysis(prev => ({ ...prev, [sectionId]: result }));
        } catch (e) {
            console.error('Analysis failed:', e);
            alert('모델 분석 실패: ' + e);
        } finally {
            setAnalyzingModels(prev => {
                const next = new Set(prev);
                next.delete(sectionId);
                return next;
            });
        }
    };

    // Toggle Hold Handler
    const handleToggleHold = async (sectionId: string) => {
        setHeldSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
                // Trigger analysis when holding
                if (!modelAnalysis[sectionId]) {
                    analyzeModel(sectionId);
                }
            }
            return next;
        });
    };

    const handleToggleGlobalHold = () => {
        // Toggle global edit mode (MINIMAP toggle)
        setIsHoldOn(prev => !prev);
    };

    const handleToggleSectionSelect = () => {
        const targetId = contextMenu.targetId;
        if (!targetId) return;

        setSelectedSections(prev => {
            const newSet = new Set(prev);
            if (newSet.has(targetId)) {
                newSet.delete(targetId);
            } else {
                newSet.add(targetId);
            }
            return newSet;
        });
        setContextMenu({ visible: false, x: 0, y: 0, targetId: null });
    };

    const handleForceEdit = (sectionId: string) => {
        setForceEditSections(prev => new Set(prev).add(sectionId));
    };

    const handleCancelForceEdit = (sectionId: string) => {
        setForceEditSections(prev => {
            const next = new Set(prev);
            next.delete(sectionId);
            return next;
        });
    };

    // Undo Section Handler - 섹션 이미지를 이전 상태로 되돌리기
    const handleUndoSection = () => {
        const sectionId = contextMenu.targetId;
        if (!sectionId) return;

        const history = imageHistory[sectionId];
        if (!history || history.length === 0) {
            alert('되돌릴 이전 상태가 없습니다.');
            return;
        }

        // Pop the last image from history and restore it
        const prevImage = history[history.length - 1];
        setImageHistory(prev => ({
            ...prev,
            [sectionId]: prev[sectionId].slice(0, -1)
        }));
        setGeneratedData((prev: any) => ({
            ...prev,
            imageUrls: {
                ...prev.imageUrls,
                [sectionId]: prevImage
            }
        }));
        setContextMenu({ visible: false, x: 0, y: 0, targetId: null });
    };

    // Flip Horizontal Handler - 섹션 이미지 좌우반전
    const handleFlipHorizontal = () => {
        const sectionId = contextMenu.targetId;
        if (!sectionId) return;

        setFlippedSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionId)) {
                next.delete(sectionId);
            } else {
                next.add(sectionId);
            }
            return next;
        });
        setContextMenu({ visible: false, x: 0, y: 0, targetId: null });
    };

    // Product Upload Handler
    const handleProductUpload = async (file: File) => {
        setLoading(true);
        try {
            const imageUrl = await fileToDataUrl(file);
            const type = await detectItemType(imageUrl);

            const newProduct = {
                id: Date.now().toString(),
                type,
                url: imageUrl,
                file
            };

            setUploadedProducts(prev => {
                const next = [...prev, newProduct];
                // Sort order: hat > top > inner > bottom > shoes
                const order = ['hat', 'top', 'inner', 'bottom', 'shoes'];
                return next.sort((a, b) => {
                    const indexA = order.indexOf(a.type);
                    const indexB = order.indexOf(b.type);
                    // If type not in list, put at end
                    return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
                });
            });
        } catch (e) {
            console.error(e);
            alert("제품 분석 실패: " + e);
        } finally {
            setLoading(false);
        }
    };

    // AI Composite Image Handler
    const handleCompositeImage = async (sectionId: string, source: File | { url: string, type: string }) => {
        console.log('🎨 Composite Image Triggered:', sectionId, source);

        // 1. Check if model analysis exists for this section
        const analysis = modelAnalysis[sectionId];
        if (!analysis) {
            console.error('❌ No analysis available for this section. Please enable Model Hold first.');
            alert('모델 분석 정보가 없습니다. 먼저 "모델 홀드"를 활성화하여 분석을 완료해주세요.');
            return;
        }

        // 2. Get Base Image URL
        const baseImageUrl = generatedData.imageUrls[sectionId];
        if (!baseImageUrl) {
            alert('베이스 이미지가 없습니다.');
            return;
        }

        setLoading(true);
        // Add to processing sections for visual feedback
        setProcessingSections(prev => new Set([...prev, sectionId]));

        // Save current image to history for undo
        setImageHistory(prev => ({
            ...prev,
            [sectionId]: [...(prev[sectionId] || []), baseImageUrl]
        }));

        try {
            let itemImageUrl: string;
            let itemType: string;

            if (source instanceof File) {
                console.log('📂 Source is File');
                itemImageUrl = await fileToDataUrl(source);
                console.log('🔍 Detecting item type...');
                itemType = await detectItemType(itemImageUrl);
                console.log(`✅ Detected: ${itemType}`);
            } else {
                console.log('📦 Source is Product Object', source);
                itemImageUrl = source.url;
                itemType = source.type;
                if (!itemImageUrl || !itemType) {
                    throw new Error('Invalid product data: URL or Type missing');
                }
                console.log(`✅ Using pre-detected type: ${itemType}`);
            }

            // 5. Find matching region in analysis
            const targetRegion = analysis.regions.find(r => r.type === itemType);
            if (!targetRegion) {
                console.error(`❌ No ${itemType} region found in analysis`);
                alert(`이 모델에서 ${itemType === 'face' ? '얼굴' : itemType === 'hat' ? '모자' : itemType === 'top' ? '상의' : itemType === 'bottom' ? '하의' : '신발'} 영역을 찾을 수 없습니다.`);
                return;
            }

            console.log(`🎯 Target region for ${itemType}:`, targetRegion);

            // 6. Composite Image using Imagen API
            console.log('🚀 Starting composition...');
            const newImageUrl = await compositeClothingItem({
                baseImage: baseImageUrl,
                itemImage: itemImageUrl,
                itemType: itemType,
                targetRegion: targetRegion
            });

            console.log('✨ Composition complete, updating image...');
            setGeneratedData((prev: any) => ({
                ...prev,
                imageUrls: {
                    ...prev.imageUrls,
                    [sectionId]: newImageUrl
                }
            }));

        } catch (error) {
            console.error('Compositing failed:', error);
            alert(`합성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        } finally {
            setLoading(false);
            // Remove from processing sections
            setProcessingSections(prev => {
                const newSet = new Set(prev);
                newSet.delete(sectionId);
                return newSet;
            });
        }
    };

    // Product Apply Handler (Button Click)
    const handleApplyProduct = async (product: { id: string; type: string; url: string; file: File }) => {
        if (heldSections.size === 0) {
            alert('적용할 모델이 없습니다. 먼저 모델 이미지를 "홀드(Lock)" 해주세요.');
            return;
        }

        const confirmMsg = `${heldSections.size}개의 홀드된 모델에 '${product.type}' 제품을 적용하시겠습니까?`;
        if (!confirm(confirmMsg)) return;

        setLoading(true);
        try {
            // Apply to all held sections
            for (const sectionId of Array.from(heldSections)) {
                await handleCompositeImage(sectionId, { url: product.url, type: product.type });
            }
            alert('모든 모델에 적용 완료되었습니다!');
        } catch (e) {
            console.error(e);
            alert('일부 모델 적용 실패: ' + e);
        } finally {
            setLoading(false);
        }
    };

    // Wear Shoes Handler (Context Menu)
    const handleWearShoes = async () => {
        const sectionId = contextMenu.targetId;
        if (!sectionId) return;

        // Find uploaded shoes
        const shoes = uploadedProducts.find(p => p.type === 'shoes');
        if (!shoes) {
            alert('업로드된 신발 제품이 없습니다. 먼저 신발 사진을 업로드해주세요.');
            return;
        }

        setContextMenu(prev => ({ ...prev, visible: false }));

        // Confirm
        if (!confirm(`선택한 모델에 신발을 착용하시겠습니까?`)) return;

        await handleCompositeImage(sectionId, { url: shoes.url, type: 'shoes' });
    };

    // Color Change Handlers - 클릭 위치 기반으로 의류 부위 자동 감지
    const handleOpenColorPicker = () => {
        const sectionId = contextMenu.targetId;
        if (!sectionId) return;

        // Check if section has model analysis
        if (!modelAnalysis[sectionId]) {
            alert('먼저 "모델 홀드"를 활성화하여 분석을 완료해주세요.');
            return;
        }

        const analysis = modelAnalysis[sectionId];

        // 클릭한 y좌표를 사용하여 의류 부위 감지
        // contextMenu.y는 화면 y좌표이고, 이미지 내 상대적 위치를 계산해야 함
        const sectionElement = document.querySelector(`[data-section="${sectionId}"]`) as HTMLElement;
        let detectedType: string = 'top'; // 기본값

        if (sectionElement) {
            const rect = sectionElement.getBoundingClientRect();
            const clickY = contextMenu.y; // 화면 y좌표
            const relativeY = (clickY - rect.top) / rect.height; // 이미지 내 상대적 y위치 (0~1)

            console.log(`🎯 클릭 위치 분석: relativeY = ${(relativeY * 100).toFixed(1)}%`);

            // 상대적 y위치에 따라 의류 부위 결정
            // 0-15%: 머리/모자 영역
            // 15-40%: 상의 영역
            // 40-75%: 하의/치마 영역
            // 75-100%: 신발/양말 영역

            if (relativeY <= 0.15) {
                // 머리 영역 - 모자 확인
                if (analysis.regions.find(r => r.type === 'hat')) {
                    detectedType = 'hat';
                } else if (analysis.regions.find(r => r.type === 'top')) {
                    detectedType = 'top';
                }
            } else if (relativeY <= 0.40) {
                // 상체 영역 - 상의
                if (analysis.regions.find(r => r.type === 'top')) {
                    detectedType = 'top';
                } else if (analysis.regions.find(r => r.type === 'inner')) {
                    detectedType = 'inner';
                }
            } else if (relativeY <= 0.75) {
                // 하체 영역 - 바지/치마
                if (analysis.regions.find(r => r.type === 'bottom')) {
                    detectedType = 'bottom';
                } else if (analysis.regions.find(r => r.type === 'skirt')) {
                    detectedType = 'skirt';
                } else if (analysis.regions.find(r => r.type === 'pants')) {
                    detectedType = 'pants';
                } else if (analysis.regions.find(r => r.type === 'top')) {
                    // 긴 상의인 경우
                    detectedType = 'top';
                }
            } else {
                // 발 영역 - 신발/양말
                if (analysis.regions.find(r => r.type === 'shoes')) {
                    detectedType = 'shoes';
                } else if (analysis.regions.find(r => r.type === 'socks')) {
                    detectedType = 'socks';
                } else if (analysis.regions.find(r => r.type === 'bottom')) {
                    // 긴 바지인 경우
                    detectedType = 'bottom';
                }
            }

            console.log(`✅ 감지된 의류: ${detectedType} (클릭 위치: ${(relativeY * 100).toFixed(1)}%)`);
        } else {
            // 섹션 요소를 찾을 수 없는 경우 기존 우선순위 방식 사용
            const clothingPriority = ['top', 'bottom', 'shoes', 'inner', 'hat'];
            for (const type of clothingPriority) {
                if (analysis.regions.find(r => r.type === type)) {
                    detectedType = type;
                    break;
                }
            }
        }

        setContextMenu({ visible: false, x: 0, y: 0, targetId: null });
        // Go directly to color picker with detected clothing type
        setColorPickerState({ step: 'selectColor', sectionId, clothingType: detectedType });
    };

    // Color selected callback
    const handleColorChange = async (color: string, colorName: string) => {
        const sectionId = colorPickerState.sectionId;
        const clothingType = colorPickerState.clothingType;
        if (!sectionId || !clothingType) return;

        setColorPickerState({ step: null, sectionId: null, clothingType: null });

        const analysis = modelAnalysis[sectionId];
        const baseImageUrl = generatedData.imageUrls[sectionId];
        if (!analysis || !baseImageUrl) return;

        // Find region matching selected clothing type
        let targetRegion = analysis.regions.find(r => r.type === clothingType);

        // Start processing
        setProcessingSections(prev => new Set([...prev, sectionId]));
        setLoading(true);

        try {
            console.log(`🎨 Changing ${clothingType} to ${colorName}...`);
            const newImageUrl = await changeItemColor({
                baseImage: baseImageUrl,
                itemType: clothingType,
                targetColor: color,
                colorName: colorName,
                targetRegion: targetRegion
            });

            setGeneratedData((prev: any) => ({
                ...prev,
                imageUrls: {
                    ...prev.imageUrls,
                    [sectionId]: newImageUrl
                }
            }));
        } catch (error) {
            console.error('Color change failed:', error);
            alert(`색상 변경 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        } finally {
            setLoading(false);
            setProcessingSections(prev => {
                const newSet = new Set(prev);
                newSet.delete(sectionId);
                return newSet;
            });
        }
    };


    // Pose Generation Handlers
    const handleOpenPoseDialog = (type: 'full' | 'closeup') => {
        console.log('🎯 handleOpenPoseDialog called with type:', type);
        const sectionId = contextMenu.targetId;
        console.log('📌 Target sectionId:', sectionId);

        if (!sectionId) {
            console.log('❌ No sectionId found');
            return;
        }

        // Check if section has an image
        const imageUrl = generatedData?.imageUrls?.[sectionId];
        console.log('🖼️ Image URL:', imageUrl?.substring(0, 100));

        if (!imageUrl || imageUrl.includes('placeholder') || imageUrl === 'SPACER') {
            console.log('⚠️ No valid image - showing alert');
            alert('이미지가 없는 섹션입니다. 먼저 모델 이미지를 업로드해주세요.');
            return;
        }

        console.log('✅ Valid image found, opening dialog');
        setContextMenu(prev => ({ ...prev, visible: false }));
        setPoseDialogState({ visible: true, type, sectionId });
    };

    // Capture section as image using html2canvas
    const captureSectionAsImage = async (sectionId: string): Promise<string> => {
        console.log(`📸 captureSectionAsImage called for: ${sectionId}`);
        const sectionEl = document.querySelector(`[data-section="${sectionId}"]`) as HTMLElement;
        if (!sectionEl) {
            console.error(`❌ Section element not found for: ${sectionId}`);
            // Attempt to list all data-section attributes available for debugging
            const allSections = document.querySelectorAll('[data-section]');
            console.log('Available sections:', Array.from(allSections).map(el => el.getAttribute('data-section')));
            throw new Error(`Section not found: ${sectionId}`);
        }

        console.log(`✅ Element found for ${sectionId}, dimensions: ${sectionEl.offsetWidth}x${sectionEl.offsetHeight}`);

        try {
            const canvas = await html2canvas(sectionEl, {
                useCORS: true,
                scale: 0.8, // Slightly reduced scale for balance between quality and performance
                backgroundColor: '#ffffff', // Ensure white background
                logging: false, // Turn off logging
                onclone: (clonedDoc) => {
                    // console.log(`Clone created for ${sectionId}`, clonedDoc.body);
                }
            });
            // console.log(`✅ html2canvas success for ${sectionId}`);
            return canvas.toDataURL('image/jpeg', 0.85); // Reasonable quality JPEG
        } catch (error) {
            console.error(`❌ html2canvas failed for ${sectionId}:`, error);
            throw error;
        }
    };

    const handlePoseDialogConfirm = async (count: number) => {
        const { sectionId, type } = poseDialogState;
        if (!sectionId) return;

        setPoseDialogState({ visible: false, type: 'full', sectionId: null });

        // Start generation - first capture the preview frame
        setPoseGenerationProgress({
            isGenerating: true,
            current: 0,
            total: count,
            message: '📷 프리뷰 프레임 캡처 중...'
        });

        let imageUrl: string;
        try {
            // Capture the current preview frame instead of using original image
            imageUrl = await captureSectionAsImage(sectionId);
            console.log('📷 Captured preview frame successfully');
        } catch (e) {
            console.error('Failed to capture section:', e);
            // Fallback to original image if capture fails
            imageUrl = generatedData?.imageUrls?.[sectionId];
            if (!imageUrl) {
                setPoseGenerationProgress({ isGenerating: false, current: 0, total: 0, message: '' });
                alert('섹션 캡처에 실패했습니다.');
                return;
            }
            console.log('⚠️ Using original image as fallback');
        }

        // Update progress message
        setPoseGenerationProgress({
            isGenerating: true,
            current: 0,
            total: count,
            message: '🔍 모델 성별 분석 중...'
        });

        try {
            const { results, newUsedPoseIds } = await generatePoseBatch(
                imageUrl,
                count,
                type,
                usedPoseIds,
                (current, total, result) => {
                    setPoseGenerationProgress({
                        isGenerating: true,
                        current,
                        total,
                        message: `🎨 자세 생성 중... (${current}/${total})`
                    });
                }
            );

            // Update used poses
            setUsedPoseIds(newUsedPoseIds);

            // Add generated images as new sections below the original
            const originalIndex = sectionOrder.indexOf(sectionId);
            const newSections: string[] = [];

            results.forEach((result, idx) => {
                const newId = `pose-${Date.now()}-${idx}`;

                // Add image URL
                setGeneratedData((prev: any) => ({
                    ...prev,
                    imageUrls: {
                        ...prev.imageUrls,
                        [newId]: result.imageUrl
                    }
                }));

                // Set height based on type
                setSectionHeights(prev => ({
                    ...prev,
                    [newId]: type === 'closeup' ? 800 : 1200
                }));

                newSections.push(newId);
            });

            // Insert new sections after the original
            setSectionOrder(prev => {
                const newOrder = [...prev];
                newOrder.splice(originalIndex + 1, 0, ...newSections);
                return newOrder;
            });

            setPoseGenerationProgress({
                isGenerating: false,
                current: 0,
                total: 0,
                message: ''
            });

            if (results.length > 0) {
                alert(`✨ ${results.length}개의 자세 변형 이미지가 생성되었습니다!`);
            } else {
                alert('이미지 생성에 실패했습니다. 다시 시도해주세요.');
            }

        } catch (e: any) {
            console.error('Pose generation failed:', e);
            setPoseGenerationProgress({
                isGenerating: false,
                current: 0,
                total: 0,
                message: ''
            });
            alert(`자세 생성 실패: ${e.message || '알 수 없는 오류'}`);
        }
    };

    const handlePoseDialogCancel = () => {
        setPoseDialogState({ visible: false, type: 'full', sectionId: null });
    };

    // Context Menu Handler
    const handleContextMenu = (e: React.MouseEvent, type: string, index: number, sectionId: string) => {
        e.preventDefault();
        if (type === 'section' && sectionId) {
            setContextMenu({
                visible: true,
                x: e.clientX,
                y: e.clientY,
                targetId: sectionId
            });
        }
    };

    const handleGenerate = async (pFiles: File[], mFiles: File[], mode: string) => {
        setLoading(true);
        try {
            let productUrls: string[] = [];
            // Text data structure
            let textData = {
                textContent: {},
                specContent: {},
                heroTextContent: {
                    productName: 'Sample Product',
                    brandLine: 'BRAND NAME',
                    subName: 'Color / Model',
                    stylingMatch: '스타일링 매치 설명이 들어갑니다.',
                    craftsmanship: '제작 공정 및 소재 설명이 들어갑니다.',
                    technology: '핵심 기술 설명이 들어갑니다.'
                },
                noticeContent: {}
            };

            // Process images if any (just to have them available if needed, though we are simplifying)
            if (pFiles.length > 0) {
                productUrls = await Promise.all(pFiles.map(fileToDataUrl));
            }

            // Initial section order - ONLY HERO
            const initialSections = ['hero'];

            setGeneratedData({
                ...textData,
                imageUrls: {
                    // Only keep necessary placeholders or empty arrays
                    products: [],
                    modelShots: [],
                    closeupShots: [],
                    // Custom sections will be added dynamically
                },
                layoutHtml: LAYOUT_TEMPLATE_HTML,
                productFiles: pFiles,
                modelFiles: mFiles,
                sectionOrder: initialSections
            });
            setScreen('result');
            setSectionOrder(initialSections);
        } catch (e) {
            alert("생성 오류: " + e);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = (action: string, type: any, index: any, arg?: any) => {
        if (action === 'updateImage') {
            const sectionKey = type;
            const newUrl = arg;

            setGeneratedData((prev: any) => {
                const newData = { ...prev };
                const targetSection = newData.imageUrls[sectionKey];

                if (Array.isArray(targetSection)) {
                    // Handle array-based sections (products, modelShots, closeupShots)
                    const newArray = [...targetSection];
                    if (typeof newArray[index] === 'string') {
                        newArray[index] = newUrl;
                    } else {
                        newArray[index] = { ...newArray[index], url: newUrl };
                    }
                    newData.imageUrls[sectionKey] = newArray;
                } else {
                    // Handle single image sections (hero, custom)
                    newData.imageUrls[sectionKey] = newUrl;
                }
                return newData;
            });
        }
    };

    // Section Image Download Handler
    const handleDownloadSectionImage = () => {
        const sectionId = contextMenu.targetId;
        if (!sectionId) return;
        const imageUrl = generatedData.imageUrls?.[sectionId];
        if (!imageUrl || imageUrl === 'loading' || imageUrl.length < 100) {
            alert('다운로드할 이미지가 없습니다.');
            return;
        }

        const link = document.createElement('a');
        link.id = 'download-link'; // visual aid if debug needed
        link.href = imageUrl;
        link.download = `section_${sectionId}_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    return (
        <div className="flex flex-col h-screen bg-[#F5F5F7] overflow-hidden">
            {/* Header - Grey on Grey Design */}
            <header className="h-14 bg-white border-b border-[#E2E2E8] flex items-center justify-between px-6 z-50 flex-shrink-0">
                <div className="flex items-center gap-3">
                    {screen === 'result' && (
                        <button
                            onClick={() => navigate('/')}
                            className="p-2 hover:bg-[#F0F0F4] rounded-lg transition-colors"
                            title="뒤로가기"
                        >
                            <svg className="w-5 h-5 text-[#6E6E73]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-bold text-[#111111]">
                            I AM IMPACT
                        </h1>
                        <span className="text-xs px-2 py-0.5 bg-[#F0F0F4] text-[#6E6E73] rounded-full font-semibold">
                            아이엠 임펙트
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {screen === 'result' && (
                        <button
                            onClick={handleNewProject}
                            className="px-3 py-1.5 text-sm text-[#6E6E73] hover:bg-[#F0F0F4] rounded-lg transition-colors border border-[#E2E2E8]"
                        >
                            + 새로 만들기
                        </button>
                    )}
                    <button
                        onClick={handleExportHTML}
                        className="px-3 py-1.5 bg-white border border-[#E2E2E8] text-[#111111] text-sm font-semibold rounded-lg hover:bg-[#F0F0F4] transition-colors"
                    >
                        HTML 저장
                    </button>
                    <button
                        onClick={handleExportJPG}
                        className="px-4 py-1.5 bg-[#111111] text-white text-sm font-semibold rounded-full hover:opacity-90 transition-opacity"
                    >
                        JPG 저장 ({previewDevice === 'mobile' ? '640px' : previewDevice === 'tablet' ? '768px' : '1000px'})
                    </button>
                </div>
            </header>

            {/* Quick Transfer Loading Overlay - Grey on Grey */}
            {quickTransferProgress && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center">
                    <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4 text-center border border-[#E2E2E8]">
                        <div className="w-16 h-16 border-4 border-[#111111] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                        <h3 className="text-xl font-bold text-[#111111] mb-2">Quick Transfer 생성 중</h3>
                        <p className="text-[#6E6E73] mb-4">{quickTransferProgress.status}</p>
                        <div className="w-full bg-[#F0F0F4] rounded-full h-3 overflow-hidden">
                            <div
                                className="h-full bg-[#111111] transition-all duration-300"
                                style={{ width: `${(quickTransferProgress.current / quickTransferProgress.total) * 100}%` }}
                            />
                        </div>
                        <p className="text-sm text-[#A1A1AA] mt-2">{quickTransferProgress.current} / {quickTransferProgress.total}</p>
                    </div>
                </div>
            )}

            <main className="flex-grow overflow-hidden relative">
                {generatedData && (
                    <div className="flex h-full">
                        {/* Left Panel Wrapper - Grey on Grey */}
                        <div className="w-[420px] border-r border-[#E2E2E8] bg-white hidden md:flex flex-col relative z-10 flex-shrink-0 h-full">
                            <div className="flex-grow overflow-y-auto custom-scrollbar">
                                <AdjustmentPanel
                                    data={generatedData}
                                    onUpdate={(newData: any) => {
                                        setGeneratedData(newData);
                                        // Sync sectionOrder if changed
                                        if (newData.sectionOrder && JSON.stringify(newData.sectionOrder) !== JSON.stringify(sectionOrder)) {
                                            setSectionOrder(newData.sectionOrder);
                                        }
                                    }}
                                    showAIAnalysis={showAIAnalysis}
                                    onToggleAIAnalysis={() => setShowAIAnalysis(prev => !prev)}
                                    activeSection={activeSection}
                                    textElements={textElements}
                                    onAddTextElement={handleAddTextElement}
                                    onUpdateTextElement={handleUpdateTextElement}
                                    onDeleteTextElement={handleDeleteTextElement}
                                    onAddSpacerSection={handleAddSpacerSection}
                                    onAddSectionWithImage={handleAddSectionWithImage}
                                    onAddGridSection={handleAddGridSection}
                                    onAddLineElement={handleAddLineElement}
                                    heldSections={heldSections}
                                    activeFilter={activeFilter}
                                    onFilterChange={setActiveFilter}
                                    sectionHeights={sectionHeights}
                                    onUpdateHeights={(key: string, height: number) => setSectionHeights(prev => ({ ...prev, [key]: height }))}
                                    onSetActiveSection={setActiveSection}
                                />
                            </div>
                        </div>

                        {/* Middle Panel */}
                        <div ref={middlePanelRef} className="flex-grow h-full bg-[#F5F5F7] overflow-hidden relative flex flex-col">
                            {/* Responsive Toolbar with Zoom Controls - Floating Cards Style */}
                            <div className="h-14 bg-[#F5F5F7] flex items-center justify-center gap-3 px-4 z-20 flex-shrink-0">
                                {/* Zoom Controls - Floating Card */}
                                <div className="flex items-center gap-1 bg-white rounded-xl px-3 py-1.5 shadow-sm border border-[#E2E2E8]">
                                    <button
                                        onClick={() => setPreviewScale(prev => Math.max(0.2, prev - 0.1))}
                                        className="w-6 h-6 flex items-center justify-center text-[#6E6E73] hover:bg-[#F0F0F4] rounded-md"
                                    >−</button>
                                    <span className="text-[11px] font-semibold text-[#111111] min-w-[45px] text-center">{Math.round(previewScale * 100)}%</span>
                                    <button
                                        onClick={() => setPreviewScale(prev => Math.min(1.5, prev + 0.1))}
                                        className="w-6 h-6 flex items-center justify-center text-[#6E6E73] hover:bg-[#F0F0F4] rounded-md"
                                    >+</button>
                                    <div className="w-px h-4 bg-[#E2E2E8] mx-1.5" />
                                    <button
                                        onClick={() => setPreviewScale(0.5)}
                                        className="px-2 py-1 text-[10px] text-[#6E6E73] hover:bg-[#F0F0F4] rounded-md font-semibold"
                                    >전체</button>
                                    <button
                                        onClick={() => setPreviewScale(1)}
                                        className="px-2 py-1 text-[10px] text-[#111111] hover:bg-[#F0F0F4] rounded-md font-bold"
                                    >100%</button>
                                </div>

                                {/* Device Selector - Floating Card */}
                                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 shadow-sm border border-[#E2E2E8]">
                                    <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wide">Preview:</span>
                                    <div className="flex bg-[#F0F0F4] rounded-lg p-0.5">
                                        <button
                                            onClick={() => handleDeviceChange('mobile')}
                                            className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${previewDevice === 'mobile' ? 'bg-white text-[#111111] shadow-sm' : 'text-[#A1A1AA] hover:text-[#6E6E73]'}`}
                                        >
                                            📱 Mobile
                                        </button>
                                        <button
                                            onClick={() => handleDeviceChange('tablet')}
                                            className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${previewDevice === 'tablet' ? 'bg-white text-[#111111] shadow-sm' : 'text-[#A1A1AA] hover:text-[#6E6E73]'}`}
                                        >
                                            📱 Tablet
                                        </button>
                                        <button
                                            onClick={() => handleDeviceChange('desktop')}
                                            className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all ${previewDevice === 'desktop' ? 'bg-white text-[#111111] shadow-sm' : 'text-[#A1A1AA] hover:text-[#6E6E73]'}`}
                                        >
                                            💻 Desktop
                                        </button>
                                    </div>
                                </div>

                                {/* Minimap Toggle - Floating Card */}
                                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 shadow-sm border border-[#E2E2E8]">
                                    <span className="text-[10px] font-semibold text-[#A1A1AA] uppercase tracking-wide">Minimap</span>
                                    <button
                                        onClick={() => setIsMinimapVisible(!isMinimapVisible)}
                                        className="relative w-9 h-5 rounded-full transition-colors"
                                        style={{ background: isMinimapVisible ? '#111111' : '#E2E2E8' }}
                                    >
                                        <div
                                            className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all"
                                            style={{ left: isMinimapVisible ? 18 : 2 }}
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Preview Area */}
                            <div
                                className={`flex-grow flex justify-center overflow-auto bg-gray-100 p-8 pb-32 custom-scrollbar`}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onWheel={(e) => {
                                    // Ctrl 또는 Meta 키와 함께 휠 시 전체 프리뷰 줌
                                    if (e.ctrlKey || e.metaKey) {
                                        e.preventDefault();
                                        const delta = e.deltaY > 0 ? -0.05 : 0.05;
                                        setPreviewScale(prev => Math.max(0.2, Math.min(1.5, prev + delta)));
                                    }
                                }}
                            >
                                <div
                                    className={`bg-white transition-all duration-300 ease-in-out shadow-2xl origin-top`}
                                    style={{
                                        width: previewDevice === 'desktop' ? '1000px' : previewDevice === 'tablet' ? '768px' : '640px',
                                        minHeight: '100%',
                                        transform: `scale(${previewScale})`,
                                        transformOrigin: 'top center',
                                    }}
                                >
                                    <PreviewPanel
                                        ref={previewRef}
                                        data={generatedData}
                                        imageZoomLevels={imageZoomLevels}
                                        onAction={handleAction}
                                        onZoom={(k: string, d: string) => setImageZoomLevels((p: any) => ({ ...p, [k]: Math.max(0.5, Math.min(3, (p[k] || 1) + (d === 'in' ? 0.1 : -0.1))) }))}
                                        activeSection={activeSection}
                                        onSectionVisible={setActiveSection}
                                        sectionOrder={sectionOrder}
                                        showAIAnalysis={showAIAnalysis}
                                        onHtmlUpdate={setPreviewHtml}
                                        textElements={textElements}
                                        onAddTextElement={handleAddTextElement}
                                        onUpdateTextElement={handleUpdateTextElement}
                                        onDeleteTextElement={handleDeleteTextElement}
                                        onUpdateAllTextElements={handleUpdateAllTextElements}
                                        onContextMenu={handleContextMenu}
                                        lockedImages={new Set()}
                                        sectionHeights={sectionHeights}
                                        onUpdateSectionHeight={handleUpdateSectionHeight}
                                        imageTransforms={imageTransforms}
                                        onUpdateImageTransform={handleUpdateImageTransform}
                                        onDeleteSection={handleDeleteSection}
                                        heldSections={heldSections}
                                        selectedSections={selectedSections}
                                        onToggleHold={handleToggleHold}
                                        onCompositeImage={handleCompositeImage}
                                        isHoldOn={isHoldOn}
                                        forceEditSections={forceEditSections}
                                        onForceEdit={handleForceEdit}
                                        onCancelForceEdit={handleCancelForceEdit}
                                        processingSections={processingSections}
                                        gridSections={gridSections}
                                        onUpdateGridCell={handleUpdateGridCell}
                                        lineElements={lineElements}
                                        onUpdateLineElement={handleUpdateLineElement}
                                        onDeleteLineElement={handleDeleteLineElement}
                                        flippedSections={flippedSections}
                                        activeFilter={activeFilter}
                                        modelAnalysis={modelAnalysis}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right Panel (Mini Map) - Floating Card Style */}
                        {isMinimapVisible && (
                            <div className="w-[150px] flex flex-col relative z-10 flex-shrink-0 h-full p-2 bg-[#F5F5F7]">
                                <div className="flex-1 bg-white rounded-xl shadow-sm border border-[#E2E2E8] overflow-hidden">
                                    <NavigationMinimap
                                        activeSection={activeSection}
                                        onSectionClick={(section) => {
                                            const el = document.querySelector(`[data-section="${section}"]`);
                                            el?.scrollIntoView({ behavior: 'smooth' });
                                        }}
                                        data={generatedData}
                                        sectionOrder={sectionOrder}
                                        onReorder={(newOrder) => {
                                            console.log('New minimap order:', newOrder);
                                            setSectionOrder(newOrder);
                                            // Also update in generatedData if needed
                                            setGeneratedData((prev: any) => ({
                                                ...prev,
                                                sectionOrder: newOrder
                                            }));
                                        }}
                                        onAddSection={() => handleAddSection('custom')}
                                        previewRef={previewRef}
                                        previewHtml={previewHtml}
                                        textElements={textElements}
                                        onAction={handleAction}
                                        isHoldOn={isHoldOn}
                                        onToggleHoldMode={handleToggleGlobalHold}
                                        sectionHeights={sectionHeights}
                                        previewWidth={previewWidth === '100%' ? 1000 : parseInt(previewWidth)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Simple Context Menu */}
            <SimpleContextMenu
                x={contextMenu.x}
                y={contextMenu.y}
                visible={contextMenu.visible}
                isSelected={contextMenu.targetId ? selectedSections.has(contextMenu.targetId) : false}
                isHeld={contextMenu.targetId ? heldSections.has(contextMenu.targetId) : false}
                onToggleSelect={handleToggleSectionSelect}
                onToggleHold={() => {
                    if (contextMenu.targetId) {
                        handleToggleHold(contextMenu.targetId);
                        setContextMenu({ visible: false, x: 0, y: 0, targetId: null });
                    }
                }}
                onGeneratePose={() => handleOpenPoseDialog('full')}
                onGenerateCloseUp={() => handleOpenPoseDialog('closeup')}
                onWearShoes={handleWearShoes}
                onChangeColor={handleOpenColorPicker}
                onUndo={handleUndoSection}
                canUndo={contextMenu.targetId ? (imageHistory[contextMenu.targetId]?.length || 0) > 0 : false}
                isFlipped={contextMenu.targetId ? flippedSections.has(contextMenu.targetId) : false}
                onFlipHorizontal={handleFlipHorizontal}
                hasImage={contextMenu.targetId ? !!(generatedData.imageUrls?.[contextMenu.targetId] && generatedData.imageUrls[contextMenu.targetId] !== 'loading' && generatedData.imageUrls[contextMenu.targetId] !== 'SPACER' && !generatedData.imageUrls[contextMenu.targetId]?.includes?.('placeholder')) : false}
                onDelete={() => {
                    if (!contextMenu.targetId) return;
                    // Delete the section directly
                    const sectionId = contextMenu.targetId;

                    setGeneratedData((prev: any) => {
                        const newData = { ...prev };
                        if (newData.imageUrls[sectionId]) {
                            delete newData.imageUrls[sectionId];
                        }
                        return newData;
                    });
                    setSectionOrder(prevOrder => prevOrder.filter(s => s !== sectionId));
                    setContextMenu({ visible: false, x: 0, y: 0, targetId: null });
                }}
                onDownload={handleDownloadSectionImage}
            />

            {/* Number Input Dialog for Pose Generation */}
            <NumberInputDialog
                visible={poseDialogState.visible}
                title={poseDialogState.type === 'full' ? '🧍 자세생성 (Full Body)' : '👠 클로즈생성 (Lower Body)'}
                maxCount={10}
                onConfirm={handlePoseDialogConfirm}
                onCancel={handlePoseDialogCancel}
            />

            {/* Color Picker Dialog - Direct flow (no clothing type selection) */}
            <ColorPickerDialog
                visible={colorPickerState.step === 'selectColor'}
                onConfirm={handleColorChange}
                onCancel={() => setColorPickerState({ step: null, sectionId: null, clothingType: null })}
            />

            {/* Loading Overlay */}
            {(isProcessing || poseGenerationProgress.isGenerating) && (
                <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-xl shadow-2xl flex flex-col items-center min-w-[300px]">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-600 border-t-transparent mb-4"></div>
                        <p className="text-lg font-bold text-gray-800">
                            {poseGenerationProgress.isGenerating ? '🎨 자세 변형 생성 중...' : 'AI 신발 합성 중...'}
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                            {poseGenerationProgress.isGenerating
                                ? poseGenerationProgress.message
                                : '잠시만 기다려주세요.'}
                        </p>
                        {poseGenerationProgress.isGenerating && poseGenerationProgress.total > 0 && (
                            <div className="mt-4 w-full">
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-300"
                                        style={{ width: `${(poseGenerationProgress.current / poseGenerationProgress.total) * 100}%` }}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 text-center mt-2">
                                    {poseGenerationProgress.current} / {poseGenerationProgress.total}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
