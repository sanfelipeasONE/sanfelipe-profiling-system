import { useState, useEffect, useRef } from "react";
import api from "../../api/api";
import {
  X,
  Plus,
  Trash2,
  User,
  Users,
  MapPin,
  Briefcase,
  Heart,
  Save,
  Phone,
  Fingerprint,
  FileText,
  ChevronDown,
  Check,
  AlertCircle,
  Loader2,
  Camera,
  Upload,
  Webcam,
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
      const file = new File([blob], "profile.jpg", {
        type: "image/jpeg",
      });
      resolve(file);
    }, "image/jpeg");
  });
}

// --- DATE HELPERS ---

function formatBirthdateInput(value) {
  // Allow up to 8 digits for MMDDYYYY
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  // Slice out the 4-digit year at the end
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

function isoToDisplayDate(isoDate) {
  if (!isoDate) return "";

  const clean = String(isoDate).split("T")[0];
  const [year, month, day] = clean.split("-");
  if (!year || !month || !day) return "";

  // Return full 4-digit year
  return `${month}/${day}/${year}`;
}

function displayDateToIso(displayDate) {
  const clean = String(displayDate || "").trim();
  const match = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  
  if (!match) return null; // <-- CHANGED: Return null instead of ""
  
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

const SelectGroup = ({
  label,
  name,
  value,
  onChange,
  options,
  required = false,
  disabled = false,
  placeholder,
  className = "",
}) => (
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
        className={`
          w-full px-4 py-3 border rounded-xl
          text-sm font-normal appearance-none outline-none transition-all cursor-pointer
          uppercase
          ${className}
          ${
            disabled
              ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
              : "bg-slate-50 text-slate-800 border-slate-200 focus:bg-white focus:border-red-400 focus:ring-4 focus:ring-red-50 hover:border-slate-300"
          }
        `}
      >
        <option value="" disabled className="text-slate-400 uppercase">
          {placeholder || (disabled ? "System Assigned" : "Select Option")}
        </option>

        {options.map((opt) => {
          const optionValue =
            typeof opt === "object" ? opt.id ?? opt.value ?? opt.name : opt;

          const optionLabel =
            typeof opt === "object" ? opt.label ?? opt.name ?? opt.id : opt;

          const key =
            typeof opt === "object" ? opt.id ?? opt.value ?? opt.name : opt;

          return (
            <option key={key} value={optionValue} className="uppercase">
              {String(optionLabel).toUpperCase()}
            </option>
          );
        })}
      </select>

      <ChevronDown
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        size={16}
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
  className = "",
  maxLength, // Added maxLength support
}) => (
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
      className={`
        w-full px-4 py-3
        bg-slate-50 border border-slate-200 rounded-xl
        text-sm font-normal text-slate-800 placeholder:text-slate-300
        focus:bg-white focus:border-red-400 focus:ring-4 focus:ring-red-50 hover:border-slate-300
        outline-none transition-all uppercase
      `}
    />
  </div>
);

// --- INITIAL STATE ---

const getInitialFormState = () => ({
  last_name: "",
  first_name: "",
  middle_name: "",
  ext_name: "",
  house_no: "",
  purok: "",
  barangay_id: "",
  birthdate: "",
  sex: "",
  civil_status: "",
  religion: "",
  occupation: "",
  precinct_no: "",
  contact_no: "",

  emergency_name: "",
  emergency_contact_no: "",
  emergency_address: "",

  spouse_last_name: "",
  spouse_first_name: "",
  spouse_middle_name: "",
  spouse_ext_name: "",

  sector_ids: [],
  family_members: [],
  other_sector_details: "",
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

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [facingMode, setFacingMode] = useState("environment"); // Tracks front vs back camera
  const videoRef = useRef(null);

  const userRole = (localStorage.getItem("role") || "staff").toLowerCase();
  const isAdmin = userRole === "admin";
  const isSuperAdmin = userRole === "super_admin";
  const isAdminLimited = userRole === "admin_limited";
  const isAdminLike = isAdmin || isSuperAdmin || isAdminLimited;

  const relationshipOptions = [
    "Son",
    "Daughter",
    "Mother",
    "Father",
    "Sibling",
    "Grandparent",
    "Grandchild",
    "Guardian",
    "In-laws",
    "Relative",
  ];

  // --- NORMALIZATION HELPERS ---
  const normalizeText = (v) =>
    String(v ?? "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const normalizePurokSitioKey = (v) => {
    const t = normalizeText(v);
    const numMatch = t.match(/\b(\d{1,2})\b/);
    if (t.includes("purok") && numMatch) return `purok-${numMatch[1]}`;
    if (/^\d{1,2}$/.test(t)) return `purok-${t}`;
    return t;
  };

  const normalizeSex = (value) => {
    if (!value) return "";
    const v = String(value).toLowerCase().trim();
    if (v === "m" || v === "male") return "Male";
    if (v === "f" || v === "female") return "Female";
    return "";
  };

  const normalizeCivilStatus = (value) => {
    if (!value) return "";
    const v = String(value).toLowerCase().trim();
    if (v === "single") return "Single";
    if (v === "married") return "Married";
    if (v === "widowed") return "Widowed";
    if (v.includes("live")) return "Live-in Partner";
    if (v === "separated") return "Separated";
    return "";
  };

  // --- FETCH DATA ---

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [bRes, sRes] = await Promise.all([api.get("/barangays/"), api.get("/sectors/")]);
        setBarangayOptions(
          (bRes.data || []).map((b) => ({
            ...b,
            value: b.id,
            label: b.name,
          }))
        );
        setSectorOptions(sRes.data || []);
      } catch {
        toast.error("System Error: Failed to load form options.");
      }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    const loadAreas = async () => {
      if (!formData.barangay_id) {
        setPurokOptions([]);
        setFormData((prev) => ({ ...prev, purok: "" }));
        return;
      }

      try {
        const res = await api.get(`/barangays/${formData.barangay_id}/areas`);
        const opts = (res.data || []).map((a) => ({
          value: a.name,
          label: a.parent_purok ? `${a.name} (${a.parent_purok})` : a.name,
        }));

        setPurokOptions(opts);

        setFormData((prev) => {
          const targetKey = normalizePurokSitioKey(prev.purok || residentToEdit?.purok || "");
          const exactMatch = opts.find((opt) => normalizePurokSitioKey(opt.value) === targetKey);
          
          return {
            ...prev,
            purok: exactMatch ? exactMatch.value : "",
          };
        });
      } catch {
        setPurokOptions([]);
        toast.error("Failed to load Purok/Sitio for selected barangay.");
      }
    };

    loadAreas();
  }, [formData.barangay_id]); 

  useEffect(() => {
    const loadMe = async () => {
      try {
        const res = await api.get("/me");
        const { role, barangay_id } = res.data || {};

        if (String(role).toLowerCase() === "barangay" && barangay_id) {
          setFormData((prev) => ({ ...prev, barangay_id: String(barangay_id) }));
        }
      } catch {}
    };
    loadMe();
  }, []);

  // --- POPULATE EDIT DATA ---

  useEffect(() => {
    if (!residentToEdit) return;
    if (!barangayOptions.length) return;

    if (formData.id === residentToEdit.id) return;

    const barangayMatch = barangayOptions.find(
      (b) => normalizeText(b.name) === normalizeText(residentToEdit?.barangay)
    );

    setFormData({
      ...getInitialFormState(),
      ...residentToEdit,
      id: residentToEdit.id,
      birthdate: residentToEdit.birthdate ? isoToDisplayDate(residentToEdit.birthdate) : "",
      sex: normalizeSex(residentToEdit.sex),
      civil_status: normalizeCivilStatus(residentToEdit.civil_status),
      barangay_id: barangayMatch ? String(barangayMatch.value ?? barangayMatch.id) : "",
      purok: residentToEdit.purok || "",
      sector_ids: residentToEdit.sectors ? residentToEdit.sectors.map((s) => s.id) : [],
      family_members: residentToEdit.family_members || [],
    });

    setPhotoPreview(residentToEdit.photo_url || null);
    
  }, [residentToEdit, barangayOptions, formData.id]);

  // --- CLEANUP CAMERA ---

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

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
      // Stop the existing stream before switching
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
    openCamera(newMode); // Restart with new mode
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
    
    // If it's the front camera, mirror the image horizontally so it doesn't look backwards
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

  // --- FORM HANDLERS ---

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const newState = {
        ...prev,
        [name]: name === "birthdate" ? formatBirthdateInput(value) : value,
      };

      if (
        name === "civil_status" &&
        value !== "Married" &&
        value !== "Live-in Partner" &&
        value !== "Separated"
      ) {
        newState.spouse_last_name = "";
        newState.spouse_first_name = "";
        newState.spouse_middle_name = "";
        newState.spouse_ext_name = "";
      }

      return newState;
    });
  };

  const handleSectorToggle = (id) => {
    setFormData((prev) => ({
      ...prev,
      sector_ids: prev.sector_ids.includes(id)
        ? prev.sector_ids.filter((sid) => sid !== id)
        : [...prev.sector_ids, id],
    }));
  };

  const addFamilyMember = () => {
    setFormData((prev) => ({
      ...prev,
      family_members: [
        ...prev.family_members,
        { first_name: "", middle_name: "", last_name: "", relationship: "" },
      ],
    }));
  };

  const handleFamilyChange = (index, field, value) => {
    const updated = [...formData.family_members];
    updated[index][field] = value;
    setFormData({ ...formData, family_members: updated });
  };

  const removeFamilyMember = (index) => {
    setFormData({
      ...formData,
      family_members: formData.family_members.filter((_, i) => i !== index),
    });
  };

  const buildPayload = () => {
    const payload = { ...formData };
    
    // 1. Format Date and Numbers
    payload.birthdate = displayDateToIso(formData.birthdate);
    payload.barangay_id = formData.barangay_id ? Number(formData.barangay_id) : null;
    payload.sector_ids = Array.isArray(formData.sector_ids) ? formData.sector_ids.map(Number) : [];
    
    // 2. Format Family Members
    payload.family_members = (formData.family_members || [])
      .filter(m => m.first_name && m.first_name.trim() !== "")
      .map((m) => ({
        first_name: m.first_name || "",
        middle_name: m.middle_name || "",
        last_name: m.last_name || "",
        relationship: m.relationship || "",
      }));

    // 3. Clear "Others" detail if not checked
    const isOtherSelected = sectorOptions.find(
      (s) => s.name.toLowerCase().includes("other") && formData.sector_ids.includes(s.id)
    );
    if (!isOtherSelected) {
      payload.other_sector_details = "";
    }

    // 4. CRITICAL: Convert optional numbers/unique strings to NULL instead of "" 
    // This stops the Database Constraint Error for unique columns.
    const optionalFields = ["contact_no", "precinct_no", "emergency_contact_no"];
    optionalFields.forEach(field => {
       if (!payload[field] || String(payload[field]).trim() === "") {
           payload[field] = null;
       }
    });

    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = buildPayload();
      console.log("PAYLOAD BEING SENT:", payload); // <-- Check your browser console if it fails!

      // --- STRICT FRONTEND VALIDATION ---
      // This stops the form from submitting if required Database fields are broken/missing
      if (!payload.birthdate) {
          toast.error("Please enter a complete and valid Date of Birth (MM/DD/YYYY).");
          setLoading(false);
          return;
      }
      if (!payload.barangay_id) {
          toast.error("Barangay is required. Please ensure a Barangay is selected.");
          setLoading(false);
          return;
      }

      let response;

      if (residentToEdit) {
        response = await api.put(`/residents/${residentToEdit.id}`, payload);

        if (photoFile) {
          const form = new FormData();
          form.append("file", photoFile);
          await api.post(`/residents/${residentToEdit.id}/upload-photo`, form, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }

        toast.success("Resident Record Updated.");
        setTimeout(onSuccess, 1000);
      } else {
        response = await api.post("/residents/", payload);
        const newResident = response.data;

        if (photoFile && newResident?.id) {
          const form = new FormData();
          form.append("file", photoFile);
          await api.post(`/residents/${newResident.id}/upload-photo`, form, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }

        toast.success("New Resident Registered.");

        setTimeout(() => {
          setFormData(getInitialFormState());
          setPhotoFile(null);
          setPhotoPreview(null);
          setImageSrc(null);
          window.scrollTo({ top: 0, behavior: "smooth" });
          setLoading(false);
          onSuccess();
        }, 1000);
      }
    } catch (err) {
      console.error("FULL ERROR:", err);
      
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;

        if (Array.isArray(detail)) {
          const message = detail
            .map((item) => {
              const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : "field";
              return `${field}: ${item.msg}`;
            })
            .join(" | ");
          toast.error(message || "Validation failed.");
        } else if (typeof detail === "string") {
          // If the backend still throws a DB error, show it clearly
          toast.error(`Database Error: ${detail}`); 
        } else {
          toast.error("Validation failed.");
        }
      } else {
        toast.error("Registration failed. Please check your connection.");
      }

      setLoading(false);
    }
  };

  const isOtherSelected = sectorOptions.find(
    (s) => s.name.toLowerCase().includes("other") && formData.sector_ids.includes(s.id)
  );

  return (
    <div className="max-w-6xl mx-auto pb-32 animate-in fade-in duration-300 font-sans text-slate-800">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1e293b",
            color: "#fff",
            borderRadius: "12px",
            fontSize: "14px",
          },
        }}
      />

      <div className="mb-8 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-sm">
            {residentToEdit ? (
              <FileText size={24} strokeWidth={1.5} />
            ) : (
              <User size={24} strokeWidth={1.5} />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-medium text-slate-800 tracking-tight">
              {residentToEdit ? "Update Resident Profile" : "Resident Registration"}
            </h1>
            <p className="text-sm font-normal text-slate-400 mt-1">
              {residentToEdit
                ? "Modify existing resident data and records."
                : "Enter details to register a new resident into the system."}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="px-6 md:px-8 py-6">
            <SectionHeader icon={User} title="Personal Information" colorClass="text-blue-600" />

            <div className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <InputGroup
                  label="Last Name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  placeholder="DELA CRUZ"
                />
                <InputGroup
                  label="First Name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  placeholder="JUAN"
                />
                <InputGroup
                  label="Middle Name"
                  name="middle_name"
                  value={formData.middle_name}
                  onChange={handleChange}
                  placeholder="SANTOS"
                />
                <InputGroup
                  label="Suffix"
                  name="ext_name"
                  value={formData.ext_name}
                  onChange={handleChange}
                  placeholder="JR, SR, III"
                />
              </div>

              <div>
                <label className="text-[11px] font-normal text-slate-400 uppercase tracking-wider block mb-3">
                  Resident Photo
                </label>

                <div className="flex items-center gap-6">
                  <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center overflow-hidden flex-shrink-0">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Resident Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={32} className="text-slate-300" strokeWidth={1.5} />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-wrap gap-3">
                      <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-normal hover:bg-slate-200 transition-colors cursor-pointer">
                        <Upload size={16} />
                        Upload Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => openCamera()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-normal hover:bg-slate-800 transition-colors"
                      >
                        <Camera size={16} />
                        Take Photo
                      </button>
                    </div>

                    {photoPreview && (
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="mt-3 text-sm text-slate-500 hover:text-red-600 transition-colors"
                      >
                        Remove current photo
                      </button>
                    )}

                    <p className="text-xs text-slate-400 mt-2 font-normal">
                      Recommended: Square image, max 5MB.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <InputGroup
                  label="Date of Birth"
                  name="birthdate"
                  type="text"
                  value={formData.birthdate}
                  onChange={handleChange}
                  required
                  placeholder="MM/DD/YYYY"
                  maxLength={10}
                />
                <SelectGroup
                  label="Sex"
                  name="sex"
                  value={formData.sex}
                  onChange={handleChange}
                  options={["Male", "Female"]}
                  required
                  placeholder="Select Gender"
                />
                <SelectGroup
                  label="Civil Status"
                  name="civil_status"
                  value={formData.civil_status}
                  onChange={handleChange}
                  options={["Single", "Married", "Widowed", "Live-in Partner", "Separated"]}
                  required
                  placeholder="Select Status"
                />
                <InputGroup
                  label="Religion"
                  name="religion"
                  value={formData.religion}
                  onChange={handleChange}
                  placeholder="ROMAN CATHOLIC"
                />
              </div>

              {(formData.civil_status === "Married" ||
                formData.civil_status === "Live-in Partner") && (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-2 mb-5 text-slate-400">
                    <Heart size={16} className="text-red-400" strokeWidth={2} />
                    <span className="text-[11px] font-normal uppercase tracking-wider">
                      Spouse / Partner Details
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <InputGroup
                      label="Spouse Last Name"
                      name="spouse_last_name"
                      value={formData.spouse_last_name}
                      onChange={handleChange}
                    />
                    <InputGroup
                      label="Spouse First Name"
                      name="spouse_first_name"
                      value={formData.spouse_first_name}
                      onChange={handleChange}
                    />
                    <InputGroup
                      label="Spouse Middle Name"
                      name="spouse_middle_name"
                      value={formData.spouse_middle_name}
                      onChange={handleChange}
                    />
                    <InputGroup
                      label="Suffix"
                      name="spouse_ext_name"
                      value={formData.spouse_ext_name}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 border-t border-slate-100 pt-6">
                <InputGroup
                  label="Occupation / Profession"
                  name="occupation"
                  value={formData.occupation}
                  onChange={handleChange}
                  placeholder="E.G. FARMER, EMPLOYEE"
                />
                <InputGroup
                  label="Mobile Number"
                  name="contact_no"
                  value={formData.contact_no}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setFormData((prev) => ({ ...prev, contact_no: val }));
                  }}
                  placeholder="09XXXXXXXXX"
                />
                <InputGroup
                  label="Precinct / Voter ID"
                  name="precinct_no"
                  value={formData.precinct_no}
                  onChange={handleChange}
                  placeholder="OPTIONAL"
                />
              </div>

              <div className="border-t border-slate-100 pt-6">
                <div className="flex items-center gap-2 mb-5 text-slate-400">
                  <Phone size={16} className="text-red-400" strokeWidth={2} />
                  <span className="text-[11px] font-normal uppercase tracking-wider">
                    Emergency Contact Information
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <InputGroup
                    label="Emergency Contact Name"
                    name="emergency_name"
                    value={formData.emergency_name}
                    onChange={handleChange}
                    placeholder="FULL NAME"
                  />

                  <InputGroup
                    label="Emergency Contact Number"
                    name="emergency_contact_no"
                    value={formData.emergency_contact_no}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setFormData((prev) => ({ ...prev, emergency_contact_no: val }));
                    }}
                    placeholder="09XXXXXXXXX"
                  />

                  <InputGroup
                    label="Emergency Address"
                    name="emergency_address"
                    value={formData.emergency_address}
                    onChange={handleChange}
                    placeholder="BARANGAY / STREET / PUROK"
                    className="sm:col-span-2 lg:col-span-1"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="px-6 md:px-8 py-6">
            <SectionHeader icon={MapPin} title="Residency & Location" colorClass="text-emerald-600" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <InputGroup
                label="House No. / Street"
                name="house_no"
                value={formData.house_no}
                onChange={handleChange}
                placeholder="House No. / Street Name"
              />

              <SelectGroup
                label="Barangay"
                name="barangay_id"
                value={formData.barangay_id}
                onChange={handleChange}
                options={barangayOptions}
                required={isAdminLike}
                disabled={!isAdminLike}
                placeholder={isAdminLike ? "Select Barangay" : "Auto-Assigned"}
              />

              <SelectGroup
                label="Purok / Sitio"
                name="purok"
                value={formData.purok}
                onChange={handleChange}
                options={purokOptions}
                required
                placeholder="Select Purok or Sitio"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="px-6 md:px-8 py-6">
            <SectionHeader
              icon={Briefcase}
              title="Sectoral Classification"
              colorClass="text-purple-600"
            />

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...sectorOptions]
                .sort((a, b) => {
                  const aIsOther = a.name.toLowerCase().includes("other");
                  const bIsOther = b.name.toLowerCase().includes("other");
                  if (aIsOther && !bIsOther) return 1;
                  if (!aIsOther && bIsOther) return -1;
                  return 0;
                })
                .map((s) => (
                  <label
                    key={s.id}
                    className={`
                      flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all h-28 text-center select-none
                      ${
                        formData.sector_ids.includes(s.id)
                          ? "bg-slate-900 border-slate-900 text-white shadow-md transform scale-[1.02]"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={formData.sector_ids.includes(s.id)}
                      onChange={() => handleSectorToggle(s.id)}
                    />

                    {formData.sector_ids.includes(s.id) ? (
                      <Check size={24} className="text-white" strokeWidth={2} />
                    ) : (
                      <div className="w-5 h-5 rounded-md border-2 border-slate-200"></div>
                    )}

                    <span className="text-xs font-normal uppercase tracking-wide leading-tight">
                      {s.name}
                    </span>
                  </label>
                ))}
            </div>

            {isOtherSelected && (
              <div className="mt-6 animate-in slide-in-from-top-4 duration-300">
                <InputGroup
                  label="Please Specify Other Sector"
                  name="other_sector_details"
                  value={formData.other_sector_details}
                  onChange={handleChange}
                  placeholder="Enter Details"
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="px-6 md:px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex-1">
                <SectionHeader
                  icon={Fingerprint}
                  title="Household Members"
                  colorClass="text-amber-600"
                />
              </div>

              <button
                type="button"
                onClick={addFamilyMember}
                className="flex items-center justify-center gap-2 text-xs font-normal uppercase tracking-wider bg-slate-100 text-slate-600 px-5 py-2.5 rounded-xl hover:bg-slate-200 transition-colors shadow-sm -mt-8 sm:mt-0"
              >
                <Plus size={16} strokeWidth={2} /> Add Member
              </button>
            </div>

            <div className="space-y-4">
              {formData.family_members.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <Users size={32} className="mx-auto text-slate-300 mb-3" strokeWidth={1.5} />
                  <p className="text-sm font-normal text-slate-400">
                    No additional household members listed.
                  </p>
                </div>
              )}

              {formData.family_members.map((member, index) => (
                <div
                  key={index}
                  className="flex flex-col md:flex-row gap-4 p-5 bg-slate-50 border border-slate-200 rounded-2xl relative items-end animate-in fade-in duration-300"
                >
                  <div className="flex-1 w-full">
                    <InputGroup
                      label="First Name"
                      value={member.first_name}
                      onChange={(e) => handleFamilyChange(index, "first_name", e.target.value)}
                      placeholder="Given Name"
                    />
                  </div>

                  <div className="flex-1 w-full">
                    <InputGroup
                      label="Middle Name"
                      value={member.middle_name}
                      onChange={(e) => handleFamilyChange(index, "middle_name", e.target.value)}
                      placeholder="Middle Name"
                    />
                  </div>

                  <div className="flex-1 w-full">
                    <InputGroup
                      label="Last Name"
                      value={member.last_name}
                      onChange={(e) => handleFamilyChange(index, "last_name", e.target.value)}
                      placeholder="Surname"
                    />
                  </div>

                  <div className="flex-1 w-full">
                    <SelectGroup
                      label="Relationship"
                      value={member.relationship}
                      onChange={(e) => handleFamilyChange(index, "relationship", e.target.value)}
                      options={relationshipOptions}
                      placeholder="Select Relation"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFamilyMember(index)}
                    className="p-3 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 rounded-xl transition-colors shrink-0"
                    title="Remove Member"
                  >
                    <Trash2 size={18} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 lg:left-[280px] right-0 p-5 bg-white/90 backdrop-blur-md border-t border-slate-200 flex items-center justify-between z-40 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.05)]">
          <div className="hidden md:flex items-center gap-2.5 text-sm text-slate-400 font-normal px-4">
            <AlertCircle size={18} className="text-blue-400" strokeWidth={2} />
            <span>Please verify all data before saving to the registry.</span>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 md:flex-none px-6 py-3 text-sm font-normal text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex-1 md:flex-none px-8 py-3 bg-red-600 text-white rounded-xl text-sm font-normal shadow-sm hover:bg-red-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} strokeWidth={2} />
              )}
              {loading ? "Processing..." : residentToEdit ? "Update Record" : "Save Registry"}
            </button>
          </div>
        </div>
      </form>

      {cameraOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[99998] p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-slate-800">Take Photo</h3>
              
              {/* NEW: Switch Camera Button */}
              <button
                type="button"
                onClick={toggleCamera}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 text-sm font-medium transition-colors"
              >
                <Camera size={16} /> Switch Camera
              </button>
            </div>

            <div className="rounded-xl overflow-hidden bg-black relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className={`w-full h-[360px] object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeCamera}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
              >
                Capture
              </button>
            </div>
          </div>
        </div>
      )}

      {cropModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-slate-800">Crop Photo</h3>
              <button
                type="button"
                onClick={() => setCropModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
              >
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
              <label className="text-[11px] font-normal text-slate-400 uppercase tracking-wider">
                Zoom Adjust
              </label>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full mt-2 accent-red-600"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCropModalOpen(false)}
                className="px-5 py-2.5 text-sm font-normal text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCropSave}
                className="px-5 py-2.5 bg-slate-900 text-white text-sm font-normal rounded-xl hover:bg-slate-800 transition-colors"
              >
                Apply Crop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}