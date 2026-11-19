import React from 'react'
import { CheckCircle2, AlertTriangle, AlertCircle, TrendingDown, TrendingUp, Music, ShieldCheck, Flame } from 'lucide-react'
import type { VerdictInfo } from '../types'

interface VerdictBannerProps {
  verdict: VerdictInfo
}

export const VerdictBanner: React.FC<VerdictBannerProps> = ({ verdict }) => {
  const vonis = verdict.VONIS || 'HASIL PENGUJIAN'
  const isIntune = vonis.includes('IN-TUNE')
  const isFlat = vonis.includes('FLAT')
  const isSharp = vonis.includes('SHARP')

  const badgeColor = isIntune
    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
    : isFlat
    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
    : isSharp
    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
    : 'bg-red-500/10 border-red-500/30 text-red-300'

  const icon = isIntune ? (
    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
  ) : isFlat ? (
    <TrendingDown className="w-8 h-8 text-amber-400" />
  ) : isSharp ? (
    <TrendingUp className="w-8 h-8 text-rose-400" />
  ) : (
    <AlertCircle className="w-8 h-8 text-red-400" />
  )

  const medCent = verdict.median_cent ?? 0
  const medColor = Math.abs(medCent) <= 25 ? 'text-emerald-400' : medCent < 0 ? 'text-amber-400' : 'text-rose-400'

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
      {/* Top Banner Verdict */}
      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${badgeColor}`}>
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-slate-900/60 shadow-inner">
            {icon}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase tracking-wider font-bold opacity-80">Vonis Evaluasi Model</span>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <span className="text-xs font-semibold">Toleransi ±25 Cent</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5">{vonis}</h2>
            {verdict.catatan_oktaf && verdict.catatan_oktaf !== '-' && (
              <p className="text-xs mt-1 opacity-90 font-medium">{verdict.catatan_oktaf}</p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-6 border-t md:border-t-0 md:border-l border-current/20 pt-3 md:pt-0 md:pl-6">
          <div>
            <p className="text-xs opacity-75 font-medium">Median Deviasi</p>
            <p className={`text-2xl font-mono font-bold ${medColor}`}>
              {medCent > 0 ? `+${medCent}` : medCent} <span className="text-xs font-normal opacity-80">cent</span>
            </p>
          </div>
          <div>
            <p className="text-xs opacity-75 font-medium">Akurasi In-Tune</p>
            <p className="text-2xl font-mono font-bold text-emerald-400">
              {verdict['in_tune_%'] ?? 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Grid Metrics Breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Target vs Acuan */}
        <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <Music className="w-4 h-4 text-indigo-400" />
            <span>Target vs Acuan</span>
          </div>
          <p className="text-base font-bold text-white truncate">{verdict.nada_target || '-'}</p>
          <p className="text-xs text-indigo-300 mt-0.5 truncate">Acuan: {verdict.nada_acuan || '-'}</p>
        </div>

        {/* Stabilitas Goyangan Cent */}
        <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <Flame className="w-4 h-4 text-violet-400" />
            <span>Goyangan Pitch (Std)</span>
          </div>
          <p className="text-base font-mono font-bold text-white">
            ± {verdict.goyangan_cent ?? 0} <span className="text-xs font-normal text-slate-400">cent</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Makin kecil makin stabil</p>
        </div>

        {/* Durasi Stabil */}
        <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Durasi Stabil</span>
          </div>
          <p className="text-base font-mono font-bold text-white">
            {verdict.durasi_stabil_s ?? 0} <span className="text-xs font-normal text-slate-400">detik</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Di luar masa attack 200ms</p>
        </div>

        {/* Flat vs Sharp Distribution */}
        <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Kecenderungan</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono font-semibold">
            <span className="text-amber-400">Flat: {verdict['flat_%'] ?? 0}%</span>
            <span className="text-rose-400">Sharp: {verdict['sharp_%'] ?? 0}%</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Salah Nada: {verdict['nada_salah_%'] ?? 0}%
          </p>
        </div>
      </div>

      {/* Accuracy Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400 font-medium">
          <span>Distribusi Frame Stabil</span>
          <div className="flex space-x-3">
            <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span>In-Tune</span></span>
            <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-amber-500" /><span>Flat</span></span>
            <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-rose-500" /><span>Sharp</span></span>
            <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-red-600" /><span>Salah</span></span>
          </div>
        </div>
        <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden flex">
          <div
            className="bg-emerald-500 h-full transition-all duration-500"
            style={{ width: `${verdict['in_tune_%'] ?? 0}%` }}
            title={`In-tune: ${verdict['in_tune_%'] ?? 0}%`}
          />
          <div
            className="bg-amber-500 h-full transition-all duration-500"
            style={{ width: `${verdict['flat_%'] ?? 0}%` }}
            title={`Flat: ${verdict['flat_%'] ?? 0}%`}
          />
          <div
            className="bg-rose-500 h-full transition-all duration-500"
            style={{ width: `${verdict['sharp_%'] ?? 0}%` }}
            title={`Sharp: ${verdict['sharp_%'] ?? 0}%`}
          />
          <div
            className="bg-red-600 h-full transition-all duration-500"
            style={{ width: `${verdict['nada_salah_%'] ?? 0}%` }}
            title={`Salah Nada: ${verdict['nada_salah_%'] ?? 0}%`}
          />
        </div>
      </div>
    </div>
  )
}
