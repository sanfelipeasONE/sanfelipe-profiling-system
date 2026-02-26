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
        const response = await api.get(`/residents/code/${code}`);
        setResident(response.data);

        const qrResponse = await api.get(
          `/residents/code/${code}/qr`,
          { responseType: "blob" }
        );
        const imageUrl = URL.createObjectURL(qrResponse.data);
        setQrImage(imageUrl);
      } catch (err) {
        console.error("Failed to fetch QR");
        setResident(null);
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
          <h2 className="text-xl font-bold text-red-900 uppercase tracking-widest mb-2">
            Record Not Found
          </h2>
          <p className="text-xs text-red-800 uppercase mb-6 font-bold">
            The requested registry ID is invalid or unauthorized.
          </p>
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

  const CardHeaderFront = () => (
    <div className="bg-red-800 text-white py-3 px-4 flex items-center justify-center gap-3">
      <img
        src="/san_felipe_seal.png"
        alt="San Felipe Seal"
        className="w-10 h-10 object-contain rounded-full flex-shrink-0"
      />
      <div className="text-left">
        <h1 className="text-xs font-black uppercase tracking-widest leading-tight">
          Municipality of San Felipe
        </h1>
        <p className="text-[9px] font-bold tracking-widest text-red-200 uppercase mt-0.5">
          Province of Zambales · Official Resident Registry
        </p>
      </div>
    </div>
  );

  const CardHeaderBack = () => (
    <div className="bg-red-800 text-white py-3 px-4 flex items-center justify-center">
      <img
        src="/san_felipe_seal.png"
        alt="San Felipe Seal"
        className="w-10 h-10 object-contain rounded-full"
      />
    </div>
  );

  const CardFooter = ({ label }) => (
    <div className="bg-red-800 text-center py-1.5">
      <p className="text-[9px] font-bold text-red-200 uppercase tracking-widest">{label}</p>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6 font-sans">

      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-5">
        Resident ID Card — Print Both Sides
      </p>

      {/* BOTH CARDS */}
      <div className="flex flex-col md:flex-row gap-8 items-start justify-center w-full qr-print-area">

        {/* ── FRONT SIDE ── */}
        <div className="bg-white border-4 border-red-800 w-80 shadow-md flex flex-col">
          <CardHeaderFront />

          <div className="px-5 pt-5 pb-4 text-center flex-1 flex flex-col items-center">

            {/* PHOTO */}
            <div className="mb-4">
              {resident.photo_url ? (
                <img
                  src={resident.photo_url}
                  alt="Resident"
                  className="w-36 h-36 object-cover border-4 border-red-800 shadow-md bg-white"
                />
              ) : (
                <div className="w-36 h-36 border-4 border-gray-300 flex items-center justify-center text-xs font-bold text-gray-400 uppercase">
                  No Photo
                </div>
              )}
            </div>

            {/* NAME */}
            <h2 className="text-lg font-black uppercase text-gray-900 leading-snug">
              {resident.last_name}, {resident.first_name}
              {resident.middle_name && (
                <>
                  <br />
                  <span className="text-sm font-bold">{resident.middle_name}</span>
                </>
              )}
            </h2>

            {/* DETAILS */}
            <div className="w-full border-t-2 border-gray-200 mt-3 pt-3 space-y-2 text-left">
              <div>
                <span className="block text-[9px] font-bold text-red-800 uppercase tracking-wider">Registered Address</span>
                <p className="text-xs font-bold text-gray-900 uppercase">
                  {resident.barangay} – Purok {resident.purok}
                </p>
              </div>

              {resident.birthdate && (
                <div>
                  <span className="block text-[9px] font-bold text-red-800 uppercase tracking-wider">Date of Birth</span>
                  <p className="text-xs font-bold text-gray-900">{resident.birthdate}</p>
                </div>
              )}

              {resident.sector_summary && (
                <div>
                  <span className="block text-[9px] font-bold text-red-800 uppercase tracking-wider">Sector</span>
                  <p className="text-xs font-bold text-gray-900">{resident.sector_summary}</p>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* ── BACK SIDE ── */}
        <div className="bg-white border-4 border-red-800 w-80 shadow-md flex flex-col">
          <CardHeaderBack />

          <div className="px-5 pt-5 pb-4 text-center flex-1 flex flex-col items-center justify-center gap-4">

            {/* QR CODE */}
            <div>
              <span className="block text-[9px] font-bold text-red-800 uppercase tracking-widest mb-2">
                Scan to Verify Identity
              </span>
              <div className="p-3 border-2 border-red-200 bg-red-50 inline-block">
                {qrImage ? (
                  <img
                    src={qrImage}
                    alt="QR Code"
                    className="w-44 h-44 mx-auto mix-blend-multiply"
                  />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center bg-gray-200 text-xs font-bold text-gray-500 uppercase">
                    Loading...
                  </div>
                )}
              </div>
            </div>

            {/* REGISTRY ID */}
            <div>
              <span className="block text-[9px] font-bold text-red-800 uppercase tracking-widest mb-1">
                Registry ID Number
              </span>
              <p className="text-sm font-mono font-bold tracking-widest text-gray-900 bg-gray-100 py-1.5 px-4 border border-gray-300 inline-block">
                {resident.resident_code}
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* ACTION BUTTONS */}
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