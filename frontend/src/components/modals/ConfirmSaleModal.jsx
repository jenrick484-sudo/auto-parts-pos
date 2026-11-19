import { useState, useEffect } from 'react';
import { X, ShoppingBag } from 'lucide-react';
import { apiRequest } from '../../services/api';
import { usePos } from '../../context/PosContext';
import ImageLightbox from './ImageLightbox';

export default function ConfirmSaleModal({ batch, master, onClose }) {
  const { loggedInUser, syncBackendData, showToast } = usePos();
  const [sellingPrice, setSellingPrice] = useState(Number(batch.price || 0).toFixed(2));
  const [qty, setQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [galleryImages, setGalleryImages] = useState([]);
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unitCost = Number(batch.cost || 0);
  const availableStock = Number(batch.stock || 0);
  const bCode = batch.code || batch.variant_code;
  const pName = master?.partName || master?.part_name || 'AUTO PART';
  const mId = batch.masterId || batch.master_id;

  useEffect(() => {
    async function loadImages() {
      try {
        const res = await apiRequest(`/masters/${mId}/images`, 'GET');
        setGalleryImages(res.images || []);
      } catch {
        setGalleryImages(master?.images || []);
      }
    }
    if (mId) loadImages();
  }, [mId, master]);

  async function handleConfirmSale(e) {
    e.preventDefault();
    setErrorMsg('');

    const priceNum = Number(sellingPrice);
    const qtyNum = Number(qty);

    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMsg('Kailangang mas mataas sa ₱0.00 ang Selling Price!');
      return;
    }
    if (priceNum < unitCost) {
      setErrorMsg(`Hindi pwedeng mas mababa sa puhunan/cost (₱${unitCost.toLocaleString()}) ang Selling Price!`);
      return;
    }
    if (isNaN(qtyNum) || qtyNum <= 0 || qtyNum > availableStock) {
      setErrorMsg(`Wastong quantity lamang (1 hanggang ${availableStock} pcs).`);
      return;
    }

    setIsSubmitting(true);
    try {
      const totalAmount = priceNum * qtyNum;
      await apiRequest('/sales', 'POST', {
        user_id: loggedInUser?.id ? Number(loggedInUser.id) : null,
        batch_code: bCode,
        qty: qtyNum,
        price: priceNum,
        cost: unitCost,
        payment_method: paymentMethod,
        cash_tendered: totalAmount,
        change_amount: 0,
      });

      showToast(`✅ Successfully Saved! Benta para sa ${pName} ay naitala na.`, 'success');
      await syncBackendData({ skipMasters: true, skipUsers: true, skipSuppliers: true });
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Nabigong i-save ang benta sa database.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 bg-[#1A1A1A]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-zinc-300">
          <div className="bg-[#1A1A1A] text-white px-6 py-4 flex justify-between items-center border-b-4 border-[#FF6600]">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-[#FF6600]" />
              <div>
                <h3 className="font-extrabold text-sm">CONFIRM DIRECT SALE</h3>
                <p className="text-xs text-zinc-400 truncate max-w-[260px]">
                  {pName} ({master?.oem || ''})
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleConfirmSale} className="p-6 space-y-4">
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold p-3 rounded-xl">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Clickable Thumbnails for Lightbox */}
            {galleryImages.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {galleryImages.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    onClick={() => setLightboxIdx(idx)}
                    alt="Item"
                    title="I-click para palakihin"
                    className="w-16 h-16 object-cover rounded-lg cursor-zoom-in border-2 border-[#FF6600] hover:scale-105 transition shrink-0"
                  />
                ))}
              </div>
            )}

            <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500">Variant Code / Barcode:</span>
                <strong className="text-[#FF6600] font-mono">{bCode}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Available Stock:</span>
                <strong className="text-green-600">{availableStock} pcs</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Supplier:</span>
                <strong className="text-zinc-900">{batch.supplier}</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">Selling Price (₱)</label>
                <input
                  type="number"
                  step="0.01"
                  min={unitCost}
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Quantity to Sell (Max: {availableStock})
                </label>
                <input
                  type="number"
                  min="1"
                  max={availableStock}
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-[#FF6600]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 mb-1">Payment Method *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full border border-zinc-300 rounded-xl px-3 py-2 text-sm font-bold bg-white focus:outline-none focus:border-[#FF6600]"
              >
                <option value="CASH">CASH</option>
                <option value="GCASH">G-CASH</option>
              </select>
            </div>

            <div className="bg-[#FFF7ED] border border-[#FF6600]/30 rounded-xl p-3 flex justify-between items-center">
              <span className="text-xs font-extrabold text-zinc-700">TOTAL AMOUNT:</span>
              <span className="text-xl font-black text-[#FF6600]">
                ₱{(Number(sellingPrice || 0) * Number(qty || 1)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-xs font-bold py-3 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#FF6600] hover:bg-[#EA580C] disabled:bg-zinc-400 text-white text-xs font-extrabold py-3 rounded-xl shadow cursor-pointer"
              >
                {isSubmitting ? 'SAVING...' : 'Confirm & Log Sale'}
              </button>
            </div>
          </form>
        </div>
      </div>
           
      {lightboxIdx !== null && (
        <ImageLightbox
          images={galleryImages}
          activeIndex={lightboxIdx}
          onChangeIndex={setLightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </>
  );
}
