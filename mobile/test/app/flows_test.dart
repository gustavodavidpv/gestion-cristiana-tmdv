import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gestion_cristiana/core/utils/panama_time.dart';
import 'package:gestion_cristiana/widgets/widgets.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../support/fake_backend.dart';
import '../support/harness.dart';

/// Flujos de trabajo principales, verificando el contrato enviado al servidor.
void main() {
  group('Registrar asistencia (flujo estrella)', () {
    Future<FakeBackend> openRegister(WidgetTester tester, {FakeBackend? backend, StreamController<bool>? online}) async {
      final be = await pumpApp(tester, backend: backend, loggedIn: true, online: online, height: 1600);
      await tapText(tester, 'Registrar'); // botón "Hoy · 7:00 p. m." del Inicio
      expect(find.text('Registrar asistencia'), findsOneWidget);
      return be;
    }

    testWidgets('selección, decisiones de fe, búsqueda y guardado (REEMPLAZO)', (tester) async {
      final be = await openRegister(tester);

      // Ana ya estaba registrada: aparece marcada y no se puede desmarcar.
      expect(find.text('Ya registrado'), findsOneWidget);
      expect(find.text('1 seleccionado'), findsOneWidget);
      await tapText(tester, 'Guardar asistencia (1)');
      expect(be.sent('POST', '/events/10/attendees'), isEmpty, reason: 'sin cambios no se guarda');
      await tapText(tester, 'Ana López');
      expect(find.text('Ana López ya está registrado en este evento.'), findsOneWidget);

      // Marcar a Beto; decisión de fe en Carla (la selecciona también).
      await tapText(tester, 'Beto Díaz');
      expect(find.text('2 seleccionados'), findsOneWidget);
      await tester.tap(find.text('Decisión').at(2)); // filas: Ana, Beto, Carla, David
      await settle(tester);
      expect(find.text('3 seleccionados'), findsOneWidget);
      expect(find.text('1 decisión de fe'), findsOneWidget);

      // Desmarcar a alguien elimina su decisión.
      await tester.tap(find.text('Decisión').at(3)); // David
      await settle(tester);
      expect(find.text('2 decisiones de fe'), findsOneWidget);
      await tapText(tester, 'David Soto');
      expect(find.text('3 seleccionados'), findsOneWidget);
      expect(find.text('1 decisión de fe'), findsOneWidget);

      // La selección sobrevive a la búsqueda.
      await tester.enterText(find.byType(TextField).first, 'car');
      await settle(tester);
      expect(find.text('Beto Díaz'), findsNothing);
      expect(find.text('Carla Ruiz'), findsOneWidget);
      expect(find.text('3 seleccionados'), findsOneWidget);
      await tester.enterText(find.byType(TextField).first, '');
      await settle(tester);

      await tapText(tester, 'Guardar asistencia (3)');
      final sent = be.sent('POST', '/events/10/attendees').single.json['attendees'] as List;
      // El servidor reemplaza la lista: van los ya registrados + los nuevos.
      expect(sent, [
        {'member_id': 1, 'attended': true, 'made_faith_decision': false},
        {'member_id': 2, 'attended': true, 'made_faith_decision': false},
        {'member_id': 3, 'attended': true, 'made_faith_decision': true},
      ]);
      expect(find.text('Asistencia guardada · 3 personas, 1 decisión de fe.'), findsOneWidget);
      expect(find.textContaining(', Gustavo'), findsOneWidget, reason: 'vuelve al Inicio');
    });

    testWidgets('nuevo visitante se crea como Visitante y queda marcado', (tester) async {
      final be = await openRegister(tester);
      await tapText(tester, 'Nuevo visitante');
      await tester.enterText(find.byType(TextField).at(1), 'Eva');
      await tester.enterText(find.byType(TextField).at(2), 'Mora');
      await settle(tester);
      await tapText(tester, 'Agregar y marcar');
      final created = be.sent('POST', '/members').single.json;
      expect(created['first_name'], 'Eva');
      expect(created['last_name'], 'Mora');
      expect(created['member_type'], 'Visitante');
      expect(find.text('Eva Mora'), findsOneWidget);
      expect(find.text('2 seleccionados'), findsOneWidget);
    });

    testWidgets('sin conexión: aviso y guardar deshabilitado, la selección se conserva', (tester) async {
      final online = StreamController<bool>.broadcast();
      final be = FakeBackend();
      final future = openRegister(tester, backend: be, online: online);
      online.add(true);
      await future;
      online.add(false);
      await settle(tester);
      await tapText(tester, 'Beto Díaz');
      expect(find.text('Sin conexión. Tu selección se conserva; guarda cuando vuelva la red.'), findsOneWidget);
      await tapText(tester, 'Guardar asistencia (2)');
      expect(be.sent('POST', '/events/10/attendees'), isEmpty);
      online.add(true);
      await settle(tester);
      await tapText(tester, 'Guardar asistencia (2)');
      expect(be.sent('POST', '/events/10/attendees'), hasLength(1));
      await online.close();
    });
  });

  group('Eventos', () {
    testWidgets('crear evento envía la hora de Panamá con offset -05:00', (tester) async {
      final be = await pumpApp(tester, loggedIn: true);
      await goTab(tester, 'Eventos');
      await tester.tap(find.byType(AppFab));
      await settle(tester);
      expect(find.text('Nuevo evento'), findsOneWidget);

      await tapText(tester, 'Crear evento');
      expect(find.text('Escribe el título del evento.'), findsOneWidget);
      expect(be.sent('POST', '/events'), isEmpty);

      await tester.enterText(find.byType(TextField).first, 'Vigilia de oración');
      await tapText(tester, 'Crear evento');
      final body = be.sent('POST', '/events').single.json;
      expect(body['title'], 'Vigilia de oración');
      expect(body['event_type'], 'Culto');
      expect(body['start_date'], '${PanamaTime.dateOnly(PanamaTime.today())}T19:00:00-05:00');
      expect(find.text('Vigilia de oración'), findsOneWidget, reason: 'abre el detalle del evento creado');
    });
  });

  group('Miembros', () {
    testWidgets('crear miembro: validación y envío', (tester) async {
      final be = await pumpApp(tester, loggedIn: true);
      await goTab(tester, 'Miembros');
      await tester.tap(find.byType(AppFab));
      await settle(tester);
      await tapText(tester, 'Agregar miembro');
      expect(find.text('Escribe los nombres.'), findsOneWidget);
      expect(be.sent('POST', '/members'), isEmpty);

      await tester.enterText(find.byType(TextField).at(0), 'Rosa');
      await tester.enterText(find.byType(TextField).at(1), 'Vega');
      await tapText(tester, 'Agregar miembro');
      final body = be.sent('POST', '/members').single.json;
      expect(body['first_name'], 'Rosa');
      expect(body['member_type'], 'Miembro');
      expect(body.containsKey('position_ids'), isTrue, reason: 'Administrador ve el catálogo de cargos');
      expect(find.text('Rosa Vega fue agregado.'), findsOneWidget);
    });

    testWidgets('Secretaría sin catálogo de cargos (403): no envía position_ids y conserva el cargo', (tester) async {
      final be = await pumpApp(tester, role: 'Secretaría', loggedIn: true);
      await goTab(tester, 'Miembros');
      await tapText(tester, 'Ana López');
      await tapText(tester, 'Editar');
      expect(find.text('Cargo ministerial'), findsNothing, reason: 'campo oculto sin positions.view');
      await tapText(tester, 'Guardar cambios');
      final body = be.sent('PUT', '/members/1').single.json;
      expect(body.containsKey('position_ids'), isFalse);
      expect(body['first_name'], 'Ana');
    });
  });

  group('Club Bíblico', () {
    testWidgets('sumar puntos (+1, mantener = +5), motivo y guardado por lote', (tester) async {
      final be = await pumpApp(tester, loggedIn: true);
      await goTab(tester, 'Club');
      final plus = find.byIcon(PhosphorIconsBold.plus).first; // Luis Pérez
      await tester.tap(plus);
      await settle(tester, 5);
      await tester.longPress(plus);
      await settle(tester, 5);
      expect(find.text('6'), findsOneWidget);
      await tapText(tester, 'Por llegar temprano');
      await tapText(tester, 'Guardar 1 movimiento');

      final body = be.sent('POST', '/bible-club/transactions').single.json;
      expect(body['activity_date'], PanamaTime.dateOnly(PanamaTime.lastWeekday(DateTime.saturday)));
      expect(body['entries'], [
        {'student_id': 1, 'points': 6, 'type': 'earn', 'reason': 'Por llegar temprano'},
      ]);
      expect(find.text('1 movimiento guardado · +6 pts'), findsOneWidget);
      expect(find.text('Sin movimientos'), findsOneWidget, reason: 'la hoja queda limpia');
    });

    testWidgets('canje: saldo insuficiente bloquea; canje válido descuenta', (tester) async {
      final be = await pumpApp(tester, loggedIn: true);
      await goTab(tester, 'Club');
      await tapText(tester, 'Luis Pérez');
      expect(find.text('CANJE · SALDO 40 PTS'), findsOneWidget);
      await tester.enterText(find.byType(TextField).at(0), 'Biblia de bolsillo');
      await tester.enterText(find.byType(TextField).at(1), '50');
      await settle(tester);
      expect(find.text('Saldo insuficiente para este artículo.'), findsOneWidget);
      await tapText(tester, 'Canjear 50 pts');
      expect(be.sent('POST', '/bible-club/transactions'), isEmpty);

      await tester.enterText(find.byType(TextField).at(1), '15');
      await settle(tester);
      await tapText(tester, 'Canjear 15 pts');
      final entry = (be.sent('POST', '/bible-club/transactions').single.json['entries'] as List).single;
      expect(entry['type'], 'redeem');
      expect(entry['points'], 15);
      expect(entry['item'], 'Biblia de bolsillo');
    });
  });

  group('Asistencia semanal', () {
    Future<void> openForm(WidgetTester tester) async {
      await goTab(tester, 'Más');
      await tapText(tester, 'Asistencia semanal');
      await tester.tap(find.byType(AppFab));
      await settle(tester);
      expect(find.text('Registrar semana'), findsOneWidget);
    }

    testWidgets('teclado propio, validación y registro del último domingo', (tester) async {
      final be = await pumpApp(tester, loggedIn: true);
      await openForm(tester);
      await tapText(tester, 'Guardar semana');
      expect(find.text('Escribe la cantidad de asistentes.'), findsOneWidget);

      for (final k in ['1', '2', '0']) {
        await tester.tap(find.text(k).last);
        await settle(tester, 2);
      }
      expect(find.text('120'), findsOneWidget);
      await tapText(tester, 'Guardar semana');
      final body = be.sent('POST', '/weekly-attendance').single.json;
      expect(body['week_date'], PanamaTime.dateOnly(PanamaTime.lastWeekday(DateTime.sunday)));
      expect(body['attendance_count'], 120);
      expect(find.text('Semana registrada · 120 asistentes.'), findsOneWidget);
    });

    testWidgets('semana ya registrada se reemplaza (PUT)', (tester) async {
      final be = await pumpApp(tester, loggedIn: true);
      await openForm(tester);
      await tester.tap(find.byIcon(PhosphorIconsDuotone.caretLeft).last); // semana anterior (ya existe)
      await settle(tester);
      for (final k in ['9', '5']) {
        await tester.tap(find.text(k).last);
        await settle(tester, 2);
      }
      await tapText(tester, 'Guardar semana');
      expect(be.sent('POST', '/weekly-attendance'), isEmpty);
      expect(be.sent('PUT', '/weekly-attendance/1').single.json['attendance_count'], 95);
    });

    testWidgets('rol Asistencia no puede reemplazar una semana: muestra el 403 del servidor', (tester) async {
      await pumpApp(tester, role: 'Asistencia', loggedIn: true);
      await openForm(tester);
      await tester.tap(find.byIcon(PhosphorIconsDuotone.caretLeft).last);
      await settle(tester);
      await tester.tap(find.text('7').last);
      await settle(tester, 2);
      await tapText(tester, 'Guardar semana');
      expect(find.text('No tiene permisos para realizar esta acción.'), findsOneWidget);
    });
  });
}
