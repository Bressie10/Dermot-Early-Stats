import { writable } from 'svelte/store'

const SETTINGS_KEY = 'doora-settings'

const defaults = {
  // Team
  teamName: 'Doora Barefield',
  ageGroup: 'Minor',

  // Match setup fields
  showVenueField: true,
  showCompetitionField: false,

  // Match periods
  periods: ['Warm-up', '1st Half', '2nd Half', 'Extra Time'],
  defaultPeriod: '1st Half',
  periodLength: 30,

  // Default stats shown in every new match
  defaultStats: ['Point', 'Goal', 'Wide', 'Tackle', 'Block', 'Turnover Won', 'Turnover Lost', 'Free Won'],

  // Tracking features — toggle entire features on/off
  trackPuckouts: true,
  trackOppScores: true,
  trackPitchCoords: true,

  // Quick View Stats — which accordions start open
  quickViewSections: {
    puckouts: true,
    conceded: true,
    players: false,
    subs: false
  },

  // Appearance
  darkMode: false,

  // Legacy: halftime sheet section visibility (kept for compatibility)
  halftimeStats: {
    showScore: true,
    showPuckouts: true,
    showConcededScores: true,
    showPlayerStats: true,
    showSubs: true
  }
}

function createSettingsStore() {
  const stored = localStorage.getItem(SETTINGS_KEY)
  const parsed = stored ? JSON.parse(stored) : {}
  const initial = {
    ...defaults,
    ...parsed,
    halftimeStats: { ...defaults.halftimeStats, ...(parsed.halftimeStats || {}) },
    quickViewSections: { ...defaults.quickViewSections, ...(parsed.quickViewSections || {}) },
    // Ensure arrays have fallbacks
    periods: parsed.periods?.length ? parsed.periods : defaults.periods,
    defaultStats: parsed.defaultStats?.length ? parsed.defaultStats : defaults.defaultStats,
  }

  const { subscribe, set, update } = writable(initial)

  return {
    subscribe,
    save: (newSettings) => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings))
      set(newSettings)
    }
  }
}

export const settingsStore = createSettingsStore()
