import { useState, useEffect } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { usePos } from '../../context/PosContext';
import BarcodeSvg from '../BarcodeSvg';
import ImageLightbox from './ImageLightbox';

export default function ItemDetailsModal({ item, onClose }) {
  const { inventoryBatches } = usePos();
  const [images, setImages] = useState([]);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  useEffect(() => {
    async function loadAllImages() {
      try {
        const res = await apiRequest(`/masters/${item.id}/images`, 'GET');
        setImages(res.images || []);
      } catch {
        setImages(item.images || []);
      }
    }
    if (item?.id) loadAllImages();
  }, [item]);

  const relatedVariants = inventoryBatches.filter(
    (b) => Number(b.masterId || b.master_id) === Number(item.id)
  );

  return (
    <>
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 bg-[#1A1A1A]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col border border-zinc-300">
          {/* Matte Black Header */}
          <div className="bg-[#1A1A1A] text-white px-6 py-4 flex justify-between items-center border-b-4 border-[#FF6600]">
            <div>
              <h3 className="font-extrabold text-base uppercase">
                {item.partName || item.part_name} — {item.oem}
              </h3>
              <p className="text-xs text-zinc-400 uppercase mt-0.5">
                {item.brand} | {item.make} {item.model} {item.engine ? `(${item.engine})` : ''}
              </p>
            </div>
            <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-5">
            {/* Gallery Main + Thumbnails */}
            <div className="space-y-2.5">
              <div
                onClick={() => images.length > 0 && setIsLightboxOpen(true)}
                className={`relative h-56 bg-zinc-100 rounded-xl flex items-center justify-center overflow-hidden border border-zinc-300 ${
                  images.length > 0 ? 'cursor-zoom-in group' : ''
                }`}
              >
                {images.length > 0 ? (
                  <>
                    <img
                      src={images[activeImgIdx]}
                      alt="Part Preview"
                      className="max-h-full max-w-full object-contain transition group-hover:scale-105"
                    />
                    <span className="absolute top-2.5 left-2.5 bg-[#FF6600] text-white text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 shadow">
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>Click to Enlarge</span>
                    </span>
                  </>
                ) : (
                  <span className="text-4xl">⚙️</span>
                )}
              </div>

              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      onClick={() => setActiveImgIdx(i)}
                      alt="Thumb"
                      className={`w-14 h-14 object-cover rounded-lg cursor-pointer border-2 shrink-0 ${
                        i === activeImgIdx ? 'border-[#FF6600]' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Specs Profile Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="bg-zinc-100 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Brand</span>
                <strong className="text-zinc-900 uppercase">{item.brand || 'N/A'}</strong>
              </div>
              <div className="bg-zinc-100 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">OEM / Part Number</span>
                <strong className="text-zinc-900 font-mono uppercase">{item.oem || 'N/A'}</strong>
              </div>
              <div className="bg-zinc-100 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Vehicle Make</span>
                <strong className="text-zinc-900 uppercase">{item.make || 'N/A'}</strong>
              </div>
              <div className="bg-zinc-100 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Vehicle Model</span>
                <strong className="text-zinc-900 uppercase">{item.model || 'N/A'}</strong>
              </div>
              <div className="bg-zinc-100 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Year / Model Year</span>
                <strong className="text-zinc-900 uppercase">{item.year || 'N/A'}</strong>
              </div>
              <div className="bg-zinc-100 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Engine / Engine Code</span>
                <strong className="text-zinc-900 uppercase">{item.engine || 'N/A'}</strong>
              </div>
              <div className="bg-zinc-100 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Unit / Packaging</span>
                <strong className="text-zinc-900 uppercase">
                  {item.unit_type === 'set' ? 'SET' : '1 PC (PIECE)'}
                </strong>
              </div>
              <div className="bg-zinc-100 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Position / Origin</span>
                <strong className="text-zinc-900 uppercase">
                  {item.position || 'N/A'} / {item.origin || 'N/A'}
                </strong>
              </div>
              <div className="sm:col-span-2 bg-zinc-100 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-zinc-500 uppercase block">Description</span>
                <strong className="text-zinc-900 uppercase">{item.description || 'N/A'}</strong>
              </div>
            </div>

            {/* Associated Inventory Variants & Visual Barcodes */}
            <div className="pt-4 border-t border-dashed border-zinc-300">
              <h4 className="text-xs font-extrabold text-zinc-700 uppercase mb-3">
                Associated Inventory Variants & Barcodes ({relatedVariants.length})
              </h4>
              {relatedVariants.length === 0 ? (
                <p className="text-xs text-zinc-400">No variant generated yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {relatedVariants.map((b) => {
                    const bCode = b.code || b.variant_code;
                    return (
                      <div
                        key={bCode}
                        className="flex flex-wrap justify-between items-center gap-3 p-3 border border-zinc-300 rounded-xl bg-white text-xs"
                      >
                        <div>
                          <strong className="text-[#FF6600] font-mono text-sm">{bCode}</strong>
                          <span className="text-zinc-500 ml-2 font-semibold">| {b.supplier}</span>
                          <div className="text-green-600 font-extrabold mt-1">
                            ₱{Number(b.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
                            <span className="text-zinc-400 font-normal">({b.stock} pcs)</span>
                          </div>
                        </div>
                        <div className="bg-white p-1.5 border border-dashed border-zinc-300 rounded-lg">
                          <BarcodeSvg value={b.barcode || bCode} width={1.3} height={24} fontSize={9} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox */}
      {isLightboxOpen && (
        <ImageLightbox
          images={images}
          activeIndex={activeImgIdx}
          onChangeIndex={setActiveImgIdx}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </>
  );
}
