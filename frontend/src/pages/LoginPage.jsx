import { useState } from 'react';
import { Eye, EyeOff, Wrench, User, Lock, ArrowRight } from 'lucide-react';
import { usePos } from '../context/PosContext';

export default function LoginPage() {
  const { login } = usePos();
  const [username, setUsername] = useState(() => localStorage.getItem('pos_remembered_username') || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => Boolean(localStorage.getItem('pos_remembered_username')));
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password) {
      setErrorMsg('Ilagay ang iyong Username at Password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(username.trim(), password, remember);
    } catch (err) {
      setErrorMsg(err.message || 'Mali ang Username o Password!');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      {/* LEFT SECTION: MATTE BLACK BRANDING PANEL */}
      <div className="hidden lg:flex flex-col justify-between bg-[#171717] text-white p-14 relative overflow-hidden">
        {/* Radial Orange Accent & Grid */}
        <div
          className="absolute -top-28 -right-28 w-96 h-96 rounded-full pointer-events-none"
          style={{
            border: '1px solid rgba(255, 102, 0, 0.25)',
            background: 'radial-gradient(circle, rgba(255, 102, 0, 0.16) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Top Identity */}
        <div className="relative z-10 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#262626] border border-[#FF6600]/40 text-[#FF6600] flex items-center justify-center shadow-lg">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div className="text-lg font-extrabold tracking-widest leading-tight">DAIHO AUTO PARTS</div>
            <div className="text-[11px] font-semibold tracking-[0.2em] text-zinc-400">POS & INVENTORY SYSTEM</div>
          </div>
        </div>

        {/* Center Automotive Graphic */}
        <div className="relative z-10 my-auto py-8">
          <div className="w-11 h-1 rounded bg-[#FF6600] mb-5" />
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
            DRIVE BETTER. <br />
            <span className="text-[#FF6600]">GO FURTHER.</span>
          </h2>
          <p className="text-zinc-400 text-sm mt-4 max-w-md leading-relaxed">
            Your trusted partner for quality automotive parts, real-time stock control, and high-speed barcode checkout.
          </p>
        </div>

        {/* Bottom Copyright */}
        <div className="relative z-10 text-xs text-zinc-500 font-medium">
          © {new Date().getFullYear()} Daiho Auto Parts Supply. All rights reserved.
        </div>
      </div>

      {/* RIGHT SECTION: LOGIN FORM PANEL */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-zinc-50 lg:bg-white">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 border border-zinc-200 shadow-xl shadow-zinc-900/5">
          {/* Mobile Brand Header */}
          <div className="flex lg:hidden items-center gap-3 pb-5 mb-6 border-b border-zinc-200">
            <div className="w-10 h-10 rounded-xl bg-[#FFF7ED] border border-[#FF6600]/30 text-[#FF6600] flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-zinc-900">DAIHO AUTO PARTS SUPPLY</div>
              <div className="text-[11px] font-bold text-[#FF6600]">POS MANAGEMENT SYSTEM</div>
            </div>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">Welcome Back</h1>
            <p className="text-sm text-zinc-500 mt-1">Sign in to access your Daiho POS workspace.</p>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-semibold px-4 py-3 rounded-xl mb-5">
              ❌ {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-zinc-800 mb-2">Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  className="w-full h-13 pl-11 pr-4 border-2 border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#FF6600] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-800 mb-2">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-13 pl-11 pr-12 border-2 border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#FF6600] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-zinc-800 rounded-lg cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 accent-[#FF6600] rounded cursor-pointer"
                />
                <span>Remember my username</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-13 bg-[#FF6600] hover:bg-[#EA580C] disabled:opacity-60 text-white font-bold text-sm tracking-wider rounded-xl shadow-lg shadow-orange-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>{isSubmitting ? 'SIGNING IN...' : 'SIGN IN TO WORKSPACE'}</span>
              {!isSubmitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-8 pt-5 border-t border-zinc-200 text-center">
            <div className="text-xs font-extrabold text-zinc-900 tracking-wide">DAIHO AUTO PARTS SUPPLY</div>
            <div className="text-[10px] font-semibold text-zinc-400 tracking-widest mt-0.5">POS MANAGEMENT SYSTEM</div>
          </div>
        </div>
      </div>
    </div>
  );
}
