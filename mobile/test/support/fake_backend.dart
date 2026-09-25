import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:gestion_cristiana/core/utils/panama_time.dart';

import 'server_defaults.dart';

/// Petición registrada por el backend simulado.
class FakeRequest {
  final String method;
  final String path;
  final Map<String, dynamic> query;
  final dynamic data;
  final Map<String, String> params;
  final String? auth;
  final int status;
  FakeRequest(this.method, this.path, this.query, this.data, this.params, this.auth, this.status);

  Map<String, dynamic> get json => (data is Map ? (data as Map).cast<String, dynamic>() : const <String, dynamic>{});
  @override
  String toString() => '$method $path → $status';
}

class FakeResponse {
  final int status;
  final Object? body;
  const FakeResponse(this.status, [this.body]);
}

typedef FakeHandler = FakeResponse Function(FakeRequest r);

/// Backend simulado con los contratos de `server/` (rutas, forma de las
/// respuestas, paginación) y la misma autorización por ruta
/// (`authorizePermission(módulo, acción)`) usando los DEFAULTS del servidor.
///
/// Registra cada petición en [requests] para verificar lo que la app envía.
class FakeBackend implements HttpClientAdapter {
  FakeBackend({this.role = 'Administrador'}) {
    _seed();
  }

  /// Rol del usuario que inicia sesión.
  String role;
  String password = 'secreto';
  bool accountDisabled = false;

  /// Simula que el servidor no responde (sin red).
  bool offline = false;

  /// `/app/config` (T1.4): null = el endpoint aún no existe (404).
  Map<String, dynamic>? appConfig;

  /// Token vigente; si una petición llega con otro, responde 401.
  String validToken = 'token-valido';

  final List<FakeRequest> requests = [];

  /// Respuestas forzadas por prueba: clave "GET /members".
  final Map<String, FakeHandler> overrides = {};

  // ---- datos de prueba (ficticios) ----
  late List<Map<String, dynamic>> members;
  late List<Map<String, dynamic>> events;
  late List<Map<String, dynamic>> weekly;
  late List<Map<String, dynamic>> students;
  int _nextId = 1000;

  static final today = PanamaTime.today();

  Map<String, Map<String, bool>> get perms => permissionsFor(role);
  bool can(String module, String action) => role == 'SuperAdmin' || (perms[module]?[action] ?? false);

  Map<String, dynamic> get userJson => {
        'id': 7,
        'email': 'gustavo@iglesiacentral.pa',
        'full_name': 'Gustavo Polanco',
        'role_id': allRoles.indexOf(role) + 1,
        'church_id': role == 'SuperAdmin' ? null : 1,
        'is_active': true,
        'role': {'id': allRoles.indexOf(role) + 1, 'name': role},
        'church': role == 'SuperAdmin' ? null : {'id': 1, 'name': 'Iglesia Central TMDV', 'login_logo_url': null, 'initials': 'ICT'},
      };

  void _seed() {
    Map<String, dynamic> m(int id, String f, String l, String type, {String? phone, bool baptized = false, String? role}) => {
          'id': id,
          'church_id': 1,
          'first_name': f,
          'last_name': l,
          'member_type': type,
          'phone': phone,
          'baptized': baptized,
          'church_role': role,
          'birth_date': '03-15',
          'age': 34,
          'sex': 'F',
          'positions': [],
          'created_at': '2025-01-10T15:00:00.000Z',
        };
    members = [
      m(1, 'Ana', 'López', 'Miembro', phone: '6000-0001', baptized: true, role: 'Diaconisa'),
      m(2, 'Beto', 'Díaz', 'Miembro', phone: '6000-0002'),
      m(3, 'Carla', 'Ruiz', 'Visitante'),
      m(4, 'David', 'Soto', 'Familiar'),
    ];
    final start = today.add(const Duration(hours: 19));
    events = [
      {
        'id': 10,
        'church_id': 1,
        'title': 'Culto de adoración',
        'event_type': 'Culto',
        'start_date': PanamaTime.toIso(start),
        'end_date': PanamaTime.toIso(start.add(const Duration(hours: 2))),
        'location': 'Templo principal',
        'description': 'Culto dominical.',
        'attendees_count': 1,
        'faith_decisions': 0,
        'preacher': {'id': 2, 'first_name': 'Beto', 'last_name': 'Díaz'},
        'worship_leader': null,
        'singer': null,
        'attendees': [
          {
            'member_id': 1,
            'attended': true,
            'made_faith_decision': false,
            'member': {'id': 1, 'first_name': 'Ana', 'last_name': 'López', 'member_type': 'Miembro'},
          },
        ],
      },
      {
        'id': 11,
        'church_id': 1,
        'title': 'Jornada de evangelismo',
        'event_type': 'Evangelismo',
        'start_date': PanamaTime.toIso(today.add(const Duration(days: 3, hours: 9))),
        'attendees_count': 0,
        'faith_decisions': 0,
        'attendees': [],
      },
    ];
    weekly = [
      {
        'id': 1,
        'week_date': PanamaTime.dateOnly(PanamaTime.lastWeekday(DateTime.sunday).subtract(const Duration(days: 7))),
        'attendance_count': 90,
        'notes': 'Culto',
        'creator': {'id': 7, 'full_name': 'Gustavo Polanco'},
      },
    ];
    students = [
      {'id': 1, 'full_name': 'Luis Pérez', 'group_id': 1, 'balance': 40, 'earned': 60, 'level': {'name': 'Nivel 2'}},
      {'id': 2, 'full_name': 'María Gómez', 'group_id': 1, 'balance': 10, 'earned': 10, 'level': {'name': 'Nivel 1'}},
    ];
  }

