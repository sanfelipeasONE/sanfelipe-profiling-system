import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/api';
import { ArrowLeft, Printer, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SeniorIdCard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [senior, setSenior] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSenior = async () => {
      try {
        const res = await api.get(`/osca/seniors/${id}`);
        setSenior(res.data);
      } catch (err) {
        toast.error("Could not load ID Card details.");
      } finally {
        setLoading(false);
      }
    };
    fetchSenior();
  }, [id]);

  const handlePrint = () => window.print();

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <Loader2 className="animate-spin text-red-600 w-10 h-10" />
      </div>
    );
  }

  if (!senior) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 flex-col gap-4">
        <AlertCircle className="text-red-500 w-12 h-12" />
        <p className="text-stone-600 font-medium">Record not found.</p>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-stone-200 rounded-lg text-sm">Go Back</button>
      </div>
    );
  }

  const fullName = `${senior.last_name}, ${senior.first_name}${senior.middle_name ? ' ' + senior.middle_name : ''}${senior.ext_name ? ' ' + senior.ext_name : ''}`.trim();
  const address = `${senior.purok ? senior.purok + ', ' : ''}${senior.barangay}, San Felipe, Zambales`;

  // Crosshatch / diagonal pattern for card background
  const bgPattern = `repeating-linear-gradient(
    45deg,
    transparent,
    transparent 3px,
    rgba(0,0,0,0.03) 3px,
    rgba(0,0,0,0.03) 4px
  )`;

  return (
    <div className="min-h-screen bg-stone-100 p-4 md:p-8 font-sans">
      {/* TOOLBAR */}
      <div className="max-w-5xl mx-auto flex justify-between items-center mb-8 print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-300 text-stone-700 rounded-xl hover:bg-stone-50 transition-colors shadow-sm text-sm font-medium"
        >
          <ArrowLeft size={16} /> Back to List
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-700 text-white rounded-xl hover:bg-red-800 transition-colors shadow-md text-sm font-medium"
        >
          <Printer size={16} /> Print ID Card
        </button>
      </div>

      {/* CARDS WRAPPER */}
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-10 print:gap-6">

        {/* ===================== FRONT OF ID ===================== */}
        <div
          style={{
            width: '3.375in',
            minHeight: '2.125in',
            fontFamily: 'Arial, sans-serif',
            position: 'relative',
            overflow: 'visible',
            background: '#fff',
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            borderLeft: '4px solid #b91c1c',
            borderRight: '4px solid #b91c1c',
            display: 'flex',
            flexDirection: 'column',
          }}
          className="print:shadow-none"
        >
          {/* === HEADER SECTION === */}
          <div style={{
            background: '#f5f5f5',
            backgroundImage: bgPattern,
            borderBottom: '2px solid #b91c1c',
            padding: '6px 8px 4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            position: 'relative',
            minHeight: '52px',
          }}>
            {/* Red diagonal accent bars — top right */}
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '90px',
              height: '100%',
              overflow: 'hidden',
              pointerEvents: 'none',
            }}>
              {/* Diagonal red stripes */}
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '-10px',
                width: '100px',
                height: '80px',
                background: 'linear-gradient(135deg, transparent 38%, #b91c1c 38%, #b91c1c 52%, #7f1d1d 52%, #7f1d1d 66%, #b91c1c 66%, #b91c1c 80%, transparent 80%)',
              }} />
            </div>

            {/* Municipality Seal */}
            <img
              src="/favicon_no_white_v2.png"
              alt="Seal"
              style={{ width: '44px', height: '44px', objectFit: 'contain', flexShrink: 0, zIndex: 1 }}
            />

            {/* Header Text */}
            <div style={{ zIndex: 1, lineHeight: 1.15 }}>
              <div style={{ fontSize: '7px', fontWeight: 'bold', color: '#111', letterSpacing: '0.02em' }}>
                REPUBLIC OF THE PHILIPPINES
              </div>
              <div style={{ fontSize: '6.5px', fontWeight: '600', color: '#222' }}>
                PROVINCE OF ZAMBALES
              </div>
              <div style={{ fontSize: '9.5px', fontWeight: '900', color: '#b91c1c', letterSpacing: '0.01em' }}>
                MUNICIPALITY OF SAN FELIPE
              </div>
              <div style={{ fontSize: '6px', fontWeight: '600', color: '#222' }}>
                Office of the Senior Citizens Affairs (OSCA)
              </div>
            </div>
          </div>

          {/* === RED ACCENT BAR BELOW HEADER === */}
          <div style={{ height: '5px', background: 'linear-gradient(90deg, #b91c1c 80%, #7f1d1d 100%)' }} />

          {/* === BODY === */}
          <div style={{
            flex: 1,
            display: 'flex',
            padding: '8px 10px 0 8px',
            gap: '10px',
            backgroundImage: bgPattern,
            background: '#fff',
          }}>
            {/* Left: Photo + Control No */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '72px', flexShrink: 0 }}>
              <div style={{
                width: '68px',
                height: '68px',
                border: '1.5px solid #555',
                background: '#f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {senior.photo_url ? (
                  <img src={senior.photo_url} alt="Senior" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : null}
              </div>
              {/* Control No */}
              <div style={{ marginTop: '6px', textAlign: 'center', width: '100%' }}>
                <div style={{
                  borderBottom: '1px solid #333',
                  fontSize: '7px',
                  fontWeight: 'bold',
                  color: '#111',
                  paddingBottom: '1px',
                  minWidth: '60px',
                  textAlign: 'center',
                }}>
                  {senior.osca_control_no || '\u00a0'}
                </div>
                <div style={{ fontSize: '5.5px', textAlign: 'center', color: '#444', marginTop: '1px', fontWeight: '600' }}>
                  CONTROL NO.
                </div>
              </div>
            </div>

            {/* Right: Fields */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '2px' }}>
              {/* NAME */}
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{ fontSize: '6.5px', fontWeight: '700', color: '#111', flexShrink: 0 }}>NAME:</span>
                  <div style={{
                    flex: 1,
                    borderBottom: '1.5px solid #111',
                    fontSize: '7px',
                    fontWeight: '700',
                    color: '#111',
                    paddingBottom: '1px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {fullName}
                  </div>
                </div>
              </div>

              {/* ADDRESS */}
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{ fontSize: '6.5px', fontWeight: '700', color: '#111', flexShrink: 0 }}>ADDRESS:</span>
                  <div style={{
                    flex: 1,
                    borderBottom: '1.5px solid #111',
                    fontSize: '7px',
                    fontWeight: '700',
                    color: '#111',
                    paddingBottom: '1px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {address}
                  </div>
                </div>
              </div>

              {/* DATE OF BIRTH + DATE ISSUED */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '6px', fontWeight: '700', color: '#111', flexShrink: 0 }}>DATE OF BIRTH:</span>
                    <div style={{
                      flex: 1,
                      borderBottom: '1.5px solid #111',
                      fontSize: '7px',
                      fontWeight: '700',
                      color: '#111',
                      paddingBottom: '1px',
                    }}>
                      {formatDate(senior.birthdate)}
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ fontSize: '6px', fontWeight: '700', color: '#111', flexShrink: 0 }}>DATE ISSUED:</span>
                    <div style={{
                      flex: 1,
                      borderBottom: '1.5px solid #111',
                      fontSize: '7px',
                      fontWeight: '700',
                      color: '#111',
                      paddingBottom: '1px',
                    }}>
                      {formatDate(senior.date_issued)}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* === SIGNATURE / THUMBMARK — centered in right column === */}
          <div style={{ display: 'flex', padding: '4px 10px 3px 8px', gap: '10px' }}>
            {/* Spacer matching left photo column */}
            <div style={{ width: '72px', flexShrink: 0 }} />
            {/* Centered within right column */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', width: '60%' }}>
                <div style={{ borderBottom: '1.5px solid #111', marginBottom: '2px', height: '14px' }} />
                <div style={{ fontSize: '5.5px', fontWeight: '600', color: '#333', letterSpacing: '0.03em' }}>
                  SIGNATURE / THUMBMARK
                </div>
              </div>
            </div>
          </div>

          {/* === RED BOTTOM BAR === */}
          <div style={{
            background: '#b91c1c',
            padding: '3px 8px',
            marginTop: '6px',
          }}>
            <div style={{
              color: '#fff',
              fontSize: '6px',
              fontWeight: '900',
              fontStyle: 'italic',
              textAlign: 'center',
              letterSpacing: '0.04em',
            }}>
              THIS CARD IS NON-TRANSFERABLE AND VALID ANYWHERE IN THE COUNTRY
            </div>
          </div>
        </div>


        {/* ===================== BACK OF ID ===================== */}
        <div
          style={{
            width: '3.375in',
            height: '2.125in',
            fontFamily: 'Arial, sans-serif',
            position: 'relative',
            overflow: 'hidden',
            background: '#f5f5f5',
            backgroundImage: bgPattern,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            borderLeft: '4px solid #b91c1c',
            borderRight: '4px solid #b91c1c',
            display: 'flex',
            flexDirection: 'column',
          }}
          className="print:shadow-none"
        >
          {/* Top red accent bar */}
          <div style={{ height: '5px', background: 'linear-gradient(90deg, #b91c1c 80%, #7f1d1d 100%)' }} />

          {/* Body */}
          <div style={{ flex: 1, display: 'flex', padding: '8px 10px', gap: '10px' }}>

            {/* Left: Empty photo box (for thumbmark/photo on back) */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '58px',
                height: '58px',
                border: '1.5px solid #555',
                background: '#fff',
              }} />
            </div>

            {/* Right: Benefits */}
            <div style={{ flex: 1, fontSize: '6px', color: '#111', lineHeight: '1.45' }}>
              <div style={{ fontWeight: '700', fontSize: '7px', marginBottom: '3px' }}>
                Benefits Under Republic Act. No. 9257
              </div>
              <div style={{ fontWeight: '600', fontSize: '6.5px', marginBottom: '3px' }}>
                Senior Citizens act. (Amending R.A. 7432)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <div>-Free medical/dental diagnostic &amp; laboratory fees in all government facilities</div>
                <div>-20% discount in purchase of medicine</div>
                <div>-20% discount in Hotels, Restaurant, Recreation Centers &amp; Funeral Parlor</div>
                <div>-20% discount on Theaters, Cinema House and Concerts Halls, etc.</div>
                <div>-20% discount on Medical &amp; Dental Service</div>
                <div>-20% discount in Fare for Domestic Air, Sea Travel and Public Land Transportation</div>
              </div>
            </div>
          </div>

          {/* Disclaimer text */}
          <div style={{
            textAlign: 'center',
            fontSize: '5.5px',
            color: '#111',
            padding: '0 12px 4px 12px',
            lineHeight: '1.4',
          }}>
            Only for the exclusive use of Senior Citizens Abuse of privileges is punishable by law Person &amp; Corporation violating RA 9257 shall be penalized
          </div>

          {/* Bottom red accent bar */}
          <div style={{ height: '5px', background: 'linear-gradient(90deg, #b91c1c 80%, #7f1d1d 100%)' }} />

          {/* Signatures */}
          <div style={{
            background: '#fff',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'flex-end',
            padding: '16px 16px 6px 16px', 
            borderTop: 'none',
          }}>
            {/* OSCA Head */}
            <div style={{ textAlign: 'center', minWidth: '100px', position: 'relative' }}>
              <img
                src="/Sunny Rodin-Signature.png"
                alt="Sunny A. Rodin Signature"
                style={{
                  position: 'absolute',
                  bottom: '15px', // Increased to push signature UP
                  left: '50%',
                  transform: 'translateX(-50%)',
                  height: '42px', 
                  objectFit: 'contain',
                  zIndex: 10,
                  pointerEvents: 'none'
                }}
              />
              <div style={{ height: '16px' }}></div>
              <div style={{ fontWeight: '900', fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.02em', position: 'relative', zIndex: 1 }}>
                SUNNY A. RODIN
              </div>
              <div style={{ borderBottom: '1.5px solid #111', margin: '2px 0' }} />
              <div style={{ fontSize: '6px', fontWeight: '600', color: '#333' }}>OSCA HEAD</div>
            </div>

            {/* Mayor */}
            <div style={{ textAlign: 'center', minWidth: '120px', position: 'relative' }}>
              <img
                src="/Mayor-Signature.png"
                alt="Mayor Signature"
                style={{
                  position: 'absolute',
                  bottom: '6px', // Increased to push signature UP
                  left: '50%',
                  transform: 'translateX(-50%)',
                  height: '48px', 
                  objectFit: 'contain',
                  zIndex: 10,
                  pointerEvents: 'none'
                }}
              />
              <div style={{ height: '16px' }}></div> 
              <div style={{ fontWeight: '900', fontSize: '7px', textTransform: 'uppercase', letterSpacing: '0.02em', position: 'relative', zIndex: 1 }}>
                ENGR. REINHARD E. JERESANO
              </div>
              <div style={{ borderBottom: '1.5px solid #111', margin: '2px 0' }} />
              <div style={{ fontSize: '6px', fontWeight: '600', color: '#333' }}>MUNICIPAL MAYOR</div>
            </div>
          </div>

          {/* Bottom dark red bar */}
          <div style={{
            height: '8px',
            background: 'linear-gradient(90deg, #7f1d1d 0%, #b91c1c 50%, #7f1d1d 100%)',
          }} />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
          @page { size: portrait; margin: 0.5in; }
        }
      ` }} />
    </div>
  );
}