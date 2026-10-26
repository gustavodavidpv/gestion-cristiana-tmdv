/// Usuario autenticado tal como lo devuelven `/auth/login` y `/auth/me`.
class AppUser {
  final int id;
  final String email;
  final String fullName;
  final String roleName;
  final int? churchId;
  final String? churchName;
  final String? churchLogoUrl;

  const AppUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.roleName,
    this.churchId,
    this.churchName,
    this.churchLogoUrl,
  });

  bool get isSuperAdmin => roleName == 'SuperAdmin';

  String get firstName => fullName.trim().split(RegExp(r'\s+')).first;

  factory AppUser.fromJson(Map<String, dynamic> j) {
    final role = j['role'] is Map ? j['role'] as Map : const {};
    final church = j['church'] is Map ? j['church'] as Map : const {};
    return AppUser(
      id: (j['id'] as num).toInt(),
      email: (j['email'] ?? '') as String,
      fullName: (j['full_name'] ?? '') as String,
      roleName: (role['name'] ?? '') as String,
      churchId: (j['church_id'] as num?)?.toInt(),
      churchName: church['name'] as String?,
      churchLogoUrl: church['login_logo_url'] as String?,
    );
  }
}

/// Mapa de permisos de `/auth/my-permissions`: `{ módulo: { acción: bool } }`.
///
/// Guardrail del plan: la UI nunca decide por rol; siempre consulta este mapa.
class Permissions {
  final Map<String, Map<String, bool>> _map;
  const Permissions(this._map);

  static const empty = Permissions({});

  factory Permissions.fromJson(Map<String, dynamic> j) {
    final out = <String, Map<String, bool>>{};
    j.forEach((module, actions) {
      if (actions is Map) {
        out[module] = actions.map((k, v) => MapEntry(k.toString(), v == true));
      }
    });
    return Permissions(out);
  }

  Map<String, dynamic> toJson() => _map;

  bool can(String module, [String action = 'view']) => _map[module]?[action] ?? false;
}
