<script>
  import { onMount } from 'svelte'
  import { getDB, loadMatches } from './db.js'
  import { settingsStore } from './settings-store.js'

  let settings = { ...$settingsStore, quickViewSections: { ...$settingsStore.quickViewSections } }
  let savedFlash = false
  let saveTimer = null
  let exportSuccess = false
  let newCustomStat = ''
  let newPeriod = ''

  const PRESET_PERIODS = ['Warm-up', '1st Half', '2nd Half', 'Extra Time']
  const REQUIRED_PERIODS = ['1st Half', '2nd Half']

  const allPossibleStats = [
    'Point', 'Goal', 'Wide', 'Tackle', 'Block',
    'Turnover Won', 'Turnover Lost', 'Free Won',
    'Yellow Card', 'Red Card', 'Penalty Won', 'Penalty Scored'
  ]

  function autoSave() {
    settingsStore.save(settings)
    savedFlash = true
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => savedFlash = false, 1500)
  }

  // ── Stats ──
  function toggleStat(stat) {
    if (settings.defaultStats.includes(stat)) {
      if (settings.defaultStats.length <= 1) return
      settings.defaultStats = settings.defaultStats.filter(s => s !== stat)
    } else {
      settings.defaultStats = [...settings.defaultStats, stat]
    }
    autoSave()
  }

  function addCustomDefaultStat() {
    const trimmed = newCustomStat.trim()
    if (!trimmed || settings.defaultStats.includes(trimmed)) return
    settings.defaultStats = [...settings.defaultStats, trimmed]
    newCustomStat = ''
    autoSave()
  }

  $: builtInStats = allPossibleStats
  $: customDefaultStats = settings.defaultStats.filter(s => !allPossibleStats.includes(s))

  // ── Periods ──
  function isPeriodActive(p) { return settings.periods.includes(p) }
  function isPeriodRequired(p) { return REQUIRED_PERIODS.includes(p) }

  function togglePeriod(p) {
    if (isPeriodRequired(p)) return
    if (isPeriodActive(p)) {
      settings.periods = settings.periods.filter(x => x !== p)
      // If defaultPeriod was the removed one, reset to first active
      if (settings.defaultPeriod === p) {
        settings.defaultPeriod = settings.periods[0] || '1st Half'
      }
    } else {
      // Re-insert in logical order: presets first in PRESET_PERIODS order, then custom
      const presetOrder = PRESET_PERIODS.filter(x => isPeriodActive(x) || x === p)
      const customPeriods = settings.periods.filter(x => !PRESET_PERIODS.includes(x))
      settings.periods = [...presetOrder, ...customPeriods]
    }
    autoSave()
  }

  function addCustomPeriod() {
    const trimmed = newPeriod.trim()
    if (!trimmed || settings.periods.includes(trimmed)) return
    settings.periods = [...settings.periods, trimmed]
    newPeriod = ''
    autoSave()
  }

  function removeCustomPeriod(p) {
    settings.periods = settings.periods.filter(x => x !== p)
    if (settings.defaultPeriod === p) {
      settings.defaultPeriod = settings.periods[0] || '1st Half'
    }
    autoSave()
  }

  $: customPeriods = settings.periods.filter(p => !PRESET_PERIODS.includes(p))

  // ── Data export ──
  async function exportData() {
    const matches = await loadMatches()
    const db = await getDB()
    const squad = await db.getAll('squad')
    const data = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      settings,
      squad,
      matches
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `doora-stats-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    exportSuccess = true
    setTimeout(() => exportSuccess = false, 3000)
  }
</script>

<div class="screen">

  <!-- HEADER -->
  <div class="page-header">
    <div>
      <h2>Settings</h2>
      <p>Configure every aspect of the app for your team</p>
    </div>
    <div class="saved-badge" class:visible={savedFlash}>Saved</div>
  </div>

  <!-- ── TEAM ── -->
  <div class="section-block">
    <div class="section-title">Team</div>
    <div class="card">
      <div class="field-group">
        <label>Team name</label>
        <input bind:value={settings.teamName} on:input={autoSave} placeholder="e.g. Doora Barefield" />
      </div>
      <div class="field-group">
        <label>Age group</label>
        <select bind:value={settings.ageGroup} on:change={autoSave}>
          <option value="U12">U12</option>
          <option value="U13">U13</option>
          <option value="U14">U14</option>
          <option value="U15">U15</option>
          <option value="U16">U16</option>
          <option value="Minor">Minor (U17)</option>
          <option value="U18">U18</option>
          <option value="U20">U20</option>
          <option value="Junior">Junior</option>
          <option value="Senior">Senior</option>
        </select>
      </div>
    </div>
  </div>

  <!-- ── MATCH SETUP ── -->
  <div class="section-block">
    <div class="section-title">Match Setup</div>
    <div class="card">
      <div class="card-desc">Choose which fields appear when starting a new match.</div>

      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Venue field</div>
          <div class="toggle-sub">Show a "Venue" input on the match setup screen</div>
        </div>
        <button
          class="toggle-switch"
          class:on={settings.showVenueField}
          on:click={() => { settings.showVenueField = !settings.showVenueField; autoSave() }}
          aria-label="Toggle venue field"
        ><span class="toggle-thumb"></span></button>
      </div>

      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Competition field</div>
          <div class="toggle-sub">Show a "Competition" input (e.g. County Championship)</div>
        </div>
        <button
          class="toggle-switch"
          class:on={settings.showCompetitionField}
          on:click={() => { settings.showCompetitionField = !settings.showCompetitionField; autoSave() }}
          aria-label="Toggle competition field"
        ><span class="toggle-thumb"></span></button>
      </div>

      <div class="field-group" style="margin-top:4px">
        <label>Default starting period</label>
        <select bind:value={settings.defaultPeriod} on:change={autoSave}>
          {#each settings.periods as p}
            <option value={p}>{p}</option>
          {/each}
        </select>
        <div class="field-hint">The period that is active when a new match begins.</div>
      </div>
    </div>
  </div>

  <!-- ── MATCH PERIODS ── -->
  <div class="section-block">
    <div class="section-title">Match Periods</div>
    <div class="card">
      <div class="card-desc">Choose which period options appear during a match. 1st Half and 2nd Half are always included.</div>

      <div class="periods-list">
        {#each PRESET_PERIODS as p}
          <div class="period-row" class:required={isPeriodRequired(p)}>
            <button
              class="period-check"
              class:checked={isPeriodActive(p)}
              class:locked={isPeriodRequired(p)}
              on:click={() => togglePeriod(p)}
              disabled={isPeriodRequired(p)}
            >
              {#if isPeriodActive(p)}
                <svg style="width:12px;height:12px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              {/if}
            </button>
            <span class="period-name">{p}</span>
            {#if isPeriodRequired(p)}<span class="required-tag">required</span>{/if}
          </div>
        {/each}

        {#each customPeriods as p}
          <div class="period-row">
            <button class="period-check checked" disabled>
              <svg style="width:12px;height:12px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <span class="period-name">{p}</span>
            <button class="remove-period-btn" on:click={() => removeCustomPeriod(p)}>
              <svg style="width:13px;height:13px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        {/each}
      </div>

      <div class="add-period-row">
        <input
          bind:value={newPeriod}
          placeholder="Add custom period (e.g. Penalties)"
          on:keydown={e => e.key === 'Enter' && addCustomPeriod()}
        />
        <button class="add-small-btn" on:click={addCustomPeriod}>Add</button>
      </div>
    </div>
  </div>

  <!-- ── DEFAULT STATS ── -->
  <div class="section-block">
    <div class="section-title">Default Stats</div>
    <div class="card">
      <div class="card-desc">These stat buttons appear in every new match. Toggle to enable or disable. At least one must be active.</div>

      <div class="stats-grid">
        {#each builtInStats as stat}
          <button
            class="stat-toggle"
            class:active={settings.defaultStats.includes(stat)}
            on:click={() => toggleStat(stat)}
          >
            <span class="toggle-check">
              {#if settings.defaultStats.includes(stat)}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              {/if}
            </span>
            {stat}
          </button>
        {/each}
      </div>

      <div class="add-stat-row">
        <input
          bind:value={newCustomStat}
          placeholder="Add a custom stat..."
          on:keydown={e => e.key === 'Enter' && addCustomDefaultStat()}
        />
        <button class="add-small-btn" on:click={addCustomDefaultStat}>Add</button>
      </div>

      {#if customDefaultStats.length > 0}
        <div class="custom-list">
          <div class="custom-list-label">Custom stats</div>
          {#each customDefaultStats as stat}
            <div class="custom-list-row">
              <span>{stat}</span>
              <button class="remove-text-btn" on:click={() => toggleStat(stat)}>Remove</button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- ── TRACKING ── -->
  <div class="section-block">
    <div class="section-title">Tracking Features</div>
    <div class="card">
      <div class="card-desc">Toggle entire tracking features on or off. Disabling a feature hides its buttons and removes it from the stats view.</div>

      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Puckout tracking</div>
          <div class="toggle-sub">Log every puckout as won/lost with player and zone info</div>
        </div>
        <button
          class="toggle-switch"
          class:on={settings.trackPuckouts}
          on:click={() => { settings.trackPuckouts = !settings.trackPuckouts; autoSave() }}
          aria-label="Toggle puckout tracking"
        ><span class="toggle-thumb"></span></button>
      </div>

      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Opposition score tracking</div>
          <div class="toggle-sub">Record which opposition player scored and who was marking</div>
        </div>
        <button
          class="toggle-switch"
          class:on={settings.trackOppScores}
          on:click={() => { settings.trackOppScores = !settings.trackOppScores; autoSave() }}
          aria-label="Toggle opposition score tracking"
        ><span class="toggle-thumb"></span></button>
      </div>

      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Pitch coordinates</div>
          <div class="toggle-sub">Show the pitch map after each stat to record where it happened</div>
        </div>
        <button
          class="toggle-switch"
          class:on={settings.trackPitchCoords}
          on:click={() => { settings.trackPitchCoords = !settings.trackPitchCoords; autoSave() }}
          aria-label="Toggle pitch coordinates"
        ><span class="toggle-thumb"></span></button>
      </div>
    </div>
  </div>

  <!-- ── QUICK VIEW STATS ── -->
  <div class="section-block">
    <div class="section-title">Quick View Stats</div>
    <div class="card">
      <div class="card-desc">Choose which sections are expanded by default when you open the Stats view during a match.</div>

      {#each [
        { key: 'puckouts', label: 'Puckouts', sub: 'Win/loss rates, zone heatmap, player breakdowns' },
        { key: 'conceded', label: 'Scores Conceded', sub: 'Goals and points conceded by marker' },
        { key: 'players', label: 'Player Stats', sub: 'Full stat counts for all players' },
        { key: 'subs', label: 'Substitutions', sub: 'Sub log with times' }
      ] as section}
        <div class="toggle-row">
          <div class="toggle-info">
            <div class="toggle-label">{section.label}</div>
            <div class="toggle-sub">{section.sub}</div>
          </div>
          <button
            class="toggle-switch"
            class:on={settings.quickViewSections[section.key]}
            on:click={() => {
              settings.quickViewSections = { ...settings.quickViewSections, [section.key]: !settings.quickViewSections[section.key] }
              autoSave()
            }}
            aria-label="Toggle {section.label}"
          ><span class="toggle-thumb"></span></button>
        </div>
      {/each}
    </div>
  </div>

  <!-- ── TIMER ── -->
  <div class="section-block">
    <div class="section-title">Match Timer</div>
    <div class="card">
      <div class="field-group">
        <label>Period length (minutes)</label>
        <div class="period-row">
          <input
            type="range"
            min="15"
            max="40"
            step="5"
            bind:value={settings.periodLength}
            on:input={autoSave}
          />
          <span class="period-val">{settings.periodLength} min</span>
        </div>
        <div class="field-hint">Used as a reference — the timer highlights when this time is reached.</div>
      </div>
    </div>
  </div>

  <!-- ── APPEARANCE ── -->
  <div class="section-block">
    <div class="section-title">Appearance</div>
    <div class="card">
      <div class="toggle-row">
        <div class="toggle-info">
          <div class="toggle-label">Dark mode</div>
          <div class="toggle-sub">Easier on the eyes in low light conditions</div>
        </div>
        <button
          class="toggle-switch"
          class:on={settings.darkMode}
          on:click={() => { settings.darkMode = !settings.darkMode; autoSave() }}
          aria-label="Toggle dark mode"
        ><span class="toggle-thumb"></span></button>
      </div>
    </div>
  </div>

  <!-- ── DATA BACKUP ── -->
  <div class="section-block">
    <div class="section-title">Data Backup</div>
    <div class="card">
      <div class="card-desc">Download a full backup of all your matches, squad, and settings as a JSON file.</div>
      <button class="export-btn" class:success={exportSuccess} on:click={exportData}>
        {#if exportSuccess}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><polyline points="20 6 9 17 4 12"/></svg>
          Backup downloaded
        {:else}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download backup
        {/if}
      </button>
    </div>
  </div>

  <!-- ── ABOUT ── -->
  <div class="section-block">
    <div class="section-title">About</div>
    <div class="card about-card">
      <div class="about-row">
        <span class="about-label">App</span>
        <span class="about-val">Doora Barefield Stats</span>
      </div>
      <div class="about-row">
        <span class="about-label">Version</span>
        <span class="about-val">1.0.0</span>
      </div>
      <div class="about-row">
        <span class="about-label">Built for</span>
        <span class="about-val">Doora Barefield GAA</span>
      </div>
      <div class="about-row">
        <span class="about-label">Storage</span>
        <span class="about-val">Local (IndexedDB) + Supabase</span>
      </div>
    </div>
  </div>

</div>

<style>
  .screen { display: flex; flex-direction: column; gap: 0; padding-bottom: 2rem; }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 20px;
  }
  .page-header h2 { font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
  .page-header p { font-size: 13px; color: var(--text-muted); }

  .saved-badge {
    padding: 6px 14px;
    border-radius: 20px;
    background: #2d7a2d;
    color: white;
    font-size: 13px;
    font-weight: 600;
    opacity: 0;
    transition: opacity 0.2s;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .saved-badge.visible { opacity: 1; }

  /* Section blocks */
  .section-block { margin-bottom: 20px; }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
    margin-bottom: 8px;
  }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .card-desc {
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.5;
    margin-top: -4px;
    margin-bottom: -2px;
  }

  /* Form fields */
  .field-group { display: flex; flex-direction: column; gap: 6px; }
  .field-group label { font-size: 12px; font-weight: 600; color: var(--text-2); }
  .field-group input, .field-group select {
    padding: 13px 14px;
    border: 1.5px solid var(--input-border);
    border-radius: 10px;
    font-size: 16px;
    font-family: inherit;
    background: var(--surface-3);
    color: var(--text);
    transition: all 0.15s;
    min-height: 46px;
  }
  .field-group input:focus, .field-group select:focus {
    outline: none;
    border-color: #6B1B2B;
    background: var(--surface);
    box-shadow: 0 0 0 3px rgba(107,27,43,0.08);
  }
  .field-hint { font-size: 12px; color: var(--text-faint); line-height: 1.4; }

  /* Toggle switch rows */
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 4px 0;
    border-top: 1px solid var(--divider-faint);
  }
  .toggle-row:first-of-type { border-top: none; }
  .toggle-info { flex: 1; }
  .toggle-label { font-size: 14px; font-weight: 600; color: var(--text); }
  .toggle-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; line-height: 1.4; }

  .toggle-switch {
    position: relative; width: 48px; height: 28px; border-radius: 14px;
    border: none; background: var(--divider); cursor: pointer; transition: background 0.2s;
    flex-shrink: 0; padding: 0;
  }
  .toggle-switch.on { background: #6B1B2B; }
  .toggle-thumb {
    position: absolute; top: 3px; left: 3px;
    width: 22px; height: 22px; border-radius: 50%;
    background: white; transition: transform 0.2s; display: block;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  .toggle-switch.on .toggle-thumb { transform: translateX(20px); }

  /* Stats grid */
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .stat-toggle {
    display: flex; align-items: center; gap: 8px;
    padding: 11px 12px; border-radius: 8px;
    border: 1.5px solid var(--input-border);
    background: var(--surface); font-size: 14px; font-weight: 500;
    color: var(--text-muted); cursor: pointer; font-family: inherit;
    transition: all 0.15s; text-align: left; min-height: 44px;
  }
  .stat-toggle.active { border-color: #6B1B2B; color: var(--text); background: rgba(107,27,43,0.08); }
  .toggle-check {
    width: 18px; height: 18px; border-radius: 4px;
    border: 1.5px solid var(--input-border); background: var(--surface);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; color: white;
  }
  .stat-toggle.active .toggle-check { background: #6B1B2B; border-color: #6B1B2B; }
  .toggle-check svg { width: 11px; height: 11px; }

  /* Add stat / add period row */
  .add-stat-row, .add-period-row { display: flex; gap: 8px; }
  .add-stat-row input, .add-period-row input {
    flex: 1; padding: 11px 12px;
    border: 1.5px solid var(--input-border); border-radius: 8px;
    font-size: 16px; font-family: inherit;
    background: var(--surface-3); color: var(--text); min-height: 44px;
  }
  .add-stat-row input:focus, .add-period-row input:focus {
    outline: none; border-color: #6B1B2B; background: var(--surface);
  }
  .add-small-btn {
    padding: 11px 16px; border-radius: 8px; border: none;
    background: #6B1B2B; color: white; font-size: 14px; font-weight: 600;
    cursor: pointer; font-family: inherit; min-height: 44px; white-space: nowrap;
  }

  /* Custom stat list */
  .custom-list { border-top: 1px solid var(--divider); padding-top: 10px; display: flex; flex-direction: column; gap: 4px; }
  .custom-list-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-faint); margin-bottom: 4px; }
  .custom-list-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--text); padding: 4px 0; }
  .remove-text-btn { background: none; border: none; color: #e53935; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }

  /* Periods list */
  .periods-list { display: flex; flex-direction: column; gap: 2px; }
  .period-row {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 4px; border-radius: 6px; transition: background 0.1s;
  }
  .period-row:hover:not(.required) { background: var(--surface-2); }
  .period-check {
    width: 20px; height: 20px; border-radius: 5px;
    border: 1.5px solid var(--input-border); background: var(--surface);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; flex-shrink: 0; color: white; transition: all 0.15s;
  }
  .period-check.checked { background: #6B1B2B; border-color: #6B1B2B; }
  .period-check.locked { opacity: 0.5; cursor: not-allowed; }
  .period-name { font-size: 14px; color: var(--text); flex: 1; }
  .required-tag { font-size: 11px; color: var(--text-faint); background: var(--surface-2); padding: 2px 7px; border-radius: 4px; }
  .remove-period-btn {
    background: none; border: none; color: var(--text-faint); cursor: pointer;
    padding: 4px; border-radius: 4px; display: flex; align-items: center;
  }
  .remove-period-btn:hover { color: #e53935; background: rgba(229,57,53,0.08); }

  /* Period length slider */
  .period-row { display: flex; align-items: center; gap: 12px; }
  .period-row input[type="range"] { flex: 1; accent-color: #6B1B2B; }
  .period-val { font-size: 15px; font-weight: 700; color: #6B1B2B; min-width: 56px; }

  /* Export button */
  .export-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 11px 18px; border-radius: 10px;
    border: 1.5px solid #6B1B2B; background: none;
    color: #6B1B2B; font-size: 14px; font-weight: 600;
    cursor: pointer; font-family: inherit; transition: all 0.15s; width: fit-content;
  }
  .export-btn:hover { background: #6B1B2B; color: white; }
  .export-btn.success { background: #e6f4ea; border-color: #2d7a2d; color: #2d7a2d; }

  /* About */
  .about-card { gap: 0; }
  .about-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 9px 0; border-bottom: 1px solid var(--divider-faint); font-size: 13px;
  }
  .about-row:last-child { border-bottom: none; }
  .about-label { color: var(--text-faint); }
  .about-val { font-weight: 500; color: var(--text); text-align: right; }

  @media (max-width: 480px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .page-header { flex-wrap: wrap; }
  }
</style>
