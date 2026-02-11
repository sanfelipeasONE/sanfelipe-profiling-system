import axios from 'axios';
import { useState } from 'react';

export default function ExportButton({ barangay }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // 1. Request the file from Backend
      const response = await axios.get('https://sanfelipe-profiling-system-production.up.railway.app/export/excel', {
        params: { barangay: barangay },
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: 'blob',
      });

      // 2. Create a "Hidden Link"
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // 3. Set the Filename
      const filename = barangay 
        ? `SanFelipe_MasterList_${barangay}.xlsx` 
        : `SanFelipe_MasterList_ALL.xlsx`;
        
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to download report. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isLoading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        isLoading 
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
          : 'bg-green-600 hover:bg-green-700 text-white'
      }`}
    >
      {/* Excel Icon (SVG) */}
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
      
      {isLoading ? 'Generating...' : 'Export to Excel'}
    </button>
  );
}