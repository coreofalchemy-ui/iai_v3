/**
 * 🔐 보안 AI Copywriter 서비스
 * 모든 API 호출은 서버리스 함수를 통해 처리됩니다.
 */

import { callGeminiSecure } from '../../../lib/geminiClient';

export interface CopywritingOutput {
    brandLine: string;
    productName: string;
    subName: string;
    descriptionMain: string;
    stylingMatch: string;
    craftsmanship: string;
    technology: string;
    specColor: string;
    specUpper: string;
    specLining: string;
    specOutsole: string;
    specOrigin: string;
    heelHeight: string;
    sizeGuide: string;
}

/**
 * 🔐 5단계 설득형 카피라이팅 생성 - 보안 버전
 */
export async function generateAICopywriting(imageDataUrl: string): Promise<CopywritingOutput> {
    const prompt = `당신은 명품 패션 브랜드의 수석 카피라이터입니다. 
제품 이미지를 **정밀 분석**하여 구매 전환율을 높이는 **상세페이지 카피**를 작성하세요.

## 🎯 핵심 분석 포인트

### 1. 소재 분석 (CRITICAL - 이미지에서 정확히 파악)
- 겉감: 스웨이드/천연가죽/합성피혁/캔버스/메쉬/패브릭 등 **정확히 식별**
- 광택감: 매트/세미글로시/유광 등 표면 질감 분석
- 밑창: 러버/EVA/TPU/가죽창 등 소재와 패턴 식별

### 2. 스타일링 분석 (구체적 코디 제안 필수)
- **어떤 바지와 매치**: 와이드 슬랙스, 테이퍼드 슬랙스, 스트레이트 데님 등 **2-3가지 구체적 추천**
- **어떤 상의와 매치**: 오버핏 셔츠, 니트, 블레이저 등 **2-3가지 구체적 추천**
- **색상 조합 팁**: 어떤 색상의 옷과 조합하면 최고인지 구체적 제안

---

## 📝 출력 형식 (JSON ONLY)

{
  "brandLine": "브랜드 라인명 (영문 대문자, 10자 이내)",
  "productName": "제품명 (영문 또는 한글, 15자 이내)",
  "subName": "컬러/모델명 (영문 대문자, 15자 이내)",
  "stylingMatch": "스타일링 제안 (150-200자)",
  "craftsmanship": "제작 퀄리티 설명 (150-200자)",
  "technology": "핵심 기술명",
  "specColor": "정확한 색상명",
  "specUpper": "겉감 소재",
  "specLining": "안감 소재",
  "specOutsole": "밑창 소재",
  "specOrigin": "원산지",
  "heelHeight": "굽 높이",
  "sizeGuide": "사이즈 추천"
}

**⚠️ 중요: JSON 형식으로만 응답하세요.**`;

    try {
        const base64Data = imageDataUrl.split(',')[1];
        const mimeType = imageDataUrl.match(/data:([^;]+);/)?.[1] || 'image/jpeg';

        const result = await callGeminiSecure(
            prompt,
            [{ data: base64Data, mimeType }]
        );

        // JSON 파싱
        let jsonText = result.data.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
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
            stylingMatch: "이 제품은 미니멀 포멀룩을 즐기는 분들을 위해 제작되었습니다. 테이퍼드 슬랙스, 와이드 치노팬츠와 매치하면 세련된 비즈니스 캐주얼 스타일을 완성할 수 있습니다.",
            craftsmanship: "프리미엄 스웨이드의 부드러운 질감이 돋보이는 디자인입니다. 더블 스티치 공법으로 내구성을 극대화했으며, 통기성이 우수한 메쉬 안감을 적용하여 장시간 착용에도 쾌적합니다.",
            technology: "오쏘라이트 인솔",
            specColor: "Earth Brown",
            specUpper: "Premium Suede",
            specLining: "Breathable Textile",
            specOutsole: "Non-slip Rubber",
            specOrigin: "Made in KOREA",
            heelHeight: "3.5cm",
            sizeGuide: "정사이즈로 제작되었습니다. 발볼이 넓은 경우 반 사이즈 업을 권장합니다."
        };
    }
}
