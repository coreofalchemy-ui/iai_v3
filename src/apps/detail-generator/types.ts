export interface UploadedImage {
    file: File;
    previewUrl: string;
    base64: string;
    mimeType: string;
}

export interface UploadFile {
    file: File;
    previewUrl: string;
}

export interface UploadFile {
    file: File;
    previewUrl: string;
}

export interface ProductDetailInfo {
    brandName: string;
    lineName: string;
    productName: string;
    color: string;
    upperMaterial: string;
    liningMaterial: string;
    soleMaterial: string;
    insoleMaterial: string;
    outsoleHeight: string;
    insoleHeight: string;
    sizeSpec: string;
    origin: string;
    intro: string;
    style: string;
    tech: string;
    sizeTip: string;
}

export interface AutoFilledProductInfo {
    category: string;
    color: string;
    upper: string;
    lining: string;
    sole: string;
    insole: string;
    outsoleHeightCm: string;
    insoleHeightCm: string;
    totalHeightCm: string;
    intro: string;
    style: string;
    tech: string;
    sizeTip: string;
}

export interface LookbookImage {
    url: string;
    type: 'model' | 'detail' | 'candidate';
    promptUsed: string;
}

export type LookbookPhase = 'input' | 'generating_candidates' | 'selecting_face' | 'generating_final' | 'complete';
export type ModelGender = 'w' | 'm';
export type ModelAge = '18' | '21' | '25' | '28' | '31' | '35' | '40';
export type ModelEthnicity = 'Korean' | 'Western' | 'East Asian' | 'Black' | 'Mixed';

// [NEW] Detailed content for editable sections
export interface DetailTextContent {
    sizeGuide: {
        specs: { length: string; width: string; heel: string };
        disclaimer: string;
        labels: { size: string[]; width: string[]; weight: string[] };
        visible?: boolean;
    };
    asInfo: {
        defect: { title: string; content: string[] }; // Changed to array for bullets
        contact: { title: string; desc: string; info: string };
        caution: { title: string; content: string[]; icons: { label: string }[] };
        refund: { title: string; policy: { condition: string; cost: string; impossible: string[]; procedure: string } };
    };
    precautions: Array<{ icon: string; title: string; desc: string }>;
}
