import React, { useState, useRef, useMemo } from 'react'
import type { ChartDataPoint } from '../types'
import {
  Activity,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  AlertCircle,
  Sliders,
} from 'lucide-react'

interface InteractiveChartsProps {
  data: ChartDataPoint[]
  targetNote?: string
}

type ScaleMode = 'focus100' | 'detail50' | 'wide250' | 'auto' | 'custom'

export const InteractiveCharts: React.FC<InteractiveChartsProps> = ({ data, targetNote = 'D#4' }) => {
  const [activeTab, setActiveTab] = useState<'both' | 'pitch' | 'mar'>('both')
  const [scaleMode, setScaleMode] = useState<ScaleMode>('focus100')
  const [customCentLimit, setCustomCentLimit] = useState<number>(100)
  const [isExpandedHeight, setIsExpandedHeight] = useState<boolean>(false)
  const [zoomX, setZoomX] = useState<number>(1)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const points = useMemo(() => data, [data])

  const minT = points && points.length > 0 ? points[0].t : 0
  const maxT = points && points.length > 0 ? points[points.length - 1].t || 1 : 1
  const duration = maxT - minT || 1

  // Kumpulan nilai cent yang stabil
  const centValues = useMemo(() => {
    return (points || [])
      .filter((p) => p.cent !== null && p.stable)
      .map((p) => p.cent as number)
  }, [points])

  const actualMinCent = centValues.length ? Math.min(...centValues) : -50
  const actualMaxCent = centValues.length ? Math.max(...centValues) : 50

  // Tentukan batas min & max cent berdasarkan mode skala yang dipilih
  const { minCent, maxCent } = useMemo(() => {
    if (scaleMode === 'detail50') {
      return { minCent: -50, maxCent: 50 }
    }
    if (scaleMode === 'focus100') {
      return { minCent: -100, maxCent: 100 }
    }
    if (scaleMode === 'wide250') {
      return { minCent: -250, maxCent: 250 }
    }
    if (scaleMode === 'custom') {
      return { minCent: -customCentLimit, maxCent: customCentLimit }
    }
    // 'auto' mode: rentang penuh mencakup seluruh outlier
    const calcMin = Math.min(-50, Math.floor(actualMinCent / 25) * 25)
    const calcMax = Math.max(50, Math.ceil(actualMaxCent / 25) * 25)
    return { minCent: calcMin, maxCent: calcMax }
  }, [scaleMode, customCentLimit, actualMinCent, actualMaxCent])

  const centRange = maxCent - minCent || 100

  // Cek apakah ada data yang berada di luar viewport saat ini
  const hasOutliersBelow = actualMinCent < minCent
  const hasOutliersAbove = actualMaxCent > maxCent

  // Hitung range MAR (biasanya 0.0 s/d 1.0)
  const marValues = useMemo(() => {
    return (points || [])
      .filter((p) => p.mar_smooth !== null)
      .map((p) => p.mar_smooth as number)
  }, [points])

  const minMar = 0
  const maxMar = marValues.length ? Math.max(0.6, Math.ceil(Math.max(...marValues) * 10) / 10 + 0.1) : 0.8
  const marRange = maxMar - minMar || 1

  // Dimensi dasar SVG
  const baseWidth = 1000
  const width = baseWidth * zoomX
  const heightPitch = isExpandedHeight ? 380 : 250
  const heightMar = isExpandedHeight ? 200 : 160
  const padL = 65
  const padR = 25
  const padT = 20
  const padB = 32

  const plotW = width - padL - padR
  const plotHPitch = heightPitch - padT - padB
  const plotHMar = heightMar - padT - padB

  // Fungsi konversi koordinat
  const getX = (t: number) => padL + ((t - minT) / duration) * plotW
  const getYCent = (cent: number) => padT + plotHPitch - ((cent - minCent) / centRange) * plotHPitch
  const getYMar = (mar: number) => padT + plotHMar - ((mar - minMar) / marRange) * plotHMar

  // Jalur segmen pitch dengan pewarnaan status
  const pitchSegments = useMemo(() => {
    if (!points || points.length === 0) return []
    const segments: Array<{ points: string; color: string; status: string }> = []
    type Segment = { points: string[]; color: string; status: string }
    let currentSegment: Segment | null = null

    for (const p of points) {
      if (p.cent !== null && p.stable) {
        const x = getX(p.t).toFixed(1)
        const y = getYCent(p.cent).toFixed(1)
        const pointStr = `${x},${y}`

        let color = '#10b981' // in-tune (emerald)
        if (p.status === 'flat') color = '#f59e0b' // amber
        else if (p.status === 'sharp') color = '#f43f5e' // rose
        else if (p.status === 'nada-salah') color = '#ef4444' // red

        if (!currentSegment || currentSegment.status !== p.status) {
          if (currentSegment && currentSegment.points.length > 1) {
            segments.push({
              points: currentSegment.points.join(' '),
              color: currentSegment.color,
              status: currentSegment.status,
            })
          }
          currentSegment = { points: [pointStr], color, status: p.status }
        } else {
          currentSegment.points.push(pointStr)
        }
      } else {
        if (currentSegment && currentSegment.points.length > 1) {
          segments.push({
            points: currentSegment.points.join(' '),
            color: currentSegment.color,
            status: currentSegment.status,
          })
        }
        currentSegment = null
      }
    }

    if (currentSegment && currentSegment.points.length > 1) {
      segments.push({
        points: currentSegment.points.join(' '),
        color: currentSegment.color,
        status: currentSegment.status,
      })
    }

    return segments
  }, [points, minT, duration, minCent, centRange, width, plotW, plotHPitch])

  // Jalur MAR Smooth
  const marSmoothPath = useMemo(() => {
    if (!points || points.length === 0) return ''
    const pts = points
      .filter((p) => p.mar_smooth !== null)
      .map((p) => `${getX(p.t).toFixed(1)},${getYMar(p.mar_smooth as number).toFixed(1)}`)
    return pts.length > 1 ? `M ${pts.join(' L ')}` : ''
  }, [points, minT, duration, minMar, maxMar, width, plotW, plotHMar])

  // Area under curve MAR
  const marAreaPath = useMemo(() => {
    if (!points || points.length === 0) return ''
    const valid = points.filter((p) => p.mar_smooth !== null)
    if (valid.length < 2) return ''
    const pts = valid.map((p) => `${getX(p.t).toFixed(1)},${getYMar(p.mar_smooth as number).toFixed(1)}`)
    const firstX = getX(valid[0].t).toFixed(1)
    const lastX = getX(valid[valid.length - 1].t).toFixed(1)
    const bottomY = (padT + plotHMar).toFixed(1)
    return `M ${firstX},${bottomY} L ${pts.join(' L ')} L ${lastX},${bottomY} Z`
  }, [points, minT, duration, minMar, maxMar, width, plotW, plotHMar])

  // Generator Ticks Y Axis untuk Cent
  const yCentTicks = useMemo(() => {
    if (scaleMode === 'detail50') {
      return [50, 25, 0, -25, -50]
    }
    if (scaleMode === 'focus100') {
      return [100, 75, 50, 25, 0, -25, -50, -75, -100]
    }
    if (scaleMode === 'wide250') {
      return [250, 150, 75, 25, 0, -25, -75, -150, -250]
    }
    if (scaleMode === 'custom') {
      const step = customCentLimit <= 60 ? 20 : customCentLimit <= 150 ? 25 : 50
      const ticks: number[] = [0]
      for (let v = step; v <= customCentLimit; v += step) {
        ticks.push(v)
        ticks.push(-v)
      }
      if (!ticks.includes(25)) ticks.push(25)
      if (!ticks.includes(-25)) ticks.push(-25)
      return Array.from(new Set(ticks)).sort((a, b) => b - a)
    }

    // Auto mode
    const ticks: number[] = [maxCent, 50, 25, 0, -25, -50, minCent]
    if (minCent < -200) {
      const step = Math.ceil(Math.abs(minCent) / 4 / 50) * 50
      for (let v = -step; v > minCent; v -= step) {
        ticks.push(v)
      }
    }
    return Array.from(new Set(ticks)).sort((a, b) => b - a)
  }, [scaleMode, customCentLimit, minCent, maxCent])

  if (!points || points.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center text-slate-400">
        Belum ada data visualisasi timeline.
      </div>
    )
  }

  // Handler interaksi mouse hover
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const svgX = (mouseX / rect.width) * width
    if (svgX < padL || svgX > padL + plotW) {
      setHoverIndex(null)
      return
    }
    const ratio = (svgX - padL) / plotW
    const hoverT = minT + ratio * duration

    let bestIdx = 0
    let bestDiff = Infinity
    points.forEach((p, idx) => {
      const diff = Math.abs(p.t - hoverT)
      if (diff < bestDiff) {
        bestDiff = diff
        bestIdx = idx
      }
    })
    setHoverIndex(bestIdx)
  }

  // Aksi tombol zoom
  const handleZoomIn = () => {
    const currentLimit = scaleMode === 'custom' ? customCentLimit : Math.abs(maxCent)
    const nextLimit = Math.max(30, Math.round(currentLimit * 0.7))
    setCustomCentLimit(nextLimit)
    setScaleMode('custom')
  }

  const handleZoomOut = () => {
    const currentLimit = scaleMode === 'custom' ? customCentLimit : Math.abs(maxCent)
    const nextLimit = Math.min(2000, Math.round(currentLimit * 1.4))
    setCustomCentLimit(nextLimit)
    setScaleMode('custom')
  }

  const handleResetZoom = () => {
    setScaleMode('focus100')
    setCustomCentLimit(100)
    setZoomX(1)
  }

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null

  // Batas zona In-Tune (±25 cent)
  const yInTuneTop = getYCent(25)
  const yInTuneBottom = getYCent(-25)

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
      {/* Header Utama Grafik & Filter Tab */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center space-x-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <span>Grafik Sinkronisasi Audio & Visual</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Perbandingan timeline deviasi nada (cent) dengan dinamika bukaan mulut (MAR)
          </p>
        </div>

        {/* Tab Pilih Stream Data */}
        <div className="flex items-center space-x-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 self-stretch sm:self-auto justify-center">
          <button
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'both' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Semua (Sinkron)
          </button>
          <button
            onClick={() => setActiveTab('pitch')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'pitch' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Deviasi Pitch
          </button>
          <button
            onClick={() => setActiveTab('mar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'mar' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Bukaan Mulut (MAR)
          </button>
        </div>
      </div>

      {/* Control Bar: Zoom Vertikal (Y-Cent) & Opsi Tampilan */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800/90 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-semibold flex items-center space-x-1 text-[11px] uppercase tracking-wider">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span>Skala Vertikal (Pitch):</span>
          </span>

          {/* Preset Buttons */}
          <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            <button
              onClick={() => setScaleMode('focus100')}
              title="Fokus area nyanyi utama ±100 cent (Anti-Dempet)"
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                scaleMode === 'focus100'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Fokus (±100)
            </button>
            <button
              onClick={() => setScaleMode('detail50')}
              title="Detail intonasi presisi ±50 cent"
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                scaleMode === 'detail50'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Detail (±50)
            </button>
            <button
              onClick={() => setScaleMode('wide250')}
              title="Rentang luas ±250 cent"
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                scaleMode === 'wide250'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Luas (±250)
            </button>
            <button
              onClick={() => setScaleMode('auto')}
              title="Tampilkan seluruh data termasuk oktaf jauh"
              className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                scaleMode === 'auto'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua Data (Auto)
            </button>
          </div>

          {/* Tombol Perbesar / Perkecil (+ / -) */}
          <div className="inline-flex items-center space-x-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
            <button
              onClick={handleZoomIn}
              title="Perbesar Skala Pitch (Zoom In Vertikal)"
              className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              title="Perkecil Skala Pitch (Zoom Out Vertikal)"
              className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              title="Reset Zoom ke Default"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-[11px] font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 rounded-md">
            Rentang: {minCent > 0 ? `+${minCent}` : minCent} s/d +{maxCent} cent
          </span>
        </div>

        {/* Timeline Zoom & Height Expander */}
        <div className="flex items-center space-x-2">
          {/* Zoom Horizontal Timeline */}
          <div className="inline-flex items-center space-x-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg text-[11px]">
            <span className="px-1 text-slate-400 font-mono">X:</span>
            {[1, 1.5, 2].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setZoomX(lvl)}
                className={`px-1.5 py-0.5 rounded font-mono transition cursor-pointer ${
                  zoomX === lvl
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lvl}x
              </button>
            ))}
          </div>

          {/* Toggle Tinggi Kanvas */}
          <button
            onClick={() => setIsExpandedHeight(!isExpandedHeight)}
            className={`px-2.5 py-1 rounded-lg border font-medium flex items-center space-x-1.5 transition cursor-pointer text-xs ${
              isExpandedHeight
                ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
            }`}
            title="Perbesar tinggi vertikal grafik agar lebih lega"
          >
            {isExpandedHeight ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Kecilkan Tinggi</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Perluas Tinggi</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Outlier Warning Pill */}
      {(hasOutliersBelow || hasOutliersAbove) && scaleMode !== 'auto' && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs animate-fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Ada nada di luar tampilan skala ({Math.round(actualMinCent)} cent). Skala saat ini difokuskan ke zona bernyanyi agar tidak dempet.
            </span>
          </div>
          <button
            onClick={() => setScaleMode('auto')}
            className="ml-3 px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-[11px] transition cursor-pointer"
          >
            Lihat Rentang Lengkap
          </button>
        </div>
      )}

      {/* SVG Canvas Area */}
      <div ref={containerRef} className="relative select-none overflow-x-auto pb-2">
        {/* Floating Tooltip */}
        {hoverPoint && (
          <div className="absolute top-2 right-4 z-20 bg-slate-950/95 border border-slate-700/80 p-3 rounded-xl shadow-2xl backdrop-blur-md pointer-events-none text-xs flex items-center space-x-4">
            <div>
              <span className="text-slate-400 block font-mono text-[10px]">Waktu:</span>
              <span className="font-bold text-white font-mono">{hoverPoint.t.toFixed(2)}s</span>
            </div>
            {hoverPoint.cent !== null && (
              <div>
                <span className="text-slate-400 block font-mono text-[10px]">Deviasi Pitch:</span>
                <span
                  className={`font-bold font-mono ${
                    Math.abs(hoverPoint.cent) <= 25
                      ? 'text-emerald-400'
                      : hoverPoint.cent < 0
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {hoverPoint.cent > 0 ? `+${hoverPoint.cent}` : hoverPoint.cent} cent
                </span>
              </div>
            )}
            {hoverPoint.f0 && (
              <div>
                <span className="text-slate-400 block font-mono text-[10px]">Pitch f0:</span>
                <span className="font-bold text-indigo-300 font-mono">{hoverPoint.f0} Hz</span>
              </div>
            )}
            {hoverPoint.mar_smooth !== null && (
              <div>
                <span className="text-slate-400 block font-mono text-[10px]">MAR Mulut:</span>
                <span className="font-bold text-violet-400 font-mono">
                  {hoverPoint.mar_smooth.toFixed(3)}
                </span>
              </div>
            )}
            <div>
              <span className="text-slate-400 block font-mono text-[10px]">Status:</span>
              <span className="font-semibold uppercase tracking-wider text-[10px] text-white">
                {hoverPoint.status}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-4" style={{ minWidth: zoomX > 1 ? `${width}px` : '100%' }}>
          {/* Chart 1: Pitch Deviation */}
          {(activeTab === 'both' || activeTab === 'pitch') && (
            <div className="bg-slate-950/70 rounded-2xl border border-slate-800 p-4 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3 px-2">
                <span className="text-xs font-semibold text-slate-200 flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  <span>Deviasi Nada Terhadap Target ({targetNote})</span>
                </span>
                <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                  <span className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500/30 border border-emerald-500/70" />
                    <span>Zona In-Tune (±25 cent)</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="w-3 h-0.5 bg-slate-400" />
                    <span>Acuan (0 cent)</span>
                  </span>
                </div>
              </div>

              <svg
                viewBox={`0 0 ${width} ${heightPitch}`}
                className="w-full h-auto cursor-crosshair overflow-hidden"
                style={{ maxHeight: isExpandedHeight ? '450px' : '300px' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <defs>
                  {/* Clip path agar garis data tidak keluar dari kotak plot saat di-zoom */}
                  <clipPath id="pitch-plot-clip">
                    <rect x={padL} y={padT} width={plotW} height={plotHPitch} />
                  </clipPath>
                </defs>

                {/* Background In-Tune Zone (±25 cent) */}
                <g clipPath="url(#pitch-plot-clip)">
                  <rect
                    x={padL}
                    y={Math.min(yInTuneTop, yInTuneBottom)}
                    width={plotW}
                    height={Math.abs(yInTuneBottom - yInTuneTop)}
                    fill="rgba(16, 185, 129, 0.12)"
                    stroke="rgba(16, 185, 129, 0.35)"
                    strokeDasharray="4 4"
                  />
                </g>

                {/* Garis Horizontal Grid & Label Cent */}
                {yCentTicks.map((val) => {
                  const y = getYCent(val)
                  if (y < padT - 5 || y > padT + plotHPitch + 5) return null
                  const isZero = val === 0
                  const isInTuneBoundary = Math.abs(val) === 25

                  return (
                    <g key={val}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={padL + plotW}
                        y2={y}
                        stroke={
                          isZero
                            ? 'rgba(255, 255, 255, 0.4)'
                            : isInTuneBoundary
                            ? 'rgba(16, 185, 129, 0.3)'
                            : 'rgba(255, 255, 255, 0.08)'
                        }
                        strokeWidth={isZero ? 1.5 : 1}
                        strokeDasharray={isInTuneBoundary ? '3 3' : undefined}
                      />
                      <text
                        x={padL - 8}
                        y={y + 4}
                        fill={
                          isZero
                            ? '#ffffff'
                            : isInTuneBoundary
                            ? '#34d399'
                            : 'rgba(148, 163, 184, 0.75)'
                        }
                        fontSize="10"
                        fontWeight={isZero || isInTuneBoundary ? 'bold' : 'normal'}
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        {val > 0 ? `+${val}` : val}
                      </text>
                    </g>
                  )
                })}

                {/* Sumbu X Ticks (Waktu / Detik) */}
                {Array.from({ length: 6 * zoomX }).map((_, i) => {
                  const t = minT + (i / (6 * zoomX - 1)) * duration
                  const x = getX(t)
                  return (
                    <g key={i}>
                      <line
                        x1={x}
                        y1={padT + plotHPitch}
                        x2={x}
                        y2={padT + plotHPitch + 5}
                        stroke="rgba(255,255,255,0.2)"
                      />
                      <text
                        x={x}
                        y={padT + plotHPitch + 18}
                        fill="rgba(148, 163, 184, 0.75)"
                        fontSize="10"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {t.toFixed(1)}s
                      </text>
                    </g>
                  )
                })}

                {/* Pitch Data Lines (Di-clip agar tidak tembus keluar area) */}
                <g clipPath="url(#pitch-plot-clip)">
                  {pitchSegments.map((seg, i) => (
                    <polyline
                      key={i}
                      points={seg.points}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={isExpandedHeight ? '3' : '2.5'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </g>

                {/* Crosshair Vertikal Indicator */}
                {hoverPoint && (
                  <line
                    x1={getX(hoverPoint.t)}
                    y1={padT}
                    x2={getX(hoverPoint.t)}
                    y2={padT + plotHPitch}
                    stroke="rgba(255, 255, 255, 0.6)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Hover Dot pada Pitch */}
                {hoverPoint && hoverPoint.cent !== null && (
                  <circle
                    cx={getX(hoverPoint.t)}
                    cy={Math.max(padT, Math.min(padT + plotHPitch, getYCent(hoverPoint.cent)))}
                    r="5"
                    fill="#ffffff"
                    stroke={
                      Math.abs(hoverPoint.cent) <= 25
                        ? '#10b981'
                        : hoverPoint.cent < 0
                        ? '#f59e0b'
                        : '#f43f5e'
                    }
                    strokeWidth="2.5"
                  />
                )}
              </svg>
            </div>
          )}

          {/* Chart 2: Mouth Aspect Ratio (MAR) */}
          {(activeTab === 'both' || activeTab === 'mar') && (
            <div className="bg-slate-950/70 rounded-2xl border border-slate-800 p-4 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3 px-2">
                <span className="text-xs font-semibold text-slate-200 flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-violet-400 inline-block animate-pulse" />
                  <span>Dinamika Bukaan Mulut (Mouth Aspect Ratio — MAR)</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  MAR = Vertikal Bibir Dalam / Horizontal Sudut Bibir
                </span>
              </div>

              <svg
                viewBox={`0 0 ${width} ${heightMar}`}
                className="w-full h-auto cursor-crosshair overflow-hidden"
                style={{ maxHeight: isExpandedHeight ? '280px' : '200px' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
              >
                {/* Horizontal Grid lines MAR */}
                {[0, 0.2, 0.4, 0.6, 0.8].map((val) => {
                  if (val > maxMar) return null
                  const y = getYMar(val)
                  return (
                    <g key={val}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={padL + plotW}
                        y2={y}
                        stroke="rgba(255, 255, 255, 0.08)"
                        strokeWidth="1"
                      />
                      <text
                        x={padL - 8}
                        y={y + 3}
                        fill="rgba(148, 163, 184, 0.75)"
                        fontSize="10"
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        {val.toFixed(1)}
                      </text>
                    </g>
                  )
                })}

                {/* Sumbu X Ticks */}
                {Array.from({ length: 6 * zoomX }).map((_, i) => {
                  const t = minT + (i / (6 * zoomX - 1)) * duration
                  const x = getX(t)
                  return (
                    <g key={i}>
                      <line
                        x1={x}
                        y1={padT + plotHMar}
                        x2={x}
                        y2={padT + plotHMar + 5}
                        stroke="rgba(255,255,255,0.2)"
                      />
                      <text
                        x={x}
                        y={padT + plotHMar + 16}
                        fill="rgba(148, 163, 184, 0.75)"
                        fontSize="10"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        {t.toFixed(1)}s
                      </text>
                    </g>
                  )
                })}

                {/* MAR Area Fill */}
                {marAreaPath && (
                  <path d={marAreaPath} fill="rgba(139, 92, 246, 0.15)" />
                )}

                {/* MAR Line */}
                {marSmoothPath && (
                  <path
                    d={marSmoothPath}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Crosshair indicator */}
                {hoverPoint && (
                  <line
                    x1={getX(hoverPoint.t)}
                    y1={padT}
                    x2={getX(hoverPoint.t)}
                    y2={padT + plotHMar}
                    stroke="rgba(255, 255, 255, 0.6)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}
                {hoverPoint && hoverPoint.mar_smooth !== null && (
                  <circle
                    cx={getX(hoverPoint.t)}
                    cy={getYMar(hoverPoint.mar_smooth)}
                    r="5"
                    fill="#ffffff"
                    stroke="#a855f7"
                    strokeWidth="2"
                  />
                )}
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
