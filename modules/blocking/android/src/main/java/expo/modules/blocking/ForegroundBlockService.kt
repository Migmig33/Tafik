package expo.modules.blocking

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.res.ColorStateList
import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.app.NotificationCompat

private data class OverlayPalette(
  val background: Int,
  val surface: Int,
  val text: Int,
  val textDim: Int,
  val border: Int,
  val accent: Int,
  val accentWash: Int,
  val onAccent: Int
)

/** Small code-drawn icon so the native overlay matches TockIn without legacy Android icons. */
private class LockBadgeView(
  context: Context,
  private val fillColor: Int,
  private val iconColor: Int
) : View(context) {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val size = minOf(width, height).toFloat()
    val centerX = width / 2f
    val centerY = height / 2f

    paint.style = Paint.Style.FILL
    paint.color = fillColor
    canvas.drawCircle(centerX, centerY, size / 2f, paint)

    paint.style = Paint.Style.STROKE
    paint.strokeWidth = size * 0.07f
    paint.color = iconColor
    canvas.drawArc(
      RectF(centerX - size * 0.15f, centerY - size * 0.26f, centerX + size * 0.15f, centerY + size * 0.06f),
      180f,
      180f,
      false,
      paint
    )
    canvas.drawRoundRect(
      RectF(centerX - size * 0.22f, centerY - size * 0.02f, centerX + size * 0.22f, centerY + size * 0.27f),
      size * 0.06f,
      size * 0.06f,
      paint
    )
  }
}

