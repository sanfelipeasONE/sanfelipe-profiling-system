import { useState } from 'react';
import api from '../api';
import { Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck, Activity } from 'lucide-react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const response = await api.post('/token', formData);
      
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('role', response.data.role);

      onLogin(response.data.role);
    } catch (err) {
      console.error(err);
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden">
      
      {/* BACKGROUND IMAGE */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "url('/hero.jpg')", 
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark Red/Black Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/90 via-stone-900/80 to-black/70 backdrop-blur-[2px]"></div>
      </div>

      {/* MAIN CARD CONTAINER */}
      <div className="relative z-10 w-full max-w-5xl bg-white/10 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-md border border-white/10 flex flex-col lg:flex-row">
        
        {/* LEFT SIDE - Info & Branding */}
        <div className="lg:w-5/12 p-10 flex flex-col justify-between text-white relative overflow-hidden">
          
          {/* Decorative circles (Warm Tones) */}
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-rose-500/30 rounded-full blur-3xl"></div>
          <div className="absolute bottom-10 right-10 w-60 h-60 bg-red-600/20 rounded-full blur-3xl"></div>

          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg p-1">
                <img 
                  src="/san_felipe_seal.png" 
                  alt="San Felipe Seal" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
                <User className="hidden text-rose-700" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">LGU San Felipe</h1>
                <p className="text-rose-200 text-xs font-medium uppercase tracking-wider">Province of Zambales</p>
              </div>
            </div>

            {/* Hero Text */}
            <div className="mt-8 space-y-4">
              <h2 className="text-3xl font-bold leading-tight">
                Residential <span className="text-rose-400">Profiling System</span>
              </h2>
              <p className="text-stone-200 text-sm leading-relaxed opacity-90">
                Welcome to the residential profile system for the Municipality of San Felipe, Zambales.
              </p>
            </div>
          </div>

          {/* Features / Footer Info */}
          <div className="relative z-10 mt-12 space-y-4">
            <div className="flex items-center gap-3 text-sm text-stone-100">
              <ShieldCheck className="w-5 h-5 text-rose-400" />
              <span>Secure Data Encryption</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-stone-100">
              <Activity className="w-5 h-5 text-rose-400" />
              <span>Real-time Demographics</span>
            </div>
            <div className="pt-6 border-t border-white/10">
              <p className="text-xs text-rose-100/60">© 2026 Municipality of San Felipe</p>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE - Login Form */}
        <div className="lg:w-7/12 bg-white p-8 md:p-12 flex flex-col justify-center">
          
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
            <p className="text-gray-500 text-sm mt-1">Access your administrative dashboard.</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="text-red-500 mt-0.5"><Lock size={16} /></div>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all outline-none text-gray-900 placeholder-gray-400 sm:text-sm"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all outline-none text-gray-900 placeholder-gray-400 sm:text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full relative overflow-hidden bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-red-500/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}