import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/api";
import { Loader2, ShieldAlert, Printer, ArrowLeft, Download } from "lucide-react";
import jsPDF from "jspdf";

// =========================
// Canvas helpers
// =========================

const SECTOR_CODES = {
  "4P'S": "1",
  "ATV'S/UTV'S OWNER": "2",
  "BANANA BOAT/DRAGON BOAT OWNER": "3",
  "BANCA OWNER": "4",
  "BRGY. BNS/BHW": "5",
  "BRGY BNS/BHW": "5",
  "BRGY. OFFICIAL/EMPLOYEE": "6",
  "BRGY OFFICIAL/EMPLOYEE": "6",
  "C": "7",
  "FAMILY HEADS": "8",
  "FARMERS": "9",
  "FISHERFOLK": "10",
  "FISHERMAN": "11",
  "GOVERNMENT EMPLOYEE": "12",
  "GOVT EMPLOYEE": "12",
  "HC": "13",
  "INDIGENOUS PEOPLE": "14",
  "LGU EMPLOYEE": "15",
  "LIFEGUARD": "16",
  "M": "17",
  "OFW": "18",
  "PHILHEALTH MEMBER": "19",
  "PWD": "20",
  "SENIOR CITIZEN": "21",
  "SFAO/SAN FELIPE AS ONE": "22",
  "SFAO": "22",
  "SOLO PARENT": "23",
  "STUDENT": "24",
  "TODA": "25",
  "OTHERS": "26",
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error("Missing image src"));
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx, text, maxWidth) {
  const content = String(text || "").trim();
  if (!content) return [" "];

  const words = content.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [" "];
}

// Match preview size
const DOM_W = 648;
const DOM_H = 408;

// 2x export for sharper PDF and preview
const CW = 1296;
const CH = 816;

const SX = CW / DOM_W;
const SY = CH / DOM_H;

const X = (n) => n * SX;
const Y = (n) => n * SY;
const FS = (n) => Math.round(n * SX);

const FONT_FAMILY = "Barlow, Arial, sans-serif";
const FONT_BLACK = "900";
const FONT_BOLD = "700";
const FONT_MEDIUM = "500";

const PRIMARY_RED = "#cc1d1d"; // Matched red tone

// =========================
// FRONT canvas
// =========================

