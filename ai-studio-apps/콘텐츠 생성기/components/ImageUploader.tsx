import React, { useCallback, useState, useMemo } from 'react';
import { UploadFile } from '../types';
import { PhotoIcon, XCircleIcon } from './Icons';

interface ImageUploaderProps {
  title: string;
  description: string;
  onFilesChange: (files: UploadFile[]) => void;
  maxFiles: number;
  maxSizeMB: number;
  isMultiple?: boolean;
  aspectRatio?: string;
  compact?: boolean; // New prop for sidebar styling
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  title,
  description,
  onFilesChange,
  maxFiles,
  maxSizeMB,
  isMultiple = false,
  aspectRatio = '1/1',
  compact = false,
}) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(async (incomingFiles: FileList | null) => {
    if (!incomingFiles) return;

    setError(null);
    let newUploadFiles: UploadFile[] = [];
    let currentFiles = isMultiple ? [...files] : [];
    
    for (const file of Array.from(incomingFiles)) {
      if (currentFiles.length + newUploadFiles.length >= maxFiles) {
        setError(`최대 ${maxFiles}장`);
        break;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`${maxSizeMB}MB 초과`);
        continue;
      }
      if (!file.type.startsWith('image/')) {
        continue;
      }
      newUploadFiles.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    
    const updatedFiles = [...currentFiles, ...newUploadFiles].slice(0, maxFiles);
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  }, [files, maxFiles, maxSizeMB, isMultiple, onFilesChange]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    handleFiles(e.target.files);
  };
  
  const removeFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
    const inputElement = document.getElementById(`file-upload-${title.replace(/\s+/g, '-')}`) as HTMLInputElement;
    if (inputElement) inputElement.value = "";
  };

  const hasFiles = files.length > 0;
  
  // Adjusted grid for compact sidebar
  const gridColsClass = compact 
    ? (isMultiple ? 'grid-cols-3' : 'grid-cols-1') 
    : (isMultiple ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-1');
    
  const aspectClass = aspectRatio === '1/1' ? 'aspect-square' : `aspect-[${aspectRatio}]`;

  const memoizedPreviews = useMemo(() => (
    <div className={`grid gap-2 ${hasFiles ? 'mt-3' : ''} ${gridColsClass}`}>
      {files.map((uploadFile, index) => (
        <div key={index} className={`relative group ${aspectClass}`}>
          <img src={uploadFile.previewUrl} alt={`preview ${index}`} className="w-full h-full object-cover rounded border border-gray-600" />
          <button onClick={(e) => {e.preventDefault(); removeFile(index);}} className="absolute -top-1.5 -right-1.5 bg-black rounded-full text-white hover:text-red-500 z-10 border border-gray-600">
            <XCircleIcon className="w-5 h-5" />
          </button>
        </div>
      ))}
    </div>
  ), [files, hasFiles, gridColsClass, aspectClass, compact]);

  if (compact) {
      return (
        <div className="w-full">
            <div 
                className={`relative flex flex-col justify-center items-center p-5 border-2 border-dashed rounded-xl transition-all
                ${dragActive ? 'border-indigo-500 bg-gray-800' : 'border-gray-700 bg-gray-800/40 hover:border-gray-500 hover:bg-gray-800/60'}
                min-h-[140px]
                `}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
            >
                <label htmlFor={`file-upload-${title.replace(/\s+/g, '-')}`} className="w-full h-full flex flex-col justify-center items-center cursor-pointer">
                <input 
                    id={`file-upload-${title.replace(/\s+/g, '-')}`}
                    type="file"
                    className="hidden"
                    multiple={isMultiple}
                    onChange={handleChange}
                    accept="image/png, image/jpeg, image/webp"
                />
                {!hasFiles && (
                    <div className="text-center py-2">
                         <PhotoIcon className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                         <p className="text-sm font-bold text-gray-300">이미지 업로드</p>
                         <p className="text-xs text-gray-500 mt-1">드래그 또는 클릭</p>
                    </div>
                )}
                {memoizedPreviews}
                </label>
            </div>
            {error && <p className="text-red-400 text-xs mt-2 font-medium">⚠️ {error}</p>}
        </div>
      );
  }

  // Default Legacy Layout (if used elsewhere)
  return (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 flex flex-col">
      <h3 className="text-xl font-semibold text-white">{title}</h3>
      <p className="text-sm text-gray-400 mb-4">{description}</p>
      
      <div 
        className={`flex-grow flex flex-col justify-center items-center p-6 border-2 border-dashed rounded-lg transition-colors
          ${dragActive ? 'border-indigo-400 bg-gray-700/50' : 'border-gray-600 hover:border-gray-500'}
          ${hasFiles ? 'border-solid' : ''}
        `}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <label htmlFor={`file-upload-${title.replace(/\s+/g, '-')}`} className="w-full h-full flex flex-col justify-center items-center cursor-pointer">
          <input 
            id={`file-upload-${title.replace(/\s+/g, '-')}`}
            type="file"
            className="hidden"
            multiple={isMultiple}
            onChange={handleChange}
            accept="image/png, image/jpeg, image/webp"
          />
          {!hasFiles && (
            <>
              <PhotoIcon className="w-12 h-12 text-gray-500 mb-2" />
              <p className="text-gray-400 text-center"><span className="font-semibold text-indigo-400">클릭하여 업로드</span>하거나 파일을 끌어다 놓으세요</p>
              <p className="text-xs text-gray-500 mt-1">이미지당 최대 {maxSizeMB}MB</p>
            </>
          )}
          {memoizedPreviews}
        </label>
      </div>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
};