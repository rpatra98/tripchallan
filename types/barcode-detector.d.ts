export interface BarcodeDetector {
  detect(image: ImageBitmapSource): Promise<Array<{
    boundingBox: DOMRectReadOnly;
    rawValue: string;
    format: string;
    cornerPoints: Array<{x: number, y: number}>;
  }>>;
}

export interface BarcodeDetectorOptions {
  formats: string[];
}

export interface BarcodeDetectorConstructor {
  new(options?: BarcodeDetectorOptions): BarcodeDetector;
  supported?(): Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector: BarcodeDetectorConstructor;
  }
} 