import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_controller.dart';
import '../../core/env.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../data/repositories.dart';

class Branding {
  final String name;
  final String title;
  final String? logoUrl;
  final String? initials;
  const Branding({required this.name, required this.title, this.logoUrl, this.initials});
}

/// Branding público de la iglesia (`GET /branding/:churchId`), para el Login y
/// la pantalla "Actualiza la app". Usa la iglesia del último inicio de sesión.
final brandingProvider = FutureProvider<Branding?>((ref) async {
  final user = ref.watch(currentUserProvider);
  final store = ref.read(sessionStoreProvider);
  final churchId = user?.churchId ?? await store.lastChurchId() ?? Env.defaultChurchId;
  try {
    final b = await ref.read(repoProvider).branding(churchId);
    if (b == null) return null;
    return Branding(
      name: (b['name'] ?? '') as String,
      title: (b['login_title'] ?? b['name'] ?? '') as String,
      logoUrl: Env.absoluteUrl(b['login_logo_url'] as String?),
      initials: b['initials'] as String?,
    );
  } catch (_) {
    return null;
  }
});

/// Logo configurable por iglesia (`login_logo_url`), `contain`, con respaldo de
/// iniciales si no hay logo o no carga.
class ChurchLogo extends ConsumerWidget {
  const ChurchLogo({super.key, this.size = 88});
  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final b = ref.watch(brandingProvider).value;
    final fallback = Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(color: AppColors.surface, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(
        (b?.initials?.isNotEmpty ?? false) ? b!.initials! : 'TMDV',
        style: AppText.base(size: size * 0.24, weight: FontWeight.w600, color: AppColors.cyan800),
      ),
    );
    if (b?.logoUrl == null) return Semantics(label: 'Logo de la iglesia', child: fallback);
    return Semantics(
      label: 'Logo de ${b!.name}',
      child: ClipOval(
        child: Container(
          width: size,
          height: size,
          color: AppColors.surface,
          child: Image.network(b.logoUrl!, fit: BoxFit.contain, errorBuilder: (_, _, _) => fallback),
        ),
      ),
    );
  }
}
