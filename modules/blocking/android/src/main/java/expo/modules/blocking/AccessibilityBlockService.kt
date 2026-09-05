package expo.modules.blocking

import android.accessibilityservice.AccessibilityService
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent

/**
 * Fast enforcement path for a user-selected blocklist. This service reads only
 * the package attached to window-change events; it never requests or inspects
 * the accessibility node tree.
 *
 * The UsageStats foreground service remains the visual fallback. Returning
 * Home here closes the interaction window that polling alone leaves during
 * Recents and rapid task switches.
 */
class AccessibilityBlockService : AccessibilityService() {
  private var lastRedirectedPackage: String? = null
  private var lastRedirectAt = 0L

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null || event.eventType !in ENFORCEMENT_EVENTS) return
    // TockIn blocks for its whole session. StudIn blocks only during Study;
    // Break remains deliberately unrestricted.
    if (!BlockingPreferences.shouldBlockNow(this)) {
      clearRedirectState()
      return
    }

    val foregroundPackage = event.packageName?.toString()?.takeIf { it.isNotBlank() } ?: return
    if (foregroundPackage == packageName) {
      clearRedirectState()
      return
    }

    if (!BlockingPreferences.blocklist(this).contains(foregroundPackage)) {
      clearRedirectState()
      return
    }

    val now = SystemClock.elapsedRealtime()
    if (
      lastRedirectedPackage == foregroundPackage &&
      now - lastRedirectAt < REDIRECT_COOLDOWN_MS
    ) {
      return
    }

    lastRedirectedPackage = foregroundPackage
    lastRedirectAt = now
    performGlobalAction(GLOBAL_ACTION_HOME)
  }

  override fun onInterrupt() = Unit

  private fun clearRedirectState() {
    lastRedirectedPackage = null
    lastRedirectAt = 0L
  }

  companion object {
    private val ENFORCEMENT_EVENTS = setOf(
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED,
      AccessibilityEvent.TYPE_WINDOWS_CHANGED
    )
    private const val REDIRECT_COOLDOWN_MS = 750L
  }
}
