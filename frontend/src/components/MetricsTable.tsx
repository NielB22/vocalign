import React from 'react'
import type { SummaryMetrics } from '../types'
import { Download, Table, FileSpreadsheet } from 'lucide-react'

interface MetricsTableProps {
  summary: SummaryMetrics
  downloadId: string
}

export const MetricsTable: React.FC<MetricsTableProps> = ({ summary, downloadId }) => {
  const rows = [
    { label: 'Nada Target', value: summary.target_note },
    { label: 'Nada Acuan Setelah Oktaf', value: summary.ref_note },
    { label: 'Pergeseran Oktaf', value: summary.octave_shift === 0 ? '0 (Sesuai)' : `${summary.octave_shift} Oktaf` },
    { label: 'Durasi Video', value: `${summary.video_duration_s} detik` },
    { label: 'Durasi Audio', value: `${summary.audio_duration_s} detik` },
    { label: 'Total Frame Video (30 FPS)', value: summary.total_frames.toLocaleString() },
    { label: 'Wajah Terdeteksi (YOLO Face)', value: `${summary.faces_detected} frame (${Math.round((summary.faces_detected / summary.total_frames) * 100)}%)` },
    { label: 'Bibir Terdeteksi (lip-pose.pt)', value: `${summary.lips_detected} frame (${Math.round((summary.lips_detected / summary.total_frames) * 100)}%)` },
    { label: 'Frame MAR Valid', value: `${summary.valid_mar_frames} frame` },
    { label: 'Sampel Pitch CREPE (10 ms)', value: summary.crepe_samples.toLocaleString() },
    { label: 'Sampel Vokal Stabil', value: `${summary.stable_samples} sampel` },
    { label: 'Sampel Stabil & Tepat (In-Tune)', value: `${summary.stable_in_tune_samples} sampel` },
    { label: 'Sampel Tersinkronisasi Pitch & MAR', value: `${summary.synced_samples} sampel` },
    { label: 'Median Bukaan Mulut (MAR)', value: summary.mar_median ?? '-' },
    { label: 'Waktu Komputasi Total', value: `${summary.processing_time_s} detik` },
  ]

  const handleDownload = () => {
    window.location.href = `/api/download/${downloadId}`
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center space-x-2">
            <Table className="w-5 h-5 text-indigo-400" />
            <span>Tabel Ringkasan Pengukuran Teknis</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Data statistik komputasi model audio (CREPE) dan visual (YOLO Face & Pose)
          </p>
        </div>

        <button
          onClick={handleDownload}
          className="px-4 py-2.5 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold transition shadow-lg shadow-emerald-600/20 flex items-center space-x-2 cursor-pointer hover:scale-[1.02]"
        >
          <Download className="w-4 h-4" />
          <span>Download Hasil CSV (.ZIP)</span>
        </button>
      </div>

      <div className="border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-800/60 border-b border-slate-800 text-slate-300 font-semibold">
              <th className="py-3 px-4">Parameter Pengukuran</th>
              <th className="py-3 px-4 text-right">Hasil Komputasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map((row, index) => (
              <tr
                key={index}
                className={index % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-850/30 hover:bg-slate-800/40'}
              >
                <td className="py-2.5 px-4 text-slate-300 font-medium">{row.label}</td>
                <td className="py-2.5 px-4 text-right text-white font-mono font-semibold">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 rounded-2xl bg-slate-800/30 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Arsip ZIP berisi 4 berkas CSV: <code className="text-indigo-300">pitch.csv</code>, <code className="text-indigo-300">faces.csv</code>, <code className="text-indigo-300">mar.csv</code>, dan <code className="text-indigo-300">pitch_mar_sync.csv</code>.</span>
        </div>
      </div>
    </div>
  )
}
