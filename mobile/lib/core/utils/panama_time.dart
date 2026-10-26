/// Utilidades de zona horaria para Panamá (UTC-5, sin horario de verano).
///
/// Misma técnica que `client/src/utils/panamaTime.js`: se trabaja con un
/// `DateTime` en UTC cuyos campos (year, month, day, hour, minute) representan
/// la HORA DE PARED de Panamá. Así el resultado no depende de la zona horaria
/// configurada en el teléfono.
///
/// Contrato con el backend (eventController.normalizeEventDates): las fechas de
/// eventos se envían en ISO 8601 con offset explícito, p. ej.
/// `2026-04-26T19:00:00-05:00`.
class PanamaTime {
  PanamaTime._();

  static const Duration offset = Duration(hours: -5);

  /// Hora de pared actual en Panamá.
  static DateTime now() => toWall(DateTime.now());

  /// Convierte un instante real a hora de pared de Panamá.
  static DateTime toWall(DateTime instant) => instant.toUtc().add(offset);

  /// Convierte hora de pared de Panamá al instante real (UTC).
  static DateTime toInstant(DateTime wall) =>
      DateTime.utc(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second).subtract(offset);

  /// Construye una hora de pared de Panamá.
  static DateTime wall(int year, int month, int day, [int hour = 0, int minute = 0]) =>
      DateTime.utc(year, month, day, hour, minute);

  /// Hoy a las 00:00 (hora de pared).
  static DateTime today() {
    final n = now();
    return DateTime.utc(n.year, n.month, n.day);
  }

  /// Parsea una fecha del servidor (ISO con `Z` u offset) a hora de pared.
  static DateTime? parse(String? iso) {
    if (iso == null || iso.isEmpty) return null;
    final d = DateTime.tryParse(iso);
    if (d == null) return null;
    // Un string sin offset se interpreta como hora de pared de Panamá.
    final hasOffset = RegExp(r'(Z|[+-]\d{2}:?\d{2})$').hasMatch(iso);
    if (!hasOffset) return DateTime.utc(d.year, d.month, d.day, d.hour, d.minute, d.second);
    return toWall(d);
  }

  /// Parsea una fecha DATEONLY (`YYYY-MM-DD`) como día de pared.
  static DateTime? parseDateOnly(String? s) {
    if (s == null || s.length < 10) return null;
    final p = s.substring(0, 10).split('-');
    if (p.length != 3) return null;
    return DateTime.utc(int.parse(p[0]), int.parse(p[1]), int.parse(p[2]));
  }

  static String _two(int n) => n.toString().padLeft(2, '0');

  /// ISO 8601 con offset `-05:00` a partir de una hora de pared.
  static String toIso(DateTime wall) =>
      '${wall.year.toString().padLeft(4, '0')}-${_two(wall.month)}-${_two(wall.day)}'
      'T${_two(wall.hour)}:${_two(wall.minute)}:${_two(wall.second)}-05:00';

  /// `YYYY-MM-DD` de una hora de pared.
  static String dateOnly(DateTime wall) =>
      '${wall.year.toString().padLeft(4, '0')}-${_two(wall.month)}-${_two(wall.day)}';

  static bool sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

  static DateTime startOfDay(DateTime wall) => DateTime.utc(wall.year, wall.month, wall.day);

  /// Último día `weekday` (1 = lunes … 7 = domingo) que sea hoy o anterior.
  static DateTime lastWeekday(int weekday, [DateTime? from]) {
    final d = startOfDay(from ?? now());
    final diff = (d.weekday - weekday) % 7;
    return d.subtract(Duration(days: diff));
  }
}
