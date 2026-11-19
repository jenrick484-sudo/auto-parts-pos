import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ImageLightbox({ images, activeIndex, onChangeIndex, onClose }) {
  if (!images || images.length === 0) return null;

  const prev = () => onChangeIndex((activeIndex - 1 + images.length) % images.length);
  const next = () => onChangeIndex((activeIndex + 1) % images.length);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-[10000]"
    >
      <div className="relative bg-white p-4 rounded-2xl max-w-4xl w-full text-center shadow-2xl">
        <button
          onClick={onClose}
          className="absolute -top-3.5 -right-3.5 w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#1A1A1A]/80 hover:bg-[#FF6600] text-white flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#1A1A1A]/80 hover:bg-[#FF6600] text-white flex items-center justify-center cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        <img
          src={images[activeIndex]}
          alt="Enlarged Part"
          className="max-h-[75vh] max-w-full mx-auto object-contain rounded-lg"
        />

        <div className="mt-3 text-xs font-extrabold text-zinc-600">
          Enlarged View ({activeIndex + 1} / {images.length})
        </div>
      </div>
    </div>
  );
}
