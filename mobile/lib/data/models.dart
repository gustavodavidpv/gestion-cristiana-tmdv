import '../core/utils/format.dart';
import '../core/utils/panama_time.dart';

int _int(dynamic v, [int fallback = 0]) => v is num ? v.toInt() : int.tryParse('$v') ?? fallback;
int? _intOrNull(dynamic v) => v == null ? null : (v is num ? v.toInt() : int.tryParse('$v'));
String? _str(dynamic v) => v is String && v.isNotEmpty ? v : null;
List<Map<String, dynamic>> _list(dynamic v) => v is List ? v.whereType<Map>().map((e) => e.cast<String, dynamic>()).toList() : const [];

/// Página de resultados con el contrato `{ recurso: [...], pagination: {...} }`.
class Paged<T> {
  final List<T> items;
  final int total;
  final int page;
  final int pages;
  const Paged(this.items, {required this.total, required this.page, required this.pages});

  bool get hasMore => page < pages;

  factory Paged.from(Map<String, dynamic> json, String key, T Function(Map<String, dynamic>) parse) {
    final p = json['pagination'] is Map ? json['pagination'] as Map : const {};
    return Paged(
      _list(json[key]).map(parse).toList(),
      total: _int(p['total']),
      page: _int(p['page'], 1),
      pages: _int(p['pages'], 1),
    );
  }
}

class MemberRef {
  final int id;
  final String firstName;
  final String lastName;
  const MemberRef(this.id, this.firstName, this.lastName);
  String get fullName => '$firstName $lastName'.trim();
  String get initials => Fmt.initials(fullName);

  static MemberRef? fromJson(dynamic j) {
    if (j is! Map) return null;
    return MemberRef(_int(j['id']), (j['first_name'] ?? '') as String, (j['last_name'] ?? '') as String);
  }
}

class Position {
  final int id;
  final String name;
  const Position(this.id, this.name);
  factory Position.fromJson(Map<String, dynamic> j) => Position(_int(j['id']), (j['name'] ?? '') as String);
}

class Member {
  final int id;
  final int? churchId;
  final String firstName;
  final String lastName;
  final int? age;
  final String? sex;
  final bool baptized;
  final String? birthDate; // "MM-DD"
  final String memberType;
  final String? churchRole;
  final List<Position> positions;
  final String? phone;
  final String? email;
  final String? address;
  final DateTime? createdAt;

  const Member({
    required this.id,
    this.churchId,
    required this.firstName,
    required this.lastName,
    this.age,
    this.sex,
    this.baptized = false,
    this.birthDate,
    this.memberType = 'Miembro',
    this.churchRole,
    this.positions = const [],
    this.phone,
    this.email,
    this.address,
    this.createdAt,
  });

  String get fullName => '$firstName $lastName'.trim();
  String get initials => Fmt.initials(fullName);
  bool get hasPhone => (phone ?? '').replaceAll(RegExp(r'\D'), '').length >= 7;

  /// Cargo(s) a mostrar: M:N si existe, si no el texto legacy.
  String? get positionLabel {
    if (positions.isNotEmpty) return positions.map((p) => p.name).join(', ');
    return _str(churchRole);
  }

  String get subtitle => [memberType, ?positionLabel].join(' · ');

  factory Member.fromJson(Map<String, dynamic> j) => Member(
        id: _int(j['id']),
        churchId: _intOrNull(j['church_id']),
        firstName: (j['first_name'] ?? '') as String,
        lastName: (j['last_name'] ?? '') as String,
        age: _intOrNull(j['age']),
        sex: _str(j['sex']),
        baptized: j['baptized'] == true,
        birthDate: _str(j['birth_date']),
        memberType: (j['member_type'] ?? 'Miembro') as String,
        churchRole: _str(j['church_role']),
        positions: _list(j['positions']).map(Position.fromJson).toList(),
        phone: _str(j['phone']),
        email: _str(j['email']),
        address: _str(j['address']),
        createdAt: PanamaTime.parse(j['created_at'] as String? ?? j['createdAt'] as String?),
      );
}

class EventAttendeeRow {
  final int memberId;
  final String name;
  final String? memberType;
  final bool faithDecision;
  const EventAttendeeRow(this.memberId, this.name, this.memberType, this.faithDecision);
}