  /// Peticiones con un método y ruta dados.
  List<FakeRequest> sent(String method, String path) => requests.where((r) => r.method == method && r.path == path).toList();

  /// Peticiones rechazadas por permisos (403), para verificar que la app no
  /// llama endpoints que el rol no puede usar.
  List<FakeRequest> get forbidden => requests.where((r) => r.status == 403).toList();

  // ------------------------------------------------------------------ rutas

  late final List<(String, String, (String, String)?, FakeHandler)> _routes = [
    // Auth (públicas o solo autenticadas)
    ('POST', '/auth/login', null, _login),
    ('GET', '/auth/me', null, (r) => FakeResponse(200, {'user': userJson})),
    ('GET', '/auth/my-permissions', null, (r) => FakeResponse(200, {'permissions': perms})),
    ('POST', '/auth/forgot-password', null, (r) => const FakeResponse(200, {'message': 'Se ha generado un código de restablecimiento.'})),
    ('GET', '/branding/:id', null, (r) => const FakeResponse(200, {
          'branding': {'church_id': 1, 'name': 'Iglesia Central TMDV', 'login_title': 'Iglesia Central TMDV', 'login_logo_url': null, 'initials': 'ICT'},
        })),
    ('GET', '/app/config', null, (r) => appConfig == null ? const FakeResponse(404, {'message': 'Not found'}) : FakeResponse(200, appConfig)),
    // Iglesias / dashboard
    ('GET', '/churches/my/summary', ('dashboard', 'view'), (r) => const FakeResponse(200, {
          'church_id': 1, 'church_name': 'Iglesia Central TMDV', 'year': 2026,
          'events_count': 12, 'minutes_count': 3, 'faith_decisions': 5, 'avg_weekly_attendance': 80,
        })),
    ('GET', '/churches/stats/dashboard', ('__superadmin', ''), (r) => const FakeResponse(200, {
          'year': 2026,
          'stats': [
            {'id': 1, 'name': 'Iglesia Central TMDV', 'membership_count': 128, 'events_count': 12, 'minutes_count': 3, 'faith_decisions': 5, 'avg_weekly_attendance': 80},
            {'id': 2, 'name': 'Iglesia Norte TMDV', 'membership_count': 40, 'events_count': 4, 'minutes_count': 1, 'faith_decisions': 2, 'avg_weekly_attendance': 30},
          ],
        })),
    ('GET', '/churches', ('churches', 'view'), (r) => const FakeResponse(200, {
          'churches': [
            {'id': 1, 'name': 'Iglesia Central TMDV'},
            {'id': 2, 'name': 'Iglesia Norte TMDV'},
          ],
        })),
    ('GET', '/churches/:id', ('churches', 'view'), (r) => const FakeResponse(200, {
          'church': {'id': 1, 'name': 'Iglesia Central TMDV', 'responsible': 'Pastor Elías', 'membership_count': 128, 'avg_weekly_attendance': 80},
        })),
    // Miembros
    ('GET', '/members', ('members', 'view'), _listMembers),
    ('GET', '/members/:id', ('members', 'view'), (r) {
      final m = members.where((m) => '${m['id']}' == r.params['id']).firstOrNull;
      return m == null ? const FakeResponse(404, {'message': 'Miembro no encontrado.'}) : FakeResponse(200, {'member': m});
    }),
    ('POST', '/members', ('members', 'create'), (r) {
      final m = {...r.json, 'id': _nextId++, 'church_id': r.json['church_id'] ?? 1, 'positions': []};
      members.add(m);
      return FakeResponse(201, {'message': 'Miembro creado exitosamente.', 'member': m});
    }),
    ('PUT', '/members/:id', ('members', 'edit'), (r) {
      final i = members.indexWhere((m) => '${m['id']}' == r.params['id']);
      members[i] = {...members[i], ...r.json};
      return FakeResponse(200, {'message': 'Miembro actualizado.', 'member': members[i]});
    }),
    ('DELETE', '/members/:id', ('members', 'delete'), (r) {
      members.removeWhere((m) => '${m['id']}' == r.params['id']);
      return const FakeResponse(200, {'message': 'Miembro eliminado.'});
    }),
    ('GET', '/ministerial-positions', ('positions', 'view'), (r) => const FakeResponse(200, {
          'positions': [
            {'id': 1, 'name': 'Diácono'},
            {'id': 2, 'name': 'Predicador'},
          ],
        })),
    // Eventos
    ('GET', '/events', ('events', 'view'), (r) => FakeResponse(200, {
          'events': events,
          'pagination': {'total': events.length, 'page': 1, 'limit': 500, 'pages': 1},
        })),
    ('GET', '/events/:id', ('events', 'view'), (r) {
      final e = events.where((e) => '${e['id']}' == r.params['id']).firstOrNull;
      return e == null ? const FakeResponse(404, {'message': 'Evento no encontrado.'}) : FakeResponse(200, {'event': e});
    }),
    ('POST', '/events', ('events', 'create'), (r) {
      final e = {...r.json, 'id': _nextId++, 'church_id': 1, 'attendees': [], 'attendees_count': 0, 'faith_decisions': 0};
      events.add(e);
      return FakeResponse(201, {'message': 'Evento creado exitosamente.', 'event': e});
    }),
    ('POST', '/events/:id/attendees', ('events', 'attendance'), (r) {
      final list = (r.json['attendees'] as List).cast<Map>();
      if (list.isEmpty) return const FakeResponse(400, {'message': 'Debe proporcionar al menos un asistente.'});
      return FakeResponse(200, {
        'message': 'Asistentes registrados exitosamente.',
        'attendees_count': list.length,
        'faith_decisions': list.where((a) => a['made_faith_decision'] == true).length,
      });
    }),
    // Asistencia semanal
    ('GET', '/weekly-attendance', ('weekly_attendance', 'view'), (r) => FakeResponse(200, {
          'records': weekly,
          'avg_weekly_attendance': 90,
          'pagination': {'total': weekly.length, 'page': 1, 'limit': 60, 'pages': 1},
        })),
    ('POST', '/weekly-attendance', ('weekly_attendance', 'create'), (r) {
      if (weekly.any((w) => w['week_date'] == r.json['week_date'])) {
        return const FakeResponse(409, {'message': 'Ya existe un registro para esta fecha. Edítelo en su lugar.'});
      }
      final rec = {...r.json, 'id': _nextId++};
      weekly.add(rec);
      return FakeResponse(201, {'message': 'Asistencia registrada exitosamente.', 'record': rec});
    }),
    ('PUT', '/weekly-attendance/:id', ('weekly_attendance', 'edit'), (r) => FakeResponse(200, {
          'message': 'Registro actualizado exitosamente.',
          'record': {...r.json, 'id': int.parse(r.params['id']!)},
        })),
    // Club Bíblico
    ('GET', '/bible-club/groups', ('bible_club', 'view'), (r) => const FakeResponse(200, {
          'groups': [
            {'id': 1, 'name': 'Exploradores', 'students_count': 2, 'levels': []},
            {'id': 2, 'name': 'Conquistadores', 'students_count': 0, 'levels': []},
          ],
          'reasons': ['Por llevar Biblia', 'Por llegar temprano', 'Por traer invitados', 'Versículo memorizado', 'Participación en clase', 'Bono', 'Otro'],
        })),
    ('GET', '/bible-club/students', ('bible_club', 'view'), (r) => FakeResponse(200, {
          'students': students.where((s) => '${s['group_id']}' == '${r.query['group_id']}').toList(),
          'last_round': {'date': null, 'total': 0, 'byStudent': {}},
        })),
    ('GET', '/bible-club/students/:id/transactions', ('bible_club', 'view'), (r) => const FakeResponse(200, {'transactions': []})),
    ('POST', '/bible-club/transactions', ('bible_club', 'create'), (r) {
      final entries = (r.json['entries'] as List?) ?? const [];
      return FakeResponse(201, {'message': '${entries.length} movimiento(s) registrado(s).', 'transactions': entries});
    }),
    // Actas (el servidor hoy solo exige autenticación para listar/ver: hallazgo 1.5.b)
    ('GET', '/minutes', null, (r) => const FakeResponse(200, {
          'minutes': [
            {'id': 5, 'title': 'Reunión de junta', 'meeting_date': '2026-09-10', 'creator': {'full_name': 'Gustavo Polanco'}, 'files': []},
          ],
          'pagination': {'total': 1, 'page': 1, 'limit': 20, 'pages': 1},
        })),
    ('GET', '/minutes/:id', null, (r) => const FakeResponse(200, {
          'minute': {
            'id': 5,
            'title': 'Reunión de junta',
            'objective': 'Revisar el trimestre.',
            'meeting_date': '2026-09-10',
            'creator': {'full_name': 'Gustavo Polanco'},
            'files': [
              {'id': 1, 'original_name': 'acta.pdf', 'file_size': 20480, 'file_type': 'application/pdf'},
            ],
            'attendees': [
              {'member': {'id': 1, 'first_name': 'Ana', 'last_name': 'López'}},
            ],
            'motions': [
              {'title': 'Aprobar calendario', 'result': 'Aprobado', 'order_num': 1},
            ],
          },
        })),
  ];

