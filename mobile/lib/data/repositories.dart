import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api/api_client.dart';
import '../core/providers.dart';
import '../core/utils/panama_time.dart';
import 'models.dart';

/// Acceso a la API por módulo. Cada método corresponde a un endpoint del
/// inventario de PLAN_APP_MOVIL.md §1.3.
final repoProvider = Provider<Repo>((ref) => Repo(ref.watch(apiClientProvider)));

class MemberFilters {
  final String search;
  final String? memberType;
  final bool baptizedOnly;
  final int? birthMonth;
  final int? positionId;
  const MemberFilters({this.search = '', this.memberType, this.baptizedOnly = false, this.birthMonth, this.positionId});

  bool get hasFilters => memberType != null || baptizedOnly || birthMonth != null || positionId != null;
  bool get isEmpty => search.isEmpty && !hasFilters;

  MemberFilters copyWith({String? search, String? Function()? memberType, bool? baptizedOnly, int? Function()? birthMonth, int? Function()? positionId}) =>
      MemberFilters(
        search: search ?? this.search,
        memberType: memberType != null ? memberType() : this.memberType,
        baptizedOnly: baptizedOnly ?? this.baptizedOnly,
        birthMonth: birthMonth != null ? birthMonth() : this.birthMonth,
        positionId: positionId != null ? positionId() : this.positionId,
      );

  Map<String, dynamic> toQuery() => {
        'search': search,
        'member_type': memberType,
        if (baptizedOnly) 'baptized': true,
        'birth_month': birthMonth?.toString().padLeft(2, '0'),
        'position_ids': positionId?.toString(),
      };

  @override
  bool operator ==(Object other) =>
      other is MemberFilters &&
      other.search == search &&
      other.memberType == memberType &&
      other.baptizedOnly == baptizedOnly &&
      other.birthMonth == birthMonth &&
      other.positionId == positionId;

  @override
  int get hashCode => Object.hash(search, memberType, baptizedOnly, birthMonth, positionId);
}

class Repo {
  Repo(this.api);
  final ApiClient api;

  // ---------------- Branding / auth ----------------

  Future<Map<String, dynamic>?> branding(int churchId) async {
    final r = await api.get('/branding/$churchId', skipAuth: true);
    return r['branding'] as Map<String, dynamic>?;
  }

  Future<String> forgotPassword(String email) async {
    final r = await api.post('/auth/forgot-password', skipAuth: true, data: {'email': email.trim()});
    return (r['message'] ?? '') as String;
  }

  Future<String> resetPassword(String email, String code, String newPassword) async {
    final r = await api.post('/auth/reset-password', skipAuth: true, data: {'email': email.trim(), 'code': code.trim(), 'new_password': newPassword});
    return (r['message'] ?? '') as String;
  }

  /// Baja de cuenta (T1.6). Lanza ApiException 404 mientras no exista.
  Future<void> deleteAccount(String password) => api.delete('/auth/me', data: {'password': password});

  // ---------------- Iglesias / dashboard ----------------

  Future<YearSummary> mySummary(int year) async => YearSummary.fromJson(await api.get('/churches/my/summary', query: {'year': year}));

  /// SuperAdmin: métricas por iglesia.
  Future<List<(ChurchInfo, YearSummary)>> dashboardStats(int year) async {
    final r = await api.get('/churches/stats/dashboard', query: {'year': year});
    final rows = (r['stats'] as List? ?? const []).whereType<Map>().map((e) => e.cast<String, dynamic>());
    return rows.map((j) => (ChurchInfo.fromJson(j), YearSummary.fromJson(j))).toList();
  }

  Future<ChurchInfo> church(int id) async => ChurchInfo.fromJson((await api.get('/churches/$id'))['church'] as Map<String, dynamic>);

  Future<List<ChurchInfo>> churches() async {
    final r = await api.get('/churches', query: {'limit': 200});
    return (r['churches'] as List? ?? const []).whereType<Map>().map((e) => ChurchInfo.fromJson(e.cast<String, dynamic>())).toList();
  }

  // ---------------- Miembros ----------------

  Future<Paged<Member>> members({MemberFilters filters = const MemberFilters(), int page = 1, int limit = 30, Map<String, dynamic> scope = const {}}) async {
    final r = await api.get('/members', query: {...filters.toQuery(), 'page': page, 'limit': limit, ...scope});
    return Paged.from(r, 'members', Member.fromJson);
  }

  Future<Member> member(int id) async => Member.fromJson((await api.get('/members/$id'))['member'] as Map<String, dynamic>);

  Future<Member> saveMember(int? id, Map<String, dynamic> data) async {
    final r = id == null ? await api.post('/members', data: data) : await api.put('/members/$id', data: data);
    return Member.fromJson(r['member'] as Map<String, dynamic>);
  }

  Future<void> deleteMember(int id) => api.delete('/members/$id');

  /// Catálogo de cargos. Devuelve null si el rol no tiene `positions.view`
  /// (hallazgo 1.5.d): la UI oculta el campo sin romperse.
  Future<List<Position>?> positions() async {
    try {
      final r = await api.get('/ministerial-positions');
      final list = r['positions'] ?? r['ministerialPositions'] ?? r['data'];
      return (list as List? ?? const []).whereType<Map>().map((e) => Position.fromJson(e.cast<String, dynamic>())).toList();
    } catch (_) {
      return null;
    }
  }

