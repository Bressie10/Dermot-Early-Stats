<script>
  import { onMount, onDestroy } from 'svelte'
  import { supabase } from './supabase.js'

  export let session
  export let onClose = () => {}

  let matchData = session.match_data || null
  let channel = null
  let connected = false
  let lastUpdate = null

  onMount(() => {
    channel = supabase.channel(`live:${session.id}`)
      .on('broadcast', { event: 'match_update' }, ({ payload }) => {
        matchData = payload
        lastUpdate = new Date()
      })
      .subscribe(status => { connected = status === 'SUBSCRIBED' })
  })

  onDestroy(() => { if (channel) supabase.removeChannel(channel) })

  function formatScore(s) {
    if (!s) return '0-00'
    return `${s.goals ?? 0}-${String(s.points ?? 0).padStart(2, '0')}`
  }
  function totalPts(s) { return (s?.goals ?? 0) * 3 + (s?.points ?? 0) }

  $: home = matchData?.score?.home
  $: away = matchData?.score?.away
  $: homePts = totalPts(home)
  $: awayPts = totalPts(away)
  $: topPlayers = (() => {
    if (!matchData?.stats || !matchData?.players) return []
    return matchData.players
      .map(p => {
        const s = matchData.stats[p.id] || {}
        const pts = (s['Goal'] || 0) * 3 + (s['Point'] || 0)
        const total = Object.values(s).reduce((a, b) => a + b, 0)
        return { name: p.name, pts, total }
      })
      .filter(p => p.total > 0)
      .sort((a, b) => b.pts - a.pts || b.total - a.total)
      .slice(0, 5)
  })()
  $: recentEvents = (matchData?.events || []).slice(-5).reverse()
</script>

<div class="viewer">
  <div class="viewer-header">
    <div class="live-badge"><span class="dot"></span>LIVE</div>
    <div class="viewer-meta">
      {matchData?.opposition ? `vs ${matchData.opposition}` : 'Match in progress'}
      {#if matchData?.period} · {matchData.period}{/if}
    </div>
    <button class="close-btn" on:click={onClose}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  {#if !connected}
    <div class="status-msg">Connecting…</div>
  {:else if !matchData}
    <div class="status-msg">Waiting for match data…</div>
  {:else}
    <div class="scoreboard">
      <div class="score-side" class:winning={homePts > awayPts}>
        <div class="score-label">{matchData.teamName || 'Home'}</div>
        <div class="score-val">{formatScore(home)}</div>
      </div>
      <div class="score-sep">–</div>
      <div class="score-side" class:winning={awayPts > homePts}>
        <div class="score-label">{matchData.opposition || 'Away'}</div>
        <div class="score-val">{formatScore(away)}</div>
      </div>
    </div>

    {#if topPlayers.length > 0}
      <div class="section">
        <div class="section-title">Top performers</div>
        {#each topPlayers as p}
          <div class="row">
            <span class="row-name">{p.name}</span>
            <span class="row-pts">{Math.floor(p.pts/3)}-{String(p.pts%3).padStart(2,'0')}</span>
            <span class="row-total">{p.total} actions</span>
          </div>
        {/each}
      </div>
    {/if}

    {#if recentEvents.length > 0}
      <div class="section">
        <div class="section-title">Recent events</div>
        {#each recentEvents as ev}
          <div class="row">
            <span class="row-time">{ev.time ?? '–'}'</span>
            <span class="row-stat">{ev.stat}</span>
            <span class="row-player">{(matchData.players || []).find(p => p.id === ev.playerId)?.name ?? ''}</span>
          </div>
        {/each}
      </div>
    {/if}

    {#if lastUpdate}
      <div class="last-update">Updated {lastUpdate.toLocaleTimeString()}</div>
    {/if}
  {/if}
</div>

<style>
  .viewer { display: flex; flex-direction: column; gap: 16px; }

  .viewer-header { display: flex; align-items: center; gap: 10px; }
  .live-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: #e53935; color: white;
    font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
    padding: 4px 10px; border-radius: 20px; flex-shrink: 0;
  }
  .dot {
    width: 7px; height: 7px; border-radius: 50%; background: white;
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  .viewer-meta { flex: 1; font-size: 13px; color: var(--text-muted); }
  .close-btn {
    width: 32px; height: 32px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--surface-2);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--text-muted);
  }
  .close-btn:hover { color: var(--text); }

  .status-msg { text-align: center; color: var(--text-faint); font-size: 13px; padding: 24px 0; }

  .scoreboard {
    display: flex; align-items: center; justify-content: center; gap: 12px;
    background: #1a1a1a; border-radius: 14px; padding: 20px; color: white;
  }
  .score-side { text-align: center; flex: 1; }
  .score-label { font-size: 11px; font-weight: 600; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
  .score-val { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; }
  .score-side.winning .score-val { color: #7bc47f; }
  .score-sep { font-size: 24px; font-weight: 300; opacity: 0.4; }

  .section { display: flex; flex-direction: column; gap: 6px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-faint); }

  .row {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px; background: var(--surface-2);
    border-radius: 8px; border: 1px solid var(--border);
  }
  .row-name { flex: 1; font-size: 13px; font-weight: 600; color: var(--text); }
  .row-pts { font-size: 13px; font-weight: 700; color: var(--primary); min-width: 36px; }
  .row-total, .row-player { font-size: 11px; color: var(--text-faint); }
  .row-time { font-size: 11px; color: var(--text-faint); min-width: 24px; }
  .row-stat { font-size: 12px; font-weight: 600; color: var(--text); flex: 1; }

  .last-update { font-size: 11px; color: var(--text-faint); text-align: center; }
</style>
