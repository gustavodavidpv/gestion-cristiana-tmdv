import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/fake_backend.dart';
import '../support/harness.dart';

/// Ingresos y sesión: login correcto/incorrecto, cuenta desactivada, sin red,
/// sesión recordada, sesión vencida, cierre de sesión y versión mínima.
void main() {
  group('Login', () {
    testWidgets('credenciales correctas → Inicio con saludo y pestañas', (tester) async {
      final be = await pumpApp(tester);
      expect(find.text('Entrar'), findsOneWidget);
      await login(tester);

      expect(find.textContaining(', Gustavo'), findsOneWidget);
      expect(tabLabels(tester), ['Inicio', 'Miembros', 'Eventos', 'Club', 'Más']);
      // El token queda en el almacenamiento seguro y el login manda device_id (T1.3).
      expect(secureValues['auth.token'], be.validToken);
      final loginReq = be.sent('POST', '/auth/login').single;
      expect(loginReq.json['device_id'], isNotEmpty);
      expect(loginReq.json['platform'], 'android');
      // Todas las peticiones autenticadas llevan el Bearer.
      expect(be.requests.where((r) => r.path == '/auth/my-permissions').single.auth, 'Bearer ${be.validToken}');
    });

    testWidgets('contraseña incorrecta → mensaje y sigue en Login', (tester) async {
      await pumpApp(tester);
      await login(tester, password: 'mala');
      expect(find.text('Correo o contraseña incorrectos.'), findsOneWidget);
      expect(find.text('Entrar'), findsOneWidget);
      expect(secureValues['auth.token'], isNull);
    });

    testWidgets('cuenta desactivada → mensaje del servidor', (tester) async {
      final be = FakeBackend()..accountDisabled = true;
      await pumpApp(tester, backend: be);
      await login(tester);
      expect(find.text('Cuenta desactivada. Contacte al administrador.'), findsOneWidget);
    });

    testWidgets('campos vacíos → no llama al servidor', (tester) async {
      final be = await pumpApp(tester);
      await tester.tap(find.text('Entrar'));
      await settle(tester);
      expect(find.text('Escribe tu correo y tu contraseña.'), findsOneWidget);
      expect(be.sent('POST', '/auth/login'), isEmpty);
    });

    testWidgets('servidor inalcanzable → mensaje de conexión', (tester) async {
      final be = FakeBackend();
      await pumpApp(tester, backend: be);
      be.offline = true;
      await login(tester);
      expect(find.textContaining('No pudimos conectar con el servidor'), findsOneWidget);
    });

    testWidgets('¿Olvidaste tu contraseña? pide el código', (tester) async {
      final be = await pumpApp(tester);
      await tapText(tester, '¿Olvidaste tu contraseña?');
      expect(find.text('Recuperar contraseña'), findsOneWidget);
      await tester.enterText(find.byType(TextField).first, 'gustavo@iglesiacentral.pa');
      await tapText(tester, 'Enviar código');
      expect(be.sent('POST', '/auth/forgot-password').single.json['email'], 'gustavo@iglesiacentral.pa');
      expect(find.text('Código'), findsOneWidget);
    });
  });

  group('Sesión', () {
    testWidgets('sesión guardada → entra directo sin pedir contraseña', (tester) async {
      final be = await pumpApp(tester, loggedIn: true);
      expect(find.text('Entrar'), findsNothing);
      expect(tabLabels(tester), isNotEmpty);
      expect(be.sent('GET', '/auth/me'), hasLength(1));
    });

    testWidgets('token vencido al abrir → Login con "Tu sesión expiró" y token borrado', (tester) async {
      await pumpApp(tester, loggedIn: true, storedToken: 'token-viejo');
      expect(find.text('Tu sesión expiró. Inicia sesión otra vez.'), findsOneWidget);
      expect(secureValues['auth.token'], isNull);
    });

    testWidgets('token vence mientras se usa la app → vuelve al Login', (tester) async {
      final be = await pumpApp(tester, loggedIn: true);
      be.validToken = 'otro-token'; // el servidor invalida el token actual
      await goTab(tester, 'Miembros');
      expect(find.text('Tu sesión expiró. Inicia sesión otra vez.'), findsOneWidget);
      expect(secureValues['auth.token'], isNull);
    });

    testWidgets('sin red al abrir → usa el perfil guardado y muestra la banda', (tester) async {
      final be = FakeBackend()..offline = true;
      final online = StreamController<bool>();
      online.add(false);
      await pumpApp(tester, backend: be, loggedIn: true, cachedProfile: true, online: online);
      expect(tabLabels(tester), ['Inicio', 'Miembros', 'Eventos', 'Club', 'Más']);
      expect(find.text('Sin conexión — estás viendo datos guardados.'), findsOneWidget);
      expect(find.text('No pudimos conectar.'), findsOneWidget);
      await online.close();
    });

    testWidgets('cerrar sesión pide confirmación y borra el token', (tester) async {
      await pumpApp(tester, loggedIn: true);
      await goTab(tester, 'Más');
      await tapText(tester, 'Cerrar sesión');
      expect(find.text('¿Cerrar sesión?'), findsOneWidget);
      await tapText(tester, 'Cerrar sesión', last: true);
      expect(find.text('Entrar'), findsOneWidget);
      expect(secureValues['auth.token'], isNull);
    });

    testWidgets('versión menor a la mínima (T1.4) → pantalla bloqueante', (tester) async {
      final be = FakeBackend()
        ..appConfig = {
          'min_version': {'android': '2.0.0', 'ios': '2.0.0'},
          'store_urls': {'android': 'https://play.google.com/store/apps/details?id=org.tmdv.gestioncristiana'},
        };
      await pumpApp(tester, backend: be, loggedIn: true);
      expect(find.text('Hay una versión nueva de la app.'), findsOneWidget);
      expect(find.text('Ir a Google Play'), findsOneWidget);
      expect(tabLabels(tester), isEmpty);
    });
  });
}
