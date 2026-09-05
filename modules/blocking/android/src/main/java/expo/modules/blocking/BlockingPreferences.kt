package expo.modules.blocking

import android.content.Context
import android.content.res.Configuration

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
  val breakDurationSeconds: Int
)

internal data class StudInResult(
  val focusSeconds: Long,
  val completed: Boolean
)

internal object BlockingPreferences {
  private const val FILE = "tockin_blocking"
  private const val ACTIVE = "active"
  private const val BLOCKLIST = "blocklist"
  private const val APPEARANCE = "appearance"
  private const val SESSION_MODE = "sessionMode"
  private const val SESSION_STARTED_AT = "sessionStartedAt"
  private const val STUDY_DURATION_MS = "studyDurationMs"
  private const val BREAK_DURATION_MS = "breakDurationMs"
  private const val TOTAL_ROUNDS = "totalRounds"
  private const val PENDING_STUDIN_FOCUS_MS = "pendingStudInFocusMs"
  private const val PENDING_STUDIN_COMPLETED = "pendingStudInCompleted"

  const val MODE_NONE = "none"
  const val MODE_TOCKIN = "tockin"
  const val MODE_STUDIN = "studin"
  const val PHASE_STUDY = "study"
  const val PHASE_BREAK = "break"

  private fun prefs(context: Context) =
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  @Synchronized
  fun start(context: Context, packages: List<String>) {
    prefs(context).edit()
      .putBoolean(ACTIVE, true)
      .putStringSet(BLOCKLIST, packages.toSet())
      .putString(SESSION_MODE, MODE_TOCKIN)
      .putLong(SESSION_STARTED_AT, System.currentTimeMillis())
      .commit()
  }

  @Synchronized
  fun startStudIn(
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
      .putString(SESSION_MODE, MODE_STUDIN)
      .putLong(SESSION_STARTED_AT, now)
      .putLong(STUDY_DURATION_MS, studyDurationSeconds * 1000L)
      .putLong(BREAK_DURATION_MS, breakDurationSeconds * 1000L)
      .putInt(TOTAL_ROUNDS, rounds)
      .commit()
  }

  @Synchronized
  fun stop(context: Context) {
    val state = sessionState(context)
    if (state.active && state.mode == MODE_STUDIN) {
      finishStudIn(context, focusedMillisAt(context, System.currentTimeMillis()), completed = false)
      return
    }
    prefs(context).edit().putBoolean(ACTIVE, false).commit()
  }

  fun isActive(context: Context): Boolean = sessionState(context).active

  fun shouldBlockNow(context: Context): Boolean {
    val state = sessionState(context)
    return state.active && (state.mode == MODE_TOCKIN || state.phase == PHASE_STUDY)
  }

