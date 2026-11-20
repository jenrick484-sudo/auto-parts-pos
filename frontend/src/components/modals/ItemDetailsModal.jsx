import { useState, useEffect } from 'react';
import { X, ZoomIn, Info, Boxes, Image as ImageIcon, Copy, Check } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { usePos } from '../../context/PosContext';
import BarcodeSvg from '../BarcodeSvg';
import ImageLightbox from './ImageLightbox';

export default function ItemDetailsModal({ item, onClose }) {
  const { inventoryBatches, showToast } = usePos();
  const [images, setImages] = useState([]);
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Organized Section Tabs: 'specs' | 'variants' | 'gallery'
  const [activeSection, setActiveSection] = useState('specs');
  const [copiedOem, setCopiedOem] = useState(false);

  useEffect(() => {
    setActiveImgIdx(0);
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

  const totalStock = relatedVariants.reduce((sum, b) => sum + Number(b.stock || 0), 0);

  function handleCopyOem() {
    if (!item.oem) return;
    navigator.clipboard.writeText(item.oem);
    setCopiedOem(true);
    if (showToast) showToast(`Copied OEM: ${item.oem}`, 'info');
    setTimeout(() => setCopiedOem(false), 2000);
  }

  return (
    <>
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 bg-[#1A1A1A]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col border border-zinc-300 max-h-[88vh]">
          {/* STICKY MATTE BLACK HEADER */}
          <div className="bg-[#1A1A1A] text-white px-5 py-4 flex justify-between items-start gap-3 border-b-4 border-[#FF6600] shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-base uppercase truncate">
                  {item.partName || item.part_name}
                </h3>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    totalStock > 0
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}
                >
                  {totalStock > 0 ? `${totalStock} TOTAL STOCK` : 'OUT OF STOCK'}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono font-bold text-[#FF6600]">OEM: {item.oem || 'N/A'}</span>
                {item.oem && (
                  <button
                    type="button"
                    onClick={handleCopyOem}
                    className="text-[10px] bg-white/10 hover:bg-white/20 text-zinc-300 px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                    title="Copy OEM Number"
                  >
                    {copiedOem ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedOem ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-white cursor-pointer p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ORGANIZED NAVIGATION TABS */}
          <div className="bg-zinc-100 px-4 pt-2.5 border-b border-zinc-300 flex gap-2 overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() => setActiveSection('specs')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-extrabold rounded-t-xl border-t border-x transition cursor-pointer whitespace-nowrap ${
                activeSection === 'specs'
                  ? 'bg-white text-[#FF6600] border-zinc-300 -mb-px'
                  : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-900'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Specifications & Fitment</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('variants')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-extrabold rounded-t-xl border-t border-x transition cursor-pointer whitespace-nowrap ${
                activeSection === 'variants'
                  ? 'bg-white text-[#FF6600] border-zinc-300 -mb-px'
                  : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-900'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Variants & Barcodes ({relatedVariants.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('gallery')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-extrabold rounded-t-xl border-t border-x transition cursor-pointer whitespace-nowrap ${
                activeSection === 'gallery'
                  ? 'bg-white text-[#FF6600] border-zinc-300 -mb-px'
                  : 'bg-transparent text-zinc-600 border-transparent hover:text-zinc-900'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Photos ({images.length})</span>
            </button>
          </div>

          {/* PANEL CONTENT AREA */}
          <div className="p-5 overflow-y-auto flex-1">
            {/* PANEL 1: SPECIFICATIONS & FITMENT */}
            {activeSection === 'specs' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">
                      Brand / Manufacturer
                    </span>
                    <strong className="text-zinc-900 uppercase text-sm">{item.brand || 'N/A'}</strong>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">
                      Unit / Packaging
                    </span>
                    <strong className="text-zinc-900 uppercase text-sm">
                      {item.unit_type === 'set'
                        ? 'SET'
                        : item.unit_type === 'box'
                        ? 'BOX'
                        : '1 PC (PIECE)'}
                    </strong>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">
                      Vehicle Make & Model
                    </span>
                    <strong className="text-zinc-900 uppercase">
                      {item.make || 'N/A'} {item.model || ''}
                    </strong>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">
                      Year / Engine Code
                    </span>
                    <strong className="text-zinc-900 uppercase">
                      {item.year || 'N/A'} | {item.engine || 'N/A'}
                    </strong>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">Position</span>
                    <strong className="text-zinc-900 uppercase">{item.position || 'N/A'}</strong>
                  </div>
                  <div className="bg-zinc-50 border border-zinc-200 p-3 rounded-xl">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">
                      Country of Origin
                    </span>
                    <strong className="text-zinc-900 uppercase">{item.origin || 'N/A'}</strong>
                  </div>
                  <div className="sm:col-span-2 bg-zinc-50 border border-zinc-200 p-3 rounded-xl">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase block">
                      Description / Notes
                    </span>
                    <strong className="text-zinc-900 uppercase">{item.description || 'N/A'}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* PANEL 2: SUPPLIER VARIANTS & BARCODES */}
            {activeSection === 'variants' && (
              <div className="space-y-3">
                {relatedVariants.length === 0 ? (
                  <div className="text-center py-10 bg-zinc-50 rounded-xl border border-dashed border-zinc-300">
                    <p className="text-xs font-bold text-zinc-500">No supplier variant generated yet.</p>
                  </div>
                ) : (
                  relatedVariants.map((b) => {
                    const bCode = b.code || b.variant_code;
                    const stockNum = Number(b.stock || 0);
                    return (
                      <div
                        key={bCode}
                        className="flex flex-wrap justify-between items-center gap-3 p-3.5 border border-zinc-300 rounded-xl bg-zinc-50/60 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-[#FF6600] font-mono text-sm">{bCode}</strong>
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                stockNum > 0
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {stockNum} PCS
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-500 mt-1">SUPPLIER: {b.supplier}</div>
                          <div className="text-sm font-black text-zinc-900 mt-0.5">
                            ₱{Number(b.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                        </div>

                        <div className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5">
                          <BarcodeSvg value={b.barcode || bCode} width={1.3} height={26} fontSize={9} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* PANEL 3: PHOTO GALLERY */}
            {activeSection === 'gallery' && (
              <div className="space-y-3">
                {images.length === 0 ? (
                  <div className="text-center py-12 bg-zinc-50 rounded-xl border border-dashed border-zinc-300">
                    <span className="text-3xl block mb-2">⚙️</span>
                    <p className="text-xs font-bold text-zinc-500">No photos uploaded for this item.</p>
                  </div>
                ) : (
                  <>
                    <div
                      onClick={() => setIsLightboxOpen(true)}
                      className="relative h-64 bg-zinc-100 rounded-xl flex items-center justify-center overflow-hidden border border-zinc-300 cursor-zoom-in group"
                    >
                      <img
                        src={images[activeImgIdx] || images[0]}
                        alt={item.partName || item.part_name || item.oem}
                        className="w-full h-full object-contain"
                      />
                      <span className="absolute bottom-2.5 right-2.5 bg-black/75 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 group-hover:bg-[#FF6600] transition">
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>Click to Enlarge</span>
                      </span>
                    </div>

                    {images.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {images.map((img, i) => (
                          <img
                            key={img + i}
                            src={img}
                            onClick={() => setActiveImgIdx(i)}
                            alt={`Thumb ${i + 1}`}
                            className={`w-16 h-16 object-cover rounded-lg cursor-pointer border-2 shrink-0 transition ${
                              i === activeImgIdx
                                ? 'border-[#FF6600]'
                                : 'border-transparent opacity-65 hover:opacity-100'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
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
