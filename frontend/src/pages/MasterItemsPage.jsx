import { useState, useMemo } from 'react';
import { Folder, ArrowLeft, PlusCircle, Upload, Camera, X, Search } from 'lucide-react';
import { usePos } from '../context/PosContext';
import { apiRequest } from '../services/api';
import { uploadImageToCloudinary } from '../services/cloudinary';
import ItemDetailsModal from '../components/modals/ItemDetailsModal';

export default function MasterItemsPage() {
  const { masterItems, setMasterItems, showToast } = usePos();
  const [activeTab, setActiveTab] = useState('catalog');
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedModalItem, setSelectedModalItem] = useState(null);

  const [form, setForm] = useState({
    oem: '',
    brand: '',
    part_name: '',
    make: '',
    model: '',
    year: '',
    engine: '',
    unit_type: 'pc',
    position: '',
    origin: '',
    description: '',
  });
  const [uploadedUrls, setUploadedUrls] = useState([]);
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const groupedCategories = useMemo(() => {
    const map = new Map();
    masterItems.forEach((item) => {
      const pName = (item.partName || item.part_name || 'UNCATEGORIZED').trim().toUpperCase();
      if (!map.has(pName)) map.set(pName, []);
      map.get(pName).push(item);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [masterItems]);

  const displayedItems = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (q) {
      return masterItems.filter((item) => {
        const oem = (item.oem || '').toUpperCase();
        const pName = (item.partName || item.part_name || '').toUpperCase();
        const brand = (item.brand || '').toUpperCase();
        const model = (item.model || '').toUpperCase();
        return oem.includes(q) || pName.includes(q) || brand.includes(q) || model.includes(q);
      });
    }
    if (selectedGroup) {
      return masterItems.filter(
        (item) => (item.partName || item.part_name || 'UNCATEGORIZED').trim().toUpperCase() === selectedGroup
      );
    }
    return [];
  }, [search, selectedGroup, masterItems]);

  async function handleFileSelect(e) {
    const allFiles = Array.from(e.target.files);
    if (uploadedUrls.length + allFiles.length > 10) {
      showToast('Maximum 10 pictures allowed per item!', 'warning');
    }
    const files = allFiles.slice(0, 10 - uploadedUrls.length);
    if (files.length === 0) return;

    setIsUploadingImg(true);
    try {
      const newUrls = [];
      for (const file of files) {
        const url = await uploadImageToCloudinary(file);
        newUrls.push(url);
      }
      setUploadedUrls((prev) => [...prev, ...newUrls]);
      showToast('✅ Na-upload na ang mga larawan sa Cloudinary!', 'success');
    } catch {
      showToast('❌ Nabigong i-upload ang larawan sa Cloudinary.', 'error');
    } finally {
      setIsUploadingImg(false);
      e.target.value = '';
    }
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    if (!form.oem.trim() || !form.brand.trim() || !form.part_name.trim()) {
      showToast('⚠️ Kailangan ang OEM, Brand, at Part Name.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        oem: form.oem.trim().toUpperCase(),
        brand: form.brand.trim().toUpperCase(),
        part_name: form.part_name.trim().toUpperCase(),
        make: form.make.trim().toUpperCase(),
        model: form.model.trim().toUpperCase(),
        year: form.year.trim().toUpperCase(),
        engine: form.engine.trim().toUpperCase(),
        unit_type: form.unit_type,
        position: form.position.trim().toUpperCase(),
        origin: form.origin.trim().toUpperCase(),
        description: form.description.trim().toUpperCase(),
        images: uploadedUrls,
      };

      const res = await apiRequest('/masters', 'POST', payload);
      const saved = res.master || res;
      if (saved?.id) {
        setMasterItems((prev) => [saved, ...prev]);
      }

      setForm({
        oem: '',
        brand: '',
        part_name: '',
        make: '',
        model: '',
        year: '',
        engine: '',
        unit_type: 'pc',
        position: '',
        origin: '',
        description: '',
      });
      setUploadedUrls([]);
      showToast('✅ Successfully Saved! Master Item ay nairehistro na.', 'success');
      setActiveTab('catalog');
    } catch (err) {
      showToast(`❌ Nabigong i-save ang Master Item: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* SINGLE COMPACT UNIFIED TOOLBAR */}
      <div className="bg-white rounded-xl border border-zinc-300 shadow-2xs overflow-hidden">
        {/* ROW 1: Main Tabs + Inline Search */}
        <div className="px-3.5 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                activeTab === 'catalog'
                  ? 'bg-[#1A1A1A] text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              📁 Registered Master Items ({masterItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-[#FF6600] text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add Master Item</span>
            </button>
          </div>

          {activeTab === 'catalog' && (
            <div className="relative flex-1 md:max-w-md">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  if (e.target.value) setSelectedGroup(null);
                }}
                placeholder="Search Part Name, OEM, Brand, or Model..."
                className="w-full h-8.5 bg-zinc-50 border border-zinc-300 rounded-lg pl-8 pr-7 text-xs uppercase focus:bg-white focus:outline-none focus:border-[#FF6600]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* ROW 2: Compact Category Breadcrumb Strip */}
        {activeTab === 'catalog' && !search.trim() && selectedGroup && (
          <div className="bg-[#FFF7ED] border-t border-orange-200 px-3.5 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setSelectedGroup(null)}
                className="bg-white border border-zinc-300 hover:border-[#FF6600] text-zinc-800 text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back</span>
              </button>
              <div className="flex items-center gap-2 truncate">
                <span className="font-black text-xs text-zinc-900 truncate">{selectedGroup}</span>
                <span className="text-[11px] font-semibold text-zinc-500 shrink-0">
                  - {displayedItems.length} item(s)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: CATALOG GRID */}
      {activeTab === 'catalog' && (
        <div>
          {!search.trim() && !selectedGroup ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {groupedCategories.map(([partName, items]) => {
                const sample = items.find((i) => (i.images || []).length > 0) || items[0];
                const thumb = sample?.images?.[0] || '';
                return (
                  <div
                    key={partName}
                    onClick={() => setSelectedGroup(partName)}
                    className="bg-white rounded-xl border border-zinc-300 p-4 hover:border-[#FF6600] hover:-translate-y-0.5 hover:shadow-lg transition cursor-pointer"
                  >
                    <div className="h-28 bg-zinc-100 rounded-lg mb-3 relative flex items-center justify-center overflow-hidden">
                      {thumb ? (
                        <img src={thumb} alt={partName} className="w-full h-full object-cover" />
                      ) : (
                        <Folder className="w-10 h-10 text-[#FF6600]" />
                      )}
                      <span className="absolute bottom-2 right-2 bg-[#FF6600] text-white text-[10px] font-extrabold px-2 py-0.5 rounded shadow">
                        {items.length} ITEMS
                      </span>
                    </div>
                    <h3 className="font-extrabold text-sm text-zinc-900 truncate">{partName}</h3>
                    <p className="text-xs text-[#FF6600] font-bold mt-1">
                      {items.length} available item(s) ➔
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {displayedItems.map((item) => {
                const thumb = item.images?.[0] || '';
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedModalItem(item)}
                    className="bg-white rounded-xl border border-zinc-300 p-4 hover:border-[#FF6600] hover:-translate-y-0.5 hover:shadow-lg transition cursor-pointer"
                  >
                    <div className="h-28 bg-zinc-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={item.partName || item.part_name || item.oem}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">⚙️</span>
                      )}
                      {(item.images || []).length > 1 && (
                        <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                          {item.images.length} Photos
                        </span>
                      )}
                    </div>

                    <h3 className="font-extrabold text-xs text-zinc-900 truncate">
                      {item.partName || item.part_name} - {item.oem}
                    </h3>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                      {item.brand} | VEHICLE: {item.make} {item.model}
                    </p>
                    {item.engine && (
                      <p className="text-[10px] font-mono text-zinc-400 truncate mt-0.5">
                        ({item.engine})
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REGISTER NEW MASTER ITEM CATALOG */}
      {activeTab === 'register' && (
        <form
          onSubmit={handleRegisterSubmit}
          className="bg-white rounded-2xl border border-zinc-300 p-6 shadow-xs space-y-6 text-xs"
        >
          <div>
            <h2 className="font-black text-base text-zinc-900">Register New Master Item Catalog</h2>
            <p className="text-zinc-500 mt-0.5">Complete the 4 sections below to add a new auto part.</p>
          </div>

          {/* 1. Part Identification */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
            <h3 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wide">
              1. Part Identification
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">OEM / Part Number *</label>
                <input
                  type="text"
                  required
                  value={form.oem}
                  onChange={(e) => setForm({ ...form, oem: e.target.value })}
                  placeholder="e.g. 04465-0K240"
                  className="w-full h-10 border border-zinc-300 bg-white rounded-lg px-3 uppercase font-mono focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Brand / Manufacturer *</label>
                <input
                  type="text"
                  required
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="e.g. BENDIX"
                  className="w-full h-10 border border-zinc-300 bg-white rounded-lg px-3 uppercase focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Part Name *</label>
                <input
                  type="text"
                  required
                  value={form.part_name}
                  onChange={(e) => setForm({ ...form, part_name: e.target.value })}
                  placeholder="e.g. BRAKE PAD FRONT"
                  className="w-full h-10 border border-zinc-300 bg-white rounded-lg px-3 uppercase focus:outline-none focus:border-[#FF6600]"
                />
              </div>
            </div>
          </div>

          {/* 2. Vehicle Compatibility Specs */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
            <h3 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wide">
              2. Vehicle Compatibility Specs
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Vehicle Make</label>
                <input
                  type="text"
                  value={form.make}
                  onChange={(e) => setForm({ ...form, make: e.target.value })}
                  placeholder="e.g. TOYOTA"
                  className="w-full h-10 border border-zinc-300 bg-white rounded-lg px-3 uppercase focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Vehicle Model</label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="e.g. HILUX"
                  className="w-full h-10 border border-zinc-300 bg-white rounded-lg px-3 uppercase focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Year Range</label>
                <input
                  type="text"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  placeholder="e.g. 2016-2023"
                  className="w-full h-10 border border-zinc-300 bg-white rounded-lg px-3 uppercase focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Engine Model</label>
                <input
                  type="text"
                  value={form.engine}
                  onChange={(e) => setForm({ ...form, engine: e.target.value })}
                  placeholder="e.g. 2GD-FTV"
                  className="w-full h-10 border border-zinc-300 bg-white rounded-lg px-3 uppercase focus:outline-none focus:border-[#FF6600]"
                />
              </div>
            </div>
          </div>

          {/* 3. Unit Type & Packaging */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
            <h3 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wide">
              3. Unit Type & Additional Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-bold text-zinc-700 mb-1">Unit / Packaging Type</label>
                <select
                  value={form.unit_type}
                  onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                  className="w-full h-10 border border-zinc-300 bg-white rounded-lg px-3 focus:outline-none focus:border-[#FF6600]"
                >
                  <option value="pc">1 PC (PIECE)</option>
                  <option value="set">SET</option>
                  <option value="box">BOX</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Position</label>
                <input
                  type="text"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  placeholder="e.g. FRONT / REAR"
                  className="w-full h-10 border border-zinc-300 bg-white rounded-lg px-3 uppercase focus:outline-none focus:border-[#FF6600]"
                />
              </div>

              <div>
                <label className="block font-bold text-zinc-700 mb-1">Country of Origin</label>
                <input
                  type="text"
                  value={form.origin}
                  onChange={(e) => setForm({ ...form, origin: e.target.value })}
                  placeholder="e.g. JAPAN"
                  className="w-full h-10 border border-zinc-300 bg-white rounded-lg px-3 uppercase focus:outline-none focus:border-[#FF6600]"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-zinc-700 mb-1">Description / Additional Details</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border border-zinc-300 bg-white rounded-lg p-2.5 uppercase focus:outline-none focus:border-[#FF6600]"
              />
            </div>
          </div>

          {/* 4. Item Gallery Upload */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-extrabold text-xs uppercase text-zinc-800 tracking-wide">
                4. Item Gallery Upload (Max 10 Photos)
              </h3>

              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-1.5 bg-white hover:bg-zinc-100 text-zinc-800 font-bold px-3.5 py-2 rounded-lg border border-zinc-300 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-[#FF6600]" />
                  <span>Choose Photos</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={isUploadingImg || uploadedUrls.length >= 10}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>

                <label className="flex items-center gap-1.5 bg-[#1A1A1A] hover:bg-zinc-800 text-white font-bold px-3.5 py-2 rounded-lg cursor-pointer">
                  <Camera className="w-3.5 h-3.5 text-[#FF6600]" />
                  <span>Take Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={isUploadingImg || uploadedUrls.length >= 10}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {isUploadingImg ? (
              <div className="p-4 text-center font-bold text-[#FF6600] bg-white rounded-lg border border-dashed border-[#FF6600]">
                ⏳ Uploading compressed images to Cloudinary...
              </div>
            ) : uploadedUrls.length === 0 ? (
              <div className="p-4 text-center text-zinc-400 bg-white rounded-lg border border-dashed border-zinc-300">
                No images uploaded yet (0/10)
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 pt-1">
                {uploadedUrls.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="relative w-20 h-20 rounded-xl overflow-hidden border border-zinc-300 bg-white"
                  >
                    <img src={url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setUploadedUrls(uploadedUrls.filter((_, i) => i !== idx))}
                      className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isSaving || isUploadingImg}
              className="bg-[#FF6600] hover:bg-[#EA580C] disabled:bg-zinc-400 text-white text-xs font-extrabold px-6 py-3 rounded-xl shadow cursor-pointer"
            >
              {isSaving ? 'SAVING MASTER ITEM...' : 'SAVE MASTER ITEM AND PROCEED'}
            </button>
          </div>
        </form>
      )}

      {selectedModalItem && (
        <ItemDetailsModal item={selectedModalItem} onClose={() => setSelectedModalItem(null)} />
      )}
    </div>
  );
}