  /**
   * StudIn is derived from one persisted wall-clock start time. That keeps
   * Study/Break transitions moving when React Native is asleep and lets a
   * restarted foreground service recover the correct round immediately.
   */
  @Synchronized
  fun sessionState(context: Context, now: Long = System.currentTimeMillis()): BlockingSessionState {
    val preferences = prefs(context)
    if (!preferences.getBoolean(ACTIVE, false)) return inactiveState()

    val mode = preferences.getString(SESSION_MODE, MODE_TOCKIN) ?: MODE_TOCKIN
    val startedAt = preferences.getLong(SESSION_STARTED_AT, now)
    if (mode != MODE_STUDIN) {
      return BlockingSessionState(
        active = true,
        mode = MODE_TOCKIN,
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
    val elapsed = (now - startedAt).coerceAtLeast(0L)
    val totalDuration = studyMs * rounds + breakMs * (rounds - 1)

    if (elapsed >= totalDuration) {
      finishStudIn(context, studyMs * rounds, completed = true)
      return inactiveState()
    }

    val cycleMs = studyMs + breakMs
    val roundIndex = (elapsed / cycleMs).toInt().coerceIn(0, rounds - 1)
    val withinRound = elapsed - roundIndex * cycleMs
    val studyPhase = withinRound < studyMs
    val phaseStartedAt = if (studyPhase) {
      startedAt + roundIndex * cycleMs
    } else {
      startedAt + roundIndex * cycleMs + studyMs
    }
    val phaseEndsAt = if (studyPhase) {
      startedAt + roundIndex * cycleMs + studyMs
    } else {
      startedAt + (roundIndex + 1) * cycleMs
    }

    return BlockingSessionState(
      active = true,
      mode = MODE_STUDIN,
      phase = if (studyPhase) PHASE_STUDY else PHASE_BREAK,
      currentRound = roundIndex + 1,
      totalRounds = rounds,
      phaseStartedAt = phaseStartedAt,
      phaseEndsAt = phaseEndsAt,
      sessionStartedAt = startedAt,
      studyDurationSeconds = (studyMs / 1000L).toInt(),
      breakDurationSeconds = (breakMs / 1000L).toInt()
    )
  }

  @Synchronized
  fun consumeStudInResult(context: Context): StudInResult {
    // Resolve a just-finished cycle before reading the pending result.
    sessionState(context)
    val preferences = prefs(context)
    val result = StudInResult(
      focusSeconds = preferences.getLong(PENDING_STUDIN_FOCUS_MS, 0L) / 1000L,
      completed = preferences.getBoolean(PENDING_STUDIN_COMPLETED, false)
    )
    preferences.edit()
      .remove(PENDING_STUDIN_FOCUS_MS)
      .remove(PENDING_STUDIN_COMPLETED)
      .commit()
    return result
  }

  fun blocklist(context: Context): Set<String> =
    prefs(context).getStringSet(BLOCKLIST, emptySet())?.toSet() ?: emptySet()

  fun setAppearanceMode(context: Context, mode: String) {
    prefs(context).edit().putString(APPEARANCE, mode).apply()
  }

  fun isDarkAppearance(context: Context): Boolean {
    return when (prefs(context).getString(APPEARANCE, "system")) {
      "dark" -> true
      "light" -> false
      else -> {
        val nightMode = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        nightMode == Configuration.UI_MODE_NIGHT_YES
      }
    }
  }

  private fun focusedMillisAt(context: Context, now: Long): Long {
    val preferences = prefs(context)
    val startedAt = preferences.getLong(SESSION_STARTED_AT, now)
    val studyMs = preferences.getLong(STUDY_DURATION_MS, 0L).coerceAtLeast(0L)
    val breakMs = preferences.getLong(BREAK_DURATION_MS, 0L).coerceAtLeast(0L)
    val rounds = preferences.getInt(TOTAL_ROUNDS, 1).coerceAtLeast(1)
    if (studyMs == 0L) return 0L

    val totalDuration = studyMs * rounds + breakMs * (rounds - 1)
    val elapsed = (now - startedAt).coerceIn(0L, totalDuration)
    val cycleMs = studyMs + breakMs
    val completedCycles = (elapsed / cycleMs).coerceAtMost((rounds - 1).toLong())
    val withinCycle = elapsed - completedCycles * cycleMs
    return completedCycles * studyMs + minOf(withinCycle, studyMs)
  }

  private fun finishStudIn(context: Context, focusMillis: Long, completed: Boolean) {
    val preferences = prefs(context)
    val pendingFocus = preferences.getLong(PENDING_STUDIN_FOCUS_MS, 0L)
    val pendingCompleted = preferences.getBoolean(PENDING_STUDIN_COMPLETED, false)
    preferences.edit()
      .putBoolean(ACTIVE, false)
      .putLong(PENDING_STUDIN_FOCUS_MS, pendingFocus + focusMillis.coerceAtLeast(0L))
      .putBoolean(PENDING_STUDIN_COMPLETED, pendingCompleted || completed)
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
