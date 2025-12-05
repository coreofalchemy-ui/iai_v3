import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

export interface CopywritingOutput {
    brandLine: string;        // e.g., "PREMIUM ESSENTIALS"
    productName: string;      // e.g., "URBAN STRIDE"
    subName: string;          // e.g., "MINIMAL BLACK"
    descriptionMain: string;  // 메인 설명
    stylingMatch: string;     // 룩/매칭 정보
    craftsmanship: string;    // 제작/소재 정보
    technology: string;       // 테크놀로지 (예: 오쏘라이트 인솔)
    specColor: string;
    specUpper: string;
    specLining: string;
    specOutsole: string;
    specOrigin: string;
    heelHeight: string;       // 굽 높이
    sizeGuide: string;        // 사이즈 추천 안내
}

/**
 * 5단계 설득형 카피라이팅 구조로 제품 이미지를 분석합니다.
 */
export async function generateAICopywriting(imageDataUrl: string): Promise<CopywritingOutput> {
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });

    const prompt = `당신은 명품 패션 브랜드의 수석 카피라이터입니다. 
제품 이미지를 **정밀 분석**하여 구매 전환율을 높이는 **상세페이지 카피**를 작성하세요.

## 🎯 핵심 분석 포인트

### 1. 소재 분석 (CRITICAL - 이미지에서 정확히 파악)
- 겉감: 스웨이드/천연가죽/합성피혁/캔버스/메쉬/패브릭 등 **정확히 식별**
- 광택감: 매트/세미글로시/유광 등 표면 질감 분석
- 텍스처: 그레인 패턴, 스티치 디테일, 엣지 마감 상태
- 밑창: 러버/EVA/TPU/가죽창 등 소재와 패턴 식별

### 2. 스타일링 분석 (구체적 코디 제안 필수)
- **어떤 사람이 신는가**: 포멀룩/캐주얼/고프코어/스트릿/미니멀 등 타겟 스타일
- **어떤 바지와 매치**: 와이드 슬랙스, 테이퍼드 슬랙스, 스트레이트 데님, 크롭 팬츠 등 **2-3가지 구체적 추천**
- **어떤 상의와 매치**: 오버핏 셔츠, 니트, 블레이저, 티셔츠 등 **2-3가지 구체적 추천**
- **색상 조합 팁**: 어떤 색상의 옷과 조합하면 최고인지 구체적 제안

### 3. 제작 퀄리티 분석
- 스티치 라인의 균일성과 견고함
- 접착 마감 품질
- 에지 처리 방식
- 아웃솔 접합 품질

---

## 📝 출력 형식 (JSON ONLY)

\`\`\`json
{
  "brandLine": "브랜드 라인명 (영문 대문자, 10자 이내, 예: HERITAGE COLLECTION)",
  "productName": "제품명 (영문 또는 한글, 15자 이내)",
  "subName": "컬러/모델명 (영문 대문자, 15자 이내)",
  "stylingMatch": "[첫 문장] 이 제품은 {타겟 스타일}을 즐기는 분들을 위해 제작되었습니다. [이어서] {구체적 바지 2-3개}와 {구체적 상의 2-3개}를 매치하면 완벽한 {룩 이름} 스타일을 완성할 수 있습니다. {색상 조합 팁 1-2문장}. (150-200자)",
  "craftsmanship": "[첫 문장] {소재명}의 {질감 특성}이 돋보이는 디자인입니다. [이어서] {스티치/마감 방식}으로 견고함을 더했으며, {기능적 특성: 통기성/내구성/방수성 등}을 갖추고 있습니다. {아웃솔 특성} 1-2문장. (150-200자)",
  "technology": "핵심 기술명 (예: 오쏘라이트 프리미엄 인솔, 비브람 아웃솔 등)",
  "specColor": "정확한 색상명 (예: Matte Black, Cognac Brown)",
  "specUpper": "겉감 소재 (예: Premium Suede, Full Grain Leather)",
  "specLining": "안감 소재 (예: Breathable Mesh, Textile)",
  "specOutsole": "밑창 소재 (예: Rubber, EVA Composite)",
  "specOrigin": "원산지 (예: Made in KOREA)",
  "heelHeight": "굽 높이 (예: 3.5cm)",
  "sizeGuide": "사이즈 추천 (예: 정사이즈 권장. 발볼이 넓은 분은 반 사이즈 업 추천.)"
}
\`\`\`

**⚠️ 중요: JSON 형식으로만 응답하세요. 마크다운 코드블록 없이 순수 JSON만 출력하세요.**
**⚠️ stylingMatch와 craftsmanship은 반드시 150자 이상 구체적으로 작성하세요.**
`;

    try {
        // 이미지 데이터 준비
        const base64Data = imageDataUrl.split(',')[1];
        const mimeType = imageDataUrl.match(/data:([^;]+);/)?.[1] || 'image/jpeg';

        const result = await model.generateContent([
            { text: prompt },
            {
                inlineData: {
                    mimeType,
                    data: base64Data
                }
            }
        ]);

        const response = await result.response;
        const text = response.text();

        // JSON 파싱 (마크다운 코드블록 제거)
        let jsonText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('AI 응답에서 JSON을 찾을 수 없습니다.');
        }

        const copyData: CopywritingOutput = JSON.parse(jsonMatch[0]);
        return copyData;

    } catch (error) {
        console.error('AI 카피라이팅 생성 오류:', error);

        // 기본값 반환 (에러 시 fallback)
        return {
            brandLine: "HERITAGE LINE",
            productName: "CLASSIC WALKER",
            subName: "EARTH TONE",
            descriptionMain: "클래식한 실루엣과 현대적 감성이 만난 프리미엄 슈즈입니다.",
            stylingMatch: "이 제품은 미니멀 포멀룩을 즐기는 분들을 위해 제작되었습니다. 테이퍼드 슬랙스, 와이드 치노팬츠와 매치하면 세련된 비즈니스 캐주얼 스타일을 완성할 수 있고, 오버핏 셔츠나 심플한 니트웨어와 조합하면 깔끔한 데일리룩을 연출할 수 있습니다. 네이비, 베이지, 그레이 톤의 의류와 특히 잘 어울립니다.",
            craftsmanship: "프리미엄 스웨이드의 부드러운 질감이 돋보이는 디자인입니다. 더블 스티치 공법으로 내구성을 극대화했으며, 통기성이 우수한 메쉬 안감을 적용하여 장시간 착용에도 쾌적함을 유지합니다. 논슬립 러버 아웃솔은 뛰어난 접지력과 내마모성을 제공합니다.",
            technology: "오쏘라이트 인솔",
            specColor: "Earth Brown",
            specUpper: "Premium Suede",
            specLining: "Breathable Textile",
            specOutsole: "Non-slip Rubber",
            specOrigin: "Made in KOREA",
            heelHeight: "3.5cm",
            sizeGuide: "정사이즈로 제작되었습니다. 발볼이 넓거나 두꺼운 양말을 착용할 경우 반 사이즈 업을 권장합니다."
        };
    }
}
