import React from 'react'
import type { PreviewFrame } from '../types'
import { Camera } from 'lucide-react'

interface KeypointGalleryProps {
  previews: PreviewFrame[]
  marMedian?: number | null
}

export const KeypointGallery: React.FC<KeypointGalleryProps> = ({ previews, marMedian }) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center space-x-2">
            <Camera className="w-5 h-5 text-indigo-400" />
            <span>Visualisasi Landmark Bibir (YOLOv8 Pose)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            4 titik bibir yang dideteksi oleh model <code className="text-indigo-300">lip-pose.pt</code> untuk menghitung MAR
          </p>
        </div>

        {marMedian !== undefined && marMedian !== null && (
          <div className="px-3.5 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs font-semibold text-violet-300">
            Median MAR Keseluruhan: <span className="text-white font-mono">{marMedian}</span>
          </div>
        )}
      </div>

      {/* Legend & Formula Bar */}
      <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-4">
          <span className="text-slate-400 font-semibold">Legenda Titik:</span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500 border border-white" />
            <span className="text-slate-300">Sudut Kiri</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-red-400 border border-white" />
            <span className="text-slate-300">Sudut Kanan</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 border border-white" />
            <span className="text-slate-300">Dalam Atas</span>
          </span>
          <span className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-yellow-400 border border-white" />
            <span className="text-slate-300">Dalam Bawah</span>
          </span>
        </div>

        <div className="text-slate-400 font-mono text-[11px] bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-700/50">
          MAR = Vertikal (Atas-Bawah) / Horizontal (Kiri-Kanan)
        </div>
      </div>

      {/* Frame Gallery Grid */}
      {previews && previews.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {previews.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden group hover:border-indigo-500/50 transition shadow-lg"
            >
              <div className="aspect-square relative overflow-hidden bg-black flex items-center justify-center">
                <img
                  src={item.image}
                  alt={item.caption}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-mono text-slate-300 border border-white/10">
                  Frame #{item.frame}
                </div>
              </div>
              <div className="p-3 text-center border-t border-slate-800/80">
                <p className="text-xs font-semibold text-slate-200">{item.caption}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  t = {item.t}s · MAR = {item.mar}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-slate-400 border border-dashed border-slate-800 rounded-2xl">
          Belum ada frame dengan MAR valid yang terdeteksi.
        </div>
      )}
    </div>
  )
}
