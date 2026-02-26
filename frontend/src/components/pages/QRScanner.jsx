import { useState } from "react";
import api from "../../api/api";

export default function QRScanner() {
  const [input, setInput] = useState("");
  const [resident, setResident] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleScan = async (value) => {
    if (!value) return;

    setLoading(true);

    try {
      const response = await api.get(`/residents/code/${value}`);
      setResident(response.data);
    } catch (err) {
      console.error("Resident not found");
      setResident(null);
    } finally {
      setLoading(false);
      setInput("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* HEADER */}
        <div className="text-center mb-10">
          <img
            src="/san_felipe_seal.png"
            alt="Municipality Seal"
            className="w-20 h-20 mx-auto mb-3 object-contain"
          />
          <h1 className="text-2xl font-black uppercase tracking-widest text-gray-900">
            Resident Identification Scanner
          </h1>
          <p className="text-xs font-bold text-red-800 uppercase tracking-widest mt-2">
            Authorized Personnel Only
          </p>
        </div>

        {/* INPUT */}
        <div className="bg-white border-2 border-red-300 p-6 mb-6">
          <label className="block text-xs font-bold uppercase text-red-800 mb-2 tracking-widest">
            Scan QR Code / Enter Registry ID
          </label>

          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleScan(input);
                }
              }}
              placeholder="AWAITING INPUT..."
              className="flex-1 border-2 border-red-300 p-3 text-sm font-bold uppercase tracking-widest focus:outline-none focus:border-red-800"
            />
            <button
              onClick={() => handleScan(input)}
              className="bg-red-800 text-white px-5 text-xs font-black uppercase tracking-widest hover:bg-red-900"
            >
              Search
            </button>
          </div>
        </div>

        {loading && (
          <div className="text-center text-red-800 font-bold uppercase text-sm py-6">
            Retrieving Record...
          </div>
        )}

        {/* RESULT */}
        {resident && !loading && (
          <div className="bg-white border-2 border-red-800 shadow-md">

            {/* HEADER */}
            <div className="bg-red-800 text-white px-6 py-4">
              <h2 className="text-xl font-black uppercase tracking-widest">
                {resident.last_name}, {resident.first_name}
              </h2>
              <p className="text-xs uppercase tracking-widest mt-1 opacity-80">
                {resident.barangay} – Purok {resident.purok}
              </p>
            </div>

            <div className="p-6 space-y-8">

              {/* MAIN INFO + PHOTO */}
              <div className="flex flex-col md:flex-row gap-8">

                <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-4">

                  <Field label="Birthdate" value={resident.birthdate} />
                  <Field label="Civil Status" value={resident.civil_status} />
                  <Field label="Religion" value={resident.religion} />
                  <Field label="Occupation" value={resident.occupation} />
                  <Field label="Contact No." value={resident.contact_no} />
                  <Field label="Precinct No." value={resident.precinct_no} />

                  <div className="col-span-2">
                    <Field label="Designated Sector" value={resident.sector_summary} />
                  </div>

                </div>

                {/* PHOTO */}
                <div className="flex justify-center md:justify-end flex-shrink-0">
                  {resident.photo_url ? (
                    <img
                      src={resident.photo_url}
                      alt="Resident"
                      className="w-40 h-40 object-cover border-4 border-red-800 shadow-md bg-white"
                    />
                  ) : (
                    <div className="w-40 h-40 border-4 border-gray-300 flex items-center justify-center text-xs font-bold text-gray-400 uppercase">
                      No Photo
                    </div>
                  )}
                </div>

              </div>

              {/* SPOUSE SECTION */}
              {(resident.spouse_first_name || resident.spouse_last_name) && (
                <div>
                  <h3 className="text-sm font-black uppercase text-red-800 mb-3 border-b border-red-200 pb-2">
                    Spouse / Partner Information
                  </h3>
                  <p className="text-sm font-bold">
                    {resident.spouse_last_name}, {resident.spouse_first_name}{" "}
                    {resident.spouse_middle_name || ""}
                  </p>
                </div>
              )}

              {/* FAMILY MEMBERS */}
              {resident.family_members && resident.family_members.length > 0 && (
                <div>
                  <h3 className="text-sm font-black uppercase text-red-800 mb-3 border-b border-red-200 pb-2">
                    Family Members
                  </h3>

                  <div className="grid md:grid-cols-2 gap-4">
                    {resident.family_members.map((member, index) => (
                      <div
                        key={index}
                        className="border border-gray-300 p-3 text-sm"
                      >
                        <p className="font-bold">
                          {member.last_name}, {member.first_name}
                        </p>
                        <p className="text-xs text-gray-600 uppercase">
                          {member.relationship}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

          </div>
        )}
      </div>
    </div>
  );
}

/* Small reusable display component */
function Field({ label, value }) {
  return (
    <div>
      <span className="block text-[10px] font-bold uppercase text-red-800 mb-0.5">
        {label}
      </span>
      <p className="text-sm font-bold">{value || "N/A"}</p>
    </div>
  );
}