async function drawFront(resident, formattedBirthdate, bgUrl, logoUrl) {
  const canvas = document.createElement("canvas");
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext("2d");

  // Base White Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CW, CH);

  // Faint Background Image
  try {
    const bg = await loadImage(bgUrl);
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.drawImage(bg, 0, 0, CW, CH);
    ctx.restore();
  } catch (_) {}

  // Giant Watermark Logo (Right side)
  try {
    const logo = await loadImage(logoUrl);
    ctx.save();
    ctx.globalAlpha = 0.12;
    const wmW = X(420);
    const wmH = Y(420);
    const wmX = CW - wmW + X(55);
    const wmY = CH - wmH + Y(70);
    ctx.drawImage(logo, wmX, wmY, wmW, wmH);
    ctx.restore();
  } catch (_) {}

  // Top Red Header Banner (Slants up towards right)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(CW, 0);
  ctx.lineTo(CW, Y(DOM_H * 0.18)); 
  ctx.lineTo(0, Y(DOM_H * 0.32));  
  ctx.closePath();
  ctx.fillStyle = PRIMARY_RED;
  ctx.fill();
  ctx.restore();

  // White Card Border
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = X(1);
  ctx.strokeRect(X(10), Y(10), X(DOM_W - 20), Y(DOM_H - 20));

  // Top Left Logo
  try {
    const logo = await loadImage(logoUrl);
    const lx = X(25);
    const ly = Y(15);
    const lw = X(85);
    const lh = Y(85);
    ctx.save();
    ctx.beginPath();
    ctx.arc(lx + lw / 2, ly + lh / 2, Math.min(lw, lh) / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logo, lx, ly, lw, lh);
    ctx.restore();
  } catch (_) {}

  // Header Text
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  
  ctx.font = `${FONT_BLACK} ${FS(45)}px ${FONT_FAMILY}`;
  ctx.fillText("SAN FELIPENEAN", X(140), Y(40));

  ctx.font = `${FONT_BLACK} ${FS(20)}px ${FONT_FAMILY}`;
  ctx.fillText("IDENTIFICATION CARD", X(140), Y(75));
  ctx.restore();

  // Photo Box
  const px = X(30);
  const py = Y(120);
  const pw = X(160);
  const ph = X(160);

  ctx.fillStyle = "#efefef";
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = "#555";
  ctx.lineWidth = X(1);
  ctx.strokeRect(px, py, pw, ph);

  if (resident.photo_url) {
    try {
      const photo = await loadImage(resident.photo_url);
      const imgW = photo.width;
      const imgH = photo.height;
      const squareSide = Math.min(imgW, imgH);
      const sx = (imgW - squareSide) / 2;
      const sy = (imgH - squareSide) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, pw, ph);
      ctx.clip();
      ctx.fillStyle = "#efefef";
      ctx.fillRect(px, py, pw, ph);
      ctx.drawImage(photo, sx, sy, squareSide, squareSide, px, py, pw, ph);
      ctx.restore();
    } catch (_) {}
  } else {
    ctx.fillStyle = "#888";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${FONT_BOLD} ${FS(14)}px ${FONT_FAMILY}`;
    ctx.fillText("NO PHOTO", px + pw / 2, py + ph / 2);
  }

  // Fields starting position
  const textX = X(220);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Last Name
  ctx.fillStyle = "#444";
  ctx.font = `${FONT_MEDIUM} ${FS(11)}px ${FONT_FAMILY}`;
  ctx.fillText("LAST NAME", textX, Y(135));
  ctx.fillStyle = "#000";
  ctx.font = `${FONT_BLACK} ${FS(22)}px ${FONT_FAMILY}`;
  ctx.fillText((resident.last_name || "").toUpperCase(), textX, Y(160));

  // First Name
  ctx.fillStyle = "#444";
  ctx.font = `${FONT_MEDIUM} ${FS(11)}px ${FONT_FAMILY}`;
  ctx.fillText("FIRST NAME", textX, Y(185));
  ctx.fillStyle = "#000";
  ctx.font = `${FONT_BLACK} ${FS(22)}px ${FONT_FAMILY}`;
  ctx.fillText((resident.first_name || "").toUpperCase(), textX, Y(210));

  // Middle Name / Suffix
  ctx.fillStyle = "#444";
  ctx.font = `${FONT_MEDIUM} ${FS(11)}px ${FONT_FAMILY}`;
  ctx.fillText("MIDDLE NAME / Suffix", textX, Y(235));
  ctx.fillStyle = "#000";
  ctx.font = `${FONT_BLACK} ${FS(22)}px ${FONT_FAMILY}`;
  const midSuffix = `${resident.middle_name || ""} ${resident.ext_name || ""}`.trim().toUpperCase();
  ctx.fillText(midSuffix, textX, Y(260));

  // Address Bar (Red Pill)
  const pillX = X(215);
  const pillY = Y(275);
  const pillW = X(DOM_W - 240);
  const pillH = Y(22);
  const radius = X(10);
  
  ctx.fillStyle = PRIMARY_RED;
  ctx.beginPath();
  ctx.moveTo(pillX + radius, pillY);
  ctx.lineTo(pillX + pillW - radius, pillY);
  ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + radius);
  ctx.lineTo(pillX + pillW, pillY + pillH - radius);
  ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - radius, pillY + pillH);
  ctx.lineTo(pillX + radius, pillY + pillH);
  ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - radius);
  ctx.lineTo(pillX, pillY + radius);
  ctx.quadraticCurveTo(pillX, pillY, pillX + radius, pillY);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = `${FONT_BOLD} ${FS(15)}px ${FONT_FAMILY}`;
  const fullAddr = `BARANGAY ${resident.barangay || ""}, SAN FELIPE, ZAMBALES`.toUpperCase();
  ctx.fillText(fullAddr, pillX + pillW / 2, pillY + Y(15)); // Vertically centered

  // Bottom Stats Row (Sex, DOB, Civil Status)
  const statYVal = Y(335);
  const statYLbl = Y(355);

  ctx.textAlign = "center";

  // Sex
  const sexX = X(260);
  ctx.fillStyle = "#000";
  ctx.font = `${FONT_BLACK} ${FS(20)}px ${FONT_FAMILY}`;
  ctx.fillText((resident.sex || "").toUpperCase(), sexX, statYVal);
  ctx.fillStyle = "#444";
  ctx.font = `${FONT_MEDIUM} ${FS(12)}px ${FONT_FAMILY}`;
  ctx.fillText("Sex", sexX, statYLbl);

  // Date of Birth
  const dobX = X(390);
  ctx.fillStyle = "#000";
  ctx.font = `${FONT_BLACK} ${FS(20)}px ${FONT_FAMILY}`;
  ctx.fillText(formattedBirthdate || "", dobX, statYVal);
  ctx.fillStyle = "#444";
  ctx.font = `${FONT_MEDIUM} ${FS(12)}px ${FONT_FAMILY}`;
  ctx.fillText("Date of Birth", dobX, statYLbl);

  // Civil Status
  const civX = X(530);
  ctx.fillStyle = "#000";
  ctx.font = `${FONT_BLACK} ${FS(20)}px ${FONT_FAMILY}`;
  ctx.fillText((resident.civil_status || "").toUpperCase(), civX, statYVal);
  ctx.fillStyle = "#444";
  ctx.font = `${FONT_MEDIUM} ${FS(12)}px ${FONT_FAMILY}`;
  ctx.fillText("Civil Status", civX, statYLbl);

  // Contact No.
  const contactYVal = Y(380);
  const contactYLbl = Y(395);
  ctx.fillStyle = "#000";
  ctx.font = `${FONT_BLACK} ${FS(20)}px ${FONT_FAMILY}`;
  ctx.fillText(resident.contact_no || "", dobX, contactYVal);
  ctx.fillStyle = "#444";
  ctx.font = `${FONT_MEDIUM} ${FS(12)}px ${FONT_FAMILY}`;
  ctx.fillText("Contact number", dobX, contactYLbl);

  return canvas;
}

// =========================
// BACK canvas
// =========================

async function drawBack(
  resident,
  emergencyName,
  emergencyContactNo,
  emergencyAddress,
  qrSrc,
  bgUrl,
  logoUrl
) {
  const canvas = document.createElement("canvas");
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CW, CH);

  try {
    const bg = await loadImage(bgUrl);
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.drawImage(bg, 0, 0, CW, CH);
    ctx.restore();
  } catch (_) {}

  try {
    const logo = await loadImage(logoUrl);
    ctx.save();
    ctx.globalAlpha = 0.12;
    const wmW = X(420);
    const wmH = Y(420);
    const wmX = CW - wmW + X(55);
    const wmY = CH - wmH + Y(70);
    ctx.drawImage(logo, wmX, wmY, wmW, wmH);
    ctx.restore();
  } catch (_) {}

  // Top Red Header Banner
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(CW, 0);
  ctx.lineTo(CW, Y(DOM_H * 0.10)); 
  ctx.lineTo(0, Y(DOM_H * 0.28));  
  ctx.closePath();
  ctx.fillStyle = PRIMARY_RED;
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = X(1);
  ctx.strokeRect(X(10), Y(10), X(DOM_W - 20), Y(DOM_H - 20));

  // --- Left Column: Emergency Information ---
  const leftCenterX = X(180);
  let topY = Y(145);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#000";
  ctx.font = `${FONT_BLACK} ${FS(18)}px ${FONT_FAMILY}`;
  ctx.fillText("IN CASE OF EMERGENCY", leftCenterX, topY);
  topY += Y(40);

  ctx.font = `${FONT_BLACK} ${FS(18)}px ${FONT_FAMILY}`;
  const emNameLines = wrapText(ctx, (emergencyName || "").toUpperCase(), X(320));
  emNameLines.forEach(line => {
    ctx.fillText(line, leftCenterX, topY);
    topY += Y(22);
  });
  topY += Y(5);

  ctx.fillText(emergencyContactNo || "", leftCenterX, topY);
  topY += Y(25);

  const emAddrLines = wrapText(ctx, (emergencyAddress || "").toUpperCase(), X(320));
  emAddrLines.forEach(line => {
    ctx.fillText(line, leftCenterX, topY);
    topY += Y(22);
  });

  // --- Right Column: QR Code and ID ---
  const rightCenterX = X(470);
  
  ctx.fillStyle = "#000";
  ctx.font = `${FONT_BLACK} ${FS(22)}px ${FONT_FAMILY}`;
  ctx.fillText(`ID NUMBER: ${resident.resident_code || "—"}`, rightCenterX, Y(95));

  const qw = X(190);
  const qh = Y(190);
  const qx = rightCenterX - qw / 2;
  const qy = Y(120);

  ctx.fillStyle = "#efefef";
  ctx.fillRect(qx, qy, qw, qh);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = X(2);
  ctx.strokeRect(qx, qy, qw, qh);

  if (qrSrc) {
    try {
      const qr = await loadImage(qrSrc);
      const pad = X(8);
      ctx.drawImage(qr, qx + pad, qy + pad, qw - pad * 2, qh - pad * 2);
    } catch (_) {}
  }

  const captionY = qy + qh + Y(25);
  ctx.fillStyle = "#000";
  ctx.font = `${FONT_MEDIUM} ${FS(10)}px ${FONT_FAMILY}`;
  ctx.fillText("THIS QR CODE CONTAINS VERIFIED RESIDENT DATA.", rightCenterX, captionY);
  ctx.fillText("SCAN USING AUTHORIZED LGU DEVICE ONLY.", rightCenterX, captionY + Y(15));

  // --- Bottom Left: SECTOR CODES ---
  let sectorCodes = [];
  if (resident && resident.sector_summary && resident.sector_summary !== "None") {
    const sectors = resident.sector_summary.split(",").map(s => s.trim().toUpperCase());
    sectors.forEach(sector => {
      if (SECTOR_CODES[sector]) {
        sectorCodes.push(SECTOR_CODES[sector]);
      }
    });
  }

  if (sectorCodes.length > 0) {
    const codesText = sectorCodes.join(", "); 
    ctx.fillStyle = "#000";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.font = `${FONT_BLACK} ${FS(16)}px ${FONT_FAMILY}`; 
    ctx.fillText(codesText, X(25), Y(DOM_H - 15)); 
  }

  return canvas;
}

// =========================
// Component
// =========================

export default function ResidentQRPage() {
  const { code } = useParams();
  const navigate = useNavigate();

  const [resident, setResident] = useState(null);
  const [qrImage, setQrImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [renderingPreview, setRenderingPreview] = useState(false);
  const [activeSide, setActiveSide] = useState("front"); 

  const frontScreenRef = useRef(null);
  const backScreenRef = useRef(null);
  const frontPrintRef = useRef(null);
  const backPrintRef = useRef(null);

  const logoUrl = "/san_felipe_seal.png";
  const bgUrl = "/sanfe.jpg";

  useEffect(() => {
    if (!code) return;

    const fetchData = async () => {
      try {
        const response = await api.get(`/residents/code/${code}`);
        setResident(response.data);

        const qrResponse = await api.get(`/residents/code/${code}/qr`, {
          responseType: "blob",
        });

        const imageUrl = URL.createObjectURL(qrResponse.data);
        setQrImage(imageUrl);
      } catch (err) {
        console.error("Failed to fetch QR", err);
        setResident(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [code]);

  useEffect(() => {
    return () => {
      if (qrImage) URL.revokeObjectURL(qrImage);
    };
  }, [qrImage]);

  const formattedBirthdate = useMemo(() => {
    if (!resident?.birthdate) return " ";
    const date = new Date(resident.birthdate);
    if (isNaN(date.getTime())) return resident.birthdate;

    return date.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  }, [resident]);

  const emergencyName = useMemo(() => resident?.emergency_name || " ", [resident]);
  const emergencyContactNo = useMemo(() => resident?.emergency_contact_no || " ", [resident]);
  const emergencyAddress = useMemo(() => resident?.emergency_address || " ", [resident]);

  useEffect(() => {
    let cancelled = false;

    const renderPreview = async () => {
      if (!resident) return;

      setRenderingPreview(true);

      try {
        if (document.fonts) {
          await document.fonts.load("700 17px Barlow");
          await document.fonts.load("700 16px Barlow");
          await document.fonts.load("700 15px Barlow");
          await document.fonts.load("700 14px Barlow");
          await document.fonts.load("500 13px Barlow");
          await document.fonts.load("500 16px Barlow");
          await document.fonts.load("500 11px Barlow");
          await document.fonts.load("900 40px Barlow");
          await document.fonts.load("900 38px Barlow");
          await document.fonts.load("900 28px Barlow");
          await document.fonts.load("900 24px Barlow");
          await document.fonts.ready;
        }

        const [frontCanvas, backCanvas] = await Promise.all([
          drawFront(resident, formattedBirthdate, bgUrl, logoUrl),
          drawBack(
            resident,
            emergencyName,
            emergencyContactNo,
            emergencyAddress,
            qrImage,
            bgUrl,
            logoUrl
          ),
        ]);

        if (cancelled) return;

        // 1) Draw to Screen Canvases
        const frontScreenEl = frontScreenRef.current;
        const backScreenEl = backScreenRef.current;

        if (frontScreenEl) {
          const fctx = frontScreenEl.getContext("2d");
          frontScreenEl.width = CW;
          frontScreenEl.height = CH;
          fctx.clearRect(0, 0, CW, CH);
          fctx.drawImage(frontCanvas, 0, 0);
        }

        if (backScreenEl) {
          const bctx = backScreenEl.getContext("2d");
          backScreenEl.width = CW;
          backScreenEl.height = CH;
          bctx.clearRect(0, 0, CW, CH);
          bctx.drawImage(backCanvas, 0, 0);
        }

        // 2) Draw to Print Canvases
        const frontPrintEl = frontPrintRef.current;
        const backPrintEl = backPrintRef.current;

        if (frontPrintEl) {
          const fpctx = frontPrintEl.getContext("2d");
          frontPrintEl.width = CW;
          frontPrintEl.height = CH;
          fpctx.clearRect(0, 0, CW, CH);
          fpctx.drawImage(frontCanvas, 0, 0);
        }

        if (backPrintEl) {
          const bpctx = backPrintEl.getContext("2d");
          backPrintEl.width = CW;
          backPrintEl.height = CH;
          bpctx.clearRect(0, 0, CW, CH);
          bpctx.drawImage(backCanvas, 0, 0);
        }

      } catch (err) {
        console.error("Preview render failed:", err);
      } finally {
        if (!cancelled) setRenderingPreview(false);
      }
    };

    renderPreview();

    return () => {
      cancelled = true;
    };
  }, [
    resident,
    qrImage,
    formattedBirthdate,
    emergencyName,
    emergencyContactNo,
    emergencyAddress,
    bgUrl,
    logoUrl,
  ]);

  const handleDownloadPDF = async () => {
    if (!resident) return;

    setDownloadingPdf(true);
    try {
      if (document.fonts) {
        await document.fonts.ready;
      }

      const [frontCanvas, backCanvas] = await Promise.all([
        drawFront(resident, formattedBirthdate, bgUrl, logoUrl),
        drawBack(
          resident,
          emergencyName,
          emergencyContactNo,
          emergencyAddress,
          qrImage,
          bgUrl,
          logoUrl
        ),
      ]);

      const CARD_W = 3.375;
      const CARD_H = 2.125;

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "in",
        format: [CARD_H, CARD_W],
        compress: true,
      });

      pdf.addImage(frontCanvas.toDataURL("image/png"), "PNG", 0, 0, CARD_W, CARD_H);
      pdf.addPage([CARD_H, CARD_W], "landscape");
      pdf.addImage(backCanvas.toDataURL("image/png"), "PNG", 0, 0, CARD_W, CARD_H);

      pdf.save(`ResidentID_${resident?.resident_code || "card"}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-stone-100 font-sans px-4">
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-stone-200 flex flex-col items-center w-full max-w-xs">
          <Loader2 size={32} className="text-rose-700 animate-spin mb-4" />
          <p className="text-[11px] font-bold text-stone-500 uppercase tracking-widest text-center">
            Retrieving Registry Record...
          </p>
        </div>
      </div>
    );
  }

  // ── Not found state ────────────────────────────────────────────────────────
  if (!resident) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-stone-100 font-sans p-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center w-full max-w-sm shadow-sm">
          <div className="w-14 h-14 bg-red-50 text-red-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={28} />
          </div>
          <h2 className="text-lg font-extrabold text-stone-900 tracking-tight mb-2">
            Record Not Found
          </h2>
          <p className="text-sm text-stone-500 font-medium mb-6 leading-relaxed">
            The requested registry ID is invalid, unauthorized, or has been removed from the system.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-stone-900 text-white text-sm font-semibold rounded-xl hover:bg-stone-800 active:bg-stone-950 transition-colors"
          >
            <ArrowLeft size={16} />
            Return to Directory
          </button>
        </div>
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-stone-200 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800;900&display=swap');

        /* ── Print styles ── */
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            width: 100% !important;
          }

          @page {
            size: auto; 
            margin: 15mm 0mm; /* Top/bottom margin, 0 side margins to let flex handle centering */
          }

          body * { visibility: hidden !important; }

          #qr-print-area,
          #qr-print-area * { visibility: visible !important; }

          #qr-print-area {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important; /* Force full width of the printed page */
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important; /* Center horizontally */
            margin: 0 !important;
            padding: 0 !important;
          }

          #qr-print-area > .print-canvas-wrap {
            width: 648px !important;
            height: 408px !important;
            zoom: 0.5;
            margin: 0 auto !important; /* Ensure the block itself is centered */
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: white !important;
          }

          .print-canvas {
            width: 648px !important;
            height: 408px !important;
            display: block !important;
          }

          .print\\:hidden, .no-print { display: none !important; }
        }

        /* ── Mobile card flip animation ── */
        .card-slider {
          display: flex;
          transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          will-change: transform;
        }

        .card-slider[data-side="front"] { transform: translateX(0%); }
        .card-slider[data-side="back"]  { transform: translateX(-50%); }
      `}</style>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col items-center py-6 px-4 max-w-lg mx-auto w-full">

        {/* Rendering indicator */}
        {renderingPreview && (
          <div className="flex items-center gap-2 text-stone-500 text-xs font-semibold mb-3 print:hidden">
            <Loader2 size={13} className="animate-spin" />
            Rendering preview…
          </div>
        )}

        {/* ── Side toggle tabs ── */}
        <div className="flex w-full max-w-sm rounded-xl overflow-hidden border border-stone-300 bg-stone-100 mb-4 print:hidden">
          {["front", "back"].map((side) => (
            <button
              key={side}
              onClick={() => setActiveSide(side)}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                activeSide === side
                  ? "bg-rose-700 text-white shadow-inner"
                  : "text-stone-500 hover:text-stone-700 hover:bg-stone-200"
              }`}
            >
              {side === "front" ? "Front Side" : "Back Side"}
            </button>
          ))}
        </div>

        {/* Print-only: both canvases always visible and stacked */}
        <div
          id="qr-print-area"
          className="hidden print:flex print:flex-col print:gap-8 print:items-center"
        >
          <div className="print-canvas-wrap">
            <canvas ref={frontPrintRef} className="print-canvas block w-[648px] h-[408px]" />
          </div>
          <div className="print-canvas-wrap">
            <canvas ref={backPrintRef} className="print-canvas block w-[648px] h-[408px]" />
          </div>
        </div>

        {/* Screen-only: sliding card viewer */}
        <div className="print:hidden w-full overflow-hidden rounded-2xl">
          <div
            className="card-slider w-[200%]"
            data-side={activeSide}
          >
            {/* Front */}
            <div className="w-1/2 px-0">
              <div className="rounded-2xl overflow-hidden shadow-xl border border-stone-300 bg-white">
                <canvas
                  ref={frontScreenRef}
                  className="block w-full h-auto"
                  style={{ aspectRatio: `${DOM_W} / ${DOM_H}` }}
                />
              </div>
            </div>

            {/* Back */}
            <div className="w-1/2 px-0">
              <div className="rounded-2xl overflow-hidden shadow-xl border border-stone-300 bg-white">
                <canvas
                  ref={backScreenRef}
                  className="block w-full h-auto"
                  style={{ aspectRatio: `${DOM_W} / ${DOM_H}` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Swipe hint dots ── */}
        <div className="flex items-center gap-2 mt-4 print:hidden">
          {["front", "back"].map((side) => (
            <button
              key={side}
              onClick={() => setActiveSide(side)}
              aria-label={`View ${side}`}
              className={`rounded-full transition-all duration-300 ${
                activeSide === side
                  ? "w-6 h-2 bg-rose-700"
                  : "w-2 h-2 bg-stone-400 hover:bg-stone-500"
              }`}
            />
          ))}
        </div>

        {/* ── Side label ── */}
        <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mt-2 print:hidden">
          {activeSide === "front" ? "Front Side" : "Back Side"} — Print Both Sides
        </p>

        {/* ── Action buttons ── */}
        <div className="w-full mt-6 flex flex-col gap-3 print:hidden">
          <button
            onClick={handleDownloadPDF}
            disabled={downloadingPdf}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-rose-700 text-white text-sm font-bold uppercase tracking-wider rounded-xl hover:bg-rose-800 active:bg-rose-900 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {downloadingPdf ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                Generating PDF…
              </>
            ) : (
              <>
                <Download size={17} />
                Download PDF
              </>
            )}
          </button>

          <button
            onClick={() => window.print()}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-stone-800 text-white text-sm font-bold uppercase tracking-wider rounded-xl hover:bg-stone-900 active:bg-black transition-colors shadow-sm"
          >
            <Printer size={17} />
            Print ID Card
          </button>

          <button
            onClick={() => navigate(-1)}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-white text-stone-700 text-sm font-bold uppercase tracking-wider rounded-xl border border-stone-300 hover:bg-stone-50 active:bg-stone-100 transition-colors"
          >
            <ArrowLeft size={17} />
            Go Back
          </button>
        </div>

        {/* ── Bottom safe area spacer for phones ── */}
        <div className="h-6 print:hidden" />
      </div>
    </div>
  );
}