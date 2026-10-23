package expo.modules.blocking

import android.content.Context

internal data class BlockingSessionState(
  val active: Boolean,
  val mode: String,
  val phase: String?,
  val currentRound: Int,
  val totalRounds: Int,
  val phaseStartedAt: Long,
  val phaseEndsAt: Long,
  val sessionStartedAt: Long,
  val studyDurationSeconds: Int,
  val breakDurationSeconds: Int,
  // True once the current Cycle phase has run out. It waits here until the user moves on.
  val awaiting: Boolean = false
)

internal data class CycleResult(
  val focusSeconds: Long,
  val completed: Boolean
)

internal object BlockingPreferences {
  private const val FILE = "tafik_blocking"
  private const val ACTIVE = "active"
  private const val BLOCKLIST = "blocklist"
  private const val SESSION_MODE = "sessionMode"
  private const val SESSION_STARTED_AT = "sessionStartedAt"
  private const val STUDY_DURATION_MS = "studyDurationMs"
  private const val BREAK_DURATION_MS = "breakDurationMs"
  private const val TOTAL_ROUNDS = "totalRounds"
  private const val PENDING_CYCLE_FOCUS_MS = "pendingCycleFocusMs"
  private const val PENDING_CYCLE_COMPLETED = "pendingCycleCompleted"
  // The current Cycle phase, its round, and when it began. Each phase keeps its own start time, so a
  // phase that has run out can wait for the user without the next one starting on its own.
  private const val CURSOR_PHASE = "cursorPhase"
  private const val CURSOR_ROUND = "cursorRound"
  private const val CURSOR_STARTED_AT = "cursorStartedAt"
  // Study time already completed in this session, so the total survives a long wait.
  private const val BANKED_FOCUS_MS = "bankedFocusMs"
  // The phase whose completion alert has already been posted, so each one sounds once.
  private const val ALERTED_KEY = "alertedKey"

  const val MODE_NONE = "none"
  const val MODE_TAFIK = "tafik"
  const val MODE_CYCLE = "cycle"
  const val PHASE_STUDY = "study"
  const val PHASE_BREAK = "break"

  private fun prefs(context: Context) =
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  // Written by earlier builds and unreachable now. The shield draws a fixed
  // line, so nothing will ever read the message a user once saved here.
  private val RETIRED_KEYS = listOf("shieldMessage")

  fun dropRetiredKeys(context: Context) {
    val editor = prefs(context).edit()
    RETIRED_KEYS.forEach(editor::remove)
    editor.apply()
  }

  @Synchronized
  fun start(context: Context, packages: List<String>) {
    prefs(context).edit()
      .putBoolean(ACTIVE, true)
      .putStringSet(BLOCKLIST, packages.toSet())
      .putString(SESSION_MODE, MODE_TAFIK)
      .putLong(SESSION_STARTED_AT, System.currentTimeMillis())
      .commit()
  }

  @Synchronized
  fun startCycle(
    context: Context,
    packages: List<String>,
    studyDurationSeconds: Int,
    breakDurationSeconds: Int,
    rounds: Int
  ) {
    val now = System.currentTimeMillis()
    prefs(context).edit()
      .putBoolean(ACTIVE, true)
      .putStringSet(BLOCKLIST, packages.toSet())
      .putString(SESSION_MODE, MODE_CYCLE)
      .putLong(SESSION_STARTED_AT, now)
      .putLong(STUDY_DURATION_MS, studyDurationSeconds * 1000L)
      .putLong(BREAK_DURATION_MS, breakDurationSeconds * 1000L)
      .putInt(TOTAL_ROUNDS, rounds)
      .putString(CURSOR_PHASE, PHASE_STUDY)
      .putInt(CURSOR_ROUND, 1)
      .putLong(CURSOR_STARTED_AT, now)
      .putLong(BANKED_FOCUS_MS, 0L)
      .putString(ALERTED_KEY, "")
      .commit()
  }

