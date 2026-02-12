import { useState, useRef } from 'react';
import { Upload, Loader2, FileSpreadsheet } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

export default function ImportButton({ onSuccess }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Create Form Data
    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    const loadingToast = toast.loading("Importing records...");

    try {
      // Send to Backend
      const response = await api.post('/import/excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { added, errors } = response.data;

      // Show Result
      toast.dismiss(loadingToast);
      if (errors && errors.length > 0) {
        toast.error(`Imported ${added} residents. ${errors.length} rows failed.`);
        console.error("Import Errors:", errors);
      } else {
        toast.success(`Successfully imported ${added} residents!`);
      }

      if (onSuccess) onSuccess(); // Refresh list
      
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error.response?.data?.detail || "Import failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
    }
  };

  return (
    <>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".xlsx, .csv" 
        className="hidden" 
      />
      
      <button 
        onClick={() => fileInputRef.current.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-colors disabled:opacity-50"
      >
        {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
        {uploading ? "Uploading..." : "Import Excel"}
      </button>
    </>
  );
}