class ChurchEvent {
  final int id;
  final int? churchId;
  final String title;
  final String? description;
  final String? eventType;
  final DateTime start; // hora de pared Panamá
  final DateTime? end;
  final String? location;
  final int attendeesCount;
  final int faithDecisions;
  final MemberRef? preacher;
  final MemberRef? worshipLeader;
  final MemberRef? singer;
  final List<EventAttendeeRow> attendees;

  const ChurchEvent({
    required this.id,
    this.churchId,
    required this.title,
    this.description,
    this.eventType,
    required this.start,
    this.end,
    this.location,
    this.attendeesCount = 0,
    this.faithDecisions = 0,
    this.preacher,
    this.worshipLeader,
    this.singer,
    this.attendees = const [],
  });

  bool get isCulto => eventType == 'Culto' || eventType == 'Culto Especial';

  factory ChurchEvent.fromJson(Map<String, dynamic> j) => ChurchEvent(
        id: _int(j['id']),
        churchId: _intOrNull(j['church_id']),
        title: (j['title'] ?? '') as String,
        description: _str(j['description']),
        eventType: _str(j['event_type']),
        start: PanamaTime.parse(j['start_date'] as String?) ?? PanamaTime.now(),
        end: PanamaTime.parse(j['end_date'] as String?),
        location: _str(j['location']),
        attendeesCount: _int(j['attendees_count']),
        faithDecisions: _int(j['faith_decisions']),
        preacher: MemberRef.fromJson(j['preacher']),
        worshipLeader: MemberRef.fromJson(j['worship_leader']),
        singer: MemberRef.fromJson(j['singer']),
        attendees: _list(j['attendees']).where((a) => a['attended'] != false).map((a) {
          final m = a['member'] is Map ? a['member'] as Map : const {};
          return EventAttendeeRow(
            _int(a['member_id']),
            '${m['first_name'] ?? ''} ${m['last_name'] ?? ''}'.trim(),
            m['member_type'] as String?,
            a['made_faith_decision'] == true,
          );
        }).toList(),
      );
}

class WeeklyRecord {
  final int id;
  final DateTime weekDate; // día de pared
  final int count;
  final String? notes;
  final String? createdBy;
  const WeeklyRecord(this.id, this.weekDate, this.count, this.notes, this.createdBy);

  factory WeeklyRecord.fromJson(Map<String, dynamic> j) => WeeklyRecord(
        _int(j['id']),
        PanamaTime.parseDateOnly(j['week_date'] as String?) ?? PanamaTime.today(),
        _int(j['attendance_count']),
        _str(j['notes']),
        j['creator'] is Map ? j['creator']['full_name'] as String? : null,
      );
}

class ClubLevel {
  final String name;
  final int minPoints;
  const ClubLevel(this.name, this.minPoints);
  factory ClubLevel.fromJson(Map<String, dynamic> j) => ClubLevel((j['name'] ?? '') as String, _int(j['min_points']));
}

class ClubGroup {
  final int id;
  final String name;
  final int studentsCount;
  final List<ClubLevel> levels;
  const ClubGroup(this.id, this.name, this.studentsCount, this.levels);
  factory ClubGroup.fromJson(Map<String, dynamic> j) => ClubGroup(
        _int(j['id']),
        (j['name'] ?? '') as String,
        _int(j['students_count']),
        _list(j['levels']).map(ClubLevel.fromJson).toList(),
      );
}

class ClubStudent {
  final int id;
  final String fullName;
  final int groupId;
  final int balance;
  final int earned;
  final String? levelName;
  const ClubStudent(this.id, this.fullName, this.groupId, this.balance, this.earned, this.levelName);

  factory ClubStudent.fromJson(Map<String, dynamic> j) => ClubStudent(
        _int(j['id']),
        (j['full_name'] ?? '') as String,
        _int(j['group_id']),
        _int(j['balance']),
        _int(j['earned']),
        j['level'] is Map ? j['level']['name'] as String? : null,
      );
}

class ClubTransaction {
  final int id;
  final String type; // earn | redeem | adjust
  final int points;
  final DateTime date;
  final String? reason;
  final String? item;
  final String? notes;
  final String? createdBy;
  const ClubTransaction(this.id, this.type, this.points, this.date, this.reason, this.item, this.notes, this.createdBy);

  factory ClubTransaction.fromJson(Map<String, dynamic> j) => ClubTransaction(
        _int(j['id']),
        (j['type'] ?? 'earn') as String,
        _int(j['points']),
        PanamaTime.parseDateOnly(j['activity_date'] as String?) ?? PanamaTime.today(),
        _str(j['reason']),
        _str(j['item']),
        _str(j['notes']),
        j['creator'] is Map ? j['creator']['full_name'] as String? : null,
      );
}

class MinuteFile {
  final int id;
  final String name;
  final int? size;
  final String? type;
  const MinuteFile(this.id, this.name, this.size, this.type);
  factory MinuteFile.fromJson(Map<String, dynamic> j) =>
      MinuteFile(_int(j['id']), (j['original_name'] ?? 'archivo') as String, _intOrNull(j['file_size']), _str(j['file_type']));

  bool get isPdf => (type ?? '').contains('pdf') || name.toLowerCase().endsWith('.pdf');
  bool get isImage => (type ?? '').startsWith('image/') || RegExp(r'\.(jpe?g|png|heic|webp)$', caseSensitive: false).hasMatch(name);
}

class Motion {
  final String title;
  final String? description;
  final String result; // Aprobado | Rechazado | Pendiente
  final int order;
  const Motion(this.title, this.description, this.result, this.order);
  factory Motion.fromJson(Map<String, dynamic> j) =>
      Motion((j['title'] ?? '') as String, _str(j['description']), (j['result'] ?? 'Pendiente') as String, _int(j['order_num']));
}

class Minute {
  final int id;
  final String title;
  final String? objective;
  final DateTime? date;
  final String? createdBy;
  final List<MinuteFile> files;
  final List<MemberRef> attendees;
  final List<Motion> motions;
  const Minute({
    required this.id,
    required this.title,
    this.objective,
    this.date,
    this.createdBy,
    this.files = const [],
    this.attendees = const [],
    this.motions = const [],
  });

  factory Minute.fromJson(Map<String, dynamic> j) {
    final motions = _list(j['motions']).map(Motion.fromJson).toList()..sort((a, b) => a.order.compareTo(b.order));
    return Minute(
      id: _int(j['id']),
      title: (j['title'] ?? '') as String,
      objective: _str(j['objective']),
      date: PanamaTime.parseDateOnly(j['meeting_date'] as String?),
      createdBy: j['creator'] is Map ? j['creator']['full_name'] as String? : null,
      files: _list(j['files']).map(MinuteFile.fromJson).toList(),
      attendees: _list(j['attendees']).map((a) => MemberRef.fromJson(a['member'])).whereType<MemberRef>().toList(),
      motions: motions,
    );
  }
}

class ChurchInfo {
  final int id;
  final String name;
  final String? responsible;
  final int membershipCount;
  final int avgWeeklyAttendance;
  final int ordainedPreachers;
  final int unordainedPreachers;
  final int ordainedDeacons;
  final int unordainedDeacons;
  const ChurchInfo({
    required this.id,
    required this.name,
    this.responsible,
    this.membershipCount = 0,
    this.avgWeeklyAttendance = 0,
    this.ordainedPreachers = 0,
    this.unordainedPreachers = 0,
    this.ordainedDeacons = 0,
    this.unordainedDeacons = 0,
  });

  factory ChurchInfo.fromJson(Map<String, dynamic> j) => ChurchInfo(
        id: _int(j['id']),
        name: (j['name'] ?? '') as String,
        responsible: _str(j['responsible']),
        membershipCount: _int(j['membership_count']),
        avgWeeklyAttendance: _int(j['avg_weekly_attendance']),
        ordainedPreachers: _int(j['ordained_preachers']),
        unordainedPreachers: _int(j['unordained_preachers']),
        ordainedDeacons: _int(j['ordained_deacons']),
        unordainedDeacons: _int(j['unordained_deacons']),
      );
}

/// Métricas del año (de `/churches/my/summary` o de una fila de `/stats/dashboard`).
class YearSummary {
  final int eventsCount;
  final int minutesCount;
  final int faithDecisions;
  final int avgWeeklyAttendance;
  const YearSummary({this.eventsCount = 0, this.minutesCount = 0, this.faithDecisions = 0, this.avgWeeklyAttendance = 0});

  factory YearSummary.fromJson(Map<String, dynamic> j) => YearSummary(
        eventsCount: _int(j['events_count']),
        minutesCount: _int(j['minutes_count']),
        faithDecisions: _int(j['faith_decisions']),
        avgWeeklyAttendance: _int(j['avg_weekly_attendance']),
      );
}
