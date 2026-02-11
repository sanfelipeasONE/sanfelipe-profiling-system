import { useEffect, useState } from 'react';
import api from '../api';
import { UserPlus, Shield, User, Loader2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'barangay' });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/');
      setUsers(res.data);
    } catch (err) { toast.error("Could not load user list."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users/', newUser);
      toast.success("User Created!");
      setShowForm(false);
      fetchUsers();
    } catch (err) { toast.error("Creation failed."); }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <Toaster position="top-center" />
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <h2 className="text-xl font-bold text-stone-900">System Users</h2>
        <button onClick={() => setShowForm(!showForm)} className="w-full sm:w-auto px-4 py-2 bg-rose-600 text-white rounded-xl font-bold text-sm">
          {showForm ? 'Cancel' : '+ New User'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-100 bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-stone-50 border-b border-stone-100">
            <tr>
              <th className="p-4 text-[10px] font-bold text-stone-400 uppercase">User</th>
              <th className="p-4 text-[10px] font-bold text-stone-400 uppercase">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {users.map(u => (
              <tr key={u.id}>
                <td className="p-4 text-sm font-bold text-stone-700">{u.username}</td>
                <td className="p-4">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${u.role === 'admin' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                    {u.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}