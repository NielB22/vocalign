import os
import sys
import io
import time
import uuid
import base64
import zipfile
import tempfile
import threading
from pathlib import Path
from dataclasses import replace

# Pastikan FFmpeg ditemukan di Windows (imageio-ffmpeg, sistem PATH, atau Cubase)
import shutil
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

# Batas thread komputasi
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
os.environ["TF_NUM_INTRAOP_THREADS"] = "1"
os.environ["TF_NUM_INTEROP_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MPLBACKEND"] = "Agg"

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse
import numpy as np
import cv2
from PIL import Image

import pipeline as p

app = FastAPI(title="VocalAlign API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache model agar tidak di-reload berulang kali
_face_model = None
_lip_model = None
_model_lock = threading.Lock()

def get_models():
    global _face_model, _lip_model
    with _model_lock:
        if _face_model is not None and _lip_model is not None:
            return _face_model, _lip_model
        
        import torch
        from huggingface_hub import hf_hub_download
        from ultralytics import YOLO

        torch.set_num_threads(1)
        lip_path = Path(__file__).parent / "lip-pose.pt"
        if not lip_path.is_file():
            raise FileNotFoundError("File lip-pose.pt tidak ditemukan di folder root project.")

        face_path = hf_hub_download(
            repo_id="arnabdhar/YOLOv8-Face-Detection", filename="model.pt"
        )
        face_model = YOLO(face_path)
        lip_model = YOLO(str(lip_path))

        if lip_model.task != "pose" or lip_model.names != {0: "mouth"}:
            raise ValueError("Bobot lip-pose.pt harus berupa model pose dengan kelas mouth.")

        face_model.to("cpu")
        lip_model.to("cpu")

        _face_model = face_model
        _lip_model = lip_model
        return _face_model, _lip_model

# Penyimpanan hasil download ZIP sementara di memori
_download_cache = {}

@app.get("/api/health")
def health_check():
    sample_file = Path(__file__).parent / "VIDEO-2026-11-12-12-33-23.mov"
    return {
        "status": "healthy",
        "has_sample_video": sample_file.exists(),
        "sample_video_name": sample_file.name if sample_file.exists() else None,
        "ffmpeg_available": shutil.which("ffmpeg") is not None,
    }

@app.get("/api/sample-video")
def get_sample_video():
    sample_file = Path(__file__).parent / "VIDEO-2026-11-12-12-33-23.mov"
    if not sample_file.exists():
        raise HTTPException(status_code=404, detail="Sample video not found")
    return FileResponse(
        path=str(sample_file),
        media_type="video/quicktime",
        filename="sample-video.mov"
    )

@app.post("/api/analyze")
async def analyze_video_endpoint(
    video: UploadFile = File(None),
    target_note: str = Form("D#4"),
    use_sample: bool = Form(False)
):
    note = target_note.strip()
    try:
        p.note_to_hz_safe(note)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    started = time.perf_counter()

    # Siapkan video bytes
    if use_sample:
        sample_file = Path(__file__).parent / "VIDEO-2026-11-12-12-33-23.mov"
        if not sample_file.exists():
            raise HTTPException(status_code=404, detail="File sample video tidak ditemukan.")
        video_bytes = sample_file.read_bytes()
        video_filename = sample_file.name
    elif video is not None:
        video_bytes = await video.read()
        video_filename = video.filename or "uploaded_video.mp4"
    else:
        raise HTTPException(status_code=400, detail="Tidak ada video yang diunggah atau dipilih.")

    # Load model
    try:
        face_model, lip_model = get_models()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memuat model deep learning: {str(e)}")

    with _model_lock, tempfile.TemporaryDirectory(prefix="vocalign_api_") as folder:
        folder_path = Path(folder)
        suffix = Path(video_filename).suffix.lower()
        if not suffix:
            suffix = ".mp4"
        temp_video_file = folder_path / f"input{suffix}"
        temp_video_file.write_bytes(video_bytes)

        cfg = replace(p.CFG, WORK_DIR=str(folder_path))

        # 1. Normalisasi video & ekstrak audio
        try:
            meta = p.prepare_input(str(temp_video_file), cfg=cfg)
            meta["target_note"] = note
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Gagal memproses file video/audio: {str(e)}")

        # 2. CREPE Pitch Extraction
        audio, sr = p.load_audio(meta)
        pitch_df, info = p.extract_pitch_vs_target(audio, sr, note, cfg=cfg)
        verdict = p.evaluate_note(pitch_df, info, cfg=cfg)

        # 3. Deteksi Wajah
        faces_df = p.run_face_detection(meta, face_model, cfg=cfg)

        # 4. Tracking Bibir & MAR
        lips_df = p.run_lip_tracking(meta, faces_df, lip_model, cfg=cfg)

        # 5. Sinkronisasi Pitch & MAR
        synced_df = p.sync_pitch_mar(pitch_df, lips_df, fps=meta["fps"])

        # Preview 4 frame bibir
        valid_lips = lips_df.loc[np.isfinite(lips_df["mar"])]
        previews = []
        if not valid_lips.empty:
            positions = np.unique(np.linspace(0, len(valid_lips) - 1, 4).astype(int))
            colors = [(255, 0, 0), (0, 100, 255), (0, 255, 0), (255, 255, 0)] # BGR
            for position in positions:
                row = valid_lips.iloc[position]
                frame = p.get_frame(meta, int(row["frame"]))
                if frame is None:
                    continue
                image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                for point, color in zip(p.LIP_ORDER, colors):
                    if f"{point}_x" in row and f"{point}_y" in row and np.isfinite(row[f"{point}_x"]):
                        xy = (int(row[f"{point}_x"]), int(row[f"{point}_y"]))
                        cv2.circle(image, xy, 4, color, -1)
                        cv2.circle(image, xy, 5, (255, 255, 255), 1)

                # Crop sekitar bibir/wajah agar preview fokus
                img_h, img_w = image.shape[:2]
                face_row = faces_df[faces_df["frame"] == int(row["frame"])]
                if not face_row.empty and bool(face_row.iloc[0]["detected"]):
                    fx1, fy1, fx2, fy2 = int(face_row.iloc[0]["x1"]), int(face_row.iloc[0]["y1"]), int(face_row.iloc[0]["x2"]), int(face_row.iloc[0]["y2"])
                    # Beri margin
                    pad = 20
                    fx1 = max(0, fx1 - pad)
                    fy1 = max(0, fy1 - pad)
                    fx2 = min(img_w, fx2 + pad)
                    fy2 = min(img_h, fy2 + pad)
                    crop_preview = image[fy1:fy2, fx1:fx2]
                else:
                    crop_preview = image

                image_buffer = io.BytesIO()
                Image.fromarray(crop_preview).save(image_buffer, format="JPEG", quality=90)
                image_base64 = "data:image/jpeg;base64," + base64.b64encode(image_buffer.getvalue()).decode("ascii")

                previews.append({
                    "image": image_base64,
                    "caption": f"{row['t']:.2f}s · MAR {row['mar']:.3f}",
                    "t": round(float(row["t"]), 2),
                    "mar": round(float(row["mar"]), 3),
                    "frame": int(row["frame"])
                })

        # Archive ZIP in memory
        archive_bytes = io.BytesIO()
        with zipfile.ZipFile(archive_bytes, "w", zipfile.ZIP_DEFLATED) as archive:
            for filename, df in (
                ("pitch.csv", pitch_df),
                ("faces.csv", faces_df),
                ("mar.csv", lips_df),
                ("pitch_mar_sync.csv", synced_df),
            ):
                archive.writestr(filename, df.to_csv(index=False))

        download_id = str(uuid.uuid4())
        _download_cache[download_id] = {
            "bytes": archive_bytes.getvalue(),
            "created_at": time.time()
        }

        # Bersihkan cache lama jika > 20 item
        if len(_download_cache) > 20:
            oldest_key = min(_download_cache.keys(), key=lambda k: _download_cache[k]["created_at"])
            _download_cache.pop(oldest_key, None)

        total_time = round(time.perf_counter() - started, 2)

        summary = {
            "target_note": note,
            "ref_note": info["ref_note"],
            "octave_shift": info["octave_shift"],
            "video_duration_s": round(float(meta["video_duration"]), 3),
            "audio_duration_s": round(float(meta["audio_duration"]), 3),
            "total_frames": len(lips_df),
            "faces_detected": int(faces_df["detected"].sum()),
            "lips_detected": int(lips_df["lip_detected"].sum()),
            "valid_mar_frames": len(valid_lips),
            "crepe_samples": len(pitch_df),
            "stable_samples": int(pitch_df["stable"].sum()),
            "stable_in_tune_samples": int((pitch_df["stable"] & pitch_df["status"].eq("in-tune")).sum()),
            "synced_samples": int(synced_df["mar_smooth"].notna().sum()),
            "mar_median": round(float(valid_lips["mar"].median()), 3) if not valid_lips.empty else None,
            "processing_time_s": total_time,
        }

        # Format data chart (convert NaN ke None)
        chart_records = []
        for _, r in synced_df.iterrows():
            cent_val = float(r["cent"]) if np.isfinite(r["cent"]) else None
            mar_smooth_val = float(r["mar_smooth"]) if np.isfinite(r["mar_smooth"]) else None
            mar_interp_val = float(r["mar_interp"]) if np.isfinite(r["mar_interp"]) else None
            f0_val = float(r["f0"]) if np.isfinite(r["f0"]) else None
            chart_records.append({
                "t": round(float(r["t"]), 3),
                "cent": round(cent_val, 2) if cent_val is not None else None,
                "status": str(r["status"]),
                "stable": bool(r["stable"]),
                "f0": round(f0_val, 1) if f0_val is not None else None,
                "confidence": round(float(r["confidence"]), 2) if np.isfinite(r["confidence"]) else 0,
                "mar_smooth": round(mar_smooth_val, 3) if mar_smooth_val is not None else None,
                "mar_interp": round(mar_interp_val, 3) if mar_interp_val is not None else None,
            })

        return {
            "summary": summary,
            "verdict": verdict,
            "info": info,
            "previews": previews,
            "charts": chart_records,
            "download_id": download_id
        }

@app.get("/api/download/{download_id}")
def download_archive(download_id: str):
    if download_id not in _download_cache:
        raise HTTPException(status_code=404, detail="Arsip hasil tidak ditemukan atau sudah kadaluarsa.")
    data = _download_cache[download_id]["bytes"]
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="vocalign_hasil_analisis.zip"'}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
