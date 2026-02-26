import { useState, useEffect } from 'react';
import api from '../../api/api';
import { 
  X, Plus, Trash2, User, MapPin, Briefcase, Heart, Save, Phone, 
  Fingerprint, FileText, ChevronDown, Check, AlertCircle 
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Cropper from "react-easy-crop";

// --- REUSABLE COMPONENTS ---

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

async function getCroppedImg(imageSrc, croppedAreaPixels) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = croppedAreaPixels.width;
  canvas.height = croppedAreaPixels.height;

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    croppedAreaPixels.width,
    croppedAreaPixels.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const file = new File([blob], "profile.jpg", {
        type: "image/jpeg",
      });
      resolve(file);
    }, "image/jpeg");
  });
}

const SectionHeader = ({ icon: Icon, title, colorClass = "text-stone-600" }) => (
  <div className="flex items-center gap-3 border-b border-stone-200 pb-3 mb-5">
    <div className={`p-1.5 rounded-sm bg-stone-100 ${colorClass}`}>
      <Icon size={16} />
    </div>
    <h3 className="font-bold text-stone-800 uppercase text-sm tracking-wide">{title}</h3>
  </div>
);

const SelectGroup = ({ label, name, value, onChange, options, required = false, disabled = false, placeholder, className = "" }) => (
  <div className="space-y-1 w-full">
    <div className="flex justify-between">
      <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
    </div>
    <div className="relative">
      <select 
        name={name} 
        value={value || ''} 
        onChange={onChange} 
        required={required} 
        disabled={disabled}
        className={`
          w-full h-[40px] pl-3 pr-8 border rounded-sm
          text-xs font-semibold appearance-none outline-none transition-all
          ${className}
          ${disabled 
            ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed' 
            : 'bg-white text-stone-800 border-stone-300 focus:border-rose-600 focus:ring-1 focus:ring-rose-600'
          }
        `}
      >
        <option value="" disabled className="text-stone-300">
          {placeholder || (disabled ? "System Assigned" : "Select Option")}
        </option>
        {options.map((opt) => {
          const val = typeof opt === 'object' ? opt.name || opt.id : opt;
          const key = typeof opt === 'object' ? opt.id || opt.name : opt;
          return <option key={key} value={val}>{val}</option>
        })}
      </select>
      <ChevronDown
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
        size={14}
      />
    </div>
  </div>
);

const InputGroup = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  className = ""
}) => (
  <div className={`flex flex-col gap-1 w-full ${className}`}>
    <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
      {label} {required && <span className="text-red-600">*</span>}
    </label>

    <input
      type={type}
      name={name}
      value={value || ""}
      onChange={onChange}
      required={required}
      placeholder={placeholder}
      className={`
        w-full h-[40px] px-3
        bg-white border border-stone-300 rounded-sm
        text-xs font-semibold text-stone-800
        focus:border-rose-600 focus:ring-1 focus:ring-rose-600
        outline-none transition-all
        ${type === "date" ? "date-input-fix" : ""}
      `}
    />
  </div>
);


