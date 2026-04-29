import { useEffect, useState } from 'react';
import api from '../../api/api';
import { 
  UserPlus, Shield, User, Users, Loader2, Key, Trash2, // <-- Added 'Users' icon here
  ShieldCheck, AlertCircle, Eye, EyeOff, Lock,
  ChevronLeft, ChevronRight, ChevronDown, X
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { createPortal } from 'react-dom';

export default function UserManagement() {
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const isAdmin = role === "admin";
  const isSuperAdmin = role === "super_admin";

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <p className="text-slate-600">Not allowed.</p>
      </div>
    );
  }
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'barangay' });
  const [showForm, setShowForm] = useState(false);
  
  const [showNewUserPass, setShowNewUserPass] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);

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

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = users.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(users.length / itemsPerPage);

  const goToNextPage = () => { if (currentPage < totalPages) setCurrentPage(prev => prev + 1); };
  const goToPrevPage = () => { if (currentPage > 1) setCurrentPage(prev => prev - 1); };

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/users/', newUser);
      toast.success("Account Deployed!");
      setShowForm(false);
      setNewUser({ username: '', password: '', role: 'barangay' });
      setShowNewUserPass(false);
      fetchUsers();
    } catch (err) { 
      if (err.response?.status === 401) {
        toast.error("Session expired. Please log in again.");
      } else {
        toast.error(err.response?.data?.detail || "Creation failed.");
      }
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleConfirmReset = async () => {
    if (!resetModal.newPassword) return toast.error("Please enter a new password");
    setIsSubmitting(true);
    try {
      await api.put(`/users/${resetModal.userId}/reset-password`, { 
        new_password: resetModal.newPassword 
      });
      toast.success(`Password updated for ${resetModal.username}`);
      setResetModal({ isOpen: false, userId: null, username: '', newPassword: '' });
      setShowResetPass(false);
    } catch (err) {
      toast.error("Failed to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsSubmitting(true);
    try {
      await api.delete(`/users/${deleteModal.userId}`); 
      toast.success("Account permanently removed");
      setDeleteModal({ isOpen: false, userId: null, username: '' });
      fetchUsers();
      if (currentUsers.length === 1 && currentPage > 1) setCurrentPage(prev => prev - 1);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error deleting account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10 animate-in fade-in duration-300">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#fff', borderRadius: '12px', fontSize: '14px' } }} />

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <div className="p-1.5 bg-red-50 rounded-lg border border-red-100/50"><ShieldCheck size={16} strokeWidth={2} /></div>
            <span className="text-xs font-normal tracking-widest uppercase">System Security</span>
          </div>
          <h1 className="text-3xl font-medium text-slate-800 tracking-tight">User Management</h1>
          <p className="text-sm text-slate-400 font-normal mt-1">Manage administrative and staff credentials.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)} 
          className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-normal transition-all shadow-sm ${
            showForm 
              ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50' 
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {showForm ? 'Cancel Creation' : <><UserPlus size={16} strokeWidth={2} /> New User</>}
        </button>
      </div>

      {/* CREATE USER FORM */}
      {showForm && (
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-sm font-normal text-slate-700 tracking-tight flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
            <div className="p-1.5 bg-red-100 text-red-600 rounded-lg"><Shield size={16} strokeWidth={2} /></div>
            Deploy New Credentials
          </h3>
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[11px] font-normal text-slate-400 uppercase tracking-wider mb-1.5">Username</label>
                <input required value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-100 focus:border-red-500 focus:bg-white outline-none transition-all font-normal text-slate-800" placeholder="Enter unique username" />
              </div>
              
              <div>
                <label className="block text-[11px] font-normal text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <input 
                    type={showNewUserPass ? "text" : "password"} 
                    required 
                    value={newUser.password} 
                    onChange={e => setNewUser({...newUser, password: e.target.value})} 
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 pr-10 text-sm focus:ring-2 focus:ring-red-100 focus:border-red-500 focus:bg-white outline-none transition-all font-normal text-slate-800" 
                    placeholder="••••••••" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowNewUserPass(!showNewUserPass)} 
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showNewUserPass ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-[11px] font-normal text-slate-400 uppercase tracking-wider mb-1.5">Access Role</label>
                <div className="relative">
                  <select
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full appearance-none border border-slate-200 bg-slate-50 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-100 focus:border-red-500 focus:bg-white outline-none transition-all font-normal text-slate-700 cursor-pointer"
                  >
                    <option value="barangay">Barangay Staff</option>
                    <option value="admin_limited">Admin (Limited)</option>
                    <option value="super_admin">Admin</option>
                    <option value="admin">System Admin</option>
                    {/* ADDED OSCA ADMIN OPTION */}
                    <option value="osca_admin">OSCA Admin</option> 
                  </select>
                  <ChevronDown className="absolute right-3.5 top-3.5 text-slate-400 pointer-events-none" size={16} />
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={isSubmitting} className="w-full md:w-auto px-8 py-3 bg-slate-900 text-white rounded-xl font-normal text-sm hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : "Register Account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* USER LIST TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-200">
              <tr>
                <th className="p-4 text-[11px] font-normal text-slate-400 uppercase tracking-wider w-1/2">User Account</th>
                <th className="p-4 text-[11px] font-normal text-slate-400 uppercase tracking-wider w-1/4">Access Level</th>
                <th className="p-4 text-[11px] font-normal text-slate-400 uppercase tracking-wider w-1/4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              
              {loading ? (
                <tr>
                  <td colSpan="3" className="py-24 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Loader2 className="w-8 h-8 text-red-500 animate-spin" strokeWidth={2} />
                      <p className="text-xs font-normal text-slate-400 uppercase tracking-widest">
                        Fetching Credentials...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : currentUsers.length > 0 ? (
                currentUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border shadow-sm ${
                            u.role === "super_admin"
                              ? "bg-purple-50 text-purple-600 border-purple-100"
                              : u.role === "admin"
                              ? "bg-red-50 text-red-500 border-red-100"
                              : u.role === "admin_limited"
                              ? "bg-amber-50 text-amber-600 border-amber-100"
                              : u.role === "osca_admin" // ADDED OSCA COLOR LOGIC
                              ? "bg-blue-50 text-blue-600 border-blue-100" 
                              : "bg-slate-50 text-slate-400 border-slate-200"
                          }`}
                        >
                          {u.role === "super_admin" ? (
                            <ShieldCheck size={18} strokeWidth={2} />
                          ) : u.role === "admin" ? (
                            <Shield size={18} strokeWidth={2} />
                          ) : u.role === "admin_limited" ? (
                            <ShieldCheck size={18} strokeWidth={2} />
                          ) : u.role === "osca_admin" ? ( // ADDED OSCA ICON LOGIC
                            <Users size={18} strokeWidth={2} />
                          ) : (
                            <User size={18} strokeWidth={2} />
                          )}
                        </div>
                        <span className="font-normal text-slate-700 tracking-tight">{u.username}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-normal tracking-tight border ${
                          u.role === "super_admin"
                            ? "bg-purple-50 text-purple-700 border-purple-100/60"
                            : u.role === "admin"
                            ? "bg-red-50 text-red-600 border-red-100/50"
                            : u.role === "admin_limited"
                            ? "bg-amber-50 text-amber-700 border-amber-100/60"
                            : u.role === "osca_admin" // ADDED OSCA BADGE LOGIC
                            ? "bg-blue-50 text-blue-700 border-blue-100/60"
                            : "bg-slate-100 text-slate-500 border-slate-200/50"
                        }`}
                      >
                        {u.role === "super_admin"
                          ? "Admin (Mayor)"
                          : u.role === "admin"
                          ? "Administrator"
                          : u.role === "admin_limited"
                          ? "Admin (Limited)"
                          : u.role === "osca_admin" // ADDED OSCA LABEL LOGIC
                          ? "OSCA Admin"
                          : "Barangay Staff"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => setResetModal({ isOpen: true, userId: u.id, username: u.username, newPassword: '' })} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Reset Password">
                          <Key size={16} strokeWidth={2} />
                        </button>
                        <button onClick={() => setDeleteModal({ isOpen: true, userId: u.id, username: u.username })} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete Account">
                          <Trash2 size={16} strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="py-20 text-center">
                    <div className="inline-flex flex-col items-center justify-center text-slate-400">
                      <Shield size={32} className="mb-3 opacity-20" strokeWidth={1.5} />
                      <span className="font-normal text-slate-400">No users found in the system.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {!loading && users.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-slate-400 font-normal">
              Showing <span className="font-medium text-slate-600">{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, users.length)}</span> of <span className="font-medium text-slate-600">{users.length}</span> records
            </span>
            
            <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-sm p-1">
              <button onClick={goToPrevPage} disabled={currentPage === 1} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                <ChevronLeft size={16} strokeWidth={2} />
              </button>
              
              <div className="flex items-center gap-1 px-2">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-normal transition-all ${
                      currentPage === i + 1 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'bg-transparent text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button onClick={goToNextPage} disabled={currentPage === totalPages} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                <ChevronRight size={16} strokeWidth={2} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- RESET PASSWORD MODAL --- */}
      {resetModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setResetModal({ ...resetModal, isOpen: false })}/>
          <div className="relative z-10 bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
              <Lock size={24} strokeWidth={2} />
            </div>
            <h3 className="text-lg font-medium text-slate-800 tracking-tight">Reset Password</h3>
            <p className="text-sm text-slate-400 mt-1 mb-6 font-normal">
              Updating credentials for <span className="font-medium text-slate-600">{resetModal.username}</span>
            </p>
            
            <div className="relative mb-8">
              <input 
                type={showResetPass ? "text" : "password"} 
                placeholder="Enter new password" 
                value={resetModal.newPassword} 
                onChange={(e) => setResetModal({ ...resetModal, newPassword: e.target.value })} 
                className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 pr-12 text-sm focus:ring-2 focus:ring-red-100 focus:border-red-500 focus:bg-white outline-none transition-all font-normal text-slate-800"
              />
              <button type="button" onClick={() => setShowResetPass(!showResetPass)} className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors">
                {showResetPass ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
              </button>
            </div>
            
            <div className="flex gap-3">
              <button onClick={() => setResetModal({ ...resetModal, isOpen: false })} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-normal rounded-xl hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleConfirmReset} disabled={isSubmitting} className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-normal rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center">
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Update"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* --- DELETE MODAL --- */}
      {deleteModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDeleteModal({ isOpen: false, userId: null, username: "" })}/>
          <div className="relative z-10 bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
              <AlertCircle size={24} strokeWidth={2} />
            </div>
            <h3 className="text-lg font-medium text-slate-800 tracking-tight">Delete Account</h3>
            <p className="text-sm text-slate-400 mt-2 mb-8 leading-relaxed font-normal">
              Removing <span className="font-medium text-slate-600">"{deleteModal.username}"</span> will permanently revoke all system access. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ isOpen: false, userId: null, username: "" })} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-normal rounded-xl hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleDeleteAccount} disabled={isSubmitting} className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-normal rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center">
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}