import { useState, useEffect } from 'react';
import api from '../api';
import { X, Plus, Trash2, User, MapPin, Briefcase, Heart, Save, Phone, Fingerprint } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// --- HELPER COMPONENTS ---
const InputGroup = ({ label, name, value, onChange, type = "text", required = false, placeholder }) => (
  <div className="space-y-1 w-full">
    <label className="text-xs font-bold text-stone-500 uppercase">{label}</label>
    <input 
      type={type} 
      name={name} 
      value={value || ''} 
      onChange={onChange} 
      required={required}
      placeholder={placeholder}
      className="w-full p-3 bg-stone-50 border border-transparent focus:bg-white focus:border-rose-500 rounded-xl transition-all outline-none font-medium placeholder:text-stone-400 text-stone-800" 
    />
  </div>
);

const SelectGroup = ({ label, name, value, onChange, options, required = false }) => (
  <div className="space-y-1">
    <label className="text-xs font-bold text-stone-500 uppercase">{label}</label>
    <select 
      name={name} 
      value={value || ''} 
      onChange={onChange} 
      required={required}
      className="w-full p-3 bg-white border border-stone-200 rounded-xl focus:border-rose-500 outline-none text-stone-700 appearance-none focus:ring-2 focus:ring-rose-500/10 transition-all"
    >
      <option value="">Select...</option>
      {options.map((opt) => (
        <option key={opt.id || opt} value={opt.name || opt}>
          {opt.name || opt}
        </option>
      ))}
    </select>
  </div>
);
// -------------------------------------------------------------

