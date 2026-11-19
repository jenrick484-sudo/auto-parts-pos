import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { usePos } from '../context/PosContext';
import { apiRequest } from '../services/api';

export default function UsersPage() {
  const { systemUsers, syncBackendData } = usePos();
  const [form, setForm] = useState({ fullName: '', username: '', password: '', role: 'CASHIER' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleCreateUser(e) {
    e.preventDefault();
    if (!form.fullName.trim() || !form.username.trim() || !form.password) return;
    setIsSubmitting(true);
    try {
      await apiRequest('/users', 'POST', form);
      setForm({ fullName: '', username: '', password: '', role: 'CASHIER' });
      await syncBackendData();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteUser(id) {
    if (!window.confirm('Sigurado ka bang gusto mong burahin ang user account na ito?')) return;
    try {
      await apiRequest(`/users/${id}`, 'DELETE');
      await syncBackendData();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreateUser} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-black text-slate-900">Create System User Account</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <input
            type="text"
            required
            placeholder="Full Name *"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="border border-slate-300 rounded-xl px-3 py-2"
          />
          <input
            type="text"
            required
            placeholder="Username *"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="border border-slate-300 rounded-xl px-3 py-2"
          />
          <input
            type="password"
            required
            placeholder="Password *"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="border border-slate-300 rounded-xl px-3 py-2"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="border border-slate-300 rounded-xl px-3 py-2 bg-white font-bold"
          >
            <option value="CASHIER">CASHIER</option>
            <option value="MANAGER">MANAGER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl cursor-pointer"
          >
            {isSubmitting ? 'CREATING...' : 'CREATE USER'}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900 text-white text-[11px] uppercase">
              <th className="p-4">Full Name</th>
              <th className="p-4">Username</th>
              <th className="p-4 text-center">Role</th>
              <th className="p-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {systemUsers.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="p-4 font-extrabold text-slate-900">{u.fullName || u.full_name}</td>
                <td className="p-4 font-mono">{u.username}</td>
                <td className="p-4 text-center">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      u.role === 'ADMIN'
                        ? 'bg-red-100 text-red-700'
                        : u.role === 'MANAGER'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="p-4 text-center">
                  {u.role === 'ADMIN' ? (
                    <span className="text-slate-400 text-[11px]">Protected</span>
                  ) : (
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="text-red-600 hover:text-red-800 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
