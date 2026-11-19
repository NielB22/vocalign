// Helper kalkulasi frekuensi nada standar A4 = 440 Hz
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const COMMON_VOCAL_NOTES = [
  { note: 'C3', name: 'C3 (Low Tenor/Bass)', hz: 130.81 },
  { note: 'E3', name: 'E3 (Baritone/Tenor)', hz: 164.81 },
  { note: 'G3', name: 'G3 (Tenor)', hz: 196.00 },
  { note: 'A3', name: 'A3 (Tenor/Alto)', hz: 220.00 },
  { note: 'C4', name: 'C4 (Middle C)', hz: 261.63 },
  { note: 'D4', name: 'D4 (Vocal Range)', hz: 293.66 },
  { note: 'D#4', name: 'D#4 (Default Test Note)', hz: 311.13 },
  { note: 'E4', name: 'E4 (Mezzo/Tenor High)', hz: 329.63 },
  { note: 'G4', name: 'G4 (Soprano/Tenor Belt)', hz: 392.00 },
  { note: 'A4', name: 'A4 (Concert Pitch)', hz: 440.00 },
  { note: 'C5', name: 'C5 (High Soprano)', hz: 523.25 },
]

export function getApproxHz(note: string): number | null {
  try {
    const match = note.trim().match(/^([A-Ga-g])(#|b)?(-?\d+)$/)
    if (!match) return null

    let step = match[1].toUpperCase()
    const accidental = match[2] || ''
    const octave = parseInt(match[3], 10)

    let noteIndex = NOTE_NAMES.indexOf(step)
    if (noteIndex === -1) return null

    if (accidental === '#') {
      noteIndex = (noteIndex + 1) % 12
    } else if (accidental === 'b') {
      noteIndex = (noteIndex - 1 + 12) % 12
    }

    // Semitones from A4 (A4 is noteIndex 9 in octave 4)
    const midi = (octave + 1) * 12 + noteIndex
    const a4Midi = 69
    const hz = 440 * Math.pow(2, (midi - a4Midi) / 12)
    return Math.round(hz * 100) / 100
  } catch {
    return null
  }
}
