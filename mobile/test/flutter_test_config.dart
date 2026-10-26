import 'dart:async';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:gestion_cristiana/core/theme/app_theme.dart';

/// Configuración global de pruebas: carga Roboto del SDK de Flutter para que
/// los textos midan como en un teléfono real (la fuente de pruebas por defecto
/// dibuja cada letra como un cuadrado y exagera los desbordes).
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  AppText.useGoogleFonts = false;
  final sdk = _flutterRoot();
  final dir = '$sdk/bin/cache/artifacts/material_fonts';
  final files = [
    for (final f in ['roboto-regular.ttf', 'roboto-medium.ttf', 'roboto-bold.ttf', 'roboto-italic.ttf']) File('$dir/$f'),
  ].where((file) => file.existsSync()).toList();
  // Sin Roboto las pruebas de desbordes medirían con la fuente cuadrada y
  // fallarían por motivos falsos: mejor detenerse con la causa real.
  if (sdk == null || files.isEmpty) {
    throw StateError('No se encontró Roboto en "$dir" (FLUTTER_ROOT=$sdk). '
        'Ejecuta las pruebas con el SDK completo (flutter precache --universal).');
  }
  final loader = FontLoader('Roboto');
  for (final file in files) {
    loader.addFont(Future.value(ByteData.sublistView(file.readAsBytesSync())));
  }
  await loader.load();
  AppText.fallbackFamily = 'Roboto';
  await testMain();
}

/// Raíz del SDK de Flutter. En Linux flutter_tester no hereda las variables de
/// entorno (FLUTTER_ROOT llega vacía), así que se deduce de su propia ruta:
/// `<FLUTTER_ROOT>/bin/cache/artifacts/engine/<plataforma>/flutter_tester`.
String? _flutterRoot() {
  final env = Platform.environment['FLUTTER_ROOT'];
  if (env != null && env.isNotEmpty) return env;
  final exe = Platform.resolvedExecutable.replaceAll(r'\', '/');
  final i = exe.indexOf('/bin/cache/');
  return i > 0 ? exe.substring(0, i) : null;
}
