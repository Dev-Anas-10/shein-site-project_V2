'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, X, ExternalLink } from 'lucide-react';

const DEFAULT_FALLBACK =
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80';

export interface SafeImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string;
  fallbackSrc?: string;
  enableZoom?: boolean;
}

export function SafeImage({
  src,
  alt = 'Product',
  className = '',
  fallbackSrc = DEFAULT_FALLBACK,
  enableZoom = true,
  onClick,
  ...props
}: SafeImageProps) {
  const [imgSrc, setImgSrc] = useState<string>(src || fallbackSrc);
  const [hasError, setHasError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (src) {
      setImgSrc(src);
      setHasError(false);
    }
  }, [src]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isZoomed) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsZoomed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomed]);

  // Lock scroll when zoomed
  useEffect(() => {
    if (isZoomed) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isZoomed]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(fallbackSrc);
    }
  };

  const handleThumbnailClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (enableZoom) {
      e.stopPropagation();
      setIsZoomed(true);
    }
    onClick?.(e);
  };

  if (!enableZoom) {
    return (
      <img
        src={imgSrc || fallbackSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={handleError}
        className={className}
        onClick={onClick}
        {...props}
      />
    );
  }

  const activeSrc = imgSrc || fallbackSrc;

  return (
    <>
      <div
        className="relative group cursor-zoom-in w-full h-full overflow-hidden rounded-[inherit] flex items-center justify-center select-none"
        onClick={handleThumbnailClick}
        title="اضغط لتكبير ومعاينة الصورة"
      >
        <img
          src={activeSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={handleError}
          className={`${className} transition-transform duration-300 group-hover:scale-105`}
          {...props}
        />
        {/* Hover zoom overlay indicator */}
        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none rounded-[inherit]">
          <span className="p-1.5 rounded-full bg-black/60 backdrop-blur-xs text-white shadow-md transform scale-90 group-hover:scale-100 transition-transform">
            <ZoomIn className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      {/* Fullscreen Lightbox Modal Portal */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isZoomed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setIsZoomed(false)}
                className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8 cursor-zoom-out select-none"
              >
                {/* Floating Top Controls */}
                <div
                  className="absolute top-5 right-5 sm:top-6 sm:right-6 flex items-center gap-2 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  {activeSrc && (
                    <a
                      href={activeSrc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95"
                      title="فتح الصورة في تبويب جديد"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsZoomed(false)}
                    className="p-3 rounded-full bg-white/10 hover:bg-white/25 text-white backdrop-blur-md transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95"
                    title="إغلاق (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Main Image Container */}
                <motion.div
                  initial={{ scale: 0.88, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.88, opacity: 0 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative max-w-full max-h-[82vh] flex items-center justify-center cursor-default"
                >
                  <img
                    src={activeSrc}
                    alt={alt}
                    className="max-h-[80vh] max-w-[92vw] sm:max-w-[85vw] object-contain rounded-2xl shadow-2xl border border-white/10"
                  />
                </motion.div>

                {/* Bottom Caption Pill */}
                {alt && alt !== 'Product' && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ delay: 0.1 }}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-4 max-w-lg px-5 py-2.5 rounded-full bg-neutral-900/80 border border-white/15 text-white text-xs font-bold text-center backdrop-blur-md shadow-xl line-clamp-1 cursor-default"
                  >
                    {alt}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
