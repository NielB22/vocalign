import { useState, useEffect, useRef } from 'react'
import { Header } from './components/Header'
import { UploadSection } from './components/UploadSection'
import { VerdictBanner } from './components/VerdictBanner'
import { InteractiveCharts } from './components/InteractiveCharts'
import { KeypointGallery } from './components/KeypointGallery'
import { MetricsTable } from './components/MetricsTable'
import type { AnalysisResponse } from './types'
import { AlertCircle, RotateCcw, Sparkles, CheckCircle2 } from 'lucide-react'

export function App() {
  const [backendConnected, setBackendConnected] = useState<boolean>(false)
  const [hasSampleVideo, setHasSampleVideo] = useState<boolean>(false)
  const [sampleVideoName, setSampleVideoName] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const resultsRef = useRef<HTMLDivElement>(null)

  // Cek status kesehatan backend API
  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health')
      if (res.ok) {
        const data = await res.json()
        setBackendConnected(true)
        setHasSampleVideo(Boolean(data.has_sample_video))
        setSampleVideoName(data.sample_video_name || null)
      } else {
        setBackendConnected(false)
      }
    } catch {
      setBackendConnected(false)
    }
  }

  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 8000)
    return () => clearInterval(interval)
  }, [])

  const handleAnalyze = async (file: File | null, targetNote: string, useSample: boolean) => {
    setIsAnalyzing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('target_note', targetNote)
      formData.append('use_sample', String(useSample))
      if (file) {
        formData.append('video', file)
      }

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        let errMessage = 'Gagal memproses analisis vokal.'
        try {
          const errData = await res.json()
          errMessage = errData.detail || errMessage
        } catch {
          // fallback
        }
        throw new Error(errMessage)
      }

      const data: AnalysisResponse = await res.json()
      setAnalysisResult(data)

      // Scroll halus ke bagian hasil
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 200)
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem saat inferensi model.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleReset = () => {
    setAnalysisResult(null)
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header backendConnected={backendConnected} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Vocal Training & Landmark Alignment</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
            Sinkronisasi Pitch Vokal &{' '}
            <span className="bg-linear-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
              Artikulasi Bibir
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
            Uji akurasi vokal rekaman video Anda menggunakan Deep Convolutional CREPE untuk estimasi nada dan YOLOv8 Pose untuk tracking 4 titik bukaan mulut (MAR).
          </p>
        </div>

        {/* Upload & Parameter Input */}
        <UploadSection
          onAnalyze={handleAnalyze}
          isAnalyzing={isAnalyzing}
          hasSampleVideo={hasSampleVideo}
          sampleVideoName={sampleVideoName}
        />

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-950/50 border border-red-800/80 text-red-200 text-sm flex items-start space-x-3 shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-white">Analisis Belum Berhasil</h4>
              <p className="text-xs text-red-300 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Results Section */}
        {analysisResult && (
          <div ref={resultsRef} className="space-y-8 pt-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-lg font-bold text-white">Hasil Analisis Model Deep Learning</h3>
              </div>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition border border-slate-700 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Uji Video Lain</span>
              </button>
            </div>

            {/* 1. Verdict Banner */}
            <VerdictBanner verdict={analysisResult.verdict} />

            {/* 2. Interactive Pitch & MAR Charts */}
            <InteractiveCharts
              data={analysisResult.charts}
              targetNote={analysisResult.summary.target_note}
            />

            {/* 3. Lip Landmark Visualizer Gallery */}
            <KeypointGallery
              previews={analysisResult.previews}
              marMedian={analysisResult.summary.mar_median}
            />

            {/* 4. Complete Technical Measurements Table & Download */}
            <MetricsTable
              summary={analysisResult.summary}
              downloadId={analysisResult.download_id}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} VocalAlign Project. Deep Learning Multi-Modal Audio & Visual Analysis.</p>
          <div className="flex items-center space-x-4 text-slate-400 font-mono text-[11px]">
            <span>FastAPI Backend</span>
            <span>•</span>
            <span>React 19 + Tailwind v4</span>
            <span>•</span>
            <span>PyTorch & CREPE</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
