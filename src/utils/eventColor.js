// Deterministic color from event ID — consistent across all views
const PALETTE = [
  { tw: 'from-emerald-500 to-teal-500',    css: 'linear-gradient(135deg, #10b981, #14b8a6)' },
  { tw: 'from-indigo-500 to-blue-600',     css: 'linear-gradient(135deg, #6366f1, #2563eb)' },
  { tw: 'from-rose-500 to-pink-600',       css: 'linear-gradient(135deg, #f43f5e, #ec4899)' },
  { tw: 'from-amber-600 to-orange-600',    css: 'linear-gradient(135deg, #d97706, #ea580c)' },
  { tw: 'from-purple-500 to-violet-600',   css: 'linear-gradient(135deg, #a855f7, #7c3aed)' },
  { tw: 'from-cyan-500 to-blue-500',       css: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
];

function hashId(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffff;
  return Math.abs(h);
}

/** Returns Tailwind gradient classes for the event card (Dashboard) */
export function getEventColorTw(eventId) {
  return PALETTE[hashId(eventId) % PALETTE.length].tw;
}

/** Returns a CSS gradient string for inline styles (EventDetail header) */
export function getEventColorCss(eventId) {
  return PALETTE[hashId(eventId) % PALETTE.length].css;
}
