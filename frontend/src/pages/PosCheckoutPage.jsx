import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Search,
  Barcode,
  Camera,
  CameraOff,
  CheckCircle2,
  CreditCard,
  PackageOpen,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import { usePos } from '../context/PosContext';
import ConfirmSaleModal from '../components/modals/ConfirmSaleModal';

export default function PosCheckoutPage() {
  const { masterItems, inventoryBatches, showToast } = usePos();
  const [searchParams] = useSearchParams();

  const [activeSubTab, setActiveSubTab] = useState('sales');
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);

  // Camera Scanner State
  const [isCameraOn, setIsCameraOn] = useState(false);
  const scannerRef = useRef(null);
  const lastScanRef = useRef({ code: '', time: 0 });

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearch(q);
  }, [searchParams]);

  // Cleanup camera kapag umalis sa tab
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const masterMap = useMemo(() => {
    return new Map(masterItems.map((m) => [Number(m.id), m]));
  }, [masterItems]);

  async function toggleCameraScanner() {
    if (isCameraOn) {
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
      setIsCameraOn(false);
      return;
    }

    setIsCameraOn(true);
    setTimeout(async () => {
      try {
        const html5Qr = new Html5Qrcode('pos-qr-reader');
        scannerRef.current = html5Qr;
        await html5Qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            const now = Date.now();
            if (decodedText === lastScanRef.current.code && now - lastScanRef.current.time < 2000) return;
            lastScanRef.current = { code: decodedText, time: now };

            const query = decodedText.trim().toUpperCase();
            const found = inventoryBatches.find(
              (b) =>
                (b.barcode || '').toUpperCase() === query ||
                (b.code || b.variant_code || '').toUpperCase() === query
            );

            if (found) {
              if (Number(found.stock || 0) <= 0) {
                showToast(`⚠️ Out of stock na ang ${query}!`, 'warning');
              } else {
                setSelectedBatch(found);
              }
            } else {
              showToast(`Hindi mahanap ang item para sa Barcode: ${decodedText}`, 'warning');
            }
          }
        );
      } catch {
        setIsCameraOn(false);
        showToast('Hindi mabuksan ang camera. Siguraduhing may camera permission.', 'error');
      }
    }, 100);
  }

  function handleBarcodeKey(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const query = barcodeInput.trim().toUpperCase();
    if (!query) return;

    const exact = inventoryBatches.find(
      (b) =>
        (b.barcode || '').toUpperCase() === query ||
        (b.code || b.variant_code || '').toUpperCase() === query
    );

    if (!exact) {
      showToast(`Hindi mahanap ang item para sa Barcode/Code: "${query}"`, 'warning');
      return;
    }
    if (Number(exact.stock || 0) <= 0) {
      showToast('⚠️ Out of stock na ang item/variant na ito!', 'warning');
      return;
    }
    setSelectedBatch(exact);
    setBarcodeInput('');
  }

  const displayedVariants = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) {
      return inventoryBatches
        .filter((b) => {
          const stock = Number(b.stock || 0);
          const limit = Number(b.lowStockLimit || b.low_stock_limit || 0);
          return stock === 0 || stock <= limit;
        })
        .slice(0, 40);
    }

    return inventoryBatches
      .filter((b) => {
        const master = masterMap.get(Number(b.masterId || b.master_id));
        if (!master) return false;
        const bCode = (b.code || b.variant_code || '').toUpperCase();
        const bBarcode = (b.barcode || bCode).toUpperCase();
        const oem = (master.oem || '').toUpperCase();
        const pName = (master.partName || master.part_name || '').toUpperCase();
        const brand = (master.brand || '').toUpperCase();

        return (
          bCode.includes(q) ||
          bBarcode.includes(q) ||
          oem.includes(q) ||
          pName.includes(q) ||
          brand.includes(q)
        );
      })
      .slice(0, 40);
  }, [search, inventoryBatches, masterMap]);

  const subTabs = [
    { id: 'sales', label: 'Sales (Barcode / Scan)', icon: Barcode },
    { id: 'charge', label: 'Charge (Utang)', icon: CreditCard },
    { id: 'assorted', label: 'Assorted (No Barcode)', icon: PackageOpen },
    { id: 'refund', label: 'Refund & Return', icon: RotateCcw },
    { id: 'payor', label: 'Payor', icon: Wallet },
  ];

  return (
    <div className="space-y-5">
      {/* 5 POS Sub-Tabs (Matching Vanilla JS Structure) */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-zinc-300">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveSubTab(tab.id);
                if (tab.id !== 'sales' && isCameraOn) toggleCameraScanner();
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap border transition cursor-pointer ${
                isActive
                  ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white'
                  : 'bg-white border-zinc-300 text-zinc-800 hover:border-[#FF6600]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#FF6600]' : 'text-zinc-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: MAIN BARCODE & CATALOG CHECKOUT */}
      {activeSubTab === 'sales' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-zinc-300 shadow-xs space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <span className="text-xs font-extrabold uppercase text-zinc-700">
                Scan Barcode or Search Item / Variant
              </span>
              <button
                type="button"
                onClick={toggleCameraScanner}
                className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl text-white transition cursor-pointer ${
                  isCameraOn ? 'bg-red-600 hover:bg-red-700' : 'bg-[#FF6600] hover:bg-[#EA580C]'
                }`}
              >
                {isCameraOn ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                <span>{isCameraOn ? 'Stop Camera' : 'Open Live Camera Scanner'}</span>
              </button>
            </div>

            {/* Live Camera Box */}
            {isCameraOn && (
              <div className="bg-[#1A1A1A] text-white p-4 rounded-xl text-center">
                <div id="pos-qr-reader" className="max-w-sm mx-auto rounded-lg overflow-hidden" />
                <p className="text-xs text-zinc-400 mt-2">Itapat ang barcode sa harap ng camera...</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="SEARCH PART NAME, OEM, BRAND..."
                  className="w-full h-10 pl-10 pr-4 border border-zinc-300 rounded-xl text-xs uppercase focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div className="relative">
                <Barcode className="w-4 h-4 text-[#FF6600] absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeKey}
                  placeholder="SCAN BARCODE OR TYPE CODE + ENTER..."
                  className="w-full h-10 pl-10 pr-4 border border-[#FF6600]/50 bg-[#FFF7ED]/50 rounded-xl text-xs font-mono uppercase focus:outline-none focus:border-[#FF6600]"
                />
              </div>
            </div>
          </div>

          {/* Item Cards Grid */}
          {displayedVariants.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-zinc-300 p-12 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
              <h3 className="font-extrabold text-sm text-zinc-900">
                {search.trim() === '' ? 'ALL ITEMS HAVE SUFFICIENT STOCK!' : 'NO MATCHING VARIANTS FOUND'}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Walang low stock o out of stock na item. Mag-type o mag-scan ng barcode para mag-checkout.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {displayedVariants.map((batch) => {
                const master = masterMap.get(Number(batch.masterId || batch.master_id)) || {};
                const bCode = batch.code || batch.variant_code;
                const stockNum = Number(batch.stock || 0);
                const limitNum = Number(batch.lowStockLimit || batch.low_stock_limit || 0);
                const thumb = (master.images || [])[0];

                return (
                  <div
                    key={bCode}
                    onClick={() => {
                      if (stockNum <= 0) {
                        showToast('⚠️ Out of stock na ang item/variant na ito!', 'warning');
                        return;
                      }
                      setSelectedBatch(batch);
                    }}
                    className="bg-white rounded-xl p-4 border border-zinc-300 hover:border-[#FF6600] hover:-translate-y-0.5 hover:shadow-lg transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="h-28 bg-zinc-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={master.partName || master.part_name || bCode}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-2xl">⚙️</span>
                        )}
                      </div>

                      <h3 className="font-extrabold text-xs text-zinc-900 truncate">
                        {master.partName || master.part_name} - {master.oem}
                      </h3>
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                        {master.brand} | VEHICLE: {master.make} {master.model}
                      </p>
                      <p className="text-[10px] font-mono font-bold text-[#FF6600] truncate mt-1">
                        VARIANT: {bCode} | {batch.supplier}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-zinc-900">
                        ₱{Number(batch.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap ${
                          stockNum === 0
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : stockNum <= limitNum
                            ? 'bg-orange-100 text-orange-800 border border-orange-300'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {stockNum === 0
                          ? '0 OUT OF STOCK'
                          : stockNum <= limitNum
                          ? `⚠️ ${stockNum} LOW STOCK`
                          : `STOCK: ${stockNum}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* OTHER 4 PLACEHOLDER MODULES */}
      {activeSubTab === 'charge' && (
        <div className="bg-white rounded-2xl border border-zinc-300 p-8 text-center">
          <h3 className="font-extrabold text-sm text-zinc-900">Charge (Utang) Module</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Empty muna ang view na ito. Dito ilalagay ang mga features para sa Utang transactions.
          </p>
        </div>
      )}

      {activeSubTab === 'assorted' && (
        <div className="bg-white rounded-2xl border border-zinc-300 p-8 text-center">
          <h3 className="font-extrabold text-sm text-zinc-900">Assorted Items (No Barcode) Module</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Empty muna ang view na ito. Dito ilalagay ang mga piyesang walang barcode at custom pricing.
          </p>
        </div>
      )}

      {activeSubTab === 'refund' && (
        <div className="bg-white rounded-2xl border border-zinc-300 p-8 text-center">
          <h3 className="font-extrabold text-sm text-zinc-900">Refund & Return Module</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Empty muna ang view na ito. Dito ilalagay ang refund at return item logic.
          </p>
        </div>
      )}

      {activeSubTab === 'payor' && (
        <div className="bg-white rounded-2xl border border-zinc-300 p-8 text-center">
          <h3 className="font-extrabold text-sm text-zinc-900">Payor Module</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Empty placeholder — dito ilalagay ang module para sa Payor records at payments.
          </p>
        </div>
      )}

      {/* Checkout Modal */}
      {selectedBatch && (
        <ConfirmSaleModal
          batch={selectedBatch}
          master={masterMap.get(Number(selectedBatch.masterId || selectedBatch.master_id))}
          onClose={() => setSelectedBatch(null)}
        />
      )}
    </div>
  );
}