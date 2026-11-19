"""Fungsi analisis dari vocalign_pipeline (2).ipynb untuk uji deployment CPU."""
# Modul ini berisi pengukuran audio dan visual yang dipanggil oleh app.py.
# Hasil berupa tabel per waktu sehingga dapat dipakai untuk grafik dan evaluasi.

# --- 0. Dependensi dan konfigurasi pengukuran ---
import os
import shutil
import subprocess
import time
from dataclasses import dataclass

# Pastikan FFmpeg ditemukan di Windows (imageio-ffmpeg, sistem PATH, atau Cubase)
if not shutil.which("ffmpeg"):
    try:
        import imageio_ffmpeg
        ffmpeg_bin = imageio_ffmpeg.get_ffmpeg_exe()
        ffmpeg_dir = os.path.dirname(ffmpeg_bin)
        target_ffmpeg = os.path.join(ffmpeg_dir, "ffmpeg.exe")
        if not os.path.exists(target_ffmpeg):
            shutil.copy2(ffmpeg_bin, target_ffmpeg)
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
    except Exception:
        pass

if not shutil.which("ffmpeg"):
    cubase_ffmpeg = r"C:\Program Files\Steinberg\Cubase 13\Externals\FFmpeg\5.1.1"
    if os.path.exists(os.path.join(cubase_ffmpeg, "ffmpeg.exe")):
        os.environ["PATH"] = cubase_ffmpeg + os.pathsep + os.environ.get("PATH", "")

import cv2
import numpy as np
import pandas as pd
import soundfile as sf
import librosa
import crepe
from scipy.signal import medfilt

@dataclass
class Config:
    # --- Path ---
    BASE_DIR: str = "."  # dataset (MIR-1K, Opera)
    MODEL_DIR: str = "models"  # bobot YOLO hasil training (persisten)
    WORK_DIR: str = "work"  # file sementara hasil olahan (hilang saat sesi habis)

    # --- Input layer ---
    SR: int = 16000          # sampling rate audio untuk CREPE
    VIDEO_FPS: int = 30      # video dinormalisasi ke frame rate konstan

    # --- Audio stream (dipakai di Tahap 2) ---
    CREPE_MODEL: str = "small"
    CREPE_STEP_MS: int = 10       # resolusi 10 ms / 100 Hz (sesuai dokumen)
    CONF_THRESHOLD: float = 0.6   # frame dengan confidence di bawah ini = unvoiced
    MIN_F0_HZ: float = 60.0
    CENT_TOLERANCE: float = 25.0  # batas in-tune (± cent)
    SMOOTH_VIBRATO: bool = True   # median filter untuk meredam vibrato
    VIBRATO_WINDOW_MS: int = 220  # lebar jendela median filter (dalam ms, bukan jumlah frame)

    # --- Penilaian terhadap nada target ---
    ATTACK_IGNORE_MS: int = 200     # abaikan awal tiap segmen suara (masih "meluncur" ke nada)
    WRONG_NOTE_CENT: float = 100.0  # meleset > 1 semitone dari target = nada salah

    # --- Visual stream: deteksi wajah (Tahap 3) ---
    FACE_MODEL_REPO: str = "arnabdhar/YOLOv8-Face-Detection"  # YOLOv8 pretrained WIDER FACE
    FACE_MODEL_FILE: str = "model.pt"
    FACE_CONF: float = 0.5     # minimal confidence deteksi wajah
    FACE_MARGIN: float = 0.15  # padding crop wajah (15% tiap sisi) untuk Tahap 4
    YOLO_DEVICE: str = "cpu"     # "0" = GPU pertama, "cpu" = paksa CPU (cadangan jika GPU bermasalah)

    # --- Visual stream: keypoint bibir (Tahap 4.6) ---
    LIP_MODEL_FILE: str = "lip-pose.pt"
    LIP_IMGSZ: int = 256
    LIP_CONF: float = 0.25
    BBOX_SMOOTH_FRAMES: int = 5
    MOUTH_EXPECTED_XY: tuple = (0.5, 0.72)

