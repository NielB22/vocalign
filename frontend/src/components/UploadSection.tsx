import React, { useState, useRef, useEffect } from 'react'
import { Upload, Film, PlayCircle, Loader2, Music, Check, ArrowRight, Video } from 'lucide-react'
import { COMMON_VOCAL_NOTES, getApproxHz } from '../utils/music'

interface UploadSectionProps {
  onAnalyze: (file: File | null, targetNote: string, useSample: boolean) => Promise<void>
  isAnalyzing: boolean
  hasSampleVideo: boolean
  sampleVideoName?: string | null
}

const ANALYSIS_STEPS = [
  'Memuat model deep learning & bobot lip-pose.pt...',
  'Memisahkan audio mono 16 kHz & menormalkan video ke 30 FPS konstan...',
  'Menjalankan CREPE Small Pitch Estimation (resolusi 10 ms)...',
  'Mendeteksi wajah & tracking crop stabil...',
  'Inferensi titik bibir (YOLOv8 Pose) & kalkulasi MAR...',
  'Menyinkronkan deviasi cent terhadap bukaan mulut...',
]

export const UploadSection: React.FC<UploadSectionProps> = ({
  onAnalyze,
  isAnalyzing,
  hasSampleVideo,
  sampleVideoName,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [useSample, setUseSample] = useState<boolean>(false)
  const [targetNote, setTargetNote] = useState<string>('D#4')
  const [customNote, setCustomNote] = useState<string>('D#4')
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<boolean>(false)
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Interval animasi progres step saat analisis berjalan
  useEffect(() => {
    let timer: any
    if (isAnalyzing) {
      setCurrentStepIndex(0)
      timer = setInterval(() => {
        setCurrentStepIndex((prev) => (prev < ANALYSIS_STEPS.length - 1 ? prev + 1 : prev))
      }, 3500)
    }
    return () => clearInterval(timer)
  }, [isAnalyzing])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setUseSample(false)
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
      setVideoPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && (file.type.includes('video') || file.name.match(/\.(mp4|mov|webm)$/i))) {
      setSelectedFile(file)
      setUseSample(false)
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
      setVideoPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleSelectSample = () => {
    setSelectedFile(null)
    setUseSample(true)
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    setVideoPreviewUrl('/api/sample-video')
  }

  const handleNoteSelect = (note: string) => {
    setTargetNote(note)
    setCustomNote(note)
  }

  const handleCustomNoteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase()
    setCustomNote(val)
    setTargetNote(val)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile && !useSample) return
    onAnalyze(selectedFile, targetNote, useSample)
  }

  const hz = getApproxHz(targetNote)

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl shadow-black/40">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Upload Video */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center font-bold">1</span>
              <span>Pilih atau Unggah Video Bernyanyi</span>
            </label>
            <span className="text-xs text-slate-400">Format: .MOV, .MP4, .WEBM (5-10 detik direkomendasikan)</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`lg:col-span-8 border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center cursor-pointer transition relative overflow-hidden group ${
                dragOver
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : selectedFile
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-slate-700 hover:border-indigo-500/60 bg-slate-850/40 hover:bg-slate-800/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mov,.mp4,.webm"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="flex flex-col items-center text-center space-y-3">
                <div className={`p-4 rounded-2xl transition ${
                  selectedFile
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-indigo-500/10 text-indigo-400 group-hover:scale-110'
                }`}>
                  {selectedFile ? <Film className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
                </div>

                {selectedFile ? (
                  <div>
                    <p className="font-semibold text-sm text-emerald-300">{selectedFile.name}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Klik untuk ganti file
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-sm text-slate-200">
                      Tarik & letakkan video di sini, atau <span className="text-indigo-400 underline font-semibold">klik untuk telusuri</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Dukungan video rekaman ponsel atau kamera</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Sample Option & Mini Preview */}
            <div className="lg:col-span-4 flex flex-col justify-between space-y-3">
              {hasSampleVideo && (
                <div
                  onClick={handleSelectSample}
                  className={`p-4 rounded-2xl border cursor-pointer transition flex items-start space-x-3 ${
                    useSample
                      ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/50'
                      : 'border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-violet-500/20 text-violet-300 mt-0.5">
                    <Video className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">Sample Bawaan</span>
                      {useSample && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {sampleVideoName || 'VIDEO-2026-11-12-12-33-23.mov'}
                    </p>
                    <p className="text-[10px] text-indigo-400 font-medium mt-1">Uji cepat 1-klik</p>
                  </div>
                </div>
              )}

              {/* Video Player Preview */}
              {videoPreviewUrl && (
                <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center">
                  <video
                    src={videoPreviewUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Target Note Selection */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center font-bold">2</span>
              <span>Tentukan Nada Target (Beserta Oktaf)</span>
            </label>
            {hz && (
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Frekuensi Acuan: {hz} Hz
              </span>
            )}
          </div>

          <div className="space-y-3">
            {/* Quick Pills */}
            <div className="flex flex-wrap gap-2">
              {COMMON_VOCAL_NOTES.map((item) => {
                const isSelected = targetNote === item.note
                return (
                  <button
                    key={item.note}
                    type="button"
                    onClick={() => handleNoteSelect(item.note)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/60'
                    }`}
                  >
                    <span>{item.note}</span>
                    <span className="text-[10px] opacity-70">({item.hz} Hz)</span>
                  </button>
                )
              })}
            </div>

            {/* Custom Input */}
            <div className="flex items-center space-x-3 pt-1">
              <div className="relative flex-1 sm:max-w-xs">
                <Music className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customNote}
                  onChange={handleCustomNoteChange}
                  placeholder="Ketik nada custom, misal: D#4, C4, A3"
                  className="w-full pl-9 pr-3 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase font-mono"
                />
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Sistem otomatis toleran oktaf (misal pria menyanyi D#3 untuk target D#4).
              </p>
            </div>
          </div>
        </div>

        {/* Action Button & Progress */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={(!selectedFile && !useSample) || isAnalyzing}
            className={`w-full py-4 rounded-2xl font-semibold text-sm transition shadow-lg flex items-center justify-center space-x-2 ${
              (!selectedFile && !useSample) || isAnalyzing
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/40'
                : 'bg-linear-to-r from-indigo-600 via-violet-600 to-indigo-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-600/25 cursor-pointer hover:scale-[1.005]'
            }`}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-indigo-300" />
                <span>Menjalankan Pipeline Deep Learning...</span>
              </>
            ) : (
              <>
                <PlayCircle className="w-5 h-5" />
                <span>Mulai Analisis Video</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </>
            )}
          </button>

          {/* Stepper Status When Analyzing */}
          {isAnalyzing && (
            <div className="mt-4 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-900/50 text-xs">
              <div className="flex items-center space-x-2 text-indigo-300 font-semibold mb-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Tahap Komputasi Sedang Berlangsung:</span>
              </div>
              <p className="text-slate-300 font-medium pl-6">
                {ANALYSIS_STEPS[currentStepIndex]}
              </p>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-linear-to-r from-indigo-500 to-pink-500 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${((currentStepIndex + 1) / ANALYSIS_STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
