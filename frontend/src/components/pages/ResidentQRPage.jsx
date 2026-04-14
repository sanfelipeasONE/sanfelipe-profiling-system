import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/api";
import { Loader2, ShieldAlert, Printer, ArrowLeft, Download, ChevronLeft, ChevronRight } from "lucide-react";
import jsPDF from "jspdf";

// =========================
// Canvas helpers
// =========================

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

// =========================
// FRONT canvas
// =========================

async function drawFront(resident, formattedBirthdate, fullName, bgUrl, logoUrl) {
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

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(CW, 0);
  ctx.lineTo(X(DOM_W * 0.72), 0);
  ctx.lineTo(0, Y(DOM_H * 0.63));
  ctx.closePath();
  ctx.fillStyle = "#cc0000";
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = X(1);
  ctx.strokeRect(X(10), Y(10), X(DOM_W - 20), Y(DOM_H - 20));

  try {
    const logo = await loadImage(logoUrl);
    const lx = X(24);
    const ly = Y(24);
    const lw = X(88);
    const lh = Y(88);
    ctx.save();
    ctx.beginPath();
    ctx.arc(lx + lw / 2, ly + lh / 2, Math.min(lw, lh) / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logo, lx, ly, lw, lh);
    ctx.restore();
  } catch (_) {}

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#d40000";
  ctx.strokeStyle = "#000000";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = X(2);

  ctx.font = `${FONT_BLACK} ${FS(42)}px ${FONT_FAMILY}`;
  ctx.strokeText("SAN FELIPE", CW / 2, Y(52));
  ctx.fillText("SAN FELIPE", CW / 2, Y(52));

  ctx.font = `${FONT_BLACK} ${FS(40)}px ${FONT_FAMILY}`;
  ctx.strokeText("RESIDENT ID CARD", CW / 2, Y(85));
  ctx.fillText("RESIDENT ID CARD", CW / 2, Y(85));
  ctx.restore();

  const px = X(95);
  const py = Y(140);
  const photoSize = X(170);
  const pw = photoSize;
  const ph = photoSize;

  ctx.fillStyle = "#efefef";
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = X(3);
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

      ctx.drawImage(
        photo,
        sx, sy, squareSide, squareSide,
        px, py, pw, ph
      );

      ctx.restore();
    } catch (_) {}
  } else {
    ctx.fillStyle = "#888";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${FONT_BOLD} ${FS(14)}px ${FONT_FAMILY}`;
    ctx.fillText("NO PHOTO", px + pw / 2, py + ph / 2);
  }

  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${FONT_BLACK} ${FS(28)}px ${FONT_FAMILY}`;
  ctx.fillText("RESIDENT", px + pw / 2, Y(358));

  const fx = X(320);
  const fw = X(288);

  const col1 = fw * 0.22;
  const col2 = fw * 0.42;
  const col3 = fw * 0.36;

  function drawDomField({
    label,
    value,
    x,
    y,
    w,
    valueFs = 16,
    labelFs = 13,
    valueWeight = FONT_BOLD,
    labelWeight = FONT_MEDIUM,
    boxH = 26,
    pb = 1,
    labelGap = 1,
    nowrap = false,
  }) {
    const safeValue = String(value || "").trim() || " ";
    const boxHeight = Y(boxH);
    const paddingBottom = Y(pb);
    const innerWidth = w - X(8);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#000";
    ctx.font = `${valueWeight} ${FS(valueFs)}px ${FONT_FAMILY}`;

    const lines = nowrap ? [safeValue] : wrapText(ctx, safeValue, innerWidth);
    const lineHeight = Math.round(FS(valueFs) * 1.02);

    const firstBaseline =
      y + boxHeight - paddingBottom - (lines.length - 1) * lineHeight;

    lines.forEach((line, i) => {
      ctx.fillText(line, x + w / 2, firstBaseline + i * lineHeight);
    });

    ctx.fillStyle = "#111";
    ctx.font = `${labelWeight} ${FS(labelFs)}px ${FONT_FAMILY}`;
    const labelBaseline = y + boxHeight + FS(labelFs) + Y(labelGap);
    ctx.fillText(label, x + w / 2, labelBaseline);

    ctx.restore();
  }

  const row1Y = Y(142);
  const row2Y = Y(218);
  const row3Y = Y(286);

  drawDomField({
    label: "Last Name, First Name, M.I, Suffix",
    value: fullName,
    x: fx,
    y: row1Y,
    w: fw,
    valueFs: 14,
    labelFs: 12,
    boxH: 32,
    pb: 1,
    labelGap: 2,
  });

  drawDomField({
    label: "Sex",
    value: resident.sex || "",
    x: fx,
    y: row2Y,
    w: col1,
    valueFs: 16,
    labelFs: 13,
    boxH: 24,
    pb: 1,
    labelGap: 1,
  });

  drawDomField({
    label: "Date of Birth",
    value: formattedBirthdate || "",
    x: fx + col1,
    y: row2Y,
    w: col2,
    valueFs: 15,
    labelFs: 13,
    boxH: 24,
    pb: 1,
    labelGap: 1,
  });

  drawDomField({
    label: "Civil Status",
    value: (resident.civil_status || "").replace("Live-in Partner", "Live-in Partner"),
    x: fx + col1 + col2,
    y: row2Y,
    w: col3,
    valueFs: 14,
    labelFs: 13,
    boxH: 24,
    pb: 1,
    labelGap: 1,
    nowrap: true,
  });

  drawDomField({
    label: "Contact No.",
    value: resident.contact_no || "",
    x: fx,
    y: row3Y,
    w: fw * 0.48,
    valueFs: 16,
    labelFs: 13,
    boxH: 26,
    pb: 1,
    labelGap: 1,
  });

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

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(X(DOM_W * 0.7), 0);
  ctx.lineTo(0, Y(DOM_H * 0.6));
  ctx.closePath();
  ctx.fillStyle = "#cc0000";
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = X(1);
  ctx.strokeRect(X(10), Y(10), X(DOM_W - 20), Y(DOM_H - 20));

  try {
    const logo = await loadImage(logoUrl);
    const lx = X(24);
    const ly = Y(24);
    const lw = X(88);
    const lh = Y(88);
    ctx.save();
    ctx.beginPath();
    ctx.arc(lx + lw / 2, ly + lh / 2, Math.min(lw, lh) / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logo, lx, ly, lw, lh);
    ctx.restore();
  } catch (_) {}

  const leftX = X(90);
  let topY = Y(190);

  ctx.fillStyle = "#000";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${FONT_MEDIUM} ${FS(16)}px ${FONT_FAMILY}`;
  ctx.fillText("In Case of Emergency", leftX, topY + FS(16));
  topY += FS(16) + Y(12);

  const maxEmW = X(235);

  function drawEmergencyLine(value, fontSize, mb = 12) {
    const val = String(value || " ").toUpperCase();
    ctx.fillStyle = "#000";
    ctx.font = `${FONT_BOLD} ${FS(fontSize)}px ${FONT_FAMILY}`;
    ctx.textAlign = "left";
    const lines = wrapText(ctx, val, maxEmW);
    const lh = FS(fontSize) + Y(3);

    lines.forEach((line, i) => {
      ctx.fillText(line, leftX, topY + i * lh + FS(fontSize));
    });

    topY += lines.length * lh + Y(mb);
  }

  drawEmergencyLine(emergencyName, 14, 12);
  drawEmergencyLine(emergencyContactNo, 14, 12);
  drawEmergencyLine(emergencyAddress, 13, 0);

  const rx = X(DOM_W - 34 - 285);
  const ry = Y(60);

  ctx.fillStyle = "#000";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${FONT_BLACK} ${FS(24)}px ${FONT_FAMILY}`;

  const idLabel = "ID NUMBER:";
  const idLabelW = ctx.measureText(idLabel).width;
  const idY = ry + FS(24);

  ctx.fillText(idLabel, rx, idY);
  ctx.fillText(resident.resident_code || "—", rx + idLabelW + X(8), idY);

  const qx = X(DOM_W - 34 - 245);
  const qy = Y(60) + FS(24) + Y(12);
  const qw = X(245);
  const qh = Y(205);

  ctx.fillStyle = "#efefef";
  ctx.fillRect(qx, qy, qw, qh);
  ctx.strokeStyle = "#000";
  ctx.lineWidth = X(3);
  ctx.strokeRect(qx, qy, qw, qh);

  if (qrSrc) {
    try {
      const qr = await loadImage(qrSrc);
      const pad = X(8);
      ctx.drawImage(qr, qx + pad, qy + pad, qw - pad * 2, qh - pad * 2);
    } catch (_) {}
  }

  const captionY = qy + qh + Y(12);
  ctx.textAlign = "center";
  ctx.fillStyle = "#000";
  ctx.font = `${FONT_MEDIUM} ${FS(11)}px ${FONT_FAMILY}`;
  ctx.fillText("This QR Code contains verified resident data.", qx + qw / 2, captionY + FS(11));
  ctx.fillText("Scan using authorized LGU devices only.", qx + qw / 2, captionY + FS(11) + Y(14));

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
  const [activeSide, setActiveSide] = useState("front"); // "front" | "back"

  const frontPreviewRef = useRef(null);
  const backPreviewRef = useRef(null);

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

  const fullName = useMemo(() => {
    if (!resident) return "";

    const rawLastName = (resident.last_name || "").trim().toUpperCase();
    const rawFirstName = (resident.first_name || "").trim().toUpperCase();
    const rawMiddleName = (resident.middle_name || "").trim().toUpperCase();
    const rawSuffix = (resident.ext_name || "").trim().toUpperCase();

    let cleanFirstName = rawFirstName;
    let suffix = rawSuffix;

    if (!suffix && rawFirstName.includes(",")) {
      const parts = rawFirstName
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);

      cleanFirstName = parts[0] || "";
      suffix = parts.slice(1).join(" ");
    }

    const middleInitial = rawMiddleName ? `${rawMiddleName.charAt(0)}.` : "";

    return [rawLastName ? `${rawLastName},` : "", cleanFirstName, middleInitial, suffix]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
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
          await document.fonts.load("900 42px Barlow");
          await document.fonts.load("900 40px Barlow");
          await document.fonts.load("900 28px Barlow");
          await document.fonts.load("900 24px Barlow");
          await document.fonts.ready;
        }

        const [frontCanvas, backCanvas] = await Promise.all([
          drawFront(resident, formattedBirthdate, fullName, bgUrl, logoUrl),
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

        const frontEl = frontPreviewRef.current;
        const backEl = backPreviewRef.current;

        if (frontEl) {
          const fctx = frontEl.getContext("2d");
          frontEl.width = CW;
          frontEl.height = CH;
          fctx.clearRect(0, 0, CW, CH);
          fctx.drawImage(frontCanvas, 0, 0);
        }

        if (backEl) {
          const bctx = backEl.getContext("2d");
          backEl.width = CW;
          backEl.height = CH;
          bctx.clearRect(0, 0, CW, CH);
          bctx.drawImage(backCanvas, 0, 0);
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
    fullName,
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
        await document.fonts.load("700 17px Barlow");
        await document.fonts.load("700 16px Barlow");
        await document.fonts.load("700 15px Barlow");
        await document.fonts.load("700 14px Barlow");
        await document.fonts.load("500 13px Barlow");
        await document.fonts.load("500 16px Barlow");
        await document.fonts.load("500 11px Barlow");
        await document.fonts.load("900 42px Barlow");
        await document.fonts.load("900 40px Barlow");
        await document.fonts.load("900 28px Barlow");
        await document.fonts.load("900 24px Barlow");
        await document.fonts.ready;
      }

      const [frontCanvas, backCanvas] = await Promise.all([
        drawFront(resident, formattedBirthdate, fullName, bgUrl, logoUrl),
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
            overflow: visible !important;
          }

          @page {
            size: 3.375in 2.125in;
            margin: 0;
          }

          body * { visibility: hidden !important; }

          #qr-print-area,
          #qr-print-area * { visibility: visible !important; }

          #qr-print-area {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: auto !important;
            height: auto !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          #qr-print-area > .print-canvas-wrap {
            width: 648px !important;
            height: 408px !important;
            zoom: 0.5;
            margin: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            transform: none !important;
            background: white !important;
          }

          #qr-print-area > .print-canvas-wrap:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
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

      {/* ── Top bar ── */}

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

        {/* ── Canvas slider (mobile) / stacked (print + desktop) ── */}

        {/* Print-only: both canvases always visible and stacked */}
        <div
          id="qr-print-area"
          className="hidden print:flex print:flex-col print:gap-0 print:items-center"
        >
          <div className="print-canvas-wrap">
            <canvas ref={frontPreviewRef} className="print-canvas block w-[648px] h-[408px]" />
          </div>
          <div className="print-canvas-wrap">
            <canvas ref={backPreviewRef} className="print-canvas block w-[648px] h-[408px]" />
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
                  ref={frontPreviewRef}
                  className="block w-full h-auto"
                  style={{ aspectRatio: `${DOM_W} / ${DOM_H}` }}
                />
              </div>
            </div>

            {/* Back */}
            <div className="w-1/2 px-0">
              <div className="rounded-2xl overflow-hidden shadow-xl border border-stone-300 bg-white">
                <canvas
                  ref={backPreviewRef}
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