  FakeResponse _login(FakeRequest r) {
    if (r.json['password'] != password) return const FakeResponse(401, {'message': 'Credenciales incorrectas.'});
    if (accountDisabled) return const FakeResponse(401, {'message': 'Cuenta desactivada. Contacte al administrador.'});
    return FakeResponse(200, {'message': 'Inicio de sesión exitoso.', 'token': validToken, 'user': userJson});
  }

  FakeResponse _listMembers(FakeRequest r) {
    final q = '${r.query['search'] ?? ''}'.toLowerCase();
    var list = members.where((m) => '${m['first_name']} ${m['last_name']}'.toLowerCase().contains(q)).toList();
    if (r.query['member_type'] != null) list = list.where((m) => m['member_type'] == r.query['member_type']).toList();
    if (r.query['baptized'] == 'true') list = list.where((m) => m['baptized'] == true).toList();
    list.sort((a, b) => '${a['first_name']}'.compareTo('${b['first_name']}'));
    final page = int.tryParse('${r.query['page'] ?? 1}') ?? 1;
    final limit = int.tryParse('${r.query['limit'] ?? 20}') ?? 20;
    final slice = list.skip((page - 1) * limit).take(limit).toList();
    return FakeResponse(200, {
      'members': slice,
      'pagination': {'total': list.length, 'page': page, 'limit': limit, 'pages': (list.length / limit).ceil()},
    });
  }

