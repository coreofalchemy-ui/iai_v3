export enum ToolType {
    StyleTransfer = 'style-transfer',
    QuickTransfer = 'quick-transfer',
    VirtualTryOn = 'virtual-tryon',
    TrendPrediction = 'trend-prediction',
    SketchToImage = 'sketch-to-image',
    OutfitRec = 'outfit-rec',
    PatternCreation = 'pattern-creation'
}

export interface ToolConfig {
    id: ToolType;
    title: string;
    description: string;
    actionText: string;
    image: string;
}
