import { supabase } from './supabase.js'
import { loadMatches, loadSquad, saveMatch, saveSquad } from './db.js'

let _autoSyncTimer = null

export function scheduleAutoSync(userId) {
  if (!userId) return
  clearTimeout(_autoSyncTimer)
  _autoSyncTimer = setTimeout(() => {
    syncToSupabase(userId).catch(e => console.warn('Auto-sync failed:', e))
  }, 10000)
}

export async function syncToSupabase(userId) {
  try {
    const [matches, squad] = await Promise.all([loadMatches(), loadSquad()])

    // ── Sync matches ──────────────────────────────────────────────────────────
    if (matches.length > 0) {
      const matchRows = matches.map(m => ({
        id: m.id,
        user_id: userId,
        date: m.date,
        opposition: m.opposition,
        venue: m.venue,
        score: m.score,
        stats: m.stats,
        events: m.events,
        notes: m.notes,
        custom_stats: m.customStats,
        players: m.players,
        subs_log: m.subs_log,
        // FIX: extra_data carries all fields added after initial schema creation.
        // Stored as a single JSONB blob so the schema only needs one new column.
        extra_data: {
          competition: m.competition ?? null,
          period:      m.period ?? null,
          puckouts:    m.puckouts ?? [],
          opp_scores:  m.oppScores ?? [],
          lineup:      m.lineup ?? {}
        }
      }))

      // Try full sync (including extra_data).
      // If the extra_data column doesn't exist yet in Supabase, fall back to
      // the original schema so existing sync is never broken.
      let { error } = await supabase.from('matches').upsert(matchRows, { onConflict: 'id' })

      if (error) {
        // FIX: Detect missing-column errors and gracefully degrade.
        const isSchemaMissing = error.code === 'PGRST204' ||
          error.message?.includes('extra_data') ||
          error.message?.includes('Could not find')

        if (isSchemaMissing) {
          console.warn('Supabase missing extra_data column — syncing without puckouts/opp_scores/lineup. Run the migration SQL to enable full sync.')
          // Fall back: send only columns that are known to exist
          const basicRows = matchRows.map(({ extra_data, ...rest }) => rest)
          const { error: err2 } = await supabase.from('matches').upsert(basicRows, { onConflict: 'id' })
          if (err2) throw err2
        } else {
          throw error
        }
      }
    }

    // FIX: Delete from cloud any matches that no longer exist locally.
    // Previously syncToSupabase only ever upserted — deletions were never
    // propagated, so deleted matches reappeared after the next login/sync.
    // Requires the Supabase RLS policy to allow DELETE where user_id = auth.uid().
    const { data: remoteMatches } = await supabase
      .from('matches').select('id').eq('user_id', userId)
    if (remoteMatches) {
      const localMatchIds = new Set(matches.map(m => String(m.id)))
      const matchesToDelete = remoteMatches
        .filter(r => !localMatchIds.has(String(r.id)))
        .map(r => r.id)
      if (matchesToDelete.length > 0) {
        const { error: delErr } = await supabase
          .from('matches').delete().eq('user_id', userId).in('id', matchesToDelete)
        if (delErr) console.warn('Failed to delete removed matches from cloud:', delErr)
      }
    }

    // ── Sync squad ────────────────────────────────────────────────────────────
    if (squad.length > 0) {
      const squadRows = squad.map(p => ({
        id: p.id,
        user_id: userId,
        name: p.name,
        number: p.number,
        position: p.position
      }))
      const { error } = await supabase.from('squad').upsert(squadRows, { onConflict: 'id,user_id' })
      if (error) throw error
    }

    // FIX: Delete from cloud any squad players that no longer exist locally.
    const { data: remoteSquad } = await supabase
      .from('squad').select('id').eq('user_id', userId)
    if (remoteSquad) {
      const localSquadIds = new Set(squad.map(p => String(p.id)))
      const squadToDelete = remoteSquad
        .filter(r => !localSquadIds.has(String(r.id)))
        .map(r => r.id)
      if (squadToDelete.length > 0) {
        const { error: delErr } = await supabase
          .from('squad').delete().eq('user_id', userId).in('id', squadToDelete)
        if (delErr) console.warn('Failed to delete removed squad players from cloud:', delErr)
      }
    }

    return true
  } catch (e) {
    console.error('Sync failed:', e)
    return false
  }
}

export async function syncFromSupabase(userId) {
  try {
    const [matchRes, squadRes] = await Promise.all([
      supabase.from('matches').select('*').eq('user_id', userId),
      supabase.from('squad').select('*').eq('user_id', userId)
    ])

    // FIX: Supabase JS client does not throw on API errors — it returns { error }.
    // Previously these were silently ignored, causing a false success return.
    if (matchRes.error) throw matchRes.error
    if (squadRes.error) throw squadRes.error

    if (matchRes.data) {
      for (const m of matchRes.data) {
        // FIX: Restore all fields, including those stored in extra_data.
        const extra = m.extra_data || {}
        await saveMatch({
          id: m.id,
          date: m.date,
          opposition: m.opposition,
          venue: m.venue,
          competition: extra.competition ?? m.competition ?? null,
          period: extra.period ?? m.period ?? null,
          score: m.score,
          stats: m.stats,
          events: m.events,
          notes: m.notes,
          customStats: m.custom_stats,
          players: m.players,
          subs_log: m.subs_log,
          puckouts:  extra.puckouts  ?? [],
          oppScores: extra.opp_scores ?? [],
          lineup:    extra.lineup    ?? {}
        })
      }
    }

    if (squadRes.data && squadRes.data.length > 0) {
      await saveSquad(squadRes.data.map(p => ({
        id: p.id,
        name: p.name,
        number: p.number,
        position: p.position
      })))
    }

    return true
  } catch (e) {
    console.error('Sync from cloud failed:', e)
    return false
  }
}

// FIX: Delete a match from Supabase when the coach deletes it locally.
// Previously, deleted matches would reappear after the next login/sync.
export async function deleteMatchFromCloud(userId, matchId) {
  if (!userId) return
  try {
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', matchId)
      .eq('user_id', userId)
    if (error) throw error
  } catch (e) {
    console.warn('Failed to delete match from cloud:', e)
    // Non-fatal — local delete already done; cloud copy will be orphaned but
    // RLS ensures other coaches can't see it.
  }
}