  @Synchronized
  fun stop(context: Context) {
    val state = sessionState(context)
    if (state.active && state.mode == MODE_CYCLE) {
      finishCycle(context, bankedFocusAt(context, System.currentTimeMillis()), completed = false)
      return
    }
    prefs(context).edit().putBoolean(ACTIVE, false).commit()
  }

  fun isActive(context: Context): Boolean = sessionState(context).active

  fun shouldBlockNow(context: Context): Boolean {
    val state = sessionState(context)
    return state.active && (state.mode == MODE_TAFIK || state.phase == PHASE_STUDY)
  }

  /**
   * Cycle is derived from one persisted wall-clock start time. That keeps
   * Study/Break transitions moving when React Native is asleep and lets a
   * restarted foreground service recover the correct round immediately.
   */
  @Synchronized
  fun sessionState(context: Context, now: Long = System.currentTimeMillis()): BlockingSessionState {
    val preferences = prefs(context)
    if (!preferences.getBoolean(ACTIVE, false)) return inactiveState()

    val mode = preferences.getString(SESSION_MODE, MODE_TAFIK) ?: MODE_TAFIK
    val startedAt = preferences.getLong(SESSION_STARTED_AT, now)
    if (mode != MODE_CYCLE) {
      return BlockingSessionState(
        active = true,
        mode = MODE_TAFIK,
        phase = null,
        currentRound = 0,
        totalRounds = 0,
        phaseStartedAt = startedAt,
        phaseEndsAt = 0L,
        sessionStartedAt = startedAt,
        studyDurationSeconds = 0,
        breakDurationSeconds = 0
      )
    }

    val studyMs = preferences.getLong(STUDY_DURATION_MS, 25 * 60 * 1000L).coerceAtLeast(1000L)
    val breakMs = preferences.getLong(BREAK_DURATION_MS, 5 * 60 * 1000L).coerceAtLeast(1000L)
    val rounds = preferences.getInt(TOTAL_ROUNDS, 1).coerceAtLeast(1)
    // The phase in progress comes from its own stored start. Once its time has run out, it stays
    // here, flagged as awaiting, until the user moves the cycle on.
    val studyPhase = (preferences.getString(CURSOR_PHASE, PHASE_STUDY) ?: PHASE_STUDY) == PHASE_STUDY
    val round = preferences.getInt(CURSOR_ROUND, 1).coerceIn(1, rounds)
    val phaseStartedAt = preferences.getLong(CURSOR_STARTED_AT, startedAt)
    val phaseEndsAt = phaseStartedAt + if (studyPhase) studyMs else breakMs

    return BlockingSessionState(
      active = true,
      mode = MODE_CYCLE,
      phase = if (studyPhase) PHASE_STUDY else PHASE_BREAK,
      currentRound = round,
      totalRounds = rounds,
      phaseStartedAt = phaseStartedAt,
      phaseEndsAt = phaseEndsAt,
      sessionStartedAt = startedAt,
      studyDurationSeconds = (studyMs / 1000L).toInt(),
      breakDurationSeconds = (breakMs / 1000L).toInt(),
      awaiting = now >= phaseEndsAt
    )
  }

  @Synchronized
  fun consumeCycleResult(context: Context): CycleResult {
    // Resolve a just-finished cycle before reading the pending result.
    sessionState(context)
    val preferences = prefs(context)
    val result = CycleResult(
      focusSeconds = preferences.getLong(PENDING_CYCLE_FOCUS_MS, 0L) / 1000L,
      completed = preferences.getBoolean(PENDING_CYCLE_COMPLETED, false)
    )
    preferences.edit()
      .remove(PENDING_CYCLE_FOCUS_MS)
      .remove(PENDING_CYCLE_COMPLETED)
      .commit()
    return result
  }

  fun blocklist(context: Context): Set<String> =
    prefs(context).getStringSet(BLOCKLIST, emptySet())?.toSet() ?: emptySet()

