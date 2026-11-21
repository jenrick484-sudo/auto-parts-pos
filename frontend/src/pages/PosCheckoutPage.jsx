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
  Trash2,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { usePos } from '../context/PosContext';
import { apiRequest } from '../services/api';
import ConfirmSaleModal from '../components/modals/ConfirmSaleModal';

export default function PosCheckoutPage() {
  const { masterItems, inventoryBatches, showToast, syncBackendData } = usePos();
  const [searchParams] = useSearchParams();

  const [activeSubTab, setActiveSubTab] = useState('sales');
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);

  // Camera Scanner State
  const [isCameraOn, setIsCameraOn] = useState(false);
  const scannerRef = useRef(null);
  const lastScanRef = useRef({ code: '', time: 0 });

  // === CHARGE TAB STATES ===
  const [chargeCustomer, setChargeCustomer] = useState('');
  const [chargeBodyNumber, setChargeBodyNumber] = useState('');
  const [chargeCart, setChargeCart] = useState([]);
  const [chargeSearch, setChargeSearch] = useState('');
  const [isChargeSubmitting, setIsChargeSubmitting] = useState(false);
  const [expandedUtang, setExpandedUtang] = useState(null);

  // State para sa Utang List (Local Storage)
  const [utangList, setUtangList] = useState(() => {
    const saved = localStorage.getItem('pos_utang_list');
    return saved ? JSON.parse(saved) : [];
  });

  // Auto-compute Due Date (5 days from today) - Plain Text
  const chargeDueDate = useMemo(() => {
    const d = new Date(); 
    d.setDate(d.getDate() + 5);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }, []);

  const masterMap = useMemo(() => {
    return new Map(masterItems.map((m) => [Number(m.id), m]));
  }, [masterItems]);

  const chargeSearchResults = useMemo(() => {
    const q = chargeSearch.trim().toUpperCase();
    if (!q) return [];
    return inventoryBatches.filter(b => {
      const master = masterMap.get(Number(b.masterId || b.master_id));
      if (!master) return false;
      return (b.code || b.variant_code || '').toUpperCase().includes(q) || 
             (master.partName || master.part_name || '').toUpperCase().includes(q) ||
             (master.oem || '').toUpperCase().includes(q);
    }).slice(0, 10);
  }, [chargeSearch, inventoryBatches, masterMap]);

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
          bCode.includes(q) || bBarcode.includes(q) ||
          oem.includes(q) || pName.includes(q) || brand.includes(q)
        );
      })
      .slice(0, 40);
  }, [search, inventoryBatches, masterMap]);

  const chargeTotal = chargeCart.reduce((sum, item) => sum + (item.qty * item.price), 0);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearch(q);
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const handleAddChargeItem = (batch) => {
    if (Number(batch.stock || 0) <= 0) return showToast('Out of stock!', 'warning');
    setChargeCart(prev => {
      const existing = prev.find(i => (i.batch.code || i.batch.variant_code) === (batch.code || batch.variant_code));
      if (existing) {
        if (existing.qty + 1 > Number(batch.stock)) return prev;
        return prev.map(i => (i.batch.code === existing.batch.code) ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { batch, qty: 1, price: Number(batch.price) }];
    });
    setChargeSearch('');
  };

  const updateCartQty = (idx, delta) => {
    setChargeCart(prev => prev.map((item, i) => {
      if (i === idx) {
        const newQty = item.qty + delta;
        if (newQty < 1) return item;
        if (newQty > Number(item.batch.stock)) {
          showToast('Lalampas sa stock!', 'warning');
          return item;
        }
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const removeCartItem = (idx) => {
    setChargeCart(prev => prev.filter((_, i) => i !== idx));
  };

  const handleChargeCheckout = async () => {
    if (!chargeCustomer.trim()) return showToast('Please enter Customer Name.', 'warning');
    if (chargeCart.length === 0) return showToast('Walang laman ang cart.', 'warning');

    setIsChargeSubmitting(true);
    try {
      // Send to backend to deduct stock (filtered out from sales log sa backend)
      await apiRequest('/sales', 'POST', {
        payment_method: 'CASH', 
        is_charge: true,        
        cash_tendered: 0,       
        change_amount: 0,
        items: chargeCart.map(i => ({
          variant_code: i.batch.code || i.batch.variant_code,
          qty: i.qty,
          price: i.price
        }))
      });
      
      // Save to Local Storage for the Utang List UI
      const newUtang = {
        id: Date.now(),
        customer: chargeCustomer,
        bodyNumber: chargeBodyNumber,
        dueDate: chargeDueDate,
        total: chargeTotal,
        date: new Date().toLocaleDateString('en-US'),
        items: chargeCart.map(i => {
          const m = masterMap.get(Number(i.batch.masterId || i.batch.master_id)) || {};
          return {
            name: m.partName || m.part_name || 'Unknown Item',
            code: i.batch.code || i.batch.variant_code,
            qty: i.qty,
            price: i.price,
            subtotal: i.qty * i.price
          };
        })
      };
      
      const updatedList = [newUtang, ...utangList];
      setUtangList(updatedList);
      localStorage.setItem('pos_utang_list', JSON.stringify(updatedList));

      showToast('✅ Utang saved! Inventory deducted.', 'success');
      setChargeCart([]); 
      setChargeCustomer(''); 
      setChargeBodyNumber(''); 
      syncBackendData({ skipMasters: true, skipUsers: true, skipSuppliers: true });
    } catch (err) {
      showToast(err.message || 'Error sa pag-save.', 'error');
    } finally {
      setIsChargeSubmitting(false);
    }
  };

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

  const subTabs = [
    { id: 'sales', label: 'Sales (Barcode / Scan)', icon: Barcode },
    { id: 'charge', label: 'Charge (Utang)', icon: CreditCard },
    { id: 'assorted', label: 'Assorted (No Barcode)', icon: PackageOpen },
    { id: 'refund', label: 'Refund & Return', icon: RotateCcw },
    { id: 'payor', label: 'Payor', icon: Wallet },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-Tabs */}
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
                  className="w-full h-10 pl-10 pr-4 border border-zinc-500 rounded-xl text-xs uppercase focus:outline-none focus:border-[#FF6600]"
                />
              </div>
            </div>
          </div>

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
                          <img src={thumb} alt="Part" className="w-full h-full object-cover" />
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
                        {stockNum === 0 ? '0 OUT OF STOCK' : stockNum <= limitNum ? `⚠️ ${stockNum} LOW STOCK` : `STOCK: ${stockNum}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CHARGE (UTANG) MODULE - LIGHT MODE */}
      {activeSubTab === 'charge' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in text-left">
          
          {/* LEFT SIDE (Customer Details, Search, Utang List) */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Customer Details Form */}
            <div className="bg-white rounded-2xl p-6 border border-zinc-300 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-zinc-900 font-bold text-base">Customer Credit Details</h2>
                <span className="text-zinc-500 text-xs">Charge (Utang)</span>
              </div>
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-[11px] font-bold text-zinc-600 mb-1.5 uppercase">Customer Name *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Aling Nena Store" 
                    value={chargeCustomer}
                    onChange={(e) => setChargeCustomer(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:border-[#FF6600] outline-none"
                  />
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-[11px] font-bold text-zinc-600 mb-1.5 uppercase">Body Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 1234" 
                    value={chargeBodyNumber}
                    onChange={(e) => setChargeBodyNumber(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-4 py-2.5 text-sm text-zinc-900 focus:border-[#FF6600] outline-none"
                  />
                </div>
                {/* Due Date as plain text beside Body Number */}
                <div className="pb-2.5 shrink-0">
                  <span className="text-xs text-zinc-500 font-bold uppercase block mb-1">Due Date</span>
                  <span className="text-sm font-black text-[#FF6600]">{chargeDueDate}</span>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-5 h-5 text-zinc-400 absolute left-4 top-3.5" />
              <input 
                type="text" 
                placeholder="Search part to add to utang cart..." 
                value={chargeSearch}
                onChange={(e) => setChargeSearch(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-xl pl-12 pr-4 py-3 text-sm text-zinc-900 focus:border-[#FF6600] outline-none shadow-sm"
              />
              {chargeSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-zinc-300 rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto">
                  {chargeSearchResults.map(res => {
                    const m = masterMap.get(Number(res.masterId || res.master_id)) || {};
                    return (
                      <div 
                        key={res.code || res.variant_code} 
                        onClick={() => handleAddChargeItem(res)}
                        className="p-3 border-b border-zinc-100 hover:bg-orange-50 cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <p className="text-sm text-zinc-900 font-bold">{m.partName || m.part_name}</p>
                          <p className="text-[10px] text-zinc-500">{res.code || res.variant_code} | Stock: {res.stock}</p>
                        </div>
                        <p className="text-[#FF6600] font-bold">₱{Number(res.price).toFixed(2)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* UTANG LIST (Expandable Items) */}
            <div className="bg-white rounded-2xl border border-zinc-300 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-zinc-200 bg-zinc-50 flex justify-between items-center">
                <h3 className="text-zinc-800 font-bold text-sm">Recent Utang List</h3>
                <span className="text-xs text-zinc-500">{utangList.length} record(s)</span>
              </div>
              {utangList.length === 0 ? (
                <p className="p-6 text-center text-xs text-zinc-500">Walang utang records sa device na ito.</p>
              ) : (
                <div className="divide-y divide-zinc-100 max-h-80 overflow-y-auto">
                  {utangList.map(u => (
                    <div key={u.id} className="flex flex-col hover:bg-zinc-50 transition">
                      {/* Header (Clickable to expand) */}
                      <div 
                        onClick={() => setExpandedUtang(expandedUtang === u.id ? null : u.id)}
                        className="p-4 flex justify-between items-center cursor-pointer"
                      >
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{u.customer}</p>
                          <p className="text-[11px] text-zinc-500">
                            Body No: {u.bodyNumber || 'N/A'} | Due: {u.dueDate}
                          </p>
                          <p className="text-[10px] text-zinc-400 mt-1">{u.items.length} items • {u.date}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-[#FF6600] font-black">₱{u.total.toFixed(2)}</p>
                          {expandedUtang === u.id ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
                        </div>
                      </div>
                      
                      {/* Expanded Items View */}
                      {expandedUtang === u.id && (
                        <div className="px-4 pb-4 pt-0">
                          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-2">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase border-b border-zinc-200 pb-1 mb-2">Mga Inutang na Item</p>
                            {u.items.map((item, i) => (
                              <div key={i} className="flex justify-between items-center text-xs">
                                <div>
                                  <span className="font-bold text-zinc-800">{item.name}</span>
                                  <span className="text-[10px] text-zinc-500 block">Code: {item.code}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-zinc-500 block">{item.qty} x ₱{item.price.toFixed(2)}</span>
                                  <span className="font-bold text-zinc-800">₱{item.subtotal.toFixed(2)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDE (Cart & Checkout) */}
          <div className="bg-white rounded-2xl border border-zinc-300 p-5 shadow-sm flex flex-col h-[calc(100vh-200px)]">
            <div className="flex justify-between items-center border-b border-zinc-200 pb-4 mb-4">
              <h3 className="text-zinc-900 font-bold text-sm">Current Utang Cart</h3>
              <button onClick={() => setChargeCart([])} className="text-[11px] text-zinc-500 border border-zinc-300 px-3 py-1.5 rounded-lg hover:text-red-500 hover:border-red-300 transition">Clear</button>
            </div>

            {/* Cart Items with Qty +/- */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {chargeCart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-sm">
                  <p>Walang laman ang cart.</p>
                  <p className="text-xs">Search a part to begin.</p>
                </div>
              ) : (
                chargeCart.map((item, idx) => {
                  const mData = masterMap.get(Number(item.batch.masterId || item.batch.master_id)) || {};
                  const mName = mData.partName || mData.part_name || 'Unknown Item';
                  const bCode = item.batch.code || item.batch.variant_code;
                  return (
                    <div key={idx} className="flex flex-col bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                      <div className="flex justify-between items-start mb-2">
                        {/* Dito makikita ang Pangalan tapad ng Item Number */}
                        <p className="text-xs font-bold text-zinc-900 flex-1 pr-2">
                          {mName} <span className="text-zinc-500 font-mono text-[10px]">({bCode})</span>
                        </p>
                        <button onClick={() => removeCartItem(idx)} className="text-red-400 hover:text-red-600 shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex justify-between items-center">
                        {/* Qty Adjuster */}
                        <div className="flex items-center gap-2 bg-white border border-zinc-300 rounded-lg px-2 py-1">
                          <button onClick={() => updateCartQty(idx, -1)} className="text-zinc-600 hover:text-[#FF6600]">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold text-zinc-900 w-6 text-center">{item.qty}</span>
                          <button onClick={() => updateCartQty(idx, 1)} className="text-zinc-600 hover:text-[#FF6600]">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-zinc-500">₱{item.price.toFixed(2)} each</p>
                          <p className="text-sm font-bold text-[#FF6600]">₱{(item.qty * item.price).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Totals & Checkout */}
            <div className="border-t border-zinc-200 pt-4 space-y-3 mt-4">
              <div className="flex justify-between text-lg font-black text-zinc-900 pt-2">
                <span>Total Utang</span>
                <span className="text-[#FF6600]">₱{chargeTotal.toFixed(2)}</span>
              </div>

              <button 
                onClick={handleChargeCheckout}
                disabled={isChargeSubmitting || chargeCart.length === 0 || !chargeCustomer}
                className="w-full mt-2 bg-[#FF6600] hover:bg-[#EA580C] disabled:bg-zinc-300 text-white text-sm font-extrabold py-3.5 rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                {isChargeSubmitting ? 'Saving...' : 'Complete Utang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTHER PLACEHOLDER MODULES */}
      {activeSubTab === 'assorted' && (
        <div className="bg-white rounded-2xl border border-zinc-300 p-8 text-center">
          <h3 className="font-extrabold text-sm text-zinc-900">Assorted Items (No Barcode) Module</h3>
        </div>
      )}

      {activeSubTab === 'refund' && (
        <div className="bg-white rounded-2xl border border-zinc-300 p-8 text-center">
          <h3 className="font-extrabold text-sm text-zinc-900">Refund & Return Module</h3>
        </div>
      )}

      {activeSubTab === 'payor' && (
        <div className="bg-white rounded-2xl border border-zinc-300 p-8 text-center">
          <h3 className="font-extrabold text-sm text-zinc-900">Payor Module</h3>
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