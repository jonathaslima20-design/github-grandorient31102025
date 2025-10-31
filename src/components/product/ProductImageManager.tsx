import { useState, useRef } from 'react';
import { Upload, X, Star, Image as ImageIcon, Scissors, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageCropperProduct } from '@/components/ui/image-cropper-product';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { validateFiles, formatFileSize } from '@/lib/fileValidation';
import { v4 as uuidv4 } from 'uuid';

type MediaItem = {
  id: string;
  url: string;
  file?: File;
  isFeatured: boolean;
  mediaType: 'image';
};

interface ProductImageManagerProps {
  images: MediaItem[];
  onChange: (images: MediaItem[]) => void;
  maxImages?: number;
  maxFileSize?: number;
}

export function ProductImageManager({
  images,
  onChange,
  maxImages = 10,
  maxFileSize = 5
}: ProductImageManagerProps) {
  const [dragOver, setDragOver] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [imageToRecrop, setImageToRecrop] = useState<MediaItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingQueueRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    console.log('=== handleFileSelect called ===');
    console.log('FileList length:', files.length);
    console.log('FileList contents:');
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`  [${i}]:`, {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });
    }

    if (processingQueueRef.current) {
      console.log('Already processing, rejecting new upload');
      toast.info('Aguarde o processamento anterior terminar');
      return;
    }

    processingQueueRef.current = true;
    setIsProcessing(true);
    console.log('Processing started');

    try {
      const remainingSlots = maxImages - images.length;
      const filesToAdd = Array.from(files).slice(0, remainingSlots);

      console.log('After Array.from and slice:');
      filesToAdd.forEach((f, idx) => {
        console.log(`  [${idx}]:`, {
          name: f.name,
          size: f.size,
          type: f.type,
          lastModified: f.lastModified
        });
      });

      if (filesToAdd.length === 0) {
        toast.error(`Limite máximo de ${maxImages} imagens atingido`);
        return;
      }

      const existingFiles = images.map(img => img.file).filter((f): f is File => f !== undefined);

      console.log('Validating', filesToAdd.length, 'files against', existingFiles.length, 'existing files');
      console.log('Files to add:', filesToAdd.map(f => ({ name: f.name, size: f.size, type: f.type, lastModified: f.lastModified })));

      const validationResult = await validateFiles(filesToAdd, {
        maxFileSize,
        allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'],
        existingFiles
      });

      console.log('Validation result:', {
        valid: validationResult.validFiles.length,
        duplicates: validationResult.duplicates.length,
        invalid: validationResult.invalid.length
      });

      if (validationResult.invalid.length > 0) {
        validationResult.invalid.forEach(({ name, reason }) => {
          toast.error(`${name}: ${reason}`);
        });
      }

      if (validationResult.duplicates.length > 0) {
        toast.warning(`Imagens duplicadas ignoradas: ${validationResult.duplicates.join(', ')}`);
      }

      if (validationResult.validFiles.length === 0) {
        if (validationResult.invalid.length === 0 && validationResult.duplicates.length === 0) {
          toast.error('Nenhuma imagem válida para adicionar');
        }
        return;
      }

      const newImages = validationResult.validFiles.map((file, index) => {
        const uniqueId = `new-${uuidv4()}`;
        return {
          id: uniqueId,
          url: URL.createObjectURL(file),
          file: file,
          isFeatured: images.length === 0 && index === 0,
          mediaType: 'image' as const
        };
      });

      console.log('Adding new images:', newImages.map(img => ({ id: img.id, fileName: img.file?.name })));
      console.log('Existing images:', images.map(img => ({ id: img.id, fileName: img.file?.name })));

      const combinedImages = [...images, ...newImages];
      console.log('Final combined images:', combinedImages.map(img => ({ id: img.id, fileName: img.file?.name })));

      onChange(combinedImages);

      const totalSize = validationResult.validFiles.reduce((sum, file) => sum + file.size, 0);
      toast.success(
        `${validationResult.validFiles.length} imagem(ns) adicionada(s) (${formatFileSize(totalSize)})`
      );
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Erro ao processar imagens. Tente novamente.');
    } finally {
      setIsProcessing(false);
      processingQueueRef.current = false;

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (imageToRecrop) {
      const croppedFile = new File([croppedBlob], `recropped-${uuidv4()}.jpg`, {
        type: 'image/jpeg',
      });

      const updatedImages = images.map(img =>
        img.id === imageToRecrop.id
          ? { ...img, url: URL.createObjectURL(croppedFile), file: croppedFile }
          : img
      );

      onChange(updatedImages);
      setShowCropper(false);
      setImageToRecrop(null);
      toast.success('Imagem recortada com sucesso');
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setImageToRecrop(null);
  };

  const handleRecropImage = (image: MediaItem) => {
    setImageToRecrop(image);
    setShowCropper(true);
  };


  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    if (isProcessing) {
      toast.info('Aguarde o processamento anterior terminar');
      return;
    }

    await handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const setFeaturedImage = (imageId: string) => {
    const updatedImages = images.map(img => ({
      ...img,
      isFeatured: img.id === imageId
    }));
    onChange(updatedImages);
  };

  const removeImage = (imageId: string) => {
    const imageToRemove = images.find(img => img.id === imageId);
    const remainingImages = images.filter(img => img.id !== imageId);

    if (imageToRemove?.isFeatured && remainingImages.length > 0) {
      remainingImages[0].isFeatured = true;
    }

    onChange(remainingImages);
  };

  const remainingSlots = maxImages - images.length;

  return (
    <>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">Imagens do Produto</h3>
          <p className="text-sm text-muted-foreground">
            Adicione até {maxImages} imagens. Imagens serão cortadas em proporção quadrada (1:1).
          </p>
        </div>

        {images.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Imagens Atuais</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {images.map((item) => (
                <div
                  key={item.id}
                  className="relative group aspect-square rounded-lg overflow-hidden bg-muted border-2 transition-all"
                >
                  <img
                    src={item.url}
                    alt="Product"
                    className="w-full h-full object-cover"
                  />

                  <div className="absolute top-2 right-2 flex gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant={item.isFeatured ? "default" : "secondary"}
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setFeaturedImage(item.id)}
                      title={item.isFeatured ? "Imagem principal" : "Definir como principal"}
                    >
                      <Star className={cn(
                        "h-4 w-4",
                        item.isFeatured && "fill-current"
                      )} />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRecropImage(item)}
                      title="Recortar imagem"
                    >
                      <Scissors className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeImage(item.id)}
                      title="Remover imagem"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {item.isFeatured && (
                    <div className="absolute bottom-2 left-2">
                      <span className="bg-primary text-primary-foreground text-xs font-medium px-2 py-1 rounded">
                        Principal
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {remainingSlots > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">
              Adicionar Novas Imagens ({remainingSlots} restantes)
            </h4>

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                "relative border-2 border-dashed rounded-lg p-6 transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border",
                isProcessing && "opacity-60 pointer-events-none"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                id="image-upload"
                className="hidden"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => handleFileSelect(e.target.files)}
                disabled={isProcessing}
              />
              <label
                htmlFor="image-upload"
                className={cn(
                  "flex flex-col items-center justify-center",
                  isProcessing ? "cursor-not-allowed" : "cursor-pointer"
                )}
              >
                <div className="rounded-full bg-primary/10 p-4 mb-3">
                  {isProcessing ? (
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                  ) : (
                    <Scissors className="h-6 w-6 text-primary" />
                  )}
                </div>
                <p className="text-sm font-medium text-center mb-1">
                  {isProcessing ? 'Processando...' : 'Upload de Imagens'}
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  PNG, JPG ou WEBP (MÁX. {maxFileSize}MB)
                </p>
                {!isProcessing && (
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    Clique ou arraste
                  </p>
                )}
              </label>
            </div>
          </div>
        )}

        {images.length === 0 && (
          <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg border border-dashed">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhuma imagem adicionada ainda. Adicione pelo menos uma imagem do produto.
            </p>
          </div>
        )}
      </div>

      {imageToRecrop && (
        <ImageCropperProduct
          image={imageToRecrop.url}
          onCrop={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={1}
          open={showCropper}
        />
      )}

    </>
  );
}