class ForegroundBlockService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var windowManager: WindowManager
  private var overlay: View? = null
  private var shieldedPackage: String? = null
  private var lastForegroundPackage: String? = null
  private var unshieldCandidate: String? = null
  private var unshieldCandidateSince = 0L
  private var notificationStateKey: String? = null
  private val poppinsRegular: Typeface by lazy {
    loadTypeface("fonts/Poppins_400Regular.ttf", Typeface.NORMAL)
  }
  private val poppinsSemiBold: Typeface by lazy {
    loadTypeface("fonts/Poppins_600SemiBold.ttf", Typeface.BOLD)
  }

  private val monitor = object : Runnable {
    override fun run() {
      val session = BlockingPreferences.sessionState(this@ForegroundBlockService)
      if (!session.active) {
        stopSelf()
        return
      }
      refreshNotification(session)
      val foreground = currentForegroundPackage()

      // Break releases restrictions, while this service remains alive to
      // reapply them when the next Study begins. Foreground tracking continues
      // here so an app opened early in a long Break is still known at 00:00.
      if (session.mode == BlockingPreferences.MODE_STUDIN &&
        session.phase == BlockingPreferences.PHASE_BREAK
      ) {
        clearUnshieldCandidate()
        hideShield()
        handler.postDelayed(this, POLL_INTERVAL_MS)
        return
      }

      val shouldShield = foreground != null &&
        foreground != packageName &&
        BlockingPreferences.blocklist(this@ForegroundBlockService).contains(foreground)

      when {
        shouldShield -> {
          clearUnshieldCandidate()
          showShield(foreground!!)
        }
        overlay == null -> clearUnshieldCandidate()
        foreground == packageName -> {
          // TockIn must become usable immediately so the user can scan to end
          // the session. Other app transitions are confirmed below.
          clearUnshieldCandidate()
          hideShield()
        }
        foreground == null -> {
          // An inconclusive UsageStats read must never create an unlock gap.
          clearUnshieldCandidate()
        }
        unshieldCandidate != foreground -> {
          // Recents briefly reports the launcher/System UI as foreground. Keep
          // the existing window attached until that transition proves stable.
          unshieldCandidate = foreground
          unshieldCandidateSince = SystemClock.elapsedRealtime()
        }
        SystemClock.elapsedRealtime() - unshieldCandidateSince >= EXIT_CONFIRMATION_MS -> {
          clearUnshieldCandidate()
          hideShield()
        }
      }
      handler.postDelayed(this, POLL_INTERVAL_MS)
    }
  }

  override fun onCreate() {
    super.onCreate()
    windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val session = BlockingPreferences.sessionState(this)
    startForeground(NOTIFICATION_ID, buildNotification(session))
    notificationStateKey = notificationKey(session)
    handler.removeCallbacks(monitor)
    handler.post(monitor)
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(monitor)
    hideShield()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun currentForegroundPackage(): String? {
    val usageStats = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val end = System.currentTimeMillis()
    val events = usageStats.queryEvents(end - EVENT_LOOKBACK_MS, end)
    val event = UsageEvents.Event()
    var latestPackage: String? = null
    var latestTime = 0L

    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val enteredForeground =
        event.eventType == UsageEvents.Event.ACTIVITY_RESUMED ||
          event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND
      if (enteredForeground && event.timeStamp >= latestTime) {
        latestPackage = event.packageName
        latestTime = event.timeStamp
      }
    }
    if (latestPackage != null) lastForegroundPackage = latestPackage
    if (lastForegroundPackage == null) {
      // Recover after Android restarts the sticky service while an app has
      // already been open longer than the short event lookback window.
      lastForegroundPackage = usageStats.queryUsageStats(
        UsageStatsManager.INTERVAL_DAILY,
        end - INITIAL_USAGE_LOOKBACK_MS,
        end
      )
        .orEmpty()
        .maxByOrNull { it.lastTimeUsed }
        ?.packageName
    }
    return lastForegroundPackage
  }

  private fun showShield(blockedPackage: String) {
    if (overlay != null && shieldedPackage == blockedPackage) return
    hideShield()
    if (!Settings.canDrawOverlays(this)) return

    val appName = try {
      val info = packageManager.getApplicationInfo(blockedPackage, 0)
      packageManager.getApplicationLabel(info).toString()
    } catch (_: Exception) {
      "This app"
    }
    val appIcon = try {
      packageManager.getApplicationIcon(blockedPackage)
    } catch (_: Exception) {
      packageManager.getApplicationIcon(packageName)
    }
    val palette = overlayPalette(BlockingPreferences.isDarkAppearance(this))
    val session = BlockingPreferences.sessionState(this)
    val studInStudy = session.mode == BlockingPreferences.MODE_STUDIN &&
      session.phase == BlockingPreferences.PHASE_STUDY

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(20), dp(42), dp(20), dp(24))
      setBackgroundColor(palette.accentWash)
    }

    val header = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    header.addView(
      makeText("TockIn", 26f, palette.text, semibold = true),
      LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
    )
    header.addView(makeText("●  FOCUS ACTIVE", 11f, palette.accent, semibold = true).apply {
      letterSpacing = 0.08f
      gravity = Gravity.CENTER
      setPadding(dp(13), dp(8), dp(13), dp(8))
      background = roundedBackground(palette.surface, 100, palette.border)
    })
    root.addView(
      header,
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
    )

    val scroller = ScrollView(this).apply {
      isFillViewport = true
      clipToPadding = false
      isVerticalScrollBarEnabled = false
    }
    val center = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(0, dp(24), 0, dp(8))
    }

    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(24), dp(28), dp(24), dp(24))
      background = roundedBackground(palette.surface, 24, palette.border)
      elevation = dp(3).toFloat()
    }

    val iconShell = FrameLayout(this).apply {
      background = roundedBackground(palette.accentWash, 28)
    }
    iconShell.addView(ImageView(this).apply {
      setImageDrawable(appIcon)
      scaleType = ImageView.ScaleType.FIT_CENTER
      contentDescription = "$appName icon"
    }, FrameLayout.LayoutParams(dp(82), dp(82), Gravity.CENTER))
    iconShell.addView(
      LockBadgeView(this, palette.accent, palette.onAccent).apply {
        contentDescription = "Locked"
      },
      FrameLayout.LayoutParams(dp(34), dp(34), Gravity.END or Gravity.BOTTOM).apply {
        marginEnd = dp(1)
        bottomMargin = dp(1)
      }
    )
    card.addView(
      iconShell,
      LinearLayout.LayoutParams(dp(98), dp(98)).apply {
        gravity = Gravity.CENTER_HORIZONTAL
      }
    )

    card.addView(makeText("$appName is blocked", 26f, palette.text, semibold = true).apply {
      gravity = Gravity.CENTER
    }, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(24) })

    // The user's own reason for locking this app carries further than ours,
    // so it takes this line when they have written one.
    val shieldMessage = BlockingPreferences.shieldMessage(this).ifBlank {
      "This app will close."
    }
    card.addView(makeText(
      shieldMessage,
      15f,
      palette.textDim
    ).apply {
      gravity = Gravity.CENTER
      setLineSpacing(dp(3).toFloat(), 1f)
    }, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(10) })

    val instruction = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      setPadding(dp(16), dp(16), dp(16), dp(16))
      background = roundedBackground(palette.accentWash, 16)
    }
    instruction.addView(makeText(if (studInStudy) "LOCK" else "NFC", 11f, palette.onAccent, semibold = true).apply {
      gravity = Gravity.CENTER
      background = roundedBackground(palette.accent, 100)
    }, LinearLayout.LayoutParams(dp(46), dp(46)))
    val instructionCopy = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(14), 0, 0, 0)
    }
    instructionCopy.addView(makeText(
      if (studInStudy) "StudIn is running" else "Ready to unlock?",
      14f,
      palette.text,
      semibold = true
    ))
    instructionCopy.addView(makeText(
      if (studInStudy) {
        "This app stays blocked until Study reaches 00:00."
      } else {
        "Open TockIn, then tap your NFC card."
      },
      13f,
      palette.textDim
    ).apply {
      setLineSpacing(dp(2).toFloat(), 1f)
    }, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(3) })
    instruction.addView(
      instructionCopy,
      LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
    )
    card.addView(instruction, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(24) })

    val buttonFill = roundedBackground(palette.accent, 100)
    val rippleColor = (palette.onAccent and 0x00FFFFFF) or (40 shl 24)
    card.addView(makeText(
      if (studInStudy) "Return to StudIn" else "Return to TockIn",
      16f,
      palette.onAccent,
      semibold = true
    ).apply {
      gravity = Gravity.CENTER
      minHeight = dp(56)
      isClickable = true
      isFocusable = true
      background = RippleDrawable(ColorStateList.valueOf(rippleColor), buttonFill, null)
      setOnClickListener { returnToTockIn() }
    }, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(20) })

    center.addView(card, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ))
    center.addView(makeText(
      if (studInStudy) {
        "Study ${session.currentRound} of ${session.totalRounds} is still running"
      } else {
        "Your focus session is still running"
      },
      12f,
      palette.textDim
    ).apply {
      gravity = Gravity.CENTER
    }, LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply { topMargin = dp(18) })

    scroller.addView(
      center,
      ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    )
    root.addView(
      scroller,
      LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f)
    )

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        @Suppress("DEPRECATION")
        WindowManager.LayoutParams.TYPE_PHONE
      },
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.OPAQUE
    )
    params.gravity = Gravity.TOP or Gravity.START

    try {
      windowManager.addView(root, params)
      overlay = root
      shieldedPackage = blockedPackage
    } catch (_: Exception) {
      overlay = null
      shieldedPackage = null
    }
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

  private fun loadTypeface(path: String, fallbackStyle: Int): Typeface = try {
    Typeface.createFromAsset(assets, path)
  } catch (_: Exception) {
    Typeface.create("sans-serif", fallbackStyle)
  }

  private fun makeText(
    value: String,
    size: Float,
    color: Int,
    semibold: Boolean = false
  ) = TextView(this).apply {
    text = value
    textSize = size
    setTextColor(color)
    typeface = if (semibold) poppinsSemiBold else poppinsRegular
    includeFontPadding = false
  }

  private fun roundedBackground(
    color: Int,
    radius: Int,
    strokeColor: Int? = null
  ) = GradientDrawable().apply {
    shape = GradientDrawable.RECTANGLE
    setColor(color)
    cornerRadius = dp(radius).toFloat()
    strokeColor?.let { setStroke(dp(1), it) }
  }

  // Mirrors src/theme.ts exactly. The two copies have to be changed together
  // or the shield stops looking like the app that put it there.
  private fun overlayPalette(dark: Boolean): OverlayPalette = if (dark) {
    OverlayPalette(
      background = Color.parseColor("#101010"),
      surface = Color.parseColor("#1A1A1A"),
      text = Color.parseColor("#F5F5F5"),
      textDim = Color.parseColor("#A1A1A1"),
      border = Color.parseColor("#2E2E2E"),
      accent = Color.parseColor("#F5F5F5"),
      accentWash = Color.parseColor("#262626"),
      onAccent = Color.parseColor("#101010")
    )
  } else {
    OverlayPalette(
      background = Color.WHITE,
      surface = Color.WHITE,
      text = Color.parseColor("#1A1A1A"),
      textDim = Color.parseColor("#737373"),
      border = Color.parseColor("#E8E8E8"),
      accent = Color.parseColor("#1A1A1A"),
      accentWash = Color.parseColor("#F2F2F2"),
      onAccent = Color.WHITE
    )
  }

  private fun hideShield() {
    overlay?.let {
      try {
        windowManager.removeView(it)
      } catch (_: Exception) {
        // The system may already have removed the window.
      }
    }
    overlay = null
    shieldedPackage = null
  }

  private fun clearUnshieldCandidate() {
    unshieldCandidate = null
    unshieldCandidateSince = 0L
  }

  private fun returnToTockIn() {
    hideShield()
    packageManager.getLaunchIntentForPackage(packageName)?.let {
      it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      startActivity(it)
    }
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "TockIn focus session",
      NotificationManager.IMPORTANCE_LOW
    ).apply {
      description = "Keeps app locking active during a focus session."
      setShowBadge(false)
    }
    getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  private fun buildNotification(session: BlockingSessionState): android.app.Notification {
    val title: String
    val detail: String
    when {
      session.mode == BlockingPreferences.MODE_STUDIN &&
        session.phase == BlockingPreferences.PHASE_STUDY -> {
        title = "StudIn study ${session.currentRound} of ${session.totalRounds}"
        detail = "Selected apps stay blocked until this Study ends."
      }
      session.mode == BlockingPreferences.MODE_STUDIN -> {
        title = "StudIn break after round ${session.currentRound}"
        detail = "Apps are available. The next Study starts automatically."
      }
      else -> {
        title = "TockIn is locking selected apps"
        detail = "Tap your card in TockIn to end the session."
      }
    }

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(detail)
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setContentIntent(
        PendingIntent.getActivity(
          this,
          0,
          packageManager.getLaunchIntentForPackage(packageName),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
      )
      .build()
  }

  private fun refreshNotification(session: BlockingSessionState) {
    val key = notificationKey(session)
    if (notificationStateKey == key) return
    getSystemService(NotificationManager::class.java).notify(
      NOTIFICATION_ID,
      buildNotification(session)
    )
    notificationStateKey = key
  }

  private fun notificationKey(session: BlockingSessionState): String =
    "${session.mode}:${session.phase}:${session.currentRound}:${session.totalRounds}"

  companion object {
    private const val CHANNEL_ID = "tockin_focus"
    private const val NOTIFICATION_ID = 3107
    private const val POLL_INTERVAL_MS = 500L
    private const val EVENT_LOOKBACK_MS = 3000L
    private const val INITIAL_USAGE_LOOKBACK_MS = 24 * 60 * 60 * 1000L
    private const val EXIT_CONFIRMATION_MS = 1500L
  }
}