// --- INITIAL STATE ---
const getInitialFormState = () => ({
  last_name: '', first_name: '', middle_name: '', ext_name: '',
  house_no: '', purok: '', barangay: '',
  birthdate: '', sex: '', civil_status: '',
  religion: '',
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
  const [photoFile, setPhotoFile] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  
  const userRole = localStorage.getItem('role') || 'staff'; 

  // --- FETCH DATA ---
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [bRes, pRes, sRes] = await Promise.all([
          api.get('/barangays/'), api.get('/puroks/'), api.get('/sectors/')
        ]);
        setBarangayOptions(bRes.data);
        setPurokOptions(pRes.data);
        setSectorOptions(sRes.data);
      } catch (err) { toast.error("System Error: Failed to load form options."); }
    };
    fetchOptions();
  }, []);

  // --- POPULATE EDIT DATA ---
  useEffect(() => {
    if (residentToEdit && barangayOptions.length && purokOptions.length) {

      const normalizeSelect = (value, options) => {
        if (!value) return '';
        const cleaned = value.toLowerCase().trim();
        const match = options.find(opt => {
          const optionValue = (opt.name || opt).toLowerCase().trim();
          return (
            optionValue === cleaned ||
            optionValue.replace("purok", "").trim() === cleaned.replace("purok", "").trim()
          );
        });
        return match ? (match.name || match) : '';
      };

      const normalizeSex = (value) => {
        if (!value) return '';
        const v = value.toLowerCase().trim();
        if (v === 'm' || v === 'male') return 'Male';
        if (v === 'f' || v === 'female') return 'Female';
        return '';
      };

      const normalizeCivilStatus = (value) => {
        if (!value) return '';
        const v = value.toLowerCase().trim();
        if (v === 'single') return 'Single';
        if (v === 'married') return 'Married';
        if (v === 'widowed') return 'Widowed';
        if (v.includes('live')) return 'Live-in Partner';
        return '';
      };

      setFormData({
        ...getInitialFormState(),
        ...residentToEdit,
        birthdate: residentToEdit.birthdate
          ? residentToEdit.birthdate.split("T")[0]
          : "",
        sex: normalizeSex(residentToEdit.sex),
        civil_status: normalizeCivilStatus(residentToEdit.civil_status),
        barangay: normalizeSelect(residentToEdit.barangay, barangayOptions),
        purok: normalizeSelect(residentToEdit.purok, purokOptions),
        sector_ids: residentToEdit.sectors
          ? residentToEdit.sectors.map((s) => s.id)
          : [],
        family_members: residentToEdit.family_members || [],
      });

      // 👇 THIS is what actually shows the photo
      if (residentToEdit.photo_url) {
        setPhotoPreview(residentToEdit.photo_url);
      } else {
        setPhotoPreview(null);
      }
    }
  }, [residentToEdit, barangayOptions, purokOptions]);

  // --- HANDLERS ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newState = { ...prev, [name]: value };
      if (name === "civil_status" && value !== "Married" && value !== "Live-in Partner") {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let response;

      if (residentToEdit) {
        // UPDATE MODE
        response = await api.put(`/residents/${residentToEdit.id}`, formData);

        if (photoFile) {
          const form = new FormData();
          form.append("file", photoFile);

          await api.post(
            `/residents/${residentToEdit.id}/upload-photo`,
            form,
            { headers: { "Content-Type": "multipart/form-data" } }
          );
        }

        toast.success("Resident Record Updated.");
        setTimeout(onSuccess, 1000);

      } else {
        // CREATE MODE
        response = await api.post('/residents/', formData);

        const newResident = response.data;

        if (photoFile && newResident?.id) {
          const form = new FormData();
          form.append("file", photoFile);

          await api.post(
            `/residents/${newResident.id}/upload-photo`,
            form,
            { headers: { "Content-Type": "multipart/form-data" } }
          );
        }

        toast.success("New Resident Registered.");

        setTimeout(() => {
          setFormData(getInitialFormState());
          setPhotoFile(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setLoading(false);
          onSuccess();
        }, 1000);
      }

    } catch (err) {
      if (err.response?.data?.detail) {
        toast.error(err.response.data.detail);
      } else {
        toast.error("Registration failed.");
      }
      setLoading(false);
    }
  };

  const isOtherSelected = sectorOptions.find(s => s.name.toLowerCase().includes('other') && formData.sector_ids.includes(s.id));

  return (
    <div className="w-full pb-32 animate-in fade-in duration-300 font-sans text-stone-800"> 
      <Toaster position="top-right" toastOptions={{ style: { background: '#333', color: '#fff', borderRadius: '4px', fontSize: '12px' } }} />
      
      {/* HEADER */}
      <div className="mb-8 border-b border-stone-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-stone-900 text-white rounded-sm">
             {residentToEdit ? <FileText size={20} /> : <User size={20} />}
          </div>
          <div>
            <h1 className="text-xl font-black text-stone-900 uppercase tracking-tight">
              {residentToEdit ? "Update Resident Profile" : "Resident Registration Form"}
            </h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* --- PERSONAL INFO --- */}
        <div className="bg-white border border-stone-300 shadow-sm rounded-sm overflow-hidden">
          <div className="bg-stone-50 px-6 py-3 border-b border-stone-200">
             <SectionHeader icon={User} title="Personal Information" colorClass="text-rose-700" />
          </div>
          
          <div className="p-6 md:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <InputGroup label="Last Name" name="last_name" value={formData.last_name} onChange={handleChange} required placeholder="DELA CRUZ" className="lg:col-span-1" />
              <InputGroup label="First Name" name="first_name" value={formData.first_name} onChange={handleChange} required placeholder="JUAN" className="lg:col-span-1" />
              <InputGroup label="Middle Name" name="middle_name" value={formData.middle_name} onChange={handleChange} placeholder="SANTOS" />
              <InputGroup label="Suffix (e.g. Jr, III)" name="ext_name" value={formData.ext_name} onChange={handleChange} placeholder="JR, SR, III" />
            </div>
            {/* PHOTO UPLOAD SECTION */}
            <div className="mt-5">
              <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                Resident Photo
              </label>

              {photoPreview && (
                <div className="mt-3 mb-3">
                  <img
                    src={photoPreview}
                    alt="Resident"
                    className="w-32 h-32 object-cover rounded-md border"
                  />
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;

                  const reader = new FileReader();
                  reader.readAsDataURL(file);
                  reader.onload = () => {
                    setImageSrc(reader.result);
                    setCropModalOpen(true);
                  };
                }}
                className="mt-2 text-xs"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <InputGroup label="Date of Birth" name="birthdate" type="date" value={formData.birthdate} onChange={handleChange} required />
              <SelectGroup label="Sex" name="sex" value={formData.sex} onChange={handleChange} options={['Male', 'Female']} required placeholder="SELECT GENDER" />
              <SelectGroup label="Civil Status" name="civil_status" value={formData.civil_status} onChange={handleChange} options={['Single', 'Married', 'Widowed', 'Live-in Partner']} required placeholder="SELECT STATUS" />
              <InputGroup label="Religion" name="religion" value={formData.religion} onChange={handleChange} placeholder="ROMAN CATHOLIC" />
            </div>


            {/* SPOUSE SECTION */}
            {(formData.civil_status === 'Married' || formData.civil_status === 'Live-in Partner') && (
              <div className="p-5 bg-stone-50 border border-stone-200 rounded-sm">
                <div className="flex items-center gap-2 mb-4 text-stone-500">
                  <Heart size={14} className="text-rose-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Spouse / Partner Details</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <InputGroup label="Spouse Last Name" name="spouse_last_name" value={formData.spouse_last_name} onChange={handleChange} />
                  <InputGroup label="Spouse First Name" name="spouse_first_name" value={formData.spouse_first_name} onChange={handleChange} />
                  <InputGroup label="Spouse Middle Name" name="spouse_middle_name" value={formData.spouse_middle_name} onChange={handleChange} />
                  <InputGroup label="Suffix" name="spouse_ext_name" value={formData.spouse_ext_name} onChange={handleChange} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 border-t border-stone-100 pt-5">
              <InputGroup label="Occupation / Profession" name="occupation" value={formData.occupation} onChange={handleChange} placeholder="E.G. FARMER, GOVT EMPLOYEE" />
              <InputGroup label="Mobile Number" name="contact_no" value={formData.contact_no} onChange={handleChange} placeholder="09XX-XXX-XXXX" />
              <InputGroup label="Precinct / Voter ID" name="precinct_no" value={formData.precinct_no} onChange={handleChange} placeholder="OPTIONAL" />
            </div>
          </div>
        </div>

        {/* --- ADDRESS --- */}
        <div className="bg-white border border-stone-300 shadow-sm rounded-sm overflow-hidden">
          <div className="bg-stone-50 px-6 py-3 border-b border-stone-200">
             <SectionHeader icon={MapPin} title="Residency & Location" colorClass="text-rose-700" />
          </div>
          <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <InputGroup label="House No. / Street" name="house_no" value={formData.house_no} onChange={handleChange} placeholder="HOUSE NO. / STREET NAME" />
              <SelectGroup label="Purok / Zone" name="purok" value={formData.purok} onChange={handleChange} options={purokOptions} required placeholder="SELECT PUROK" />
              <SelectGroup 
                label="Barangay"
                name="barangay" 
                value={formData.barangay} 
                onChange={handleChange} 
                options={barangayOptions} 
                required={userRole === 'admin'} 
                disabled={userRole !== 'admin'} 
                placeholder={userRole === 'admin' ? "SELECT BARANGAY" : "AUTO-ASSIGNED"}
                className="uppercase tracking-wide"
              />
            </div>
          </div>
        </div>

        {/* --- SECTORS --- */}
        <div className="bg-white border border-stone-300 shadow-sm rounded-sm overflow-hidden">
           <div className="bg-stone-50 px-6 py-3 border-b border-stone-200">
             <SectionHeader icon={Briefcase} title="Sectoral Classification" colorClass="text-rose-700" />
           </div>
           <div className="p-6 md:p-8">
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
               {sectorOptions.map((s) => (
                 <label 
                   key={s.id} 
                   className={`
                     flex flex-col items-center justify-center gap-2 p-4 rounded-sm border cursor-pointer transition-all h-24 text-center
                     ${formData.sector_ids.includes(s.id) 
                       ? 'bg-stone-800 border-stone-800 text-white shadow-md transform scale-[1.02]' 
                       : 'bg-white border-stone-200 text-stone-500 hover:border-rose-400 hover:text-rose-600 hover:shadow-sm'
                     }
                   `}
                 >
                   <input type="checkbox" className="hidden" checked={formData.sector_ids.includes(s.id)} onChange={() => handleSectorToggle(s.id)} />
                   {formData.sector_ids.includes(s.id) ? <Check size={18} /> : <div className="w-4 h-4 rounded-full border border-current opacity-30"></div>}
                   <span className="text-[10px] font-bold uppercase leading-tight">{s.name}</span>
                 </label>
               ))}
             </div>
             {isOtherSelected && (
               <div className="mt-5 animate-in slide-in-from-top-2">
                 <InputGroup label="Please Specify Other Sector" name="other_sector_details" value={formData.other_sector_details} onChange={handleChange} placeholder="ENTER DETAILS" />
               </div>
             )}
           </div>
        </div>

        {/* --- FAMILY MEMBERS --- */}
        <div className="bg-white border border-stone-300 shadow-sm rounded-sm overflow-hidden">
           <div className="bg-stone-50 px-6 py-3 border-b border-stone-200 flex justify-between items-center">
             <SectionHeader icon={Fingerprint} title="Family Members" colorClass="text-rose-700" />
             <button type="button" onClick={addFamilyMember} className="flex items-center gap-2 text-[10px] font-bold uppercase bg-stone-800 text-white px-3 py-1.5 rounded-sm hover:bg-stone-700 transition-colors">
                <Plus size={12} /> Add Member
             </button>
           </div>
           
           <div className="p-6 md:p-8 space-y-4">
             {formData.family_members.length === 0 && (
                <div className="text-center py-8 text-stone-400 border border-dashed border-stone-200 rounded-sm bg-stone-50/50">
                   <p className="text-xs font-bold uppercase">No additional family members listed</p>
                </div>
             )}
             {formData.family_members.map((member, index) => (
               <div key={index} className="flex flex-col md:flex-row gap-3 p-4 bg-stone-50 border border-stone-200 rounded-sm relative group items-end">
                 <div className="flex-1 w-full">
                    <InputGroup label="First Name" value={member.first_name} onChange={(e) => handleFamilyChange(index, 'first_name', e.target.value)} placeholder="GIVEN NAME" />
                 </div>
                 <div className="flex-1 w-full">
                    <InputGroup label="Last Name" value={member.last_name} onChange={(e) => handleFamilyChange(index, 'last_name', e.target.value)} placeholder="SURNAME" />
                 </div>
                 <div className="flex-1 w-full">
                    <SelectGroup label="Relationship" value={member.relationship} onChange={(e) => handleFamilyChange(index, 'relationship', e.target.value)} options={['Son', 'Daughter', 'Mother', 'Father', 'Sibling', 'Grandparent', 'Grandchild']} placeholder="RELATION" />
                 </div>
                 <button type="button" onClick={() => setFormData({...formData, family_members: formData.family_members.filter((_, i) => i !== index)})} className="p-2.5 bg-white border border-stone-300 text-stone-400 hover:text-red-600 hover:border-red-300 rounded-sm transition-colors">
                    <Trash2 size={16}/>
                 </button>
               </div>
             ))}
           </div>
        </div>

        {/* --- STICKY FOOTER --- */}
        <div className="fixed bottom-0 left-0 md:left-[260px] right-0 p-4 bg-white border-t border-stone-300 flex items-center justify-between z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
           <div className="hidden md:flex items-center gap-2 text-xs text-stone-500 font-medium">
             <AlertCircle size={14} />
             <span>Ensure all data is verified before saving.</span>
           </div>
           <div className="flex gap-3 w-full md:w-auto">
              <button type="button" onClick={onCancel} className="flex-1 md:flex-none px-6 py-2.5 text-xs font-bold uppercase text-stone-600 border border-stone-300 hover:bg-stone-50 rounded-sm transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading} className="flex-1 md:flex-none px-8 py-2.5 bg-rose-700 text-white rounded-sm text-xs font-bold uppercase shadow-sm hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? "Processing..." : (
                  <>
                    <Save size={16} />
                    {residentToEdit ? "Update Record" : "Save Registry"}
                  </>
                )}
              </button>
           </div>
        </div>
      </form>
        {/* 👇 ADD CROP MODAL HERE 👇 */}
        {cropModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-md w-[400px]">
              
              <div className="relative w-full h-[300px] bg-black">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"   // optional (ID style)
                  showGrid={false}
                  objectFit="contain"
                  restrictPosition={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(croppedArea, croppedPixels) =>
                    setCroppedAreaPixels(croppedPixels)
                  }
                />
              </div>

              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(e.target.value)}
                className="w-full mt-4"
              />

              <div className="mt-4 flex justify-between">
                <button
                  onClick={() => setCropModalOpen(false)}
                  className="px-4 py-2 border"
                >
                  Cancel
                </button>

                <button
                  onClick={async () => {
                    const croppedImage = await getCroppedImg(
                      imageSrc,
                      croppedAreaPixels
                    );

                    setPhotoFile(croppedImage);
                    setPhotoPreview(URL.createObjectURL(croppedImage));

                    setCropModalOpen(false);
                  }}
                  className="px-4 py-2 bg-rose-700 text-white"
                >
                  Save Crop
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
}