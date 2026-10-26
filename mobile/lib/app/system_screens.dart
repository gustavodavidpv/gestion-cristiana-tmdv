import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../core/auth/auth_controller.dart';
import '../core/providers.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/tokens.dart';
import '../core/utils/launchers.dart';
import '../features/auth/church_logo.dart';
import '../widgets/widgets.dart';

/// Arranque: se muestra mientras se valida la sesión guardada.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Spacer(),
              Text('Gestión Cristiana', style: AppText.base(size: 28, weight: FontWeight.w600)),
              const SizedBox(height: 16),
              const Spinner(color: AppColors.cyan700, size: 24),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}

/// Bloqueante "Actualiza la app" (sin tabs) cuando la versión es menor a la mínima.
class UpdateRequiredScreen extends ConsumerWidget {
  const UpdateRequiredScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final url = ref.watch(authProvider).storeUrl;
    return Scaffold(
      body: SafeArea(
        child: StateView(
          leading: const ChurchLogo(size: 72),
          icon: PhosphorIconsDuotone.arrowSquareOut,
          iconColor: AppColors.cyan700,
          title: 'Hay una versión nueva de la app.',
          body: 'Actualízala para continuar.',
          buttonLabel: url == null ? null : (Theme.of(context).platform == TargetPlatform.iOS ? 'Ir al App Store' : 'Ir a Google Play'),
          onPressed: url == null ? null : () => Launchers.openUrl(url),
        ),
      ),
    );
  }
}

/// Banda superior "Sin conexión" (magenta-100 / magenta-800), global.
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final online = ref.watch(isOnlineProvider);
    if (online) return child;
    final top = MediaQuery.of(context).padding.top;
    return Column(
      children: [
        Material(
          color: AppColors.magenta100,
          child: Padding(
            padding: EdgeInsets.fromLTRB(20, top + 10, 20, 10),
            child: Row(children: [
              const Ic(PhosphorIconsDuotone.wifiSlash, size: 20, color: AppColors.magenta800),
              const SizedBox(width: 8),
              Expanded(
                child: Text('Sin conexión — estás viendo datos guardados.',
                    style: AppText.base(size: 14, color: AppColors.magenta800)),
              ),
            ]),
          ),
        ),
        Expanded(child: MediaQuery.removePadding(context: context, removeTop: true, child: child)),
      ],
    );
  }
}
