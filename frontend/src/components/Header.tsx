import React, { useState } from 'react'
import { Activity, Cpu, Music2, Info, Sparkles, CheckCircle2, X } from 'lucide-react'

interface HeaderProps {
  backendConnected: boolean
}

export const Header: React.FC<HeaderProps> = ({ backendConnected }) => {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <>
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-indigo-600 via-violet-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Music2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-lg text-white tracking-tight">VocalAlign AI</h1>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Deep Learning
                </span>
              </div>
              <p className="text-xs text-slate-400">CREPE Pitch Estimation & YOLOv8 Lip Pose Tracking</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span className="text-slate-300">
                {backendConnected ? 'Engine Ready' : 'Connecting to Engine...'}
              </span>
            </div>

            <button
              onClick={() => setShowInfo(true)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition flex items-center space-x-1.5 text-xs font-medium"
              title="Informasi Arsitektur Model"
            >
              <Info className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Info Model</span>
            </button>
          </div>
        </div>
      </header>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Arsitektur Pipeline Deep Learning VocalAlign</h3>
                <p className="text-xs text-slate-400">Sinkronisasi Audio Multi-Modal & Visual Tracking</p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-slate-300">
              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <h4 className="font-semibold text-indigo-300 flex items-center space-x-2 mb-1.5">
                  <Activity className="w-4 h-4" />
                  <span>1. Audio Stream: CREPE CNN Pitch Estimation</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Audio diekstrak menjadi mono 16 kHz PCM menggunakan FFmpeg. Model deep convolutional <strong>CREPE</strong> memprediksi frekuensi dasar ($f_0$) setiap interval 10 ms (100 Hz). Frame tak bersuara disaring melalui threshold confidence $\ge 0.6$. Vibrato dinormalisasi dengan median filter 220 ms. Oktaf target disesuaikan secara global sehingga penyanyi yang bernyanyi 1 oktaf lebih rendah/tinggi tetap terhitung adil.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <h4 className="font-semibold text-emerald-300 flex items-center space-x-2 mb-1.5">
                  <Cpu className="w-4 h-4" />
                  <span>2. Visual Stream: YOLOv8 Face Detection & Lip-Pose Tracking</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Video dinormalisasi ke 30 FPS konstan. Model YOLOv8 WIDER FACE mendeteksi wajah penyanyi terbesar dan menstabilkan pergerakan crop wajah melalui interpolasi rolling mean. Model pose kustom <strong>lip-pose.pt</strong> mendeteksi 4 titik bibir presisi: <em>sudut kiri</em>, <em>sudut kanan</em>, <em>dalam atas</em>, dan <em>dalam bawah</em>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
                <h4 className="font-semibold text-pink-300 flex items-center space-x-2 mb-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>3. Mouth Aspect Ratio (MAR) & Audio-Visual Sync</span>
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Bukaan mulut dihitung rasio tanpa satuan: <code className="text-pink-300 font-mono">MAR = Vertical / Horizontal</code>. Nilai MAR diinterpolasi ke time-grid audio 10 ms CREPE dan dihaluskan, memungkinkan perbandingan langsung antara deviasi nada suara dan gerakan artikulasi bibir.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowInfo(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
