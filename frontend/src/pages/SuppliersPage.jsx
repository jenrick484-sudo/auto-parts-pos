import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { usePos } from '../context/PosContext';
import { apiRequest } from '../services/api';

export default function SuppliersPage() {
  const { registeredSuppliers, syncBackendData } = usePos();
  const [form, setForm] = useState({ name: '', contactPerson: '', phone: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAddSupplier(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setIsSubmitting(true);
    try {
      await apiRequest('/suppliers', 'POST', {
        name: form.name.trim().toUpperCase(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      });
      setForm({ name: '', contactPerson: '', phone: '', email: '' });
      await syncBackendData();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Sigurado ka bang gusto mong burahin ang supplier na ito?')) return;
    try {
      await apiRequest(`/suppliers/${id}`, 'DELETE');
      await syncBackendData();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAddSupplier} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-black text-slate-900">Register New Supplier</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <input
            type="text"
            required
            placeholder="Supplier Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border border-slate-300 rounded-xl px-3 py-2 uppercase"
          />
          <input
            type="text"
            placeholder="Contact Person"
            value={form.contactPerson}
            onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
            className="border border-slate-300 rounded-xl px-3 py-2"
          />
          <input
            type="text"
            placeholder="Phone Number"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="border border-slate-300 rounded-xl px-3 py-2"
          />
          <input
            type="email"
            placeholder="Email Address"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border border-slate-300 rounded-xl px-3 py-2"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl cursor-pointer"
          >
            {isSubmitting ? 'SAVING...' : 'SAVE SUPPLIER'}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900 text-white text-[11px] uppercase">
              <th className="p-4">Supplier Name</th>
              <th className="p-4">Contact Person</th>
              <th className="p-4">Phone</th>
              <th className="p-4">Email</th>
              <th className="p-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registeredSuppliers.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-6 text-center text-slate-400">No suppliers registered yet.</td>
              </tr>
            ) : (
              registeredSuppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="p-4 font-extrabold text-slate-900">{s.name}</td>
                  <td className="p-4">{s.contact_person || '—'}</td>
                  <td className="p-4">{s.phone || '—'}</td>
                  <td className="p-4">{s.email || '—'}</td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-red-600 hover:text-red-800 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
