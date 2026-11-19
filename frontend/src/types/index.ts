export interface SummaryMetrics {
  target_note: string
  ref_note: string
  octave_shift: number
  video_duration_s: number
  audio_duration_s: number
  total_frames: number
  faces_detected: number
  lips_detected: number
  valid_mar_frames: number
  crepe_samples: number
  stable_samples: number
  stable_in_tune_samples: number
  synced_samples: number
  mar_median: number | null
  processing_time_s: number
}

export interface VerdictInfo {
  nada_target?: string
  nada_acuan?: string
  catatan_oktaf?: string
  median_cent?: number
  VONIS?: string
  'in_tune_%'?: number
  'flat_%'?: number
  'sharp_%'?: number
  'nada_salah_%'?: number
  goyangan_cent?: number
  durasi_stabil_s?: number
  pesan?: string
}

export interface PreviewFrame {
  image: string
  caption: string
  t: number
  mar: number
  frame: number
}

export interface ChartDataPoint {
  t: number
  cent: number | null
  status: 'in-tune' | 'flat' | 'sharp' | 'nada-salah' | 'unvoiced'
  stable: boolean
  f0: number | null
  confidence: number
  mar_smooth: number | null
  mar_interp: number | null
}

export interface AnalysisResponse {
  summary: SummaryMetrics
  verdict: VerdictInfo
  info: {
    target_note: string
    f_target_hz: number
    octave_shift: number
    ref_note: string
    f_ref_hz: number
  }
  previews: PreviewFrame[]
  charts: ChartDataPoint[]
  download_id: string
}
