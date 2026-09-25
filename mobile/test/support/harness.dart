import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gestion_cristiana/app/router.dart';
import 'package:gestion_cristiana/core/api/api_client.dart';
import 'package:gestion_cristiana/core/auth/session_store.dart';
import 'package:gestion_cristiana/core/providers.dart';
import 'package:gestion_cristiana/core/theme/app_theme.dart';
import 'package:gestion_cristiana/main.dart';

import 'fake_backend.dart';

/// Almacenamiento seguro simulado (el mock lo modifica en sitio: sirve para
/// comprobar que el token se guarda y se borra).
Map<String, String> secureValues = {};

/// Monta la app completa (router, tema, permisos) contra [backend].
///
/// - [loggedIn]: arranca con un token guardado, como si ya hubiera iniciado sesión.
/// - [storedToken]: token guardado distinto al vigente (sesión vencida).
/// - [cachedProfile]: guarda también usuario y permisos (arranque sin red).
/// - [online]: estado de red que ve la banda "Sin conexión".
/// - [height]: alto de la pantalla en pt; uno grande construye listas enteras
///   (útil para comprobar que algo NO aparece).
Future<FakeBackend> pumpApp(
  WidgetTester tester, {
  FakeBackend? backend,
  String role = 'Administrador',
  bool loggedIn = false,
  String? storedToken,
  bool cachedProfile = false,
  StreamController<bool>? online,
  double height = 844,
}) async {
  AppText.useGoogleFonts = false;
  tester.view.physicalSize = Size(390 * 3, height * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  final be = backend ?? FakeBackend(role: role);
  secureValues = {
    if (loggedIn) 'auth.token': storedToken ?? be.validToken,
    if (cachedProfile) 'auth.user': jsonEncode(be.userJson),
    if (cachedProfile) 'auth.permissions': jsonEncode(be.perms),
  };
  FlutterSecureStorage.setMockInitialValues(secureValues);

  await tester.pumpWidget(ProviderScope(
    overrides: [
      appVersionProvider.overrideWithValue('1.0.0'),
      sessionStoreProvider.overrideWithValue(SessionStore()),
      apiClientProvider.overrideWith((ref) => ApiClient(ref.watch(sessionStoreProvider), appVersion: '1.0.0', adapter: be)),
      onlineProvider.overrideWith((ref) => online?.stream ?? Stream.value(true)),
    ],
    retry: (_, _) => null,
    child: const TmdvApp(),
  ));
  await settle(tester);
  return be;
}

/// Avanza el reloj de prueba sin esperar a que terminen animaciones infinitas
/// (esqueletos, cursor del teclado), que harían fallar `pumpAndSettle`.
Future<void> settle(WidgetTester tester, [int frames = 30]) async {
  for (var i = 0; i < frames; i++) {
    await tester.pump(const Duration(milliseconds: 50));
  }
}

/// Inicia sesión desde la pantalla de Login.
Future<void> login(WidgetTester tester, {String email = 'gustavo@iglesiacentral.pa', String password = 'secreto'}) async {
  await tester.enterText(find.byType(TextField).at(0), email);
  await tester.enterText(find.byType(TextField).at(1), password);
  await tester.tap(find.text('Entrar'));
  await settle(tester);
}

/// Toca un texto visible y avanza.
Future<void> tapText(WidgetTester tester, String text, {bool last = false}) async {
  final f = find.text(text);
  expect(f, findsWidgets, reason: 'No se encontró "$text"');
  final target = last ? f.last : f.first;
  await tester.ensureVisible(target);
  await tester.pump();
  await tester.tap(target);
  await settle(tester);
}

/// Etiquetas visibles de la barra de pestañas.
List<String> tabLabels(WidgetTester tester) {
  final bar = find.byKey(const Key('tabBar'));
  if (bar.evaluate().isEmpty) return const [];
  return tester.widgetList<Text>(find.descendant(of: bar, matching: find.byType(Text))).map((t) => t.data ?? '').toList();
}

/// Cambia de pestaña.
Future<void> goTab(WidgetTester tester, String label) async {
  await tester.tap(find.descendant(of: find.byKey(const Key('tabBar')), matching: find.text(label)));
  await settle(tester);
}

/// Vuelve a la pantalla anterior (equivale a tocar "‹ Atrás").
Future<void> goBack(WidgetTester tester) async {
  rootNavigatorKey.currentState!.pop();
  await settle(tester);
}
