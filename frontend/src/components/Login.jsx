import { useState } from 'react';
import api from '../api';
import { User, Lock } from 'lucide-react';
import sanFelipeSeal from '../assets/san_felipe_seal.png';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const response = await api.post('/token', formData);
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('role', response.data.role);
      onLogin(response.data.role);
    } catch {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 px-4">
      
      <div className="w-full max-w-md bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-white/20">
        
        {/* HEADER */}
        <div className="flex flex-col items-center mb-8">
          <img
            src={sanFelipeSeal}
            alt="LGU San Felipe Seal"
            className="w-24 h-24 mb-4 drop-shadow-lg"
          />
          <h1 className="text-2xl font-extrabold tracking-wide text-gray-800">
            LGU San Felipe
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Resident Profiling System
          </p>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* USERNAME */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full rounded-lg border border-gray-300 bg-white px-10 py-2.5 text-sm
                           focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 outline-none"
                required
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 bg-white px-10 py-2.5 text-sm
                           focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 outline-none"
                required
              />
            </div>
          </div>

          {/* BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-lg py-2.5 text-sm font-bold tracking-wide transition-all
              ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-700 hover:bg-blue-800 active:scale-[0.98]'
              } text-white shadow-lg`}
          >
            {loading ? 'Verifying credentials…' : 'Sign In'}
          </button>
        </form>

        {/* FOOTER */}
        <p className="mt-8 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} LGU San Felipe • Authorized Personnel Only
        </p>
      </div>
    </div>
  );
}
