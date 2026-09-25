import 'package:intl/intl.dart';

import 'panama_time.dart';

/// Formateadores en español (es-419). Todas las fechas recibidas son horas de
/// pared de Panamá (ver [PanamaTime]).
class Fmt {
  Fmt._();

  static const _locale = 'es';

  static const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];

  static const _weekdays = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  static const _weekdaysShort = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  static String cap(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);

  static String monthName(int month) => months[month - 1];

  static String weekday(DateTime d) => _weekdays[d.weekday - 1];

  /// "DOM", "LUN"…
  static String dowShort(DateTime d) => _weekdaysShort[d.weekday - 1].toUpperCase();

  /// "Domingo 27 de septiembre de 2026"
  static String longDate(DateTime d) => '${cap(weekday(d))} ${d.day} de ${monthName(d.month)} de ${d.year}';

  /// "Domingo 27 de septiembre"
  static String longDateNoYear(DateTime d) => '${cap(weekday(d))} ${d.day} de ${monthName(d.month)}';

  /// "Dom 20 de septiembre"
  static String shortDowDate(DateTime d) => '${_weekdaysShort[d.weekday - 1]} ${d.day} de ${monthName(d.month)}';

  /// "sábado 26 de septiembre"
  static String activityDate(DateTime d) => '${weekday(d)} ${d.day} de ${monthName(d.month)}';

  /// "27 sept 2026"
  static String shortDate(DateTime d) => '${d.day} ${monthName(d.month).substring(0, 3)} ${d.year}';

  /// "Septiembre 2026"
  static String monthYear(DateTime d) => '${cap(monthName(d.month))} ${d.year}';

  /// "7:00 p. m."
  static String time(DateTime d) {
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final suffix = d.hour < 12 ? 'a. m.' : 'p. m.';
    return '$h:${d.minute.toString().padLeft(2, '0')} $suffix';
  }

  static String number(num n) => NumberFormat.decimalPattern(_locale).format(n);

  /// Saludo según la hora de Panamá.
  static String greeting() {
    final h = PanamaTime.now().hour;
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  /// "MM-DD" → "15 de marzo"
  static String birthday(String? mmdd) {
    if (mmdd == null || !RegExp(r'^\d{2}-\d{2}$').hasMatch(mmdd)) return '—';
    final m = int.parse(mmdd.substring(0, 2));
    final d = int.parse(mmdd.substring(3));
    if (m < 1 || m > 12) return '—';
    return '$d de ${monthName(m)}';
  }

  static String fileSize(int? bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(0)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  /// Iniciales de un nombre: "Gustavo Polanco" → "GP".
  static String initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, parts.first.length >= 2 ? 2 : 1).toUpperCase();
    return (parts.first[0] + parts[1][0]).toUpperCase();
  }

  /// Plural simple: plural(3, 'acta', 'actas') → "3 actas".
  static String plural(int n, String one, String many) => '$n ${n == 1 ? one : many}';
}
