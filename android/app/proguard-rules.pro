# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# --- TockIn ---------------------------------------------------------------
# R8 is on for release builds (android.enableMinifyInReleaseBuilds). Every keep
# below covers something resolved by NAME at runtime rather than by a compiled
# reference, which is exactly what R8 cannot see and would otherwise strip or
# rename. These are deliberately broad: an over-broad keep costs a few kilobytes,
# a missing one is a crash in the field that no build-time check catches.

# Expo resolves modules by class name from the generated module list, so nothing
# under expo.modules can be renamed. This covers the blocking module too.
-keep class expo.modules.** { *; }
-keep interface expo.modules.** { *; }

# The blocking module's two services are named as strings in AndroidManifest,
# and its session state crosses the JS bridge field by field.
-keep class expo.modules.blocking.** { *; }

# MainActivity and MainApplication are named in AndroidManifest.
-keep class com.kupdevs.tockin.** { *; }

# NFC: reached reflectively by React Native's module registry, and the tag
# classes are instantiated by the Android framework.
-keep class community.revteltech.nfc.** { *; }

# react-native-svg backs the Insights chart. Its view managers and prop setters
# are matched by name from JavaScript.
-keep class com.horcrux.svg.** { *; }

# React Native's own reflective surfaces. RN ships consumer rules for most of
# this, but the annotations are what keep bridge methods and props addressable.
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.common.internal.DoNotStrip *;
}
-keep @com.facebook.proguard.annotations.DoNotStrip class * { *; }
-keep class com.facebook.jni.** { *; }

# Kotlin coroutines and metadata, used across the foreground service.
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }
-keep class kotlin.Metadata { *; }

# Keep source file and line numbers so a Play Console crash report from a
# minified build is still readable. Without this every stack trace is unusable.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
