import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, ChevronDown, ChevronUp, Plus, PackagePlus, Printer, X } from 'lucide-react';
import { usePos } from '../context/PosContext';
import { apiRequest } from '../services/api';
import { printVariantBarcodes } from '../utils/barcodePrint';
import BarcodeSvg from '../components/BarcodeSvg';

export default function InventoryPage() {
  const { masterItems, inventoryBatches, registeredSuppliers, syncBackendData, showToast } = usePos();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [expandedMasterId, setExpandedMasterId] = useState(null);

  // Modals State
  const [codingMaster, setCodingMaster] = useState(null);
  const [restockBatch, setRestockBatch] = useState(null);
  const [reprintBatch, setReprintBatch] = useState(null);

  // Form States
  const [variantForm, setVariantForm] = useState({
    supplier: '',
    cost: '',
    price: '',
    stock: '',
    lowStockLimit: '2',
  });
  const [addQty, setAddQty] = useState('');
  const [printQty, setPrintQty] = useState('1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-open Restock Modal kapag galing sa Dashboard "+ Restock" button (?restock=CODE)
  useEffect(() => {
    const restockCode = searchParams.get('restock');
    if (restockCode && inventoryBatches.length > 0) {
      const target = inventoryBatches.find(
        (b) => (b.code || b.variant_code || '').toUpperCase() === restockCode.toUpperCase()
      );
      if (target) {
        setSearch(restockCode);
        setExpandedMasterId(Number(target.masterId || target.master_id));
        setRestockBatch(target);
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, inventoryBatches, setSearchParams]);

  const masterMap = useMemo(() => {
    return new Map(masterItems.map((m) => [Number(m.id), m]));
  }, [masterItems]);

  const batchesByMaster = useMemo(() => {
    const map = new Map();
    inventoryBatches.forEach((b) => {
      const mId = Number(b.masterId || b.master_id);
      if (!map.has(mId)) map.set(mId, []);
      map.get(mId).push(b);
    });
    return map;
  }, [inventoryBatches]);

  const filteredMasters = useMemo(() => {
    const q = search.trim().toUpperCase();
    return masterItems
      .map((m) => {
        const batches = batchesByMaster.get(Number(m.id)) || [];
        const totalStock = batches.reduce((sum, b) => sum + Number(b.stock || 0), 0);
        return { master: m, batches, totalStock };
      })
      .filter(({ master, batches }) => {
        if (!q) return true;
        const matchM =
          (master.oem || '').toUpperCase().includes(q) ||
          (master.partName || master.part_name || '').toUpperCase().includes(q) ||
          (master.brand || '').toUpperCase().includes(q);
        const matchB = batches.some(
          (b) =>
            (b.code || b.variant_code || '').toUpperCase().includes(q) ||
            (b.supplier || '').toUpperCase().includes(q)
        );
        return matchM || matchB;
      })
      .sort((a, b) => (a.totalStock === 0 ? 0 : 1) - (b.totalStock === 0 ? 0 : 1))
      .slice(0, 40);
  }, [search, masterItems, batchesByMaster]);

  async function handleCreateVariant(e) {
    e.preventDefault();
    if (!codingMaster || !variantForm.supplier) {
      showToast('⚠️ Pumili muna ng rehistradong supplier.', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiRequest('/variants', 'POST', {
        masterId: Number(codingMaster.id),
        supplier: variantForm.supplier,
        cost: Number(variantForm.cost),
        price: Number(variantForm.price),
        stock: Number(variantForm.stock),
        lowStockLimit: Number(variantForm.lowStockLimit) || 2,
      });
      await syncBackendData();
      setExpandedMasterId(Number(codingMaster.id));
      setCodingMaster(null);
      setVariantForm({ supplier: '', cost: '', price: '', stock: '', lowStockLimit: '2' });
      showToast('✅ Successfully Saved! Bagong supplier variant coding ay naidagdag na.', 'success');
    } catch (err) {
      showToast(`❌ Nabigong magdagdag ng variant: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRestockSubmit(e) {
    e.preventDefault();
    const qtyNum = parseInt(addQty, 10) || 0;
    if (!restockBatch || qtyNum <= 0) {
      showToast('⚠️ Maglagay ng wastong dami ng stock na idadagdag.', 'warning');
      return;
    }

    setIsSubmitting(true);
    const bCode = restockBatch.code || restockBatch.variant_code;
    const master = masterMap.get(Number(restockBatch.masterId || restockBatch.master_id));

    try {
      const dialogOpened = await printVariantBarcodes(restockBatch, master, qtyNum);
      if (!dialogOpened) return;

      const isPrinted = window.confirm(
        `Na-print na ba ang ${qtyNum} barcode sticker(s) para sa ${bCode}?\n\n` +
          `• OK = Naka-print na (Idagdag na ang +${qtyNum} stock)\n` +
          `• Cancel = Kinansela ang pag-print (Huwag idagdag ang stock)`
      );

      if (!isPrinted) {
        showToast('ℹ️ Kinansela ang pag-print. Walang naidagdag na stock.', 'info');
        return;
      }

      await apiRequest(`/variants/${bCode}/restock`, 'PATCH', { addQty: qtyNum });
      await syncBackendData({ skipMasters: true, skipUsers: true, skipSuppliers: true });
      setRestockBatch(null);
      setAddQty('');
      showToast(`✅ Successfully Saved! Naidagdag ang +${qtyNum} stock sa inventory.`, 'success');
    } catch (err) {
      showToast(`❌ Nabigong mag-restock: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReprintSubmit(e) {
    e.preventDefault();
    const qtyNum = parseInt(printQty, 10) || 0;
    if (!reprintBatch || qtyNum <= 0) return;

    const master = masterMap.get(Number(reprintBatch.masterId || reprintBatch.master_id));
    await printVariantBarcodes(reprintBatch, master, qtyNum);
    setReprintBatch(null);
    setPrintQty('1');
  }

  return (
    <div className="space-y-5">
      {/* Header & Search */}
      <div className="bg-white p-4 rounded-2xl border border-zinc-300 shadow-xs space-y-3">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-zinc-900">
              Central Inventory & Supplier Variant Codings
            </h2>
            <p className="text-xs text-zinc-500">
              I-click ang row upang buksan o isara ang mga supplier variant codings at barcode stickers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/master-items')}
            className="bg-[#FF6600] hover:bg-[#EA580C] text-white text-xs font-bold px-3.5 py-2 rounded-xl cursor-pointer"
          >
            + Register New Master Item
          </button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Master Item, OEM, Variant Code, or Supplier..."
            className="w-full h-10 border border-zinc-300 rounded-xl pl-9 pr-4 text-xs uppercase focus:outline-none focus:border-[#FF6600]"
          />
        </div>
      </div>

      {/* Master Rows */}
      <div className="space-y-3">
        {filteredMasters.map(({ master, batches, totalStock }) => {
          const isExpanded = expandedMasterId === master.id;
          const thumb = (master.images || [])[0];

          return (
            <div
              key={master.id}
              className="bg-white rounded-xl border border-zinc-300 hover:border-[#FF6600] transition overflow-hidden"
            >
              <div className="p-4 flex flex-wrap justify-between items-center gap-4">
                <div
                  onClick={() => setExpandedMasterId(isExpanded ? null : master.id)}
                  className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-[240px]"
                >
                  <div className="w-12 h-12 bg-zinc-100 border border-zinc-300 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                    {thumb ? (
                      <img src={thumb} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">⚙️</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 uppercase">
                      {master.partName || master.part_name} — {master.oem}
                    </h3>
                    <p className="text-xs text-zinc-500 uppercase mt-0.5">
                      {master.brand} | VEHICLE: {master.make} {master.model}{' '}
                      {master.engine ? `(${master.engine})` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCodingMaster(master)}
                    className="bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-800 text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Variant</span>
                  </button>

                  <div
                    onClick={() => setExpandedMasterId(isExpanded ? null : master.id)}
                    className="text-right cursor-pointer"
                  >
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${
                        totalStock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      STOCK: {totalStock}
                    </span>
                    <div className="text-[11px] font-bold text-[#FF6600] mt-1 flex items-center justify-end gap-1">
                      <span>{batches.length} VARIANT(S)</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Variant Grid with Live Visual CODE128 Barcodes */}
              {isExpanded && (
                <div className="bg-zinc-50 border-t border-zinc-200 p-4 space-y-3">
                  <div className="text-[11px] font-extrabold uppercase text-zinc-500 tracking-wide">
                    ASSOCIATED VARIANT CODINGS & BARCODES
                  </div>

                  {batches.length === 0 ? (
                    <p className="text-xs text-zinc-400">NO VARIANT CREATED YET.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {batches.map((b) => {
                        const bCode = b.code || b.variant_code;
                        const stockNum = Number(b.stock || 0);
                        const limitNum = Number(b.lowStockLimit || b.low_stock_limit || 0);

                        return (
                          <div
                            key={bCode}
                            className="bg-white border border-zinc-200 rounded-xl p-3.5 flex flex-col justify-between gap-3"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <div className="font-mono font-extrabold text-xs text-[#FF6600]">{bCode}</div>
                                <div className="text-[11px] text-zinc-500 mt-0.5">SUPPLIER: {b.supplier}</div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setReprintBatch(b);
                                  setPrintQty('1');
                                }}
                                title="Print Barcode Stickers"
                                className="text-zinc-500 hover:text-[#FF6600] p-1.5 rounded-lg hover:bg-[#FFF7ED] cursor-pointer"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Live CODE128 Barcode Box */}
                            <div className="bg-zinc-50 border border-zinc-200 rounded-lg py-2 px-3 flex items-center justify-center overflow-x-auto">
                              <BarcodeSvg value={b.barcode || bCode} width={1.4} height={26} fontSize={10} />
                            </div>

                            <div className="pt-2.5 border-t border-zinc-100 flex justify-between items-end gap-2">
                              <div>
                                <div className="text-sm font-black text-zinc-900">
                                  ₱{Number(b.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="text-[10px] text-zinc-400">
                                  COST: ₱{Number(b.cost || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                              </div>

                              <div className="text-right">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block mb-1.5 ${
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
                                    : `${stockNum} ${(master.unit_type || 'PC').toUpperCase()}`}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setRestockBatch(b);
                                    setAddQty('');
                                  }}
                                  className="bg-[#FF6600] hover:bg-[#EA580C] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ml-auto cursor-pointer"
                                >
                                  <PackagePlus className="w-3 h-3" />
                                  <span>+ Add Stock</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* NEW SUPPLIER CODING VARIANT MODAL */}
      {codingMaster && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setCodingMaster(null);
          }}
          className="fixed inset-0 bg-[#1A1A1A]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50"
        >
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl">
            <div className="bg-[#1A1A1A] text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-black text-sm">New Supplier Coding Variant</h3>
              <button
                type="button"
                onClick={() => setCodingMaster(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVariant} className="p-5 space-y-4 text-xs">
              <div className="bg-[#FFF7ED] border border-[#FF6600]/30 rounded-xl p-3 font-bold text-zinc-800 uppercase">
                {codingMaster.partName || codingMaster.part_name} - {codingMaster.oem} | {codingMaster.brand}
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Supplier Code / Name *</label>
                <select
                  required
                  value={variantForm.supplier}
                  onChange={(e) => setVariantForm({ ...variantForm, supplier: e.target.value })}
                  className="w-full h-10 border border-zinc-300 rounded-xl px-3 bg-white focus:outline-none focus:border-[#FF6600]"
                >
                  <option value="">SELECT SUPPLIER...</option>
                  {registeredSuppliers.map((s) => (
                    <option key={s.id || s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Puhunan (Cost) ₱ *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={variantForm.cost}
                    onChange={(e) => setVariantForm({ ...variantForm, cost: e.target.value })}
                    className="w-full h-10 border border-zinc-300 rounded-xl px-3 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Selling Price ₱ *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={variantForm.price}
                    onChange={(e) => setVariantForm({ ...variantForm, price: e.target.value })}
                    className="w-full h-10 border border-zinc-300 rounded-xl px-3 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Initial Stock *</label>
                  <input
                    type="number"
                    required
                    value={variantForm.stock}
                    onChange={(e) => setVariantForm({ ...variantForm, stock: e.target.value })}
                    className="w-full h-10 border border-zinc-300 rounded-xl px-3 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-zinc-700 mb-1">Low Stock Limit</label>
                  <input
                    type="number"
                    value={variantForm.lowStockLimit}
                    onChange={(e) => setVariantForm({ ...variantForm, lowStockLimit: e.target.value })}
                    className="w-full h-10 border border-zinc-300 rounded-xl px-3 focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCodingMaster(null)}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#FF6600] hover:bg-[#EA580C] disabled:bg-zinc-400 text-white font-extrabold px-5 py-2.5 rounded-xl shadow cursor-pointer"
                >
                  {isSubmitting ? 'SAVING...' : 'Save Supplier Variant Coding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESTOCK VARIANT MODAL */}
      {restockBatch && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setRestockBatch(null);
          }}
          className="fixed inset-0 bg-[#1A1A1A]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl">
            <div className="bg-[#1A1A1A] text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-black text-sm">RESTOCK VARIANT</h3>
              <button
                type="button"
                onClick={() => setRestockBatch(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="p-5 space-y-4 text-xs">
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 font-mono font-extrabold text-[#FF6600]">
                {restockBatch.code || restockBatch.variant_code} ({restockBatch.supplier})
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">CURRENT STOCK:</label>
                <input
                  type="text"
                  readOnly
                  value={`${restockBatch.stock} pcs`}
                  className="w-full h-10 bg-zinc-100 border border-zinc-300 rounded-xl px-3 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">DAGDAG NA QUANTITY (STOCK): *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                  className="w-full h-10 border border-zinc-300 rounded-xl px-3 text-sm font-bold focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRestockBatch(null)}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#FF6600] hover:bg-[#EA580C] disabled:bg-zinc-400 text-white font-extrabold px-5 py-2.5 rounded-xl shadow cursor-pointer"
                >
                  {isSubmitting ? 'PROCESSING...' : 'Print Stickers & Save Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPRINT ONLY MODAL */}
      {reprintBatch && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setReprintBatch(null);
          }}
          className="fixed inset-0 bg-[#1A1A1A]/65 backdrop-blur-xs flex items-center justify-center p-4 z-50"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl">
            <div className="bg-[#1A1A1A] text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-black text-sm">Print Barcode Stickers</h3>
              <button
                type="button"
                onClick={() => setReprintBatch(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReprintSubmit} className="p-5 space-y-4 text-xs">
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 font-mono font-extrabold text-[#FF6600]">
                {reprintBatch.code || reprintBatch.variant_code}
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Number of Stickers to Print *</label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  required
                  value={printQty}
                  onChange={(e) => setPrintQty(e.target.value)}
                  className="w-full h-10 border border-zinc-300 rounded-xl px-3 text-sm font-bold focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReprintBatch(null)}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="bg-[#FF6600] hover:bg-[#EA580C] text-white font-extrabold px-5 py-2.5 rounded-xl shadow cursor-pointer"
                >
                  Print Barcode Stickers
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}