package com.st3fez.affaresubito

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    // Aperta da Condividi a freddo: va girata prima che React legga l'intento iniziale.
    shareToDeepLink(intent)?.let { setIntent(it) }
    super.onCreate(null)
  }

  /** Aperta da Condividi ad app già avviata (launchMode singleTask). */
  override fun onNewIntent(intent: Intent) {
    val converted = shareToDeepLink(intent) ?: intent
    setIntent(converted)
    super.onNewIntent(converted)
  }

  /**
   * "Condividi" di un'altra app manda il testo con ACTION_SEND; React Native conosce solo i link. Lo giriamo in
   * `affaresubito://analizza?testo=<testo>`, che il codice JavaScript sa già aprire (l'indirizzo lo estrae lui dal testo).
   */
  private fun shareToDeepLink(source: Intent?): Intent? {
    if (source?.action != Intent.ACTION_SEND || source.type?.startsWith("text/") != true) return source
    val text = source.getStringExtra(Intent.EXTRA_TEXT) ?: return source
    val link = Uri.Builder().scheme("affaresubito").authority("analizza").appendQueryParameter("testo", text).build()
    return Intent(source).setAction(Intent.ACTION_VIEW).setData(link)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
