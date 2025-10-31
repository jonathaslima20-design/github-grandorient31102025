export interface FileValidationResult {
  validFiles: File[];
  duplicates: string[];
  invalid: Array<{ name: string; reason: string }>;
}

export interface FileValidationOptions {
  maxFileSize?: number;
  allowedTypes?: string[];
  existingFiles?: File[];
}

export const createFileSignature = (file: File): string => {
  return `${file.name}|${file.size}|${file.type}|${file.lastModified}`;
};

export const generateFileHash = async (file: File): Promise<string> => {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Error generating file hash:', error);
    return createFileSignature(file);
  }
};

export const validateFiles = async (
  files: File[],
  options: FileValidationOptions = {}
): Promise<FileValidationResult> => {
  const {
    maxFileSize = 5,
    allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'],
    existingFiles = []
  } = options;

  const result: FileValidationResult = {
    validFiles: [],
    duplicates: [],
    invalid: []
  };

  const processedSignatures = new Set<string>();
  const existingSignatures = new Set(existingFiles.map(createFileSignature));

  const fileArray = Array.from(files);

  console.log('Starting validation:');
  console.log(`  Files to validate: ${fileArray.length}`);
  console.log(`  Existing files: ${existingFiles.length}`);
  console.log(`  Existing signatures:`, Array.from(existingSignatures));

  for (const file of fileArray) {
    const fileSignature = createFileSignature(file);
    console.log(`Checking file: ${file.name}, signature: ${fileSignature}`);

    if (file.size > maxFileSize * 1024 * 1024) {
      console.log(`  -> INVALID: Size exceeds limit`);
      result.invalid.push({
        name: file.name,
        reason: `Tamanho excede ${maxFileSize}MB`
      });
      continue;
    }

    if (!allowedTypes.some(type => file.type.startsWith(type.split('/')[0]) || file.type === type)) {
      console.log(`  -> INVALID: Type not allowed`);
      result.invalid.push({
        name: file.name,
        reason: 'Tipo de arquivo não permitido'
      });
      continue;
    }

    if (existingSignatures.has(fileSignature)) {
      console.log(`  -> DUPLICATE: Already exists in uploaded images`);
      result.duplicates.push(file.name);
      continue;
    }

    if (processedSignatures.has(fileSignature)) {
      console.log(`  -> DUPLICATE: Already in current batch`);
      result.duplicates.push(file.name);
      continue;
    }

    console.log(`  -> VALID: Adding to valid files`);
    processedSignatures.add(fileSignature);
    result.validFiles.push(file);
  }

  console.log(`Validation complete: ${result.validFiles.length} valid, ${result.duplicates.length} duplicates, ${result.invalid.length} invalid`);

  return result;
};

export const areFilesIdentical = (file1: File, file2: File): boolean => {
  return createFileSignature(file1) === createFileSignature(file2);
};

export const findDuplicatesInArray = (files: File[]): Map<string, File[]> => {
  const duplicates = new Map<string, File[]>();
  const signatureMap = new Map<string, File[]>();

  files.forEach(file => {
    const signature = createFileSignature(file);
    const existing = signatureMap.get(signature) || [];
    existing.push(file);
    signatureMap.set(signature, existing);
  });

  signatureMap.forEach((fileList, signature) => {
    if (fileList.length > 1) {
      duplicates.set(signature, fileList);
    }
  });

  return duplicates;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export const getFileExtension = (filename: string): string => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
};

export const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/');
};

export const isVideoFile = (file: File): boolean => {
  return file.type.startsWith('video/');
};
