import 'package:flutter/material.dart';

/// Tokens del sistema visual "Broadsheet" (ver design_handoff README).
/// Serif sobre papel, cian para acciones y magenta para decisiones/canjes/destructivo.
class AppColors {
  AppColors._();

  static const bg = Color(0xFFF3F2F2);
  static const surface = Color(0xFFEAE9E9);
  static const text = Color(0xFF201E1D);

  /// Divisor: texto al 16%.
  static const divider = Color(0x29201E1D);

  /// Línea entre filas: texto al 8%.
  static const rowLine = Color(0x14201E1D);

  // Cian (acento)
  static const cyan100 = Color(0xFFE9F8FF);
  static const cyan200 = Color(0xFFCBEEFF);
  static const cyan300 = Color(0xFF99E0FF);
  static const cyan500 = Color(0xFF38A6CF);
  static const cyan = Color(0xFF0088B0);
  static const cyan700 = Color(0xFF006786);
  static const cyan800 = Color(0xFF004961);
  static const cyan900 = Color(0xFF0A303E);

  // Magenta (acento 2)
  static const magenta100 = Color(0xFFFFF1F4);
  static const magenta300 = Color(0xFFFFC0D0);
  static const magenta = Color(0xFFD6006C);
  static const magenta700 = Color(0xFFAA0B56);
  static const magenta800 = Color(0xFF790E3D);

  // Neutros
  static const neutral200 = Color(0xFFEAE7E7);
  static const neutral300 = Color(0xFFD7D3D3);
  static const neutral400 = Color(0xFFBAB6B6);
  static const neutral500 = Color(0xFF9B9797);
  static const neutral600 = Color(0xFF7D7979);
  static const neutral700 = Color(0xFF605D5D);
  static const neutral800 = Color(0xFF444141);
  static const neutral900 = Color(0xFF2D2B2B);

  /// Amarillo de proceso (solo efecto CMYK de cifras).
  static const processYellow = Color(0xFFEDBB00);
}

class AppRadii {
  AppRadii._();
  static const sm = 1.0;
  static const md = 2.0;
  static const lg = 4.0;
}

class AppSpace {
  AppSpace._();
  static const xs = 5.0;
  static const s = 10.0;
  static const m = 15.0;
  static const l = 20.0;
  static const xl = 30.0;
  static const xxl = 40.0;

  /// Margen lateral de pantalla.
  static const gutter = 20.0;
}

class AppShadows {
  AppShadows._();
  static const sm = [BoxShadow(color: Color(0x242D2B2B), offset: Offset(0, 1), blurRadius: 2)];
  static const md = [BoxShadow(color: Color(0x292D2B2B), offset: Offset(0, 3), blurRadius: 10)];
  static const lg = [BoxShadow(color: Color(0x382D2B2B), offset: Offset(0, 12), blurRadius: 32)];

  /// Sombra superior suave de los pies fijos (CTA).
  static const footer = [BoxShadow(color: Color(0x4D2D2B2B), offset: Offset(0, -8), blurRadius: 16, spreadRadius: -12)];
}

/// Estilo visual por tipo de evento: punto de color y colores de tag.
class EventTypeStyle {
  final Color dot;
  final Color tagBg;
  final Color tagFg;
  const EventTypeStyle(this.dot, this.tagBg, this.tagFg);

  static const _culto = EventTypeStyle(AppColors.cyan, AppColors.cyan100, AppColors.cyan800);
  static const _especial = EventTypeStyle(AppColors.magenta, AppColors.magenta100, AppColors.magenta800);
  static const _evangelismo = EventTypeStyle(AppColors.cyan800, AppColors.cyan200, AppColors.cyan900);
  static const _otro = EventTypeStyle(AppColors.neutral600, AppColors.neutral200, AppColors.neutral800);

  static EventTypeStyle of(String? type) {
    switch (type) {
      case 'Culto':
        return _culto;
      case 'Culto Especial':
        return _especial;
      case 'Evangelismo':
        return _evangelismo;
      default:
        return _otro;
    }
  }
}
