// Turns OSRM's structured maneuver data into short, human-readable turn-by-turn
// instructions (OSRM gives type/modifier/street name, not prose — Google Maps
// builds the same kind of sentence from the same kind of underlying data).

const MODIFIER_TEXT = {
  'sharp left': 'sharp left',
  left: 'left',
  'slight left': 'slight left',
  straight: 'straight ahead',
  'slight right': 'slight right',
  right: 'right',
  'sharp right': 'sharp right',
  uturn: 'a U-turn',
}

function ordinal(n) {
  const suffixes = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`
}

/** One OSRM route step -> a short instruction, e.g. "Turn left onto Church Street". */
export function formatManeuver(step) {
  const name = step?.name?.trim() || 'the path ahead'
  const { type, modifier, exit } = step?.maneuver || {}

  if (type === 'depart') return `Head toward ${name}`
  if (type === 'arrive') return "You've arrived"
  if (type === 'roundabout' || type === 'rotary') {
    return `At the roundabout, take ${exit ? `the ${ordinal(exit)} exit` : 'the exit'} onto ${name}`
  }
  if (modifier === 'straight') return `Continue straight onto ${name}`
  if (modifier) return `Turn ${MODIFIER_TEXT[modifier] || modifier} onto ${name}`
  return `Continue onto ${name}`
}

/** Degrees to rotate an upward-pointing arrow icon to match a maneuver's direction. */
export const MODIFIER_ROTATION_DEG = {
  'sharp left': -135,
  left: -90,
  'slight left': -45,
  straight: 0,
  'slight right': 45,
  right: 90,
  'sharp right': 135,
  uturn: 180,
}

/** Minutes -> "8 min" or "1 h 5 min", for the bottom ETA bar. */
export function formatDuration(minutes) {
  if (minutes == null) return ''
  const rounded = Math.max(1, Math.round(minutes))
  if (rounded < 60) return `${rounded} min`
  return `${Math.floor(rounded / 60)} h ${rounded % 60} min`
}
