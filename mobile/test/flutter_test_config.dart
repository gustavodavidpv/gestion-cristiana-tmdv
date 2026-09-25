import 'dart:async';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:gestion_cristiana/core/theme/app_theme.dart';

/// Configuración global de pruebas: carga Roboto del SDK de Flutter para que
/// los textos midan como en un teléfono real (la fuente de pruebas por defecto
/// dibuja cada letra como un cuadrado y exagera los desbordes).
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  AppText.useGoogleFonts = false;
  final sdk = Platform.environment['FLUTTER_ROOT'];
  if (sdk != null) {
    final dir = '$sdk/bin/cache/artifacts/material_fonts';
    final loader = FontLoader('Roboto');
    for (final f in ['roboto-regular.ttf', 'roboto-medium.ttf', 'roboto-bold.ttf', 'roboto-italic.ttf']) {
      final file = File('$dir/$f');
      if (file.existsSync()) loader.addFont(Future.value(ByteData.sublistView(file.readAsBytesSync())));
    }
    await loader.load();
    AppText.fallbackFamily = 'Roboto';
  }
  await testMain();
}
