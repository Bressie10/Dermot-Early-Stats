import { openDB } from 'idb'

const DB_NAME = 'doora-stats'
const DB_VERSION = 1

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('squad')) {
        db.createObjectStore('squad', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('matches')) {
        db.createObjectStore('matches', { keyPath: 'id' })
      }
    }
  })
}

export async function saveSquad(players) {
  // Fire all ops without mid-transaction awaits — keeps transaction open until tx.done
  const db = await getDB()
  const tx = db.transaction('squad', 'readwrite')
  tx.store.clear()
  players.forEach(p => tx.store.put(p))
  await tx.done
}

export async function loadSquad() {
  const db = await getDB()
  return db.getAll('squad')
}

export async function saveMatch(match) {
  let lastErr
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const db = await getDB()
      await db.put('matches', match)
      return
    } catch (e) {
      lastErr = e
      await new Promise(r => setTimeout(r, 150 * (attempt + 1)))
    }
  }
  throw lastErr
}

export async function loadMatches() {
  const db = await getDB()
  const all = await db.getAll('matches')
  return all.filter(m => !m.isDraft)
}

// FIX: Use a single transaction across both stores so the clear is atomic.
// If the app crashes mid-way the DB rolls back to a consistent state.
export async function clearAllData() {
  const db = await getDB()
  const tx = db.transaction(['squad', 'matches'], 'readwrite')
  tx.objectStore('squad').clear()
  tx.objectStore('matches').clear()
  await tx.done
}

export async function saveDraftMatch(match) {
  let lastErr
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const db = await getDB()
      await db.put('matches', { ...match, id: 'draft', isDraft: true })
      return
    } catch (e) {
      lastErr = e
      await new Promise(r => setTimeout(r, 100 * (attempt + 1)))
    }
  }
  console.warn('saveDraftMatch failed after 3 attempts:', lastErr)
}

export async function loadDraftMatch() {
  const db = await getDB()
  return db.get('matches', 'draft')
}

export async function clearDraftMatch() {
  const db = await getDB()
  await db.delete('matches', 'draft')
}

// FIX: Poison the draft record so it won't be auto-resumed even if clearDraftMatch
// hasn't run yet. Called immediately after saveMatch succeeds in finishMatch().
// This prevents duplicate matches if the app crashes between saveMatch and clearDraftMatch.
export async function markDraftSaved() {
  try {
    const db = await getDB()
    const draft = await db.get('matches', 'draft')
    if (draft) {
      await db.put('matches', { ...draft, _saved: true })
    }
  } catch (e) {
    console.warn('markDraftSaved failed:', e)
    // Non-fatal — clearDraftMatch will clean it up normally
  }
}
