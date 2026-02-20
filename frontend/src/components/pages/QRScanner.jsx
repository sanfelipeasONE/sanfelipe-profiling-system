import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import api from "../../api/api";

export default function QRScanner() {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const [resident, setResident] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();

    const startScanner = async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();

        const backCamera = devices.find(device =>
        device.label.toLowerCase().includes("back")
        );

        const selectedDeviceId = backCamera
        ? backCamera.deviceId
        : devices[0]?.deviceId;

        if (!selectedDeviceId) {
          setError("No camera found");
          return;
        }

        const controls = await codeReader.decodeFromVideoDevice(
          selectedDeviceId,
          videoRef.current,
          async (result) => {
            if (result) {
              const scannedCode = result.getText();

              try {
                const response = await api.get(
                  `/residents/code/${scannedCode}`
                );
                setResident(response.data);

                // ✅ STOP CAMERA SAFELY
                if (controlsRef.current) {
                  controlsRef.current.stop();
                }

              } catch (e) {
                setError("Resident not found or unauthorized");
              }
            }
          }
        );

        controlsRef.current = controls;

      } catch (err) {
        setError("Camera access denied");
      }
    };

    startScanner();

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    };
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Scan Resident QR</h2>

      <video
        ref={videoRef}
        className="w-full max-w-md rounded-lg shadow"
      />

      {error && <p className="text-red-500 mt-4">{error}</p>}

      {resident && (
        <div className="mt-6 p-4 border rounded-lg bg-white shadow">
          <h3 className="text-xl font-bold">
            {resident.first_name} {resident.last_name}
          </h3>
          <p>Barangay: {resident.barangay}</p>
          <p>Purok: {resident.purok}</p>
          <p>Status: {resident.status}</p>
        </div>
      )}
    </div>
  );
}