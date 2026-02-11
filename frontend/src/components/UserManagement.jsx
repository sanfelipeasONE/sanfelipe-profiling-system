import { useEffect, useState } from 'react';
import api from '../api';
import { 
  UserPlus, Shield, User, Loader2, Key, Trash2, 
  ShieldCheck, UserCircle, AlertCircle, Eye, EyeOff, Lock
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'barangay' });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modal States
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, userId: null, username: '' });
  const [resetModal, setResetModal] = useState({ isOpen: false, userId: null, username: '', newPassword: '' });
  const [showResetPass, setShowResetPass] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/');
      setUsers(res.data);
    } catch (err) { 
      toast.error("Could not load user list."); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e) => {
  e.preventDefault();
  setIsSubmitting(true); // Disable the button immediately
  try {
    const res = await api.post('/users/', newUser);
    toast.success("Account Deployed!");
    setShowForm(false);
    fetchUsers();
  } catch (err) { 
    // Check if the error is actually an auth error
    if (err.response?.status === 401) {
      toast.error("Session expired. Please log in again.");
    } else {
      toast.error(err.response?.data?.detail || "Creation failed.");
    }
  } finally { 
    setIsSubmitting(false); 
  }
};

  // Modern Reset Logic
  const handleConfirmReset = async () => {
    if (!resetModal.newPassword) return toast.error("Please enter a new password");
    setIsSubmitting(true);
    try {
      await api.put(`/users/${resetModal.userId}/reset-password`, { 
        new_password: resetModal.newPassword 
      });
      toast.success(`Password updated for ${resetModal.username}`);
      setResetModal({ isOpen: false, userId: null, username: '', newPassword: '' });
    } catch (err) {
      toast.error("Failed to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
  setIsSubmitting(true);
  try {
    // 1. Verify the URL matches your FastAPI @app.delete route
    await api.delete(`/users/${deleteModal.userId}`); 
    
    toast.success("Account permanently removed");
    setDeleteModal({ isOpen: false, userId: null, username: '' });
    fetchUsers();
  } catch (err) {
    // 2. This will tell you if it's a "Foreign Key" error or "404 Not Found"
    const errorMessage = err.response?.data?.detail || "Error deleting account.";
    toast.error(errorMessage);
    console.error("Delete Error:", err.response?.data);
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10 animate-in fade-in duration-500">
      <Toaster position="top-right" />

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
        <div>
          <h2 className="text-2xl font-black text-stone-900 tracking-tight uppercase">System Access</h2>
          <p className="text-sm text-stone-500 font-medium italic">Manage administrative and staff credentials.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)} 
          className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
            showForm ? 'bg-stone-100 text-stone-600' : 'bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-200'
          }`}
        >
          {showForm ? 'Cancel' : <><UserPlus size={18} /> New User</>}
        </button>
      </div>

      {/* CREATE USER FORM */}
      {showForm && (
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-stone-200 shadow-xl animate-in slide-in-from-top-4">
          <h3 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <ShieldCheck size={14} className="text-rose-600"/> Security Credentials
          </h3>
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Username</label>
                <input required value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:bg-white focus:border-rose-500 transition-all font-medium text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Password</label>
                <input type="password" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:bg-white focus:border-rose-500 transition-all font-medium text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Access Role</label>
                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-2xl outline-none font-bold text-sm appearance-none">
                  <option value="barangay">Barangay</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <button type="submit" className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-stone-800">
              {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : "Register Account"}
            </button>
          </form>
        </div>
      )}

      {/* USER LIST */}
      <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="p-5 text-[10px] font-black text-stone-400 uppercase tracking-widest">User Account</th>
                <th className="p-5 text-[10px] font-black text-stone-400 uppercase tracking-widest">Level</th>
                <th className="p-5 text-[10px] font-black text-stone-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-rose-50/20 transition-colors group">
                  <td className="p-5">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${u.role === 'admin' ? 'bg-rose-50 text-rose-600' : 'bg-stone-100 text-stone-400'}`}>
                        {u.role === 'admin' ? <Shield size={18} /> : <User size={18} />}
                      </div>
                      <span className="text-sm font-bold text-stone-800">{u.username}</span>
                    </div>
                  </td>
                  <td className="p-5">
                    <span className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase border ${u.role === 'admin' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-stone-50 text-stone-600 border-stone-100'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-5 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setResetModal({ isOpen: true, userId: u.id, username: u.username, newPassword: '' })} className="p-2 text-stone-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all"><Key size={16} /></button>
                      <button onClick={() => setDeleteModal({ isOpen: true, userId: u.id, username: u.username })} className="p-2 text-stone-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODERN RESET PASSWORD MODAL */}
      {resetModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-in fade-in" onClick={() => setResetModal({ ...resetModal, isOpen: false })}></div>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full relative animate-in zoom-in-95 shadow-2xl border border-stone-100">
            <div className="text-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><Lock size={32}/></div>
              <h3 className="text-xl font-bold text-stone-900">Reset Password</h3>
              <p className="text-sm text-stone-500 mt-1 mb-6">Updating credentials for <span className="font-bold text-stone-800">{resetModal.username}</span></p>
              
              <div className="relative mb-6">
                <input 
                  type={showResetPass ? "text" : "password"}
                  placeholder="Enter new password"
                  value={resetModal.newPassword}
                  onChange={(e) => setResetModal({ ...resetModal, newPassword: e.target.value })}
                  className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:border-rose-500 font-medium text-sm pr-12"
                />
                <button 
                  type="button"
                  onClick={() => setShowResetPass(!showResetPass)}
                  className="absolute right-4 top-4 text-stone-400 hover:text-stone-600"
                >
                  {showResetPass ? <EyeOff size={18}/> : <Eye size={18}/>}
                </button>
              </div>

              <div className="space-y-3">
                <button onClick={handleConfirmReset} disabled={isSubmitting} className="w-full py-4 bg-stone-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-stone-200 active:scale-95 transition-all">
                  {isSubmitting ? "Updating..." : "Update Password"}
                </button>
                <button onClick={() => setResetModal({ ...resetModal, isOpen: false })} className="w-full py-2 text-stone-400 font-bold text-sm">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODERN DELETE MODAL */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-in fade-in" onClick={() => setDeleteModal({ isOpen: false, userId: null, username: '' })}></div>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full relative animate-in zoom-in-95 shadow-2xl border border-stone-100">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3"><AlertCircle size={32}/></div>
              <h3 className="text-xl font-bold text-stone-900">Delete Account?</h3>
              <p className="text-sm text-stone-500 mt-2 mb-8 italic">Removing <span className="font-bold text-stone-800 not-italic">"{deleteModal.username}"</span> will revoke all system access.</p>
              <div className="space-y-3">
                <button onClick={handleDeleteAccount} disabled={isSubmitting} className="w-full py-3.5 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-200">
                  {isSubmitting ? "Processing..." : "Confirm Removal"}
                </button>
                <button onClick={() => setDeleteModal({ isOpen: false, userId: null, username: '' })} className="w-full py-3.5 text-stone-400 font-bold">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}