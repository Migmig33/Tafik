package expo.modules.blocking

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat

/**
 * Android owns the wake-up alarm for the end of the current StudIn phase.
 * The foreground service's 500 ms monitor remains a fast visible-device path;
 * this alarm is the durable path when the CPU is asleep or the process dies.
 */
internal object StudInAlarmScheduler {
  private const val ACTION_PHASE_END = "expo.modules.blocking.STUDIN_PHASE_END"
  private const val ACTION_SILENCE = "expo.modules.blocking.SILENCE_STUDIN_ALARM"
  private const val PHASE_ALARM_REQUEST_CODE = 3110
  private const val SILENCE_REQUEST_CODE = 3111
  private const val OPEN_REQUEST_CODE = 3112
  private const val FULL_SCREEN_REQUEST_CODE = 3113
  const val TIMER_ALARM_NOTIFICATION_ID = 3108
  const val TIMER_ALARM_CHANNEL_ID = "tockin_studin_timer_alarms_v2"
  const val EXTRA_ALARM_LAUNCH = "tockin_studin_alarm_launch"

  fun schedule(context: Context, state: BlockingSessionState) {
    if (!state.active ||
      state.mode != BlockingPreferences.MODE_STUDIN ||
      state.phaseEndsAt <= 0L
    ) {
      cancel(context)
      return
    }

    val manager = context.getSystemService(AlarmManager::class.java)
    val operation = phaseAlarmPendingIntent(context)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
      // Exact access is optional. This fallback can be delayed by Doze, while
      // the foreground-service monitor still handles awake-device transitions.
      manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, state.phaseEndsAt, operation)
      return
    }

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, state.phaseEndsAt, operation)
      } else {
        manager.setExact(AlarmManager.RTC_WAKEUP, state.phaseEndsAt, operation)
      }
    } catch (_: SecurityException) {
      // Access can be revoked between the check and the scheduling call.
      manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, state.phaseEndsAt, operation)
    }
  }

  fun cancel(context: Context) {
    context.getSystemService(AlarmManager::class.java).cancel(phaseAlarmPendingIntent(context))
  }

  fun hasExactAlarmAccess(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    return context.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
  }

  fun requestExactAlarmAccess(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || hasExactAlarmAccess(context)) return
    context.startActivity(
      Intent(
        Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
        Uri.parse("package:${context.packageName}")
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    )
  }

  fun hasFullScreenAlarmAccess(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true
    return context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()
  }

  fun requestFullScreenAlarmAccess(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE ||
      hasFullScreenAlarmAccess(context)
    ) return
    context.startActivity(
      Intent(
        Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
        Uri.parse("package:${context.packageName}")
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    )
  }

  fun openStudInPendingIntent(context: Context, fullScreen: Boolean): PendingIntent {
    val launchIntent = requireNotNull(
      context.packageManager.getLaunchIntentForPackage(context.packageName)
    )
      .setAction(Intent.ACTION_VIEW)
      .setData(Uri.parse("tockin://studin"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      .putExtra(EXTRA_ALARM_LAUNCH, fullScreen)
    return PendingIntent.getActivity(
      context,
      if (fullScreen) FULL_SCREEN_REQUEST_CODE else OPEN_REQUEST_CODE,
      launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  fun silencePendingIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
    context,
    SILENCE_REQUEST_CODE,
    Intent(context, StudInAlarmReceiver::class.java).setAction(ACTION_SILENCE),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  )

  private fun phaseAlarmPendingIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
    context,
    PHASE_ALARM_REQUEST_CODE,
    Intent(context, StudInAlarmReceiver::class.java).setAction(ACTION_PHASE_END),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  )

  fun isPhaseAlarm(intent: Intent): Boolean = intent.action == ACTION_PHASE_END
  fun isSilence(intent: Intent): Boolean = intent.action == ACTION_SILENCE
}

/** Receives both a due phase alarm and Android's exact-access grant broadcast. */
class StudInAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (StudInAlarmScheduler.isSilence(intent)) {
      context.getSystemService(NotificationManager::class.java)
        .cancel(StudInAlarmScheduler.TIMER_ALARM_NOTIFICATION_ID)
      return
    }

    val permissionGranted = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
      intent.action == AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED
    if (!StudInAlarmScheduler.isPhaseAlarm(intent) && !permissionGranted) return

    if (permissionGranted) {
      val state = BlockingPreferences.sessionState(context)
      if (!state.active || state.mode != BlockingPreferences.MODE_STUDIN) return
      StudInAlarmScheduler.schedule(context, state)
    }

    // Re-entering the existing foreground service makes it resolve the native
    // wall-clock state, alert exactly once, refresh blocking, and schedule the
    // next phase. Exact alarms are allowed to start this user-visible service.
    try {
      ContextCompat.startForegroundService(
        context,
        Intent(context, ForegroundBlockService::class.java)
      )
    } catch (_: IllegalStateException) {
      // Android can refuse a background foreground-service start for the
      // optional inexact fallback. If the existing sticky service is alive,
      // waking the process is still enough for its wall-clock monitor to run.
    }
  }
}
