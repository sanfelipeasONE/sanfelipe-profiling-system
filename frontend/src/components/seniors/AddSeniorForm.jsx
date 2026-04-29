import { useState, useEffect, useRef } from "react";
import api from "../../api/api";
import {
  FileBadge,
  User,
  MapPin,
  Save,
  Loader2,
  AlertCircle,
  ChevronDown,
  Camera,
  Upload,
  X
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Cropper from "react-easy-crop";

// --- IMAGE HELPERS ---
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
      const file = new File([blob], "profile.jpg", { type: "image/jpeg" });
      resolve(file);
    }, "image/jpeg");
  });
}

// --- DATE HELPERS ---
function formatDateInput(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

function displayDateToIso(displayDate) {
  const clean = String(displayDate || "").trim();
  const match = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

// --- REUSABLE COMPONENTS ---
const SectionHeader = ({ icon: Icon, title, colorClass = "text-slate-600" }) => (
  <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
    <div className={`p-2 rounded-xl bg-white border border-slate-100 shadow-sm ${colorClass}`}>
      <Icon size={18} strokeWidth={2} />
    </div>
    <div>
      <h3 className="font-normal text-slate-700 tracking-tight">{title}</h3>
    </div>
  </div>
);

const InputGroup = ({ label, name, value, onChange, type = "text", required = false, placeholder, className = "", maxLength }) => (
  <div className={`flex flex-col gap-1.5 w-full ${className}`}>
    <label className="flex items-center text-[11px] font-normal text-slate-400 uppercase tracking-wider">
      {label} {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value || ""}
      onChange={onChange}
      required={required}
      placeholder={placeholder}
      maxLength={maxLength}
      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-normal text-slate-800 placeholder:text-slate-300 focus:bg-white focus:border-red-400 focus:ring-4 focus:ring-red-50 hover:border-slate-300 outline-none transition-all uppercase"
    />
  </div>
);

const SelectGroup = ({ label, name, value, onChange, options, required = false, disabled = false, placeholder, className = "" }) => (
  <div className="space-y-1.5 w-full">
    <label className="flex items-center text-[11px] font-normal text-slate-400 uppercase tracking-wider">
      {label} {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <div className="relative">
      <select
        name={name}
        value={value || ""}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`w-full px-4 py-3 border rounded-xl text-sm font-normal appearance-none outline-none transition-all cursor-pointer uppercase ${className} ${disabled ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" : "bg-slate-50 text-slate-800 border-slate-200 focus:bg-white focus:border-red-400 focus:ring-4 focus:ring-red-50 hover:border-slate-300"}`}
      >
        <option value="" disabled className="text-slate-400 uppercase">
          {placeholder || "Select Option"}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="uppercase">
            {opt.label.toUpperCase()}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
    </div>
  </div>
);

// --- INITIAL STATE ---
const getInitialFormState = () => ({
  osca_control_no: "",
  date_issued: "",
  last_name: "",
  first_name: "",
  middle_name: "",
  ext_name: "",
  sex: "",
  civil_status: "",
  educational_attainment: "",
  birthdate: "",
  house_no: "",
  purok: "",
  barangay_id: "",
});

export default function AddSeniorForm({ onSuccess, onCancel, seniorToEdit }) {
  const [formData, setFormData] = useState(getInitialFormState());
  const [barangayOptions, setBarangayOptions] = useState([]);
  const [purokOptions, setPurokOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Photo States
  const [photoFile, setPhotoFile] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  // Camera States
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");
  const videoRef = useRef(null);

  // Cleanup Camera
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // Fetch Barangays on Mount
  useEffect(() => {
    const fetchBarangays = async () => {
      try {
        const res = await api.get("/barangays/");
        setBarangayOptions((res.data || []).map((b) => ({ value: b.id, label: b.name })));
      } catch {
        toast.error("Failed to load barangays.");
      }
    };
    fetchBarangays();
  }, []);

  // Fetch Purok/Sitio when Barangay changes
  useEffect(() => {
    const loadAreas = async () => {
      if (!formData.barangay_id) {
        setPurokOptions([]);
        setFormData((prev) => ({ ...prev, purok: "" }));
        return;
      }
      try {
        const res = await api.get(`/barangays/${formData.barangay_id}/areas`);
        setPurokOptions((res.data || []).map((a) => ({
          value: a.name,
          label: a.parent_purok ? `${a.name} (${a.parent_purok})` : a.name,
        })));
      } catch {
        setPurokOptions([]);
        toast.error("Failed to load Purok/Sitio.");
      }
    };
    loadAreas();
  }, [formData.barangay_id]);

  // --- POPULATE EDIT DATA ---
  useEffect(() => {
    if (!seniorToEdit) return;
    if (!barangayOptions.length) return; // Wait until barangays are loaded

    const barangayMatch = barangayOptions.find(
      (b) => String(b.label).toUpperCase() === String(seniorToEdit.barangay).toUpperCase()
    );

    // Format dates back to MM/DD/YYYY for the input fields
    const formatForInput = (isoString) => {
       if (!isoString) return "";
       const [year, month, day] = isoString.split("T")[0].split("-");
       return `${month}/${day}/${year}`;
    };

    setFormData({
      ...getInitialFormState(),
      ...seniorToEdit,
      birthdate: formatForInput(seniorToEdit.birthdate),
      date_issued: formatForInput(seniorToEdit.date_issued),
      civil_status: seniorToEdit.civil_status || "",
      educational_attainment: seniorToEdit.educational_attainment || "",
      barangay_id: barangayMatch ? String(barangayMatch.value) : "",
      purok: seniorToEdit.purok || "",
    });
    
    setPhotoPreview(seniorToEdit.photo_url || null);
  }, [seniorToEdit, barangayOptions]);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "birthdate" || name === "date_issued" ? formatDateInput(value) : value,
    }));
  };

  // --- PHOTO HANDLERS ---
  const handlePhotoSelect = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setImageSrc(reader.result);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropModalOpen(true);
    };
  };

  const handleCropSave = async () => {
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      setPhotoFile(croppedImage);
      setPhotoPreview(URL.createObjectURL(croppedImage));
      setCropModalOpen(false);
    } catch {
      toast.error("Failed to crop photo.");
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setImageSrc(null);
  };

  const openCamera = async (currentMode = facingMode) => {
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentMode },
        audio: false,
      });
      setCameraStream(stream);
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (error) {
      console.error(error);
      toast.error("Unable to access camera.");
    }
  };

  const toggleCamera = () => {
    const newMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newMode);
    openCamera(newMode);
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg");
    setImageSrc(dataUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropModalOpen(true);
    closeCamera();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedBarangay = barangayOptions.find(b => String(b.value) === String(formData.barangay_id));

      const payload = {
        osca_control_no: formData.osca_control_no,
        date_issued: displayDateToIso(formData.date_issued),
        last_name: formData.last_name,
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        ext_name: formData.ext_name,
        sex: formData.sex,
        civil_status: formData.civil_status,
        educational_attainment: formData.educational_attainment,
        birthdate: displayDateToIso(formData.birthdate),
        house_no: formData.house_no,
        purok: formData.purok,
        barangay: selectedBarangay ? selectedBarangay.label : ""
      };

      if (!payload.birthdate || !payload.date_issued) {
        toast.error("Please ensure dates are fully entered (MM/DD/YYYY).");
        setLoading(false);
        return;
      }

      let response;
      let seniorId;

      if (seniorToEdit) {
        response = await api.put(`/osca/seniors/${seniorToEdit.id}`, payload);
        seniorId = seniorToEdit.id;
        toast.success("Senior Record Updated Successfully.");
      } else {
        response = await api.post("/osca/seniors/", payload);
        seniorId = response.data.id;
        toast.success("Senior Citizen Registered Successfully.");
      }

      if (photoFile && seniorId) {
        const form = new FormData();
        form.append("file", photoFile);
        await api.post(`/osca/seniors/${seniorId}/upload-photo`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      
      setTimeout(() => {
        setFormData(getInitialFormState());
        setPhotoFile(null);
        setPhotoPreview(null);
        setImageSrc(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
        setLoading(false);
        if (onSuccess) onSuccess();
      }, 1000);

    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Registration failed. Check inputs.");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-32 animate-in fade-in duration-300 font-sans text-slate-800">
      <Toaster position="top-right" toastOptions={{ style: { background: "#1e293b", color: "#fff", borderRadius: "12px", fontSize: "14px" } }} />

      <div className="mb-8 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-red-600 text-white rounded-xl shadow-sm">
            <FileBadge size={24} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl font-medium text-slate-800 tracking-tight">
              {seniorToEdit ? "Update OSCA Record" : "OSCA Registration"}
            </h1>
            <p className="text-sm font-normal text-slate-400 mt-1">
              {seniorToEdit 
                ? "Modify existing OSCA data and records." 
                : "Register a new Senior Citizen into the standalone OSCA database."}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* OSCA Details */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="px-6 md:px-8 py-6">
            <SectionHeader icon={FileBadge} title="OSCA Verification Details" colorClass="text-red-600" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InputGroup label="Control Number" name="osca_control_no" value={formData.osca_control_no} onChange={handleChange} required placeholder="MANUAL INPUT (e.g., SC-2024-001)" />
              <InputGroup label="Date Issued" name="date_issued" value={formData.date_issued} onChange={handleChange} required placeholder="MM/DD/YYYY" maxLength={10} />
            </div>
          </div>
        </div>

        {/* Personal Details */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="px-6 md:px-8 py-6">
            <SectionHeader icon={User} title="Personal Information" colorClass="text-blue-600" />
            
            {/* PHOTO UPLOAD */}
            <div className="mb-8">
              <label className="text-[11px] font-normal text-slate-400 uppercase tracking-wider block mb-3">
                Senior Photo
              </label>
              <div className="flex items-center gap-6">
                <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center overflow-hidden flex-shrink-0">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User size={32} className="text-slate-300" strokeWidth={1.5} />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap gap-3">
                    <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-normal hover:bg-slate-200 transition-colors cursor-pointer">
                      <Upload size={16} /> Upload Photo
                      <input type="file" accept="image/*" onChange={(e) => handlePhotoSelect(e.target.files?.[0])} className="hidden" />
                    </label>

                    <button type="button" onClick={() => openCamera()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-normal hover:bg-slate-800 transition-colors">
                      <Camera size={16} /> Take Photo
                    </button>
                  </div>

                  {photoPreview && (
                    <button type="button" onClick={removePhoto} className="mt-3 text-sm text-slate-500 hover:text-red-600 transition-colors">
                      Remove current photo
                    </button>
                  )}
                  <p className="text-xs text-slate-400 mt-2 font-normal">Recommended: Square image, max 5MB.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <InputGroup label="Last Name" name="last_name" value={formData.last_name} onChange={handleChange} required placeholder="DELA CRUZ" />
              <InputGroup label="First Name" name="first_name" value={formData.first_name} onChange={handleChange} required placeholder="JUAN" />
              <InputGroup label="Middle Name" name="middle_name" value={formData.middle_name} onChange={handleChange} placeholder="SANTOS" />
              <InputGroup label="Suffix" name="ext_name" value={formData.ext_name} onChange={handleChange} placeholder="JR, SR, III" />
              <InputGroup label="Date of Birth" name="birthdate" value={formData.birthdate} onChange={handleChange} required placeholder="MM/DD/YYYY" maxLength={10} />
              
              <SelectGroup 
                label="Sex" 
                name="sex" 
                value={formData.sex} 
                onChange={handleChange} 
                options={[{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }]} 
                required 
                placeholder="Select Gender" 
              />

              <SelectGroup 
                label="Civil Status" 
                name="civil_status" 
                value={formData.civil_status} 
                onChange={handleChange} 
                options={[
                  { value: "Single", label: "Single" }, 
                  { value: "Married", label: "Married" },
                  { value: "Widowed", label: "Widowed" },
                  { value: "Separated", label: "Separated" },
                  { value: "Live-in Partner", label: "Live-in Partner" }
                ]} 
                placeholder="Select Status" 
              />

              <InputGroup 
                label="Educational Attainment" 
                name="educational_attainment" 
                value={formData.educational_attainment} 
                onChange={handleChange} 
                placeholder="E.G. HIGH SCHOOL GRADUATE" 
              />
            </div>
          </div>
        </div>

        {/* Address Details */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="px-6 md:px-8 py-6">
            <SectionHeader icon={MapPin} title="Residency & Location" colorClass="text-emerald-600" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <InputGroup label="House No. / Street" name="house_no" value={formData.house_no} onChange={handleChange} placeholder="House No. / Street Name" />
              <SelectGroup label="Barangay" name="barangay_id" value={formData.barangay_id} onChange={handleChange} options={barangayOptions} required placeholder="Select Barangay" />
              <SelectGroup label="Purok / Sitio" name="purok" value={formData.purok} onChange={handleChange} options={purokOptions} required placeholder="Select Purok or Sitio" />
            </div>
          </div>
        </div>

        {/* Fixed Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 lg:left-[280px] right-0 p-5 bg-white/90 backdrop-blur-md border-t border-slate-200 flex items-center justify-between z-40 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.05)]">
          <div className="hidden md:flex items-center gap-2.5 text-sm text-slate-400 font-normal px-4">
            <AlertCircle size={18} className="text-blue-400" strokeWidth={2} />
            <span>Please verify all data before saving to the OSCA registry.</span>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            {onCancel && (
              <button type="button" onClick={onCancel} className="flex-1 md:flex-none px-6 py-3 text-sm font-normal text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm">
                Cancel
              </button>
            )}
            <button type="submit" disabled={loading} className="flex-1 md:flex-none px-8 py-3 bg-red-600 text-white rounded-xl text-sm font-normal shadow-sm hover:bg-red-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} strokeWidth={2} />}
              {loading ? "Processing..." : (seniorToEdit ? "Update Record" : "Save Registry")}
            </button>
          </div>
        </div>
      </form>

      {/* CAMERA MODAL */}
      {cameraOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[99998] p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-slate-800">Take Photo</h3>
              <button type="button" onClick={toggleCamera} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-medium transition-colors">
                <Camera size={16} /> Switch Camera
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-black relative">
              <video ref={videoRef} autoPlay playsInline className={`w-full h-[360px] object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`} />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={closeCamera} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={capturePhoto} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                Capture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CROP MODAL */}
      {cropModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-slate-800">Crop Photo</h3>
              <button type="button" onClick={() => setCropModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={18} />
              </button>
            </div>
            <div className="relative w-full h-[300px] bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                objectFit="contain"
                restrictPosition={false}
                onCropChange={setCrop}
                onZoomChange={(value) => setZoom(Number(value))}
                onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
              />
            </div>
            <div className="mt-6 mb-2">
              <label className="text-[11px] font-normal text-slate-400 uppercase tracking-wider">Zoom Adjust</label>
              <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full mt-2 accent-red-600" />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setCropModalOpen(false)} className="px-5 py-2.5 text-sm font-normal text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleCropSave} className="px-5 py-2.5 bg-slate-900 text-white text-sm font-normal rounded-xl hover:bg-slate-800 transition-colors">
                Apply Crop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}