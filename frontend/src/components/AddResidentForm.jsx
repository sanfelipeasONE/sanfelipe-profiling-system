import { useState, useEffect } from 'react';
import api from '../api';
import { X, Plus, Trash2, User, MapPin, Briefcase, Heart, Save, Phone, Fingerprint } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// Helper: Enhanced to support disabled state
const SelectGroup = ({ label, name, value, onChange, options, required = false, disabled = false, placeholder }) => (
  <div className="space-y-1 w-full">
    <label className="text-[10px] font-bold text-stone-500 uppercase">{label}</label>
    <select 
      name={name} value={value || ''} onChange={onChange} required={required} disabled={disabled}
      className={`w-full p-3 border rounded-xl focus:border-rose-500 outline-none text-sm appearance-none
        ${disabled ? 'bg-stone-200 text-stone-500 cursor-not-allowed border-stone-300' : 'bg-white text-stone-800 border-stone-200'}
      `}
    >
      <option value="">{placeholder || (disabled ? "Auto-Assigned" : "Select...")}</option>
      {options.map((opt) => (
        <option key={opt.id || opt} value={opt.name || opt}>{opt.name || opt}</option>
      ))}
    </select>
  </div>
);

const InputGroup = ({ label, name, value, onChange, type = "text", required = false, placeholder }) => (
  <div className="space-y-1 w-full">
    <label className="text-[10px] font-bold text-stone-500 uppercase">{label}</label>
    <input 
      type={type} name={name} value={value || ''} onChange={onChange} required={required} placeholder={placeholder}
      className="w-full p-3 bg-stone-50 border border-transparent focus:bg-white focus:border-rose-500 rounded-xl transition-all outline-none text-sm text-stone-800 placeholder:text-stone-400" 
    />
  </div>
);

// Initial empty form state
const getInitialFormState = () => ({
  last_name: '', first_name: '', middle_name: '', ext_name: '',
  house_no: '', purok: '', barangay: '',
  birthdate: '', sex: '', civil_status: '',
  occupation: '', precinct_no: '', contact_no: '',
  spouse_last_name: '', spouse_first_name: '', spouse_middle_name: '', spouse_ext_name: '',
  sector_ids: [], family_members: [], other_sector_details: '' 
});

