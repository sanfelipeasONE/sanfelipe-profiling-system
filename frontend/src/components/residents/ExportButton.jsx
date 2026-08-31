import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

// Update this URL to match your production backend
const API_URL = "https://sanfelipe-profiling-system-production-13e4.up.railway.app";

export default function ExportButton({ barangay, sectors = [], status, className = "" }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);

    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    if (!token) {
        toast.error("Please log in again.");
        setLoading(false);
        return;
    }

    try {
      // 1. Build the query parameters based on current filters
      const params = new URLSearchParams();
      
      if (barangay && barangay !== "All Barangays") {
        params.append('barangay', barangay);
      }
      
      sectors.forEach((sector) => params.append('sectors', sector));
      
      if (status && status !== 'ALL') {
        params.append('filter_status', status.toLowerCase());
      }

      // 2. Fetch the file from the updated backend endpoint
      const response = await fetch(`${API_URL}/export/excel?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // 3. Handle potential errors
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Export failed.");
      }

      if (!response.ok) throw new Error("Server error occurred during export.");

      // 4. Extract filename from headers or generate a fallback
      const disposition = response.headers.get('Content-Disposition');
      let filename = "SanFelipe_Residents.xlsx"; 

      if (disposition && disposition.includes('filename=')) {
        filename = disposition.split('filename=')[1].replace(/["']/g, "").trim();
      } else {
        const statusPart = status && status !== 'ALL' ? `${status}_` : "";
        const sectorPart = sectors.length ? `${sectors.join('_').replace(/\s+/g, '_')}_` : "";
        const brgyPart = barangay ? barangay.replace(/\s+/g, '_') : 'All';
        filename = `SanFelipe_${statusPart}${sectorPart}${brgyPart}.xlsx`;
      }

      // 5. Trigger the download
      const blob = await response.blob(); 
      if (!blob || blob.size === 0) {
          throw new Error("The exported file is empty.");
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`Exported: ${filename}`);

    } catch (error) {
      console.error("Export Error:", error);
      toast.error(error.message || "Failed to download the excel file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleExport} 
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors disabled:opacity-50 shadow-sm shadow-rose-200 ${className}`}
    >
      {loading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
      {loading ? "Generating Excel..." : "Export to Excel"}
    </button>
  );
}
