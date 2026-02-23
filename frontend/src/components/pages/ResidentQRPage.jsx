import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/api";

export default function ResidentQRPage() {
  const { code } = useParams();
  const navigate = useNavigate();

  const [resident, setResident] = useState(null);
  const [qrImage, setQrImage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;

    const fetchData = async () => {
      try {
        // 1️⃣ Fetch resident info
        const response = await api.get(`/residents/code/${code}`);
        setResident(response.data);

        // 2️⃣ Fetch QR as blob (IMPORTANT)
        const qrResponse = await api.get(
          `/residents/code/${code}/qr`,
          { responseType: "blob" }
        );

        const imageUrl = URL.createObjectURL(qrResponse.data);
        setQrImage(imageUrl);

      } catch (err) {
        console.error("Failed to fetch QR");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [code]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <span className="w-4 h-4 mb-4 bg-red-800 rounded-sm animate-pulse"></span>
        <p className="text-red-900 font-bold uppercase tracking-widest text-sm">
          Retrieving Record...
        </p>
      </div>
    );
  }

  if (!resident) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
        <div className="bg-red-50 border-2 border-red-800 p-8 text-center max-w-md">
          <h2 className="text-xl font-bold text-red-900 uppercase tracking-widest mb-2">Record Not Found</h2>
          <p className="text-xs text-red-800 uppercase mb-6 font-bold">The requested registry ID is invalid or unauthorized.</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-gray-900 text-white text-xs font-bold uppercase tracking-wider border-2 border-gray-900 hover:bg-gray-800"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6 font-sans">

      {/* Official ID Card Container */}
      <div className="qr-print-area bg-white border-4 border-red-800 max-w-sm w-full shadow-md">
        
        {/* Card Header */}
        <div className="bg-red-800 text-white text-center py-4 border-b-4 border-red-900">
          <h1 className="text-sm font-black uppercase tracking-widest">
            Municipality of San Felipe
          </h1>
          <p className="text-[10px] font-bold tracking-widest text-red-200 uppercase mt-1">
            Official Resident Registry
          </p>
        </div>

        {/* Card Body */}
        <div className="p-6 text-center">
          <h2 className="text-2xl font-black uppercase text-gray-900 leading-tight">
            {resident.last_name}, {resident.first_name} <br/>
            <span className="text-lg">{resident.middle_name || ""}</span>
          </h2>
          
          <div className="mt-3 border-t-2 border-gray-200 pt-3 inline-block">
            <span className="block text-[10px] font-bold text-red-800 uppercase tracking-wider mb-1">Registered Address</span>
            <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">
              {resident.barangay} – Purok {resident.purok}
            </p>
          </div>

          {/* QR Code Display */}
          <div className="my-6 p-3 border-2 border-red-200 bg-red-50 inline-block">
            {qrImage ? (
              <img
                src={qrImage}
                alt="QR Code"
                className="w-48 h-48 mx-auto mix-blend-multiply"
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center bg-gray-200 text-xs font-bold text-gray-500 uppercase">
                Loading Image...
              </div>
            )}
          </div>

          {/* Registry ID */}
          <div className="mt-2">
            <span className="block text-[10px] font-bold text-red-800 uppercase tracking-widest mb-1">Registry ID Number</span>
            <p className="text-sm font-mono font-bold tracking-widest text-gray-900 bg-gray-100 py-1.5 px-4 border border-gray-300 inline-block">
              {resident.resident_code}
            </p>
          </div>

        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex gap-4 no-print">
        <button
          onClick={() => window.print()}
          className="px-6 py-3 bg-red-800 text-white text-xs font-bold uppercase tracking-widest border-2 border-red-900 hover:bg-red-900 transition-colors"
        >
          Print ID Card
        </button>

        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-white text-gray-900 text-xs font-bold uppercase tracking-widest border-2 border-gray-900 hover:bg-gray-50 transition-colors"
        >
          Go Back
        </button>
      </div>

    </div>
  );
}