export default function AddResidentForm({ onSuccess, onCancel, residentToEdit }) {
  const [formData, setFormData] = useState(getInitialFormState());

  const [barangayOptions, setBarangayOptions] = useState([]);
  const [purokOptions, setPurokOptions] = useState([]);
  const [sectorOptions, setSectorOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Get User Role to determine if we lock the barangay field
  const userRole = localStorage.getItem('role') || 'staff'; 

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [bRes, pRes, sRes] = await Promise.all([
          api.get('/barangays/'), api.get('/puroks/'), api.get('/sectors/')
        ]);
        setBarangayOptions(bRes.data);
        setPurokOptions(pRes.data);
        setSectorOptions(sRes.data);
      } catch (err) { toast.error("Failed to load options."); }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    if (residentToEdit) {
      setFormData({
        ...residentToEdit,
        birthdate: residentToEdit.birthdate ? residentToEdit.birthdate.split('T')[0] : '',
        sector_ids: residentToEdit.sectors ? residentToEdit.sectors.map(s => s.id) : [],
        family_members: residentToEdit.family_members || []
      });
    }
  }, [residentToEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newState = { ...prev, [name]: value };
      if (name === "civil_status" && value !== "Married") {
        newState.spouse_last_name = '';
        newState.spouse_first_name = '';
        newState.spouse_middle_name = '';
        newState.spouse_ext_name = '';
      }
      return newState;
    });
  };

  const handleSectorToggle = (id) => {
    setFormData(prev => ({
      ...prev,
      sector_ids: prev.sector_ids.includes(id) 
        ? prev.sector_ids.filter(sid => sid !== id) 
        : [...prev.sector_ids, id]
    }));
  };

  const addFamilyMember = () => {
    setFormData(prev => ({
      ...prev,
      family_members: [...prev.family_members, { first_name: '', last_name: '', relationship: '' }]
    }));
  };

  const handleFamilyChange = (index, field, value) => {
    const updated = [...formData.family_members];
    updated[index][field] = value;
    setFormData({ ...formData, family_members: updated });
  };

  const resetForm = () => {
    setFormData(getInitialFormState());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (residentToEdit) {
        await api.put(`/residents/${residentToEdit.id}`, formData);
        toast.success("Profile Updated!");
        setTimeout(onSuccess, 1500);
      } else {
        await api.post('/residents/', formData);
        toast.success("Resident Registered!");
        // Reset form after successful creation (not for edits)
        setTimeout(() => {
          resetForm();
          // Scroll to top for better UX
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setLoading(false);
          // Call onSuccess to refresh the data
          onSuccess();
        }, 1500);
      }
    } catch (error) { 
      toast.error("Error saving data."); 
      setLoading(false); 
    }
  };

  const isOtherSelected = sectorOptions.find(s => s.name.toLowerCase().includes('other') && formData.sector_ids.includes(s.id));

  return (
    <div className="w-full pb-32 animate-in fade-in slide-in-from-bottom-4 duration-500"> 
      <Toaster position="top-center" />
      
      <div className="mb-6 px-1">
        <h1 className="text-xl md:text-2xl font-bold text-stone-900">
          {residentToEdit ? "Edit Profile" : "Register Resident"}
        </h1>
        <p className="text-stone-500 text-xs mt-1">Fields with * are required.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* PERSONAL INFO */}
        <section className="bg-white p-5 md:p-8 rounded-2xl border border-stone-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-stone-50 pb-4">
            <User className="text-rose-500" size={20} />
            <h3 className="font-bold text-stone-800">Personal Information</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InputGroup label="Last Name *" name="last_name" value={formData.last_name} onChange={handleChange} required placeholder="Dela Cruz" />
            <InputGroup label="First Name *" name="first_name" value={formData.first_name} onChange={handleChange} required placeholder="Juan" />
            <InputGroup label="Middle Name" name="middle_name" value={formData.middle_name} onChange={handleChange} placeholder="Santos" />
            <InputGroup label="Ext." name="ext_name" value={formData.ext_name} onChange={handleChange} placeholder="Jr/Sr/III" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputGroup label="Birthdate *" name="birthdate" type="date" value={formData.birthdate} onChange={handleChange} required />
            <SelectGroup label="Sex *" name="sex" value={formData.sex} onChange={handleChange} options={['Male', 'Female']} required placeholder="Choose gender" />
            <SelectGroup label="Civil Status *" name="civil_status" value={formData.civil_status} onChange={handleChange} options={['Single', 'Married', 'Widowed']} required placeholder="Choose status" />
          </div>

          {(formData.civil_status === 'Married' || formData.civil_status === 'Live-in Partner') && (
            <div className="p-5 bg-rose-50/40 rounded-2xl border border-rose-100 animate-in zoom-in-95 duration-300">
              <h4 className="text-xs font-bold text-rose-600 uppercase mb-3 flex items-center gap-2">
                <Heart size={14} /> Spouse / Partner Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <InputGroup label="Spouse Last Name" name="spouse_last_name" value={formData.spouse_last_name} onChange={handleChange} placeholder="Last name" />
                <InputGroup label="Spouse First Name" name="spouse_first_name" value={formData.spouse_first_name} onChange={handleChange} placeholder="First name" />
                <InputGroup label="Spouse Middle Name" name="spouse_middle_name" value={formData.spouse_middle_name} onChange={handleChange} placeholder="Middle name" />
                <InputGroup label="Spouse Ext." name="spouse_ext_name" value={formData.spouse_ext_name} onChange={handleChange} placeholder="Jr/Sr" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputGroup label="Occupation" name="occupation" value={formData.occupation} onChange={handleChange} placeholder="e.g. Teacher, Farmer" />
            <InputGroup label="Contact No" name="contact_no" value={formData.contact_no} onChange={handleChange} placeholder="09XX-XXX-XXXX" />
            <InputGroup label="Precinct No" name="precinct_no" value={formData.precinct_no} onChange={handleChange} placeholder="e.g. 0001A" />
          </div>
        </section>

        {/* ADDRESS */}
        <section className="bg-white p-5 md:p-8 rounded-2xl border border-stone-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-stone-50 pb-4">
            <MapPin className="text-red-500" size={20} />
            <h3 className="font-bold text-stone-800">Address</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputGroup label="House No." name="house_no" value={formData.house_no} onChange={handleChange} placeholder="e.g. Block 1 Lot 23" />
            <SelectGroup label="Purok *" name="purok" value={formData.purok} onChange={handleChange} options={purokOptions} required placeholder="Select purok" />
            
            {/* --- FIX: DISABLE BARANGAY SELECTION FOR STAFF --- */}
            {/* If user is Admin, they can select. If Staff, it's disabled. */}
            <SelectGroup 
              label={userRole === 'admin' ? "Barangay *" : "Barangay (Auto-Assigned)"}
              name="barangay" 
              value={formData.barangay} 
              onChange={handleChange} 
              options={barangayOptions} 
              required={userRole === 'admin'} 
              disabled={userRole !== 'admin'} 
              placeholder={userRole === 'admin' ? "Select barangay" : "Assigned by system"}
            />
          </div>
        </section>

        {/* FAMILY MEMBERS */}
        <section className="bg-white p-5 md:p-8 rounded-2xl border border-stone-100 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-stone-50 pb-4">
            <div className="flex items-center gap-2">
              <Plus className="text-rose-400" size={20} />
              <h3 className="font-bold text-stone-800">Other Family Members</h3>
            </div>
            <button type="button" onClick={addFamilyMember} className="text-xs font-bold bg-rose-50 text-rose-600 px-4 py-2 rounded-xl hover:bg-rose-100 transition-colors">+ Add Member</button>
          </div>
          <div className="space-y-3">
            {formData.family_members.map((member, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 bg-stone-50 rounded-xl items-end relative">
                <InputGroup label="First Name" value={member.first_name} onChange={(e) => handleFamilyChange(index, 'first_name', e.target.value)} placeholder="First name" />
                <InputGroup label="Last Name" value={member.last_name} onChange={(e) => handleFamilyChange(index, 'last_name', e.target.value)} placeholder="Last name" />
                <SelectGroup label="Relationship" value={member.relationship} onChange={(e) => handleFamilyChange(index, 'relationship', e.target.value)} options={['Son', 'Daughter', 'Mother', 'Father', 'Sibling']} placeholder="Choose relation" />
                <button type="button" onClick={() => setFormData({...formData, family_members: formData.family_members.filter((_, i) => i !== index)})} className="p-3 text-red-500 hover:bg-red-50 rounded-xl w-fit transition-colors"><Trash2 size={18}/></button>
              </div>
            ))}
          </div>
        </section>

        {/* SECTORS */}
        <section className="bg-white p-5 md:p-8 rounded-2xl border border-stone-100 shadow-sm space-y-6">
          <div className="flex items-center gap-2 border-b border-stone-50 pb-4">
            <Briefcase className="text-orange-500" size={20} />
            <h3 className="font-bold text-stone-800">Sector Affiliation</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {sectorOptions.map((s) => (
              <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.sector_ids.includes(s.id) ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'}`}>
                <input type="checkbox" className="hidden" checked={formData.sector_ids.includes(s.id)} onChange={() => handleSectorToggle(s.id)} />
                <span className="text-xs font-bold uppercase">{s.name}</span>
              </label>
            ))}
          </div>
          {isOtherSelected && (
            <InputGroup label="Specify Other Sector" name="other_sector_details" value={formData.other_sector_details} onChange={handleChange} placeholder="e.g. Solo Parent, Overseas Worker" />
          )}
        </section>

        {/* ACTIONS - Fixed positioning to respect sidebar */}
        <div className="fixed bottom-0 left-0 md:left-64 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-stone-200 flex flex-col sm:flex-row justify-end gap-3 z-50 shadow-lg">
          <button type="button" onClick={onCancel} className="w-full sm:w-auto px-8 py-3 font-bold text-stone-500 hover:bg-stone-50 rounded-xl transition-colors">Cancel</button>
          <button type="submit" disabled={loading} className="w-full sm:w-auto px-12 py-3 bg-red-600 text-white rounded-xl font-bold shadow-xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Saving..." : "Save Record"}
          </button>
        </div>

      </form>
    </div>
  );
}