  // ------------------------------------------------------------ adaptador

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    if (offline) {
      throw DioException.connectionError(requestOptions: options, reason: 'Sin red (simulado)');
    }
    final path = options.uri.path.replaceFirst(RegExp(r'^/api'), '');
    final method = options.method.toUpperCase();
    final auth = options.headers['Authorization'] as String?;

    FakeResponse res;
    Map<String, String> params = {};
    final match = _match(method, path);
    if (match == null) {
      res = const FakeResponse(404, {'message': 'Ruta no encontrada.'});
    } else {
      final (route, p) = match;
      params = p;
      final isPublic = path.startsWith('/auth/login') || path.startsWith('/auth/forgot') || path.startsWith('/branding') || path.startsWith('/app/config');
      final perm = route.$3;
      if (!isPublic && auth != 'Bearer $validToken') {
        res = const FakeResponse(401, {'message': 'Token inválido o expirado.'});
      } else if (perm != null && perm.$1 == '__superadmin' && role != 'SuperAdmin') {
        res = const FakeResponse(403, {'message': 'No tiene permisos para realizar esta acción.'});
      } else if (perm != null && perm.$1 != '__superadmin' && !can(perm.$1, perm.$2)) {
        res = const FakeResponse(403, {'message': 'No tiene permisos para realizar esta acción.'});
      } else {
        final req = FakeRequest(method, path, options.queryParameters, options.data, params, auth, 0);
        res = (overrides['$method ${route.$2}'] ?? route.$4)(req);
      }
    }
    requests.add(FakeRequest(method, path, options.queryParameters, options.data, params, auth, res.status));
    return ResponseBody.fromString(
      jsonEncode(res.body ?? {}),
      res.status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  ((String, String, (String, String)?, FakeHandler), Map<String, String>)? _match(String method, String path) {
    final segs = path.split('/').where((s) => s.isNotEmpty).toList();
    for (final r in _routes) {
      if (r.$1 != method) continue;
      final pat = r.$2.split('/').where((s) => s.isNotEmpty).toList();
      if (pat.length != segs.length) continue;
      final params = <String, String>{};
      var ok = true;
      for (var i = 0; i < pat.length; i++) {
        if (pat[i].startsWith(':')) {
          params[pat[i].substring(1)] = segs[i];
        } else if (pat[i] != segs[i]) {
          ok = false;
          break;
        }
      }
      if (ok) return (r, params);
    }
    return null;
  }

  @override
  void close({bool force = false}) {}
}
