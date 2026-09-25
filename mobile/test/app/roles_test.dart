import 'package:flutter_test/flutter_test.dart';
import 'package:gestion_cristiana/widgets/widgets.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../support/harness.dart';
import '../support/server_defaults.dart';

/// Matriz de permisos (T4.3) en la app: para cada rol, con los DEFAULTS del
/// servidor, la UI muestra solo lo permitido (lo prohibido NO existe) y nunca
/// llama un endpoint que el backend rechazaría con 403.
const expectedTabs = {
  'SuperAdmin': ['Inicio', 'Miembros', 'Eventos', 'Club', 'Más'],
  'Administrador': ['Inicio', 'Miembros', 'Eventos', 'Club', 'Más'],
  'Secretaría': ['Inicio', 'Miembros', 'Eventos', 'Club', 'Más'],
  'Líder': ['Inicio', 'Miembros', 'Eventos', 'Club', 'Más'],
  'Asistencia': ['Inicio', 'Eventos', 'Miembros', 'Club', 'Más'],
  'Visitante': ['Inicio', 'Miembros', 'Club', 'Más'],
};

/// 403 esperados: el catálogo de cargos se pide siempre y la app lo degrada
/// (hallazgo 1.5.d del plan).
const toleratedForbidden = {'/ministerial-positions'};

Matcher present(bool yes) => yes ? findsWidgets : findsNothing;

void main() {
  for (final role in allRoles) {
    final p = permissionsFor(role);
    bool can(String m, [String a = 'view']) => p[m]?[a] ?? false;

    testWidgets('Rol $role: pestañas, acciones y endpoints', (tester) async {
      final be = await pumpApp(tester, role: role, loggedIn: true, height: 2400);

      // ---- Pestañas
      expect(tabLabels(tester), expectedTabs[role], reason: 'pestañas de $role');

      // ---- Inicio
      expect(find.text('Por iglesia'), present(role == 'SuperAdmin'), reason: 'comparativo SuperAdmin');
      expect(find.text('Resumen de la iglesia'), present(can('churches') && role != 'SuperAdmin'));
      expect(find.text('Cargar puntos'), present(can('bible_club', 'create')));
      expect(find.text('Registrar semana'), present(can('weekly_attendance', 'create')));
      expect(find.text('Próximos eventos'), present(can('events')));

      // ---- Miembros
      await goTab(tester, 'Miembros');
      expect(find.text('Ana López'), findsOneWidget);
      expect(find.byType(AppFab), present(can('members', 'create')), reason: 'FAB nuevo miembro');
      await tapText(tester, 'Ana López');
      expect(find.text('DATOS PERSONALES'), findsOneWidget);
      expect(find.text('Editar'), present(can('members', 'edit')), reason: 'acción Editar en la ficha');
      final hasMenu = can('members', 'edit') || can('members', 'delete');
      expect(find.byType(MoreButton), present(hasMenu), reason: 'menú ⋮ de la ficha');
      if (hasMenu) {
        await tester.tap(find.byType(MoreButton));
        await settle(tester);
        expect(find.text('Eliminar miembro'), present(can('members', 'delete')), reason: 'eliminar miembro');
        await goBack(tester); // cierra la hoja
      }
      await goBack(tester); // vuelve a la lista

      // ---- Eventos
      if (can('events')) {
        await goTab(tester, 'Eventos');
        expect(find.byType(AppFab), present(can('events', 'create')), reason: 'FAB nuevo evento');
        await tapText(tester, 'Culto de adoración', last: true);
        expect(find.text('Asistentes registrados'), findsOneWidget);
        expect(find.text('Registrar asistencia'), present(can('events', 'attendance')));
        if (can('events', 'attendance')) {
          await tapText(tester, 'Registrar asistencia');
          expect(find.textContaining('seleccionado'), findsOneWidget);
          expect(find.text('Nuevo visitante'), present(can('members', 'create')), reason: 'alta de visitante');
          await goBack(tester);
        }
        await goBack(tester);
      }

      // ---- Club
      if (can('bible_club')) {
        await goTab(tester, 'Club');
        expect(find.text('Luis Pérez'), findsOneWidget);
        final editable = can('bible_club', 'create');
        expect(find.text('Sin movimientos'), present(editable), reason: 'hoja de puntos editable');
        expect(find.byIcon(PhosphorIconsBold.plus), present(editable), reason: 'botones +');
      }

      // ---- Más
      await goTab(tester, 'Más');
      expect(find.text('Asistencia semanal'), present(can('weekly_attendance')));
      expect(find.text('Actas'), present(can('minutes')));
      expect(find.text('Iglesia'), present(role == 'SuperAdmin'), reason: 'selector de iglesia');
      expect(find.text('Cerrar sesión'), findsOneWidget);
      expect(find.text('Eliminar mi cuenta'), findsOneWidget);

      if (can('weekly_attendance')) {
        await tapText(tester, 'Asistencia semanal');
        expect(find.text('Semanas registradas'), findsOneWidget);
        expect(find.byType(AppFab), present(can('weekly_attendance', 'create')));
        await goBack(tester);
      }
      if (can('minutes')) {
        await tapText(tester, 'Actas');
        await tapText(tester, 'Reunión de junta');
        expect(find.text('MOTIVOS Y ACUERDOS'), findsOneWidget);
        expect(find.text('Adjuntar archivo'), present(can('minutes', 'edit')));
        await goBack(tester);
        await goBack(tester);
      }

      // ---- Ningún endpoint prohibido (salvo el catálogo de cargos, que se degrada)
      final bad = be.forbidden.where((r) => !toleratedForbidden.contains(r.path)).toList();
      expect(bad, isEmpty, reason: 'la app llamó endpoints que el rol $role no puede usar: $bad');
    });
  }
}
