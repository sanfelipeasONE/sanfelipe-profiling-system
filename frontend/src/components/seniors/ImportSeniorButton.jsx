import { useState, useRef } from 'react';
import { FileUp, Loader2, UploadCloud, X } from 'lucide-react';
import api from '../../api/api';
import toast from 'react-hot-toast';

export default function ImportSeniorButton({ onSuccess, className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post('/osca/seniors/import', formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      const { success_count, error_count } = response.data;
      toast.success(`Import Complete! Added: ${success_count} | Skipped/Duplicates: ${error_count}`);
      setIsOpen(false);
      setFile(null);
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to upload file.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 px-4 py-2 bg-white border border-stone-300 text-stone-700 font-medium hover:bg-stone-100 rounded-xl shadow-sm transition-all text-sm ${className}`}
      >
        <FileUp size={16} /> Import Excel / CSV
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
              <h3 className="font-medium text-stone-800 flex items-center gap-2">
                <UploadCloud size={18} className="text-red-600" /> Upload OSCA Data
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-stone-400 hover:text-stone-700 p-1">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-stone-500 mb-6 leading-relaxed">
                Upload your Excel (.xlsx) or .csv file. The system will automatically detect the header rows, format names, and extract the gender from the headers.
              </p>

              <div className="border-2 border-dashed border-stone-200 rounded-xl p-6 text-center hover:bg-stone-50 transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                />
                <FileUp size={32} className="mx-auto text-stone-300 mb-3" />
                {file ? (
                  <p className="text-sm font-medium text-red-600">{file.name}</p>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-stone-700">Click or drag file here</p>
                    <p className="text-xs text-stone-400 mt-1">Supports .xlsx and .csv</p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setIsOpen(false)} className="px-4 py-2 border border-stone-200 text-stone-600 rounded-lg text-sm font-medium hover:bg-stone-50">
                  Cancel
                </button>
                <button 
                  onClick={handleUpload} 
                  disabled={!file || isUploading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {isUploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                  {isUploading ? "Processing Data..." : "Upload File"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}