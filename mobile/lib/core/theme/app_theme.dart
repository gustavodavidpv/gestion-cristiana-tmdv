import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'tokens.dart';

/// Tipografía: Source Serif 4 para todo (no hay sans-serif en el sistema).
class AppText {
  AppText._();

  /// En pruebas se desactiva para no descargar la fuente; se usa [fallbackFamily].
  static bool useGoogleFonts = true;
  static String? fallbackFamily;

  static TextStyle base({
    double size = 16,
    FontWeight weight = FontWeight.w400,
    Color color = AppColors.text,
    double? height,
    double? letterSpacing,
    FontStyle? fontStyle,
  }) {
    if (!useGoogleFonts) {
      return TextStyle(fontFamily: fallbackFamily, fontSize: size, fontWeight: weight, color: color, height: height, letterSpacing: letterSpacing, fontStyle: fontStyle);
    }
    return GoogleFonts.sourceSerif4(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
      fontStyle: fontStyle,
    );
  }

  /// Título de pantalla 34/1.05, 600, tracking −0.02em.
  static TextStyle title([double size = 34]) =>
      base(size: size, weight: FontWeight.w600, height: 1.05, letterSpacing: -0.02 * size);

  /// Kicker/eyebrow 12, 600, MAYÚSCULAS, tracking 0.08em.
  static TextStyle kicker([Color color = AppColors.neutral700]) =>
      base(size: 12, weight: FontWeight.w600, letterSpacing: 0.96, color: color);

  static TextStyle h2 = base(size: 22, weight: FontWeight.w600, height: 1.2);
  static TextStyle rowName = base(size: 17, weight: FontWeight.w600, height: 1.3);
  static TextStyle rowSub = base(size: 14, color: AppColors.neutral700, height: 1.35);
  static TextStyle body = base(size: 16, height: 1.45);
  static TextStyle button = base(size: 17, weight: FontWeight.w600);
}

ThemeData buildAppTheme() {
  final textTheme = (AppText.useGoogleFonts ? GoogleFonts.sourceSerif4TextTheme() : const TextTheme()).apply(
    bodyColor: AppColors.text,
    displayColor: AppColors.text,
  );

  const scheme = ColorScheme(
    brightness: Brightness.light,
    primary: AppColors.cyan700,
    onPrimary: AppColors.bg,
    secondary: AppColors.magenta700,
    onSecondary: AppColors.bg,
    error: AppColors.magenta700,
    onError: AppColors.bg,
    surface: AppColors.bg,
    onSurface: AppColors.text,
    surfaceContainerHighest: AppColors.surface,
    outline: AppColors.divider,
  );

  final inputBorder = OutlineInputBorder(
    borderRadius: BorderRadius.circular(AppRadii.md),
    borderSide: const BorderSide(color: AppColors.divider),
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.bg,
    textTheme: textTheme,
    splashFactory: NoSplash.splashFactory,
    highlightColor: AppColors.neutral200,
    dividerColor: AppColors.rowLine,
    textSelectionTheme: const TextSelectionThemeData(
      cursorColor: AppColors.cyan,
      selectionColor: AppColors.cyan200,
      selectionHandleColor: AppColors.cyan700,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.bg,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      hintStyle: AppText.base(size: 17, color: AppColors.neutral500),
      border: inputBorder,
      enabledBorder: inputBorder,
      focusedBorder: inputBorder.copyWith(borderSide: const BorderSide(color: AppColors.cyan700, width: 1.5)),
      errorBorder: inputBorder.copyWith(borderSide: const BorderSide(color: AppColors.magenta700)),
      focusedErrorBorder: inputBorder.copyWith(borderSide: const BorderSide(color: AppColors.magenta700, width: 1.5)),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(color: AppColors.cyan700),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? AppColors.bg : AppColors.neutral600),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? AppColors.cyan700 : AppColors.neutral200),
      trackOutlineColor: WidgetStateProperty.all(AppColors.divider),
    ),
    datePickerTheme: DatePickerThemeData(
      backgroundColor: AppColors.bg,
      headerBackgroundColor: AppColors.cyan700,
      headerForegroundColor: AppColors.bg,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.lg)),
    ),
    timePickerTheme: TimePickerThemeData(
      backgroundColor: AppColors.bg,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.lg)),
    ),
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: CupertinoPageTransitionsBuilder(),
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
    }),
  );
}
