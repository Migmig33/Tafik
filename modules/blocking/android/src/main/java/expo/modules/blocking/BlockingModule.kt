package expo.modules.blocking

import android.app.AppOpsManager
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

// Two weeks, not one: the chart shows the last seven days, and the week-over-week
// trend needs the seven before them to have something to compare against.
private const val INSIGHT_DAYS = 14

class BlockingModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Blocking")

    AsyncFunction("startSession") { blocklist: List<String> ->
      val context = requireNotNull(appContext.reactContext)
      if (!hasUsageAccess(context)) {
        throw IllegalStateException("Usage access is required before apps can be blocked.")
      }
      if (!Settings.canDrawOverlays(context)) {
        throw IllegalStateException("Display-over-other-apps permission is required before apps can be blocked.")
      }

      BlockingPreferences.start(context, blocklist)
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

    AsyncFunction("setAppearanceMode") { mode: String ->
      if (mode !in setOf("system", "light", "dark")) {
        throw IllegalArgumentException("Appearance must be system, light, or dark.")
      }
      BlockingPreferences.setAppearanceMode(requireNotNull(appContext.reactContext), mode)
    }

    AsyncFunction("hasUsageAccess") {
      hasUsageAccess(requireNotNull(appContext.reactContext))
    }

    AsyncFunction("hasOverlayPermission") {
      Settings.canDrawOverlays(requireNotNull(appContext.reactContext))
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
      val packageManager = context.packageManager
      packageManager.getInstalledApplications(0)
        .asSequence()
        .filter { it.packageName != context.packageName }
        .filter { packageManager.getLaunchIntentForPackage(it.packageName) != null }
        .map {
          mapOf(
            "name" to packageManager.getApplicationLabel(it).toString(),
            "pkg" to it.packageName
          )
        }
        .sortedBy { it["name"]?.lowercase() }
        .toList()
    }

    AsyncFunction("getInstalledAppsWithIcons") {
      val context = requireNotNull(appContext.reactContext)
      val packageManager = context.packageManager
      val apps = packageManager.getInstalledApplications(0)
        .asSequence()
        .filter { it.packageName != context.packageName }
        .filter { packageManager.getLaunchIntentForPackage(it.packageName) != null }
        .map {
          AppScreenTimeEntry(
            name = packageManager.getApplicationLabel(it).toString(),
            pkg = it.packageName,
            milliseconds = 0L
          )
        }
        .sortedBy { it.name.lowercase() }
        .toList()

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
