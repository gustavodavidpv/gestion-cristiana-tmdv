import 'package:flutter_test/flutter_test.dart';
import 'package:gestion_cristiana/widgets/widgets.dart';

import '../support/harness.dart';

/// T4.4: con la fuente del sistema al 130% ninguna pantalla principal se
/// desborda (un desborde lanza una excepción de layout y falla la prueba).
void main() {
  for (final role in ['Administrador', 'Asistencia']) {
    testWidgets('fuente al 130% sin desbordes ($role)', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      // Login (sin sesión) al 130%.
      await pumpApp(tester, role: role);
      expect(find.text('Entrar'), findsOneWidget);
      await login(tester);

      for (final tab in tabLabels(tester)) {
        await goTab(tester, tab);
      }
      await goTab(tester, 'Miembros');
      await tapText(tester, 'Ana López');
      await goBack(tester);

      await goTab(tester, 'Eventos');
      await tapText(tester, 'Lista');
      await tapText(tester, 'Culto de adoración', last: true);
      await tapText(tester, 'Registrar asistencia');
      await goBack(tester);
      await goBack(tester);

      await goTab(tester, 'Más');
      await tapText(tester, 'Asistencia semanal');
      await tester.tap(find.byType(AppFab));
      await settle(tester);
      expect(find.text('Registrar semana'), findsOneWidget);
    });
  }
}
