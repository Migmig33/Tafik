package expo.modules.blocking

import android.app.AppOpsManager
import android.accessibilityservice.AccessibilityServiceInfo
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Base64
import android.view.accessibility.AccessibilityManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Calendar
import java.text.SimpleDateFormat
import java.io.ByteArrayOutputStream
import java.util.Date
import java.util.Locale
import org.json.JSONArray
import org.json.JSONObject

private data class AppScreenTimeEntry(
  val name: String,
  val pkg: String,
  val milliseconds: Long
)

private data class LaunchableAppEntry(
  val name: String,
  val pkg: String
)

// Two weeks, not one: the chart shows the last seven days, and the week-over-week
// trend needs the seven before them to have something to compare against.
private const val INSIGHT_DAYS = 14

class BlockingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Blocking")

    AsyncFunction("startSession") { blocklist: List<String> ->
      val context = requireNotNull(appContext.reactContext)
      requireBlockingPermissions(context)
      BlockingPreferences.start(context, blocklist)
      ContextCompat.startForegroundService(
        context,
        Intent(context, ForegroundBlockService::class.java)
      )
    }

    AsyncFunction("startStudInSession") {
        blocklist: List<String>,
        studyDurationSeconds: Int,
        breakDurationSeconds: Int,
        rounds: Int ->
      val context = requireNotNull(appContext.reactContext)
      requireBlockingPermissions(context)
      require(blocklist.isNotEmpty()) { "Choose at least one app to block first." }
      require(studyDurationSeconds in 60..(180 * 60)) {
        "Study duration must be between 1 and 180 minutes."
      }
      require(breakDurationSeconds in 60..(60 * 60)) {
        "Break duration must be between 1 and 60 minutes."
      }
      require(rounds in 1..12) { "StudIn rounds must be between 1 and 12." }

      BlockingPreferences.startStudIn(
        context,
        blocklist,
        studyDurationSeconds,
        breakDurationSeconds,
        rounds
      )
      ContextCompat.startForegroundService(
        context,
        Intent(context, ForegroundBlockService::class.java)
      )
    }

    AsyncFunction("endSession") {
      val context = requireNotNull(appContext.reactContext)
      BlockingPreferences.stop(context)
      context.stopService(Intent(context, ForegroundBlockService::class.java))
    }

    AsyncFunction("isSessionActive") {
      val context = requireNotNull(appContext.reactContext)
      BlockingPreferences.isActive(context)
    }

    AsyncFunction("getSessionState") {
      val state = BlockingPreferences.sessionState(requireNotNull(appContext.reactContext))
      mapOf(
        "active" to state.active,
        "mode" to state.mode,
        "phase" to state.phase,
        "currentRound" to state.currentRound,
        "totalRounds" to state.totalRounds,
        "phaseStartedAt" to state.phaseStartedAt.toDouble(),
        "phaseEndsAt" to state.phaseEndsAt.toDouble(),
        "sessionStartedAt" to state.sessionStartedAt.toDouble(),
        "studyDurationSeconds" to state.studyDurationSeconds,
        "breakDurationSeconds" to state.breakDurationSeconds
      )
    }

    AsyncFunction("consumeStudInResult") {
      val result = BlockingPreferences.consumeStudInResult(requireNotNull(appContext.reactContext))
      mapOf(
        "focusSeconds" to result.focusSeconds.toDouble(),
        "completed" to result.completed
      )
    }

    AsyncFunction("setAppearanceMode") { mode: String ->
      if (mode !in setOf("system", "light", "dark")) {
        throw IllegalArgumentException("Appearance must be system, light, or dark.")
      }
      BlockingPreferences.setAppearanceMode(requireNotNull(appContext.reactContext), mode)
    }

    AsyncFunction("setShieldMessage") { message: String ->
      BlockingPreferences.setShieldMessage(requireNotNull(appContext.reactContext), message)
    }

    AsyncFunction("hasUsageAccess") {
      hasUsageAccess(requireNotNull(appContext.reactContext))
    }

    AsyncFunction("hasOverlayPermission") {
      Settings.canDrawOverlays(requireNotNull(appContext.reactContext))
    }

    AsyncFunction("hasAccessibilityAccess") {
      hasAccessibilityAccess(requireNotNull(appContext.reactContext))
    }

    AsyncFunction("getScreenTimeToday") {
      val context = requireNotNull(appContext.reactContext)
      if (!hasUsageAccess(context)) {
        throw IllegalStateException("Usage access is required to read screen time.")
      }

      val startOfDay = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }.timeInMillis
      val usageStats = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      usageStats.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        startOfDay,
        System.currentTimeMillis()
      )
        .orEmpty()
        .asSequence()
        .filter { it.packageName != context.packageName }
        .sumOf { it.totalTimeInForeground }
    }

    AsyncFunction("getAppScreenTimeToday") {
      val context = requireNotNull(appContext.reactContext)
      if (!hasUsageAccess(context)) {
        throw IllegalStateException("Usage access is required to read screen time.")
      }

      val startOfDay = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }.timeInMillis
      val usageStats = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val packageManager = context.packageManager

      usageStats.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        startOfDay,
        System.currentTimeMillis()
      )
        .orEmpty()
        .asSequence()
        .filter { it.packageName != context.packageName && it.totalTimeInForeground > 0L }
        .groupBy { it.packageName }
        .map { (packageName, entries) ->
          val name = try {
            val info = packageManager.getApplicationInfo(packageName, 0)
            packageManager.getApplicationLabel(info).toString()
          } catch (_: Exception) {
            packageName
          }
          AppScreenTimeEntry(
            name = name,
            pkg = packageName,
            milliseconds = entries.sumOf { it.totalTimeInForeground }
          )
        }
        .sortedByDescending { it.milliseconds }
        .let { entries ->
          JSONArray().apply {
            entries.forEach { entry ->
              put(
                JSONObject().apply {
                  put("name", entry.name)
                  put("pkg", entry.pkg)
                  put("milliseconds", entry.milliseconds)
                }
              )
            }
          }.toString()
        }
    }

    AsyncFunction("getScreenTimeInsights") {
      val context = requireNotNull(appContext.reactContext)
      if (!hasUsageAccess(context)) {
        throw IllegalStateException("Usage access is required to read screen time insights.")
      }

      val now = System.currentTimeMillis()
      val today = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
      }
      val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.US)
      val packageManager = context.packageManager
      val labelCache = mutableMapOf<String, String>()
      val days = JSONArray()

      for (offset in (INSIGHT_DAYS - 1) downTo 0) {
        val startCalendar = today.clone() as Calendar
        startCalendar.add(Calendar.DAY_OF_YEAR, -offset)
        val start = startCalendar.timeInMillis
        val nextCalendar = startCalendar.clone() as Calendar
        nextCalendar.add(Calendar.DAY_OF_YEAR, 1)
        val end = minOf(nextCalendar.timeInMillis, now)
        val usage = screenTimeByPackage(context, start, end)
          .filterKeys { it != context.packageName }
          .toList()
          .sortedByDescending { it.second }

        val apps = JSONArray()
        usage.forEach { (packageName, milliseconds) ->
          val name = labelCache.getOrPut(packageName) {
            try {
              val info = packageManager.getApplicationInfo(packageName, 0)
              packageManager.getApplicationLabel(info).toString()
            } catch (_: Exception) {
              packageName
            }
          }
          apps.put(
            JSONObject().apply {
              put("name", name)
              put("pkg", packageName)
              put("milliseconds", milliseconds)
            }
          )
        }

        days.put(
          JSONObject().apply {
            put("date", dateFormat.format(Date(start)))
            put("milliseconds", usage.sumOf { it.second })
            put("apps", apps)
          }
        )
      }

      JSONObject().put("days", days).toString()
    }

    AsyncFunction("getInstalledApps") {
      val context = requireNotNull(appContext.reactContext)
      launchableApps(context).map { app ->
        mapOf(
          "name" to app.name,
          "pkg" to app.pkg
        )
      }
    }

    AsyncFunction("getInstalledAppsWithIcons") {
      val context = requireNotNull(appContext.reactContext)
      val apps = launchableApps(context)

      JSONArray().apply {
        apps.forEach { app ->
          put(
            JSONObject().apply {
              put("name", app.name)
              put("pkg", app.pkg)
              appIconDataUri(context, app.pkg)?.let { put("icon", it) }
            }
          )
        }
      }.toString()
    }
  }

  /**
   * Returns only apps with a launcher activity. The manifest's matching
   * <queries> intent makes this set visible on Android 11+ without requesting
   * QUERY_ALL_PACKAGES. A package may expose several launcher activities, so
   * deduplicate before presenting it as one blocklist entry.
   */
  private fun launchableApps(context: Context): List<LaunchableAppEntry> {
    val packageManager = context.packageManager
    val launcherIntent = Intent(Intent.ACTION_MAIN).apply {
      addCategory(Intent.CATEGORY_LAUNCHER)
    }

    @Suppress("DEPRECATION")
    val activities = packageManager.queryIntentActivities(launcherIntent, 0)

    return activities
      .asSequence()
      .map { it.activityInfo.applicationInfo }
      .filter { it.packageName != context.packageName }
      .distinctBy { it.packageName }
      .map { application ->
        LaunchableAppEntry(
          name = packageManager.getApplicationLabel(application).toString(),
          pkg = application.packageName
        )
      }
      .sortedBy { it.name.lowercase(Locale.ROOT) }
      .toList()
  }

  private fun requireBlockingPermissions(context: Context) {
    if (!hasUsageAccess(context)) {
      throw IllegalStateException("Usage access is required before apps can be blocked.")
    }
    if (!Settings.canDrawOverlays(context)) {
      throw IllegalStateException("Display-over-other-apps permission is required before apps can be blocked.")
    }
    if (!hasAccessibilityAccess(context)) {
      throw IllegalStateException("Accessibility access is required before apps can be blocked.")
    }
  }

  private fun hasAccessibilityAccess(context: Context): Boolean {
    val manager = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
    return manager
      .getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
      .any { enabled ->
        val service = enabled.resolveInfo.serviceInfo
        service.packageName == context.packageName &&
          service.name == AccessibilityBlockService::class.java.name
      }
  }

  private fun hasUsageAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        context.packageName
      )
    }
    if (mode == AppOpsManager.MODE_ALLOWED) return true

    // Some Android variants report MODE_DEFAULT after process restart even
    // while Usage Access is enabled. A real query distinguishes that case from
    // a denied permission, which returns no records.
    val usageStats = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val now = System.currentTimeMillis()
    return !usageStats.queryUsageStats(
      UsageStatsManager.INTERVAL_DAILY,
      now - 24 * 60 * 60 * 1000L,
      now
    ).isNullOrEmpty()
  }

  private fun screenTimeByPackage(context: Context, start: Long, end: Long): Map<String, Long> {
    if (end <= start) return emptyMap()
    val usageStats = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val events = usageStats.queryEvents(start - 24 * 60 * 60 * 1000L, end)
    val event = UsageEvents.Event()
    val durations = mutableMapOf<String, Long>()
    var resumedPackage: String? = null
    var interactive = true
    var activePackage: String? = null
    var activeSince = start

    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val timestamp = event.timeStamp.coerceIn(start, end)
      val previousActive = activePackage

      when (event.eventType) {
        UsageEvents.Event.ACTIVITY_RESUMED -> resumedPackage = event.packageName
        UsageEvents.Event.ACTIVITY_PAUSED -> {
          if (resumedPackage == event.packageName) resumedPackage = null
        }
        UsageEvents.Event.SCREEN_NON_INTERACTIVE,
        UsageEvents.Event.KEYGUARD_SHOWN -> interactive = false
        UsageEvents.Event.SCREEN_INTERACTIVE,
        UsageEvents.Event.KEYGUARD_HIDDEN -> interactive = true
      }

      val nextActive = if (interactive) resumedPackage else null
      if (nextActive != previousActive) {
        if (event.timeStamp >= start && previousActive != null && timestamp > activeSince) {
          durations[previousActive] =
            (durations[previousActive] ?: 0L) + (timestamp - activeSince)
        }
        activePackage = nextActive
        activeSince = if (event.timeStamp < start) start else timestamp
      }
    }

    activePackage?.let { packageName ->
      if (end > activeSince) {
        durations[packageName] = (durations[packageName] ?: 0L) + (end - activeSince)
      }
    }
    return durations.filterValues { it > 0L }
  }

  private fun appIconDataUri(context: Context, packageName: String): String? {
    return try {
      val drawable = context.packageManager.getApplicationIcon(packageName)
      // Always render into a software bitmap. This handles adaptive icons,
      // vector drawables, and hardware-backed bitmap icons consistently.
      val bitmap = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888).also { output ->
        val canvas = Canvas(output)
        drawable.setBounds(0, 0, canvas.width, canvas.height)
        drawable.draw(canvas)
      }
      val bytes = ByteArrayOutputStream()
      bitmap.compress(Bitmap.CompressFormat.PNG, 90, bytes)
      val encoded = Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)
      "data:image/png;base64,$encoded"
    } catch (_: Exception) {
      null
    }
  }
}
