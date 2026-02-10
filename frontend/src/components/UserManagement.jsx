import { useEffect, useState } from 'react';
import api from '../api';
import { UserPlus, Key, Trash2, Shield, User, Eye, EyeOff } from 'lucide-react'; // <--- Added Eye icons

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'barangay' });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // New State for "Show Password" toggle
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/');
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return alert("Please fill all fields");
    
    try {
      await api.post('/users/', newUser);
      alert("User Created Successfully!");
      setNewUser({ username: '', password: '', role: 'barangay' });
      setShowForm(false);
      setShowPassword(false); // Reset visibility
      fetchUsers(); 
    } catch (err) {
      console.error(err);
      alert("Failed to create user. Username might be taken.");
    }
  };

  const handleResetPassword = async (id, username) => {
    const newPass = prompt(`Enter new password for user '${username}':`);
    if (!newPass) return;

    try {
      await api.put(`/users/${id}/reset-password`, { new_password: newPass });
      alert("Password reset successfully.");
    } catch (err) {
      alert("Failed to reset password.");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 animate-in fade-in">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
           <h2 className="text-xl font-bold text-stone-900 tracking-tight">System Users</h2>
           <p className="text-sm text-stone-500 mt-1">Manage access accounts for Barangays and Admins.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-medium text-sm shadow-sm ${
            showForm 
              ? 'bg-stone-100 text-stone-600 hover:bg-stone-200' 
              : 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-200'
          }`}
        >
          {showForm ? 'Cancel' : <><UserPlus size={18} /> Add New User</>}
        </button>
      </div>

      {/* CREATE USER FORM */}
      {showForm && (
        <div className="mb-8 p-6 bg-gradient-to-br from-stone-50 to-white rounded-xl border border-stone-200 shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-stone-100">
            <UserPlus size={16} className="text-rose-500"/>
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">New Account Details</h3>
          </div>
          
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              
              {/* Username Input */}
              <div className="md:col-span-4">
                <label className="text-xs font-semibold text-stone-500 mb-1.5 block">Username</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-3 text-stone-400" />
                  <input 
                    placeholder="e.g. amagna" 
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all text-sm"
                    value={newUser.username}
                    onChange={e => setNewUser({...newUser, username: e.target.value})}
                  />
                </div>
              </div>

              {/* Password Input (With Eye Toggle) */}
              <div className="md:col-span-4">
                <label className="text-xs font-semibold text-stone-500 mb-1.5 block">Password</label>
                <div className="relative">
                  <Key size={16} className="absolute left-3 top-3 text-stone-400" />
                  <input 
                    placeholder="••••••••" 
                    type={showPassword ? "text" : "password"} // <--- Toggle Type
                    className="w-full pl-9 pr-10 py-2.5 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all text-sm"
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                  />
                  {/* Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600"
                    tabIndex="-1"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Role Select */}
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-stone-500 mb-1.5 block">Role</label>
                <select 
                  className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all text-sm"
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value})}
                >
                  <option value="barangay">Barangay</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Submit Button */}
              <div className="md:col-span-2">
                <button 
                  type="submit" 
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors text-sm font-semibold shadow-sm"
                >
                  Create
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* USERS TABLE */}
      <div className="overflow-hidden rounded-xl border border-stone-100 shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-stone-50 border-b border-stone-100">
            <tr>
              <th className="py-4 px-6 text-xs font-bold text-stone-400 uppercase tracking-wider">User Account</th>
              <th className="py-4 px-6 text-xs font-bold text-stone-400 uppercase tracking-wider">Access Level</th>
              <th className="py-4 px-6 text-xs font-bold text-stone-400 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 bg-white">
            {loading ? (
               <tr><td colSpan="3" className="text-center py-12 text-stone-400 text-sm">Loading users...</td></tr>
            ) : users.length === 0 ? (
               <tr><td colSpan="3" className="text-center py-12 text-stone-400 italic text-sm">No users found.</td></tr>
            ) : (
              users.map(u => (
                <tr key={u.id} className="hover:bg-stone-50 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                        u.role === 'admin' 
                          ? 'bg-rose-50 border-rose-100 text-rose-600' 
                          : 'bg-stone-50 border-stone-100 text-stone-500'
                      }`}>
                        {u.role === 'admin' ? <Shield size={16} /> : <User size={16} />}
                      </div>
                      <div>
                        <p className="font-semibold text-stone-700 text-sm">{u.username}</p>
                        <p className="text-[10px] text-stone-400 uppercase">ID: {u.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                      u.role === 'admin' 
                        ? 'bg-rose-50 text-rose-700 border-rose-100' 
                        : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button 
                      onClick={() => handleResetPassword(u.id, u.username)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all border border-transparent hover:border-rose-100"
                      title="Reset Password"
                    >
                      <Key size={14} /> Reset Password
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