import 'package:flutter_test/flutter_test.dart';
import 'package:gestion_cristiana/app/shell.dart';
import 'package:gestion_cristiana/core/auth/models.dart';

/// Mapas como los devuelve /api/auth/my-permissions con los DEFAULTS del servidor.
Permissions _perms(Map<String, Map<String, bool>> m) => Permissions.fromJson(m);

void main() {
  test('Administrador: Inicio · Miembros · Eventos · Club · Más', () {
    final p = _perms({
      'dashboard': {'view': true},
      'members': {'view': true, 'create': true},
      'events': {'view': true, 'attendance': true},
      'bible_club': {'view': true, 'create': true},
    });
    expect(visibleTabs(p).map((t) => t.label), ['Inicio', 'Miembros', 'Eventos', 'Club', 'Más']);
  });

  test('Asistencia: Eventos antes que Miembros', () {
    final p = _perms({
      'dashboard': {'view': true},
      'members': {'view': true, 'create': false},
      'events': {'view': true, 'attendance': true},
      'bible_club': {'view': false},
    });
    expect(visibleTabs(p).map((t) => t.label), ['Inicio', 'Eventos', 'Miembros', 'Más']);
  });

  test('Visitante: sin Eventos', () {
    final p = _perms({
      'dashboard': {'view': true},
      'members': {'view': true},
      'events': {'view': false},
      'bible_club': {'view': true},
    });
    expect(visibleTabs(p).map((t) => t.label), ['Inicio', 'Miembros', 'Club', 'Más']);
  });

  test('acción ausente = sin permiso', () {
    final p = _perms({'members': {'view': true}});
    expect(p.can('members', 'delete'), isFalse);
    expect(p.can('minutes'), isFalse);
  });
}
