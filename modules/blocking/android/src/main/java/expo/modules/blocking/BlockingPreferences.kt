package expo.modules.blocking

import android.content.Context
import android.content.res.Configuration

internal object BlockingPreferences {
  private const val FILE = "tapped_in_blocking"
  private const val ACTIVE = "active"
  private const val BLOCKLIST = "blocklist"
  private const val APPEARANCE = "appearance"

  private fun prefs(context: Context) =
    context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  fun start(context: Context, packages: List<String>) {
    prefs(context).edit()
      .putBoolean(ACTIVE, true)
      .putStringSet(BLOCKLIST, packages.toSet())
      .apply()
  }

  fun stop(context: Context) {
    prefs(context).edit().putBoolean(ACTIVE, false).apply()
  }

  fun isActive(context: Context): Boolean = prefs(context).getBoolean(ACTIVE, false)

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
}