  /** Study time banked so far, plus the Study in progress if the user ends the session now. */
  private fun bankedFocusAt(context: Context, now: Long): Long {
    val preferences = prefs(context)
    val banked = preferences.getLong(BANKED_FOCUS_MS, 0L).coerceAtLeast(0L)
    val studyMs = preferences.getLong(STUDY_DURATION_MS, 0L).coerceAtLeast(0L)
    val inStudy = (preferences.getString(CURSOR_PHASE, PHASE_STUDY) ?: PHASE_STUDY) == PHASE_STUDY
    if (!inStudy) return banked
    val phaseStartedAt = preferences.getLong(CURSOR_STARTED_AT, now)
    return banked + minOf((now - phaseStartedAt).coerceAtLeast(0L), studyMs)
  }

  /**
   * Moves a held cycle on: Study to Break, Break to the next Study, or, after the last Break, the
   * session completes. Returns false when no phase is waiting, so a repeated tap does nothing.
   */
  @Synchronized
  fun advanceCycle(context: Context, now: Long = System.currentTimeMillis()): Boolean {
    val state = sessionState(context, now)
    if (!state.active || state.mode != MODE_CYCLE || !state.awaiting) return false
    val preferences = prefs(context)
    if (state.phase == PHASE_STUDY) {
      val studyMs = preferences.getLong(STUDY_DURATION_MS, 0L)
      preferences.edit()
        .putLong(BANKED_FOCUS_MS, preferences.getLong(BANKED_FOCUS_MS, 0L) + studyMs)
        .putString(CURSOR_PHASE, PHASE_BREAK)
        .putLong(CURSOR_STARTED_AT, now)
        .commit()
      return true
    }
    if (state.currentRound < state.totalRounds) {
      preferences.edit()
        .putString(CURSOR_PHASE, PHASE_STUDY)
        .putInt(CURSOR_ROUND, state.currentRound + 1)
        .putLong(CURSOR_STARTED_AT, now)
        .commit()
      return true
    }
    finishCycleSession(context, now)
    return true
  }

  /** Completes the session after its last Break, through the same finish path as an early stop. */
  @Synchronized
  fun finishCycleSession(context: Context, now: Long = System.currentTimeMillis()) {
    val state = sessionState(context, now)
    if (!state.active || state.mode != MODE_CYCLE) return
    finishCycle(context, bankedFocusAt(context, now), completed = true)
  }

  /** Identifies one waiting phase, so its completion alert is posted once. */
  fun alertKey(state: BlockingSessionState): String = "${state.phase}:${state.currentRound}"

  @Synchronized
  fun alertedKey(context: Context): String = prefs(context).getString(ALERTED_KEY, "") ?: ""

  @Synchronized
  fun markAlerted(context: Context, key: String) {
    prefs(context).edit().putString(ALERTED_KEY, key).commit()
  }

  private fun finishCycle(context: Context, focusMillis: Long, completed: Boolean) {
    val preferences = prefs(context)
    val pendingFocus = preferences.getLong(PENDING_CYCLE_FOCUS_MS, 0L)
    val pendingCompleted = preferences.getBoolean(PENDING_CYCLE_COMPLETED, false)
    preferences.edit()
      .putBoolean(ACTIVE, false)
      .putLong(PENDING_CYCLE_FOCUS_MS, pendingFocus + focusMillis.coerceAtLeast(0L))
      .putBoolean(PENDING_CYCLE_COMPLETED, pendingCompleted || completed)
      .commit()
  }

  private fun inactiveState() = BlockingSessionState(
    active = false,
    mode = MODE_NONE,
    phase = null,
    currentRound = 0,
    totalRounds = 0,
    phaseStartedAt = 0L,
    phaseEndsAt = 0L,
    sessionStartedAt = 0L,
    studyDurationSeconds = 0,
    breakDurationSeconds = 0
  )
}
