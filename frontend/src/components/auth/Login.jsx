import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from "../../api/api";
import { Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();

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
      navigate('/dashboard/overview', { replace: true });
      
    } catch (err) {
      console.error(err);
      setError('Invalid username or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 overflow-hidden font-sans bg-stone-900">
      
      {/* Background Image & Overlay */}
      <div 
        className="absolute inset-0 z-0 scale-105 animate-[pulse_20s_ease-in-out_infinite_alternate]"
        style={{
          backgroundImage: "url('/hero.jpg')", 
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/95 via-stone-900/90 to-black/80 backdrop-blur-[4px]"></div>
      </div>

      {/* Decorative Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-rose-600/20 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-red-900/20 blur-[100px] rounded-full"></div>
      </div>

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-5xl bg-stone-900/40 rounded-[2rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-xl border border-white/10 flex flex-col lg:flex-row transform transition-all duration-500">
        
        {/* Left Side (Brand) */}
        <div className="lg:w-5/12 p-10 lg:p-14 flex flex-col justify-between text-white relative overflow-hidden bg-gradient-to-b from-white/5 to-black/20">
          <div className="relative z-10">
            <div className="flex items-center gap-5 mb-12">
              <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner border border-white/20 p-2">
                <img src="/san_felipe_seal.png" alt="San Felipe Seal" className="w-full h-full object-contain drop-shadow-md" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white drop-shadow-sm leading-none">LGU San Felipe</h1>
                <p className="text-rose-300 text-xs font-bold uppercase tracking-[0.2em] mt-1.5">Zambales</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <h2 className="text-4xl lg:text-5xl font-black leading-tight tracking-tight text-white">
                Resident <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-rose-600">
                  Profiling System
                </span>
              </h2>
            </div>
          </div>
          
          <div className="relative z-10 mt-16 flex items-center gap-2 text-stone-400/80">
            <ShieldCheck size={16} />
            <p className="text-xs font-medium tracking-wide">Authorized Personnel Only</p>
          </div>
        </div>

        {/* Right Side (Form) */}
        <div className="lg:w-7/12 bg-white p-8 sm:p-12 lg:p-16 flex flex-col justify-center relative">
          <div className="max-w-md w-full mx-auto">
            <div className="mb-10">
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Sign In</h2>
              <p className="text-gray-500 mt-2 text-base">Enter your credentials to access the registry.</p>
            </div>

            {error && (
              <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="p-1 rounded-full mt-0.5">
                  <Lock size={16} className="text-red-600" />
                </div>
                <p className="text-sm text-red-800 font-bold">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Username */}
              <div className="space-y-2 group">
                <label htmlFor="username" className="text-xs font-bold uppercase text-gray-500 ml-1 tracking-wider">Username</label>
                <div className="relative flex items-center">
                  <User className="absolute left-4 h-5 w-5 text-gray-400 transition-colors group-focus-within:text-rose-600" />
                  <input 
                    id="username"
                    type="text" 
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="block w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all duration-200 outline-none font-medium"
                    placeholder="Enter username"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2 group">
                <div className="flex justify-between items-center ml-1">
                  <label htmlFor="password" className="text-xs font-bold uppercase text-gray-500 tracking-wider">Password</label>
                </div>
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 h-5 w-5 text-gray-400 transition-colors group-focus-within:text-rose-600" />
                  <input 
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl focus:bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all duration-200 outline-none font-medium"
                    placeholder="••••••••"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-4 p-1 text-gray-400 hover:text-rose-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={loading}
                className="w-full mt-6 bg-stone-900 hover:bg-stone-800 text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-stone-900/20 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 group overflow-hidden relative"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-rose-600 to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center gap-2">
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <span>Secure Login</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </button>
            </form>
          </div>
          
          <div className="mt-10 text-center">
             <p className="text-xs text-gray-400 font-medium">LGU San Felipe • Residential Profile Form</p>
          </div>
        </div>
      </div>
    </div>
  );
}