# Konfigurasi default dipakai oleh fungsi. app.py membuat salinan dengan WORK_DIR
# khusus untuk setiap upload melalui dataclasses.replace().
CFG = Config()

# --- 1. Persiapan video, audio, dan timestamp ---
# FFmpeg menghasilkan audio 16 kHz untuk CREPE serta video 30 fps untuk YOLO.
# Timestamp frame hasil normalisasi dihitung dari indeks frame dibagi FPS.
def run_ffmpeg(args):
    """Menjalankan ffmpeg; melempar error yang jelas jika gagal."""
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg gagal:\n{result.stderr.strip()}")

def prepare_input(video_path, cfg=CFG):
    """
    Memecah satu file video menjadi:
      - audio_16k.wav  : mono, 16 kHz, PCM 16-bit (siap untuk CREPE)
      - video_cfr.mp4  : tanpa audio, frame rate konstan cfg.VIDEO_FPS

    Kenapa dinormalisasi ke frame rate konstan?
    Rekaman browser (.webm dari MediaRecorder) umumnya variable frame rate
    dan metadata FPS-nya sering salah. Dengan FPS konstan, timestamp frame
    ke-i cukup dihitung i / fps, sehingga sinkronisasi dengan audio akurat.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"File tidak ditemukan: {video_path}")

    stem = os.path.splitext(os.path.basename(video_path))[0]
    out_dir = os.path.join(cfg.WORK_DIR, stem)
    os.makedirs(out_dir, exist_ok=True)
    audio_out = os.path.join(out_dir, "audio_16k.wav")
    video_out = os.path.join(out_dir, "video_cfr.mp4")

    # (a) Ekstraksi audio
    try:
        run_ffmpeg(["-i", video_path, "-vn", "-ac", "1", "-ar", str(cfg.SR),
                    "-c:a", "pcm_s16le", audio_out])
    except RuntimeError as e:
        raise RuntimeError("Video tidak memiliki trek audio atau audio rusak.\n" + str(e))

    # (b) Normalisasi video ke frame rate konstan
    run_ffmpeg(["-i", video_path, "-an", "-vf", f"fps={cfg.VIDEO_FPS}",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", video_out])

    # (c) Metadata dari file hasil normalisasi (lebih andal daripada file asli)
    cap = cv2.VideoCapture(video_out)
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    if n_frames < 1:
        raise ValueError("Video tidak memiliki frame yang dapat dibaca.")

    audio_info = sf.info(audio_out)
    meta = {
        "source": video_path,
        "audio_path": audio_out,
        "video_path": video_out,
        "fps": cfg.VIDEO_FPS,
        "n_frames": n_frames,
        "resolution": (width, height),
        "video_duration": n_frames / cfg.VIDEO_FPS,
        "audio_duration": audio_info.duration,
        "audio_sr": audio_info.samplerate,
    }
    return meta

def iter_frames(meta):
    """
    Generator frame video: (index, timestamp_detik, frame_BGR).
    Dibaca satu per satu supaya hemat memori untuk video panjang.
    """
    cap = cv2.VideoCapture(meta["video_path"])
    idx = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            yield idx, idx / meta["fps"], frame
            idx += 1
    finally:
        cap.release()

# --- 2. Pengukuran pitch dan penilaian terhadap nada acuan ---
# f0 adalah frekuensi dasar suara dalam Hz. Voiced menandai sampel yang lolos
# ambang confidence dan frekuensi. Sampel yang gagal memperoleh f0 dan cent NaN.
def load_audio(meta):
    """Membaca audio hasil Tahap 1 sebagai float32 mono."""
    audio, sr = sf.read(meta["audio_path"], dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    return audio, sr

def _odd_kernel(window_ms, step_ms):
    """Mengubah lebar jendela (ms) menjadi ukuran kernel ganjil (frame)."""
    k = max(3, int(round(window_ms / step_ms)))
    return k if k % 2 == 1 else k + 1

def _voiced_segments(voiced):
    """Memecah indeks frame voiced menjadi segmen-segmen yang bersambung."""
    idx = np.flatnonzero(voiced)
    if idx.size == 0:
        return []
    breaks = np.where(np.diff(idx) > 1)[0] + 1
    return np.split(idx, breaks)

def smooth_voiced_segments(f0, voiced, kernel):
    """Median filter hanya di dalam segmen voiced (meredam vibrato)."""
    out = f0.copy()
    for seg in _voiced_segments(voiced):
        if seg.size < 3:
            continue
        k = min(kernel, seg.size if seg.size % 2 == 1 else seg.size - 1)
        out[seg] = medfilt(f0[seg], kernel_size=k)
    return out

def mark_stable(voiced, step_ms, attack_ms):
    """
    Frame 'stabil' = frame voiced setelah melewati attack_ms pertama tiap segmen.
    Awal nada diabaikan karena suara biasanya masih meluncur menuju nada target.
    """
    # Label stable menjadi mask penilaian setelah awal segmen dilewati.
    # Mask ini ditentukan dari voiced dan waktu, tanpa mengukur variasi pitch.
    stable = np.zeros_like(voiced, dtype=bool)
    skip = int(round(attack_ms / step_ms))
    for seg in _voiced_segments(voiced):
        stable[seg[skip:]] = True
    return stable

def note_to_hz_safe(note):
    try:
        return float(librosa.note_to_hz(note))
    except Exception:
        raise ValueError(f"Nama nada tidak valid: {note!r}. Contoh: 'C4', 'D#4', 'Eb3'")

def extract_pitch_vs_target(audio, sr, target_note, cfg=CFG):
    """
    1) CREPE -> f0 & confidence per cfg.CREPE_STEP_MS
    2) Buang frame unvoiced, median filter (opsional)
    3) Tentukan oktaf yang dinyanyikan (sekali, dari median bagian stabil)
       -> nada acuan = target yang digeser ke oktaf tersebut
    4) cent = 1200 * log2(f0 / f_acuan)
    5) Status per frame: in-tune / flat / sharp / nada-salah / unvoiced
    """
    f_target = note_to_hz_safe(target_note)

    # Viterbi memilih lintasan pitch yang berkesinambungan sepanjang audio.
    t, f0_raw, conf, _ = crepe.predict(
        audio, sr,
        model_capacity=cfg.CREPE_MODEL,
        step_size=cfg.CREPE_STEP_MS,
        viterbi=True,
        verbose=0,
    )

    voiced = (conf >= cfg.CONF_THRESHOLD) & (f0_raw > cfg.MIN_F0_HZ)

    # Simpan f0_raw untuk inspeksi. f0 menjadi versi yang dihaluskan per segmen suara.
    f0 = f0_raw.astype(float).copy()
    if cfg.SMOOTH_VIBRATO:
        f0 = smooth_voiced_segments(f0, voiced, _odd_kernel(cfg.VIBRATO_WINDOW_MS, cfg.CREPE_STEP_MS))
    f0[~voiced] = np.nan

    stable = mark_stable(voiced, cfg.CREPE_STEP_MS, cfg.ATTACK_IGNORE_MS)

    # Oktaf: ditentukan SEKALI untuk seluruh rekaman, supaya tidak "loncat" per frame
    cent_vs_target = 1200.0 * np.log2(f0 / f_target)
    ref = cent_vs_target[stable] if stable.any() else cent_vs_target[voiced]
    octave_shift = int(np.round(np.median(ref) / 1200.0)) if ref.size else 0
    f_ref = f_target * (2.0 ** octave_shift)

    # Cent positif berarti lebih tinggi dari acuan, cent negatif berarti lebih rendah.
    # Selisih 100 cent setara satu semitone dan 1.200 cent setara satu oktaf.
    cent = 1200.0 * np.log2(f0 / f_ref)

    tol, wrong = cfg.CENT_TOLERANCE, cfg.WRONG_NOTE_CENT
    abs_c = np.abs(cent)
    status = np.full(len(t), "unvoiced", dtype=object)
    status[voiced & (abs_c <= tol)] = "in-tune"
    status[voiced & (cent < -tol) & (abs_c <= wrong)] = "flat"
    status[voiced & (cent > tol) & (abs_c <= wrong)] = "sharp"
    status[voiced & (abs_c > wrong)] = "nada-salah"

    # df berisi pengukuran tiap 10 ms. info mencatat target serta acuan setelah
    # penyesuaian oktaf agar hasil selanjutnya bisa dijelaskan dengan konsisten.
    df = pd.DataFrame({
        "t": t,
        "f0_raw": f0_raw,
        "confidence": conf,
        "voiced": voiced,
        "stable": stable,
        "f0": f0,
        "cent": cent,
        "status": status,
    })
    info = {
        "target_note": target_note,
        "f_target_hz": f_target,
        "octave_shift": octave_shift,
        "ref_note": librosa.hz_to_note(f_ref),
        "f_ref_hz": f_ref,
    }
    return df, info

def evaluate_note(df, info, cfg=CFG):
    """Vonis akhir dari frame STABIL, memakai median cent (tahan terhadap outlier)."""
    s = df[df["stable"]]
    if s.empty:
        return {"pesan": "Tidak ada nada stabil terdeteksi. Nyanyikan nada lebih panjang/keras."}

    med = float(s["cent"].median())
    tol, wrong = cfg.CENT_TOLERANCE, cfg.WRONG_NOTE_CENT
    if abs(med) <= tol:
        vonis = "IN-TUNE (tepat nada)"
    elif abs(med) > wrong:
        vonis = "NADA SALAH (meleset lebih dari 1 semitone)"
    elif med < 0:
        vonis = "FLAT (terlalu rendah)"
    else:
        vonis = "SHARP (terlalu tinggi)"

    shift = info["octave_shift"]
    catatan_oktaf = "-" if shift == 0 else (
        f"Dinyanyikan {abs(shift)} oktaf lebih {'rendah' if shift < 0 else 'tinggi'} "
        f"dari target (wajar, tidak dihitung fals)")

    # Vonis memakai median cent, sedangkan persentase menghitung status semua
    # sampel stable. Keduanya menggambarkan aspek penilaian yang berbeda.
    # goyangan_cent adalah simpangan baku, sehingga selisih oktaf ikut memperbesarnya.
    return {
        "nada_target": f'{info["target_note"]} ({info["f_target_hz"]:.1f} Hz)',
        "nada_acuan": f'{info["ref_note"]} ({info["f_ref_hz"]:.1f} Hz)',
        "catatan_oktaf": catatan_oktaf,
        "median_cent": round(med, 1),
        "VONIS": vonis,
        "in_tune_%": round(100 * (s["status"] == "in-tune").mean(), 1),
        "flat_%": round(100 * (s["status"] == "flat").mean(), 1),
        "sharp_%": round(100 * (s["status"] == "sharp").mean(), 1),
        "nada_salah_%": round(100 * (s["status"] == "nada-salah").mean(), 1),
        "goyangan_cent": round(float(s["cent"].std()), 1),
        "durasi_stabil_s": round(len(s) * cfg.CREPE_STEP_MS / 1000, 2),
    }

# --- 3. Deteksi wajah dan pengambilan frame ---
# Bounding box disimpan per frame sebagai acuan posisi crop untuk model bibir.
def detect_face(model, frame, cfg=None):
    """
    Deteksi wajah pada satu frame BGR.
    Jika ada lebih dari satu wajah, ambil yang bbox-nya TERBESAR
    (diasumsikan penyanyi, karena paling dekat ke kamera).
    """
    cfg = cfg or CFG
    res = model(frame, conf=cfg.FACE_CONF, device=cfg.YOLO_DEVICE, verbose=False)[0]
    if res.boxes is None or len(res.boxes) == 0:
        return None
    boxes = res.boxes.xyxy.cpu().numpy()
    confs = res.boxes.conf.cpu().numpy()
    areas = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
    i = int(np.argmax(areas))
    x1, y1, x2, y2 = boxes[i]
    return {"x1": float(x1), "y1": float(y1), "x2": float(x2), "y2": float(y2),
            "conf": float(confs[i]), "n_faces": int(len(boxes))}

# Fungsi bantu ini memotong bbox pada batas gambar. Alur tracking bibir di bawah
# memakai square_crop dengan padding agar geometri crop mengikuti data training.
def crop_face(frame, det, cfg=None):
    """
    Crop wajah berbentuk persegi dengan padding (FACE_MARGIN).
    Persegi dipilih supaya proporsi wajah tidak terdistorsi saat di-resize di Tahap 4.
    Mengembalikan (gambar_crop, (xa, ya, xb, yb)) dalam koordinat frame asli.
    """
    cfg = cfg or CFG
    h, w = frame.shape[:2]
    cx, cy = (det["x1"] + det["x2"]) / 2, (det["y1"] + det["y2"]) / 2
    side = max(det["x2"] - det["x1"], det["y2"] - det["y1"]) * (1 + 2 * cfg.FACE_MARGIN)
    xa, ya = int(max(0, cx - side / 2)), int(max(0, cy - side / 2))
    xb, yb = int(min(w, cx + side / 2)), int(min(h, cy + side / 2))
    return frame[ya:yb, xa:xb], (xa, ya, xb, yb)

def run_face_detection(meta, model, cfg=None):
    """Jalankan deteksi wajah ke seluruh frame video, simpan ke faces.csv."""
    cfg = cfg or CFG
    rows = []
    t0 = time.time()
    for idx, t, frame in iter_frames(meta):
        det = detect_face(model, frame, cfg)
        if det is None:
            rows.append({"frame": idx, "t": t, "detected": False, "x1": np.nan, "y1": np.nan,
                         "x2": np.nan, "y2": np.nan, "conf": np.nan, "n_faces": 0})
        else:
            rows.append({"frame": idx, "t": t, "detected": True, **det})
    elapsed = time.time() - t0

    df = pd.DataFrame(rows)
    out_csv = os.path.join(os.path.dirname(meta["video_path"]), "faces.csv")
    df.to_csv(out_csv, index=False)
    print(f"Deteksi selesai: {len(df)} frame dalam {elapsed:.1f} s "
          f"({len(df) / max(elapsed, 1e-6):.1f} FPS) -> {out_csv}")
    return df

def get_frame(meta, idx):
    """Ambil satu frame berdasarkan index (untuk visualisasi)."""
    cap = cv2.VideoCapture(meta["video_path"])
    cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
    ok, frame = cap.read()
    cap.release()
    return frame if ok else None

# --- 4. Crop wajah, keypoint bibir, dan perhitungan MAR ---
# Urutan titik mengikuti label training. LIP_ORDER didefinisikan di akhir modul.
def square_crop(img, cx, cy, side, out):
    """
    SAMA PERSIS dengan fungsi di Tahap 4.3 (training): crop persegi, padding hitam
    jika keluar batas (bukan digeser). Data nyata jadi identik dengan data latih.
    """
    s = int(round(side))
    x0, y0 = int(round(cx - side / 2)), int(round(cy - side / 2))
    h, w = img.shape[:2]
    pad_l, pad_t = max(0, -x0), max(0, -y0)
    pad_r, pad_b = max(0, x0 + s - w), max(0, y0 + s - h)
    if pad_l or pad_t or pad_r or pad_b:
        img = cv2.copyMakeBorder(img, pad_t, pad_b, pad_l, pad_r, cv2.BORDER_CONSTANT, value=0)
    crop = img[y0 + pad_t: y0 + pad_t + s, x0 + pad_l: x0 + pad_l + s]
    crop = cv2.resize(crop, (out, out), interpolation=cv2.INTER_AREA)
    # Offset dan skala diperlukan untuk mengembalikan titik prediksi ke frame asli.
    return crop, x0, y0, out / s

def smooth_face_track(df_face, cfg=None):
    """
    Bbox wajah dari Tahap 3 sedikit bergetar antar-frame. Diubah jadi pusat (cx, cy)
    + ukuran (side), frame tanpa wajah diisi interpolasi, lalu dihaluskan dengan
    rata-rata bergerak supaya titik bibir tidak ikut bergetar.
    """
    cfg = cfg or CFG
    d = df_face[["frame", "t", "detected"]].copy()
    d["cx"] = (df_face["x1"] + df_face["x2"]) / 2
    d["cy"] = (df_face["y1"] + df_face["y2"]) / 2
    d["side"] = np.maximum(df_face["x2"] - df_face["x1"], df_face["y2"] - df_face["y1"])
    # Interpolasi bbox mengisi frame tanpa wajah dengan posisi perkiraan dari track.
    # Rolling mean meredam getaran posisi sebelum crop dipakai untuk inferensi bibir.
    for c in ("cx", "cy", "side"):
        d[c] = (d[c].interpolate(limit_direction="both")
                    .rolling(cfg.BBOX_SMOOTH_FRAMES, center=True, min_periods=1).mean())
    return d

def predict_lips(model, crop, cfg=None):
    """
    Prediksi 4 titik bibir pada crop wajah.
    Jika ada >1 deteksi mulut, pilih yang PALING DEKAT ke posisi mulut yang wajar
    (bukan confidence tertinggi) -> menghindari salah wajah seperti di evaluasi 4.5.
    """
    cfg = cfg or CFG
    r = model(crop, imgsz=cfg.LIP_IMGSZ, conf=cfg.LIP_CONF, device=cfg.YOLO_DEVICE, verbose=False)[0]
    if r.boxes is None or len(r.boxes) == 0 or r.keypoints is None:
        return None
    centers = r.boxes.xywh[:, :2].cpu().numpy()
    target = np.array(cfg.MOUTH_EXPECTED_XY) * cfg.LIP_IMGSZ
    j = int(np.argmin(np.linalg.norm(centers - target, axis=1)))
    return {"kp": r.keypoints.xy[j].cpu().numpy(),         # (4, 2) px dalam crop
            "conf": float(r.boxes.conf[j]),
            "n_mouth": int(len(r.boxes))}

def mar_from_kp(kp):
    # Empat titik harus memiliki koordinat lengkap untuk menghasilkan rasio valid.
    # MAR = jarak bibir dalam atas-bawah / jarak kedua sudut bibir.
    # Rasio ini tidak memiliki satuan dan tetap sama ketika crop diperbesar seragam.
    if kp.shape != (4, 2) or not np.isfinite(kp).all() or (kp == 0).all(axis=1).any():
        return np.nan
    v = np.linalg.norm(kp[2] - kp[3])   # bibir dalam atas - bawah
    h = np.linalg.norm(kp[0] - kp[1])   # sudut kiri - kanan
    return v / h if h > 0 else np.nan

def run_lip_tracking(meta, df_face, model, cfg=None):
    """Seluruh frame: bbox halus -> crop -> 4 titik -> kembali ke koordinat frame -> MAR."""
    cfg = cfg or CFG
    track = smooth_face_track(df_face, cfg).set_index("frame")
    rows = []
    t0 = time.time()
    for idx, t, frame in iter_frames(meta):
        rec = {"frame": idx, "t": t, "lip_detected": False, "conf": np.nan, "mar": np.nan}
        f = track.loc[idx] if idx in track.index else None
        if f is not None and not np.isnan(f["side"]):
            crop, x0, y0, scale = square_crop(frame, f["cx"], f["cy"],
                                              f["side"] * (1 + 2 * cfg.FACE_MARGIN), cfg.LIP_IMGSZ)
            p = predict_lips(model, crop, cfg)
            if p is not None:
                kp_frame = p["kp"] / scale + np.array([x0, y0])   # crop -> koordinat frame asli
                rec.update({"lip_detected": True, "conf": p["conf"], "mar": mar_from_kp(p["kp"])})
                for k, n in enumerate(LIP_ORDER):
                    rec[f"{n}_x"], rec[f"{n}_y"] = kp_frame[k]
        rows.append(rec)
    elapsed = time.time() - t0

    # Satu baris tetap disimpan untuk setiap frame, termasuk ketika deteksi gagal.
    # lip_detected menunjukkan adanya prediksi, sedangkan MAR valid dicek lewat NaN.
    df = pd.DataFrame(rows)
    out_csv = os.path.join(os.path.dirname(meta["video_path"]), "mar.csv")
    df.to_csv(out_csv, index=False)
    print(f"Tracking bibir selesai: {len(df)} frame dalam {elapsed:.1f} s "
          f"({len(df) / max(elapsed, 1e-6):.1f} FPS) -> {out_csv}")
    return df

# --- 5. Sinkronisasi bukaan mulut dengan sampel audio ---
# CREPE memiliki grid 10 ms, sementara video 30 fps berjarak sekitar 33 ms.
# MAR diinterpolasi ke grid audio, lalu dihaluskan dengan median 9 sampel (~90 ms).
# Timestamp diasumsikan memiliki awal yang sama dari hasil prepare_input().
def sync_pitch_mar(df_pitch, df_lip, fps, smooth_frames=9):
    t_audio = df_pitch["t"].to_numpy(dtype=float)
    t_video = df_lip["t"].to_numpy(dtype=float)
    frame = df_lip["frame"].to_numpy()
    mar = df_lip["mar"].to_numpy(dtype=float)

    for t in (t_audio, t_video):
        if not np.isfinite(t).all() or (np.diff(t) <= 0).any():
            raise ValueError("Timestamp harus valid dan berurutan tanpa duplikat.")

    valid = (
        df_lip["lip_detected"].to_numpy(dtype=bool)
        & np.isfinite(mar)
        & (mar >= 0)
    )
    idx = np.flatnonzero(valid)

    # Putus blok ketika ada frame yang hilang atau jeda waktu yang besar.
    putus = np.flatnonzero(
        (np.diff(frame[idx]) != 1) | (np.diff(t_video[idx]) > 1.5 / fps)
    ) + 1

    mar_interp = np.full(len(t_audio), np.nan)
    mar_smooth = np.full(len(t_audio), np.nan)

    # Pisahkan rangkaian frame valid agar jeda deteksi tetap kosong.
    for blok in np.split(idx, putus):
        if blok.size == 0:
            continue

        t_blok = t_video[blok]
        dalam_blok = (t_audio >= t_blok[0] - 1e-9) & (t_audio <= t_blok[-1] + 1e-9)
        # Interpolasi berlaku di antara timestamp pertama dan terakhir setiap blok.
        nilai = np.interp(t_audio[dalam_blok], t_blok, mar[blok])

        # Simpan versi interpolasi serta versi halus untuk inspeksi dan grafik.
        mar_interp[dalam_blok] = nilai
        mar_smooth[dalam_blok] = (
            pd.Series(nilai)
            .rolling(smooth_frames, center=True, min_periods=1)
            .median()
            .to_numpy()
        )

    return df_pitch.assign(mar_interp=mar_interp, mar_smooth=mar_smooth)

# Nama dan urutan kolom koordinat mengikuti empat keypoint pada dataset training.
LIP_ORDER = ["sudut_kiri", "sudut_kanan", "dalam_atas", "dalam_bawah"]
