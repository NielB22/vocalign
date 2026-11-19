# VocalAlign AI — Deep Learning Vocal & Lip Pose Synchronization

Platform analisis vokal multi-modal berbasis Deep Learning yang memadukan estimasi pitch audio menggunakan **CREPE (Convolutional Representation for Pitch Estimation)** dengan tracking orientasi bukaan mulut menggunakan **YOLOv8 Face Detection** dan bobot kustom **YOLOv8 Lip Pose (`lip-pose.pt`)**.

---

## 🚀 Fitur Utama

1. **Audio Stream (CREPE CNN)**:
   - Ekstraksi audio mono 16 kHz PCM menggunakan FFmpeg.
   - Estimasi nada fundamental ($f_0$) dengan resolusi grid 10 ms (100 Hz).
   - Filter median 220 ms untuk meredam vibrato tanpa mengorbankan stabilitas pitch.
   - Deteksi oktaf otomatis (penyanyi yang menyanyi 1 oktaf lebih rendah/tinggi tetap dinilai proporsional).
   - Klasifikasi frame: *In-Tune* (deviasi $\le \pm 25$ cent), *Flat* ($< -25$ cent), *Sharp* ($> +25$ cent), dan *Nada Salah* ($> \pm 100$ cent).

2. **Visual Stream (YOLOv8 Pose `lip-pose.pt`)**:
   - Normalisasi video ke 30 FPS konstan untuk sinkronisasi timestamp yang presisi.
   - Deteksi wajah terbesar penyanyi dengan interpolasi bounding box stabil.
   - Deteksi 4 keypoint bibir: *sudut kiri*, *sudut kanan*, *dalam atas*, *dalam bawah*.
   - Perhitungan rasio bukaan mulut tanpa satuan (*Mouth Aspect Ratio* — MAR):
     $$\text{MAR} = \frac{\|\text{dalam\_atas} - \text{dalam\_bawah}\|}{\|\text{sudut\_kiri} - \text{sudut\_kanan}\|}$$

3. **Sinkronisasi Multi-Modal Audio-Visual**:
   - Interpolasi nilai MAR ke grid audio 10 ms CREPE dengan smoothing median 9-frame (~90 ms).
   - Grafik interaktif perbandingan deviasi nada (cent) terhadap bukaan mulut (MAR).
   - Galeri frame preview dengan visualisasi 4 titik warna landmark bibir.

4. **Modern React Frontend**:
   - Dibangun dengan **React 19**, **Vite**, **Tailwind CSS v4**, dan **Lucide Icons**.
   - Dilengkapi dropzone upload video (.mp4, .mov, .webm) dan tombol uji 1-klik dengan sample video bawaan (`VIDEO-2026-11-12-12-33-23.mov`).
   - Selector nada target dengan referensi frekuensi (Hz).
   - Ekspor arsip zip berisi 4 file CSV (`pitch.csv`, `faces.csv`, `mar.csv`, `pitch_mar_sync.csv`).

---

## 📁 Struktur Folder

```
vocalign_Project/
├── frontend/                     # Modern React + Vite Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx        # Navbar & modal info arsitektur model
│   │   │   ├── UploadSection.tsx # Dropzone video, note picker & stepper
│   │   │   ├── VerdictBanner.tsx # Kartu vonis evaluasi model (In-Tune/Flat/Sharp)
│   │   │   ├── InteractiveCharts.tsx # Grafik SVG interaktif cent & MAR
│   │   │   ├── KeypointGallery.tsx   # Galeri 4 titik landmark bibir
│   │   │   └── MetricsTable.tsx      # Tabel 15 parameter teknis & unduh ZIP
│   │   ├── types/index.ts        # Type definitions
│   │   ├── utils/music.ts        # Kalkulator frekuensi nada (Hz)
│   │   ├── App.tsx               # Main Dashboard App
│   │   └── main.tsx
│   ├── vite.config.ts            # Proxy otomatis ke backend localhost:8000
│   └── package.json
├── server.py                     # FastAPI REST API Backend
├── pipeline.py                   # Pipeline CREPE + YOLOv8 inference
├── lip-pose.pt                   # Bobot model pose bibir kustom
├── VIDEO-2026-11-12-12-33-23.mov # Sample video uji coba
├── start.bat                     # Script 1-klik untuk menjalankan backend & frontend
└── requirements.txt
```

---

## ⚡ Cara Menjalankan

### Cara Cepat (Windows):
Cukup klik ganda berkas `start.bat` di root project.

### Cara Manual:

1. **Jalankan Backend (FastAPI)**:
   ```bash
   # Masuk ke folder root
   .\.venv\Scripts\python.exe server.py
   ```
   Backend akan aktif di `http://127.0.0.1:8000` (dokumentasi Swagger di `http://127.0.0.1:8000/docs`).

2. **Jalankan Frontend (React + Vite)**:
   ```bash
   cd frontend
   npm run dev
   ```
   Buka browser di `http://localhost:5173`.