export default function AddResidentForm({ onSuccess, onCancel, residentToEdit }) {
  const [formData, setFormData] = useState({
    last_name: '', first_name: '', middle_name: '', ext_name: '',
    house_no: '', purok: '', barangay: '',
    birthdate: '', sex: '', civil_status: '',
    occupation: '', precinct_no: '', contact_no: '',
    spouse_last_name: '', spouse_first_name: '', spouse_middle_name: '', spouse_ext_name: '',
    sector_ids: [],
    family_members: [],
    other_sector_details: '' 
  });

  const [barangayOptions, setBarangayOptions] = useState([]);
  const [purokOptions, setPurokOptions] = useState([]);
  const [sectorOptions, setSectorOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [bRes, pRes, sRes] = await Promise.all([
          api.get('/barangays/'),
          api.get('/puroks/'),
          api.get('/sectors/')
        ]);
        setBarangayOptions(bRes.data);
        setPurokOptions(pRes.data);
        setSectorOptions(sRes.data);
      } catch (err) {
        console.error("Error loading options:", err);
        toast.error("Failed to load form options.");
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    if (residentToEdit) {
      setFormData({
        ...residentToEdit,
        birthdate: residentToEdit.birthdate ? residentToEdit.birthdate.split('T')[0] : '',
        sector_ids: residentToEdit.sectors ? residentToEdit.sectors.map(s => s.id) : [],
        family_members: residentToEdit.family_members || [],
        other_sector_details: residentToEdit.other_sector_details || ''
      });
    }
  }, [residentToEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSectorChange = (e) => {
    const sectorId = parseInt(e.target.value);
    if (!sectorId) return;
    
    // Logic to clear
    const otherSector = sectorOptions.find(s => s.name.toLowerCase().includes('other'));
    const isUncheckingOther = otherSector && sectorId === otherSector.id && formData.sector_ids.includes(sectorId);

    setFormData(prev => {
      let newSectorIds;
      let newOtherDetails = prev.other_sector_details;

      if (prev.sector_ids.includes(sectorId)) {
        newSectorIds = prev.sector_ids.filter(id => id !== sectorId);
        if (isUncheckingOther) newOtherDetails = ''; // Clear text if unchecking
      } else {
        newSectorIds = [...prev.sector_ids, sectorId];
      }

      return { ...prev, sector_ids: newSectorIds, other_sector_details: newOtherDetails };
    });
  };

  const addFamilyMember = () => {
    setFormData(prev => ({
      ...prev,
      family_members: [...prev.family_members, { first_name: '', last_name: '', relationship: '', birthdate: '' }]
    }));
  };

  const removeFamilyMember = (index) => {
    setFormData(prev => ({
      ...prev,
      family_members: prev.family_members.filter((_, i) => i !== index)
    }));
  };

  const handleFamilyChange = (index, field, value) => {
    const updatedMembers = [...formData.family_members];
    updatedMembers[index][field] = value;
    setFormData(prev => ({ ...prev, family_members: updatedMembers }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (residentToEdit) {
        await api.put(`/residents/${residentToEdit.id}`, formData);
        toast.success("Resident Updated Successfully!");
      } else {
        await api.post('/residents/', formData);
        toast.success("Resident Added Successfully!");
      }
      
      setTimeout(() => {
          onSuccess(); 
      }, 1500);

    } catch (error) {
      console.error(error);
      toast.error("Error saving data.");
      setLoading(false); 
    }
  };

  // Helper to check
  const otherSector = sectorOptions.find(s => s.name.toLowerCase().includes('other'));
  const isOtherSelected = otherSector && formData.sector_ids.includes(otherSector.id);

  return (
    <div className="max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500"> 
      
      <Toaster position="top-center" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
          {residentToEdit ? "Edit Resident Profile" : "Register New Resident"}
        </h1>
        <p className="text-stone-500 text-sm mt-1">Fill in the details below to add a record to the database.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 pb-24">
        
        {/* CARD 1: PERSONAL INFO */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
          
          <div className="flex items-center gap-3 mb-6 border-b border-stone-100 pb-4">
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <User size={24} />
            </div>
            <h3 className="text-lg font-bold text-stone-900">Personal Information</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            <InputGroup label="Last Name" name="last_name" value={formData.last_name} onChange={handleChange} required placeholder="Dela Cruz" />
            <InputGroup label="First Name" name="first_name" value={formData.first_name} onChange={handleChange} required placeholder="Juan" />
            <InputGroup label="Middle Name" name="middle_name" value={formData.middle_name} onChange={handleChange} placeholder="Santos" />
            <InputGroup label="Ext (Jr/Sr)" name="ext_name" value={formData.ext_name} onChange={handleChange} placeholder="Jr." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            <InputGroup label="Birthdate" name="birthdate" type="date" value={formData.birthdate} onChange={handleChange} required />
            <SelectGroup label="Sex" name="sex" value={formData.sex} onChange={handleChange} options={['Male', 'Female']} required />
            <SelectGroup label="Civil Status" name="civil_status" value={formData.civil_status} onChange={handleChange} options={['Single', 'Married', 'Widowed']} required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
             <div className="space-y-1 relative">
                <label className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1"><Briefcase size={12}/> Occupation</label>
                <input name="occupation" value={formData.occupation} onChange={handleChange} className="w-full p-3 bg-stone-50 rounded-xl outline-none focus:ring-2 focus:ring-rose-100 border border-transparent focus:bg-white focus:border-rose-500 transition-all text-stone-800" placeholder="e.g. Farmer" />
             </div>
             <div className="space-y-1 relative">
                <label className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1"><Phone size={12}/> Contact No</label>
                <input name="contact_no" value={formData.contact_no} onChange={handleChange} className="w-full p-3 bg-stone-50 rounded-xl outline-none focus:ring-2 focus:ring-rose-100 border border-transparent focus:bg-white focus:border-rose-500 transition-all text-stone-800" placeholder="0912..." />
             </div>
             <div className="space-y-1 relative">
                <label className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1"><Fingerprint size={12}/> Precinct No</label>
                <input name="precinct_no" value={formData.precinct_no} onChange={handleChange} className="w-full p-3 bg-stone-50 rounded-xl outline-none focus:ring-2 focus:ring-rose-100 border border-transparent focus:bg-white focus:border-rose-500 transition-all text-stone-800" placeholder="0012A" />
             </div>
          </div>
        </div>

        {/* CARD 2: ADDRESS */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
          
          <div className="flex items-center gap-3 mb-6 border-b border-stone-100 pb-4">
             <div className="p-2 bg-red-50 rounded-lg text-red-600">
               <MapPin size={24} />
             </div>
             <h3 className="text-lg font-bold text-stone-900">Address Details</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1">
               <label className="text-xs font-bold text-stone-500 uppercase">House No.</label>
               <input name="house_no" value={formData.house_no} onChange={handleChange} className="w-full p-3 bg-stone-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 border border-transparent focus:bg-white focus:border-red-500 transition-all text-stone-800" placeholder="#123" />
            </div>
            <div className="space-y-1">
               <label className="text-xs font-bold text-stone-500 uppercase">Purok / Sitio</label>
               <select name="purok" value={formData.purok} onChange={handleChange} className="w-full p-3 bg-stone-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 border border-transparent focus:bg-white focus:border-red-500 transition-all text-stone-800 appearance-none" required>
                 <option value="">Select Purok...</option>
                 {purokOptions.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
               </select>
            </div>
            <div className="space-y-1">
               <label className="text-xs font-bold text-stone-500 uppercase">Barangay</label>
               <select name="barangay" value={formData.barangay} onChange={handleChange} className="w-full p-3 bg-stone-50 rounded-xl outline-none focus:ring-2 focus:ring-red-100 border border-transparent focus:bg-white focus:border-red-500 transition-all text-stone-800 appearance-none" required>
                 <option value="">Select Barangay...</option>
                 {barangayOptions.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
               </select>
            </div>
          </div>
        </div>

        {/* CARD 3: FAMILY */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 left-0 w-1 h-full bg-rose-400"></div>

          <div className="flex items-center justify-between mb-6 border-b border-stone-100 pb-4">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-rose-50 rounded-lg text-rose-500">
                 <Heart size={24} />
               </div>
               <h3 className="text-lg font-bold text-stone-900">Family Background</h3>
            </div>
            <button type="button" onClick={addFamilyMember} className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-rose-100 transition-colors border border-rose-100">
              <Plus size={16} /> Add Member
            </button>
          </div>

          {/* SPOUSE SECTION */}
          {(formData.civil_status === 'Married' || formData.civil_status === 'Live-in Partner') && (
            <div className="mb-6 p-5 bg-rose-50/40 rounded-2xl border border-rose-100">
               <h4 className="text-xs font-bold text-rose-600 uppercase mb-3">Spouse / Partner</h4>
               <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input name="spouse_last_name" placeholder="Last Name" value={formData.spouse_last_name} onChange={handleChange} className="p-3 bg-white border border-rose-200 rounded-lg text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 text-stone-700" />
                  <input name="spouse_first_name" placeholder="First Name" value={formData.spouse_first_name} onChange={handleChange} className="p-3 bg-white border border-rose-200 rounded-lg text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 text-stone-700" />
                  <input name="spouse_middle_name" placeholder="Middle Name" value={formData.spouse_middle_name} onChange={handleChange} className="p-3 bg-white border border-rose-200 rounded-lg text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 text-stone-700" />
                  <input name="spouse_ext_name" placeholder="Ext" value={formData.spouse_ext_name} onChange={handleChange} className="p-3 bg-white border border-rose-200 rounded-lg text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 text-stone-700" />
               </div>
            </div>
          )}

          {/* FAMILY LIST */}
          <div className="space-y-3">
            {formData.family_members.map((member, index) => (
              <div key={index} className="flex flex-col md:flex-row gap-3 items-end bg-stone-50 p-3 rounded-xl border border-stone-100">
                <div className="flex-1 w-full">
                  <span className="text-[10px] text-stone-400 uppercase font-bold pl-1">First Name</span>
                  <input value={member.first_name} onChange={(e) => handleFamilyChange(index, 'first_name', e.target.value)} className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm outline-none focus:border-rose-400" />
                </div>
                <div className="flex-1 w-full">
                  <span className="text-[10px] text-stone-400 uppercase font-bold pl-1">Last Name</span>
                  <input value={member.last_name} onChange={(e) => handleFamilyChange(index, 'last_name', e.target.value)} className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm outline-none focus:border-rose-400" />
                </div>
                <div className="w-full md:w-48">
                   <span className="text-[10px] text-stone-400 uppercase font-bold pl-1">Relationship</span>
                   <select value={member.relationship} onChange={(e) => handleFamilyChange(index, 'relationship', e.target.value)} className="w-full p-2 bg-white border border-stone-200 rounded-lg text-sm outline-none focus:border-rose-400">
                     <option value="">Select...</option>
                     <option value="Son">Son</option>
                     <option value="Daughter">Daughter</option>
                     <option value="Mother">Mother</option>
                     <option value="Father">Father</option>
                     <option value="Sibling">Sibling</option>
                   </select>
                </div>
                <button type="button" onClick={() => removeFamilyMember(index)} className="p-2.5 text-stone-400 hover:text-red-500 bg-white hover:bg-red-50 border border-stone-200 hover:border-red-200 rounded-lg transition-all shadow-sm">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            {formData.family_members.length === 0 && (
              <p className="text-center text-stone-400 text-sm py-4 italic">No other family members added.</p>
            )}
          </div>
        </div>

        {/* CARD 4: SECTORS */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-stone-100 relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>
          
          <div className="flex items-center gap-3 mb-6 border-b border-stone-100 pb-4">
             <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
               <Briefcase size={24} />
             </div>
             <h3 className="text-lg font-bold text-stone-900">Sector Affiliation</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {sectorOptions.map((s) => {
              const isChecked = formData.sector_ids.includes(s.id);
              return (
                <label key={s.id} className={`
                  relative flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 select-none
                  ${isChecked ? 'bg-gradient-to-r from-red-600 to-rose-600 border-red-600 text-white shadow-lg shadow-red-500/30' : 'bg-white border-stone-200 text-stone-600 hover:border-rose-300 hover:bg-rose-50/30'}
                `}>
                  <input type="checkbox" value={s.id} checked={isChecked} onChange={handleSectorChange} className="hidden" />
                  <div className={`w-5 h-5 rounded flex items-center justify-center border ${isChecked ? 'bg-white border-white text-rose-600' : 'border-stone-300 bg-stone-50'}`}>
                    {isChecked && <div className="w-2.5 h-2.5 bg-rose-600 rounded-sm" />}
                  </div>
                  <span className="text-sm font-bold">{s.name}</span>
                </label>
              );
            })}
          </div>

          {/* 3. ADDED Dynamic Logic for "Other" Input */}
          {isOtherSelected && (
            <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
               <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-100">
                  <InputGroup 
                    label="Please Specify Other Sector" 
                    name="other_sector_details" 
                    value={formData.other_sector_details} 
                    onChange={handleChange} 
                    placeholder="e.g. Solo Parent etc."
                    required={true} 
                  />
               </div>
            </div>
          )}
        </div>

        {/* FLOATING ACTION BAR */}
        <div className="fixed bottom-0 right-0 w-full md:w-[calc(100%-18rem)] bg-white/90 backdrop-blur-md border-t border-stone-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex justify-end gap-4 z-50">
          <button type="button" onClick={onCancel} className="px-6 py-2.5 rounded-xl font-bold text-stone-600 hover:bg-stone-100 transition-colors flex items-center gap-2">
            <X size={20} /> Cancel
          </button>
          <button type="submit" disabled={loading} className="px-8 py-2.5 rounded-xl font-bold bg-gradient-to-r from-red-600 to-rose-600 text-white hover:shadow-lg hover:shadow-red-500/30 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
            {loading ? "Saving..." : <><Save size={20} /> Save Resident Profile</>}
          </button>
        </div>

      </form>
    </div>
  );
}