  // ---------------- Eventos ----------------

  Future<List<ChurchEvent>> eventsBetween(DateTime fromWall, DateTime toWall, {String? type, Map<String, dynamic> scope = const {}}) async {
    final r = await api.get('/events', query: {
      'start_date': PanamaTime.toIso(fromWall),
      'end_date': PanamaTime.toIso(toWall),
      'event_type': type,
      'limit': 500,
      ...scope,
    });
    final list = (r['events'] as List? ?? const []).whereType<Map>().map((e) => ChurchEvent.fromJson(e.cast<String, dynamic>())).toList();
    list.sort((a, b) => a.start.compareTo(b.start));
    return list;
  }

  Future<ChurchEvent> event(int id) async => ChurchEvent.fromJson((await api.get('/events/$id'))['event'] as Map<String, dynamic>);

  Future<ChurchEvent> saveEvent(int? id, Map<String, dynamic> data) async {
    final r = id == null ? await api.post('/events', data: data) : await api.put('/events/$id', data: data);
    return ChurchEvent.fromJson(r['event'] as Map<String, dynamic>);
  }

  Future<void> deleteEvent(int id) => api.delete('/events/$id');

  /// Estrategia REEMPLAZO en el servidor: se envía la lista completa.
  Future<(int, int)> saveAttendees(int eventId, List<({int memberId, bool decision})> rows) async {
    final r = await api.post('/events/$eventId/attendees', data: {
      'attendees': [
        for (final a in rows) {'member_id': a.memberId, 'attended': true, 'made_faith_decision': a.decision},
      ],
    });
    return ((r['attendees_count'] as num?)?.toInt() ?? rows.length, (r['faith_decisions'] as num?)?.toInt() ?? 0);
  }

  // ---------------- Asistencia semanal ----------------

  Future<List<WeeklyRecord>> weekly(int year, {int? churchId}) async {
    final r = await api.get('/weekly-attendance', query: {'year': year, 'limit': 60, 'church_id': churchId});
    return (r['records'] as List? ?? const []).whereType<Map>().map((e) => WeeklyRecord.fromJson(e.cast<String, dynamic>())).toList();
  }

  /// Crea o reemplaza la semana; devuelve el id del registro.
  Future<int?> saveWeekly({int? id, required DateTime date, required int count, String? notes, int? churchId}) async {
    final data = {'week_date': PanamaTime.dateOnly(date), 'attendance_count': count, 'notes': notes, 'church_id': ?churchId};
    final r = id == null ? await api.post('/weekly-attendance', data: data) : await api.put('/weekly-attendance/$id', data: data);
    return (r['record'] is Map) ? ((r['record'] as Map)['id'] as num?)?.toInt() : id;
  }

  // ---------------- Club Bíblico ----------------

  Future<(List<ClubGroup>, List<String>)> clubGroups({Map<String, dynamic> scope = const {}}) async {
    final r = await api.get('/bible-club/groups', query: scope);
    final groups = (r['groups'] as List? ?? const []).whereType<Map>().map((e) => ClubGroup.fromJson(e.cast<String, dynamic>())).toList();
    final reasons = (r['reasons'] as List? ?? const []).map((e) => '$e').toList();
    return (groups, reasons);
  }

  Future<List<ClubStudent>> clubStudents(int groupId, {Map<String, dynamic> scope = const {}}) async {
    final r = await api.get('/bible-club/students', query: {'group_id': groupId, ...scope});
    final list = (r['students'] as List? ?? const []).whereType<Map>().map((e) => ClubStudent.fromJson(e.cast<String, dynamic>())).toList();
    list.sort((a, b) => a.fullName.toLowerCase().compareTo(b.fullName.toLowerCase()));
    return list;
  }

  Future<List<ClubTransaction>> studentHistory(int studentId) async {
    final r = await api.get('/bible-club/students/$studentId/transactions');
    return (r['transactions'] as List? ?? const []).whereType<Map>().map((e) => ClubTransaction.fromJson(e.cast<String, dynamic>())).toList();
  }

  Future<void> clubTransactions(DateTime activityDate, List<Map<String, dynamic>> entries) =>
      api.post('/bible-club/transactions', data: {'activity_date': PanamaTime.dateOnly(activityDate), 'entries': entries});

  // ---------------- Actas ----------------

  Future<Paged<Minute>> minutes({int page = 1, Map<String, dynamic> scope = const {}}) async {
    final r = await api.get('/minutes', query: {'page': page, 'limit': 20, ...scope});
    return Paged.from(r, 'minutes', Minute.fromJson);
  }

  Future<Minute> minute(int id) async => Minute.fromJson((await api.get('/minutes/$id'))['minute'] as Map<String, dynamic>);

  Future<void> uploadMinuteFiles(int id, List<({String path, String name})> files, void Function(double) onProgress) =>
      api.upload('/minutes/$id/upload', files: files, onProgress: onProgress);
}
