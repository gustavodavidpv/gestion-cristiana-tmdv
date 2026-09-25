import 'package:flutter_test/flutter_test.dart';
import 'package:gestion_cristiana/core/utils/format.dart';
import 'package:gestion_cristiana/core/utils/panama_time.dart';

void main() {
  group('PanamaTime', () {
    test('envía ISO con offset -05:00 (contrato de eventController)', () {
      final wall = PanamaTime.wall(2026, 4, 26, 19, 0);
      expect(PanamaTime.toIso(wall), '2026-04-26T19:00:00-05:00');
    });

    test('un UTC del servidor se muestra en hora de Panamá', () {
      // 00:00Z del 30 de marzo = 7:00 p. m. del 29 en Panamá (caso de panamaTime.js).
      final d = PanamaTime.parse('2026-03-30T00:00:00.000Z')!;
      expect([d.year, d.month, d.day, d.hour, d.minute], [2026, 3, 29, 19, 0]);
    });

    test('ida y vuelta: lo que se envía es lo que se vuelve a mostrar', () {
      final wall = PanamaTime.wall(2026, 12, 31, 23, 30);
      final back = PanamaTime.parse(PanamaTime.toIso(wall))!;
      expect(back, wall);
    });

    test('un string sin offset se toma como hora de pared de Panamá', () {
      final d = PanamaTime.parse('2026-05-01T08:15:00')!;
      expect([d.day, d.hour, d.minute], [1, 8, 15]);
    });

    test('toInstant convierte la hora de pared al instante UTC real', () {
      expect(PanamaTime.toInstant(PanamaTime.wall(2026, 1, 1, 19)), DateTime.utc(2026, 1, 2, 0));
    });

    test('fechas DATEONLY no se desplazan de día', () {
      final d = PanamaTime.parseDateOnly('2026-09-20')!;
      expect(PanamaTime.dateOnly(d), '2026-09-20');
    });

    test('lastWeekday devuelve el domingo o sábado anterior (o el mismo día)', () {
      final wed = DateTime.utc(2026, 9, 23);
      expect(PanamaTime.dateOnly(PanamaTime.lastWeekday(DateTime.sunday, wed)), '2026-09-20');
      expect(PanamaTime.dateOnly(PanamaTime.lastWeekday(DateTime.saturday, wed)), '2026-09-19');
      final sun = DateTime.utc(2026, 9, 27);
      expect(PanamaTime.dateOnly(PanamaTime.lastWeekday(DateTime.sunday, sun)), '2026-09-27');
    });
  });

  group('Fmt', () {
    test('fecha larga en español', () {
      expect(Fmt.longDate(DateTime.utc(2026, 9, 27)), 'Domingo 27 de septiembre de 2026');
    });
    test('hora con a. m./p. m.', () {
      expect(Fmt.time(DateTime.utc(2026, 1, 1, 19)), '7:00 p. m.');
      expect(Fmt.time(DateTime.utc(2026, 1, 1, 0, 5)), '12:05 a. m.');
    });
    test('cumpleaños MM-DD', () {
      expect(Fmt.birthday('03-15'), '15 de marzo');
      expect(Fmt.birthday(null), '—');
    });
    test('iniciales', () {
      expect(Fmt.initials('Gustavo Polanco'), 'GP');
    });
  });
}
