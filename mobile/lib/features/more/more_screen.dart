import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../app/router.dart';
import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/church_scope.dart';
import '../../core/env.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils/format.dart';
import '../../core/utils/launchers.dart';
import '../../data/repositories.dart';
import '../../widgets/widgets.dart';

class _Item {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final String? detail;
  final bool danger;
  final bool external;
  const _Item(this.icon, this.label, this.onTap, {this.detail, this.danger = false, this.external = false});
}

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  Future<void> _pickChurch(BuildContext context, WidgetRef ref) async {
    showAppSnack('Cargando iglesias…');
    try {
      final churches = await ref.read(repoProvider).churches();
      if (!context.mounted) return;
      ScaffoldMessenger.maybeOf(context)?.hideCurrentSnackBar();
      final current = ref.read(selectedChurchProvider).id ?? 0;
      final picked = await showOptionsSheet<int>(context, title: 'Ver datos de', selected: current, options: [
        const SheetOption('Todas las iglesias', 0),
        for (final c in churches) SheetOption(c.name, c.id),
      ]);
      if (picked == null) return;
      final name = picked == 0 ? null : churches.firstWhere((c) => c.id == picked).name;
      await ref.read(selectedChurchProvider.notifier).select(picked == 0 ? null : picked, name);
    } catch (e) {
      showAppSnack(ApiException.from(e).message, error: true);
    }
  }

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final ok = await showConfirmDialog(
      context,
      title: '¿Cerrar sesión?',
      body: 'Tendrás que escribir tu correo y contraseña para volver a entrar.',
      action: 'Cerrar sesión',
    );
    if (ok) await ref.read(authProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    if (user == null) return const SizedBox.shrink(); // cerrando sesión
    final perms = ref.watch(permissionsProvider);
    final version = ref.watch(appVersionProvider);

    final groups = <(String, List<_Item>)>[
      (
        'Módulos',
        [
          if (perms.can('weekly_attendance')) _Item(PhosphorIconsDuotone.chartBar, 'Asistencia semanal', () => context.push(Routes.semanal)),
          if (perms.can('minutes')) _Item(PhosphorIconsDuotone.fileText, 'Actas', () => context.push(Routes.actas)),
          if (user.isSuperAdmin)
            _Item(PhosphorIconsDuotone.buildings, 'Iglesia', () => _pickChurch(context, ref), detail: ref.watch(churchLabelProvider)),
        ]
      ),
      (
        'Cuenta',
        [
          _Item(PhosphorIconsDuotone.globe, 'Abrir el sistema completo en la web', () => Launchers.openUrl(Env.webUrl), external: true),
          _Item(PhosphorIconsDuotone.shieldCheck, 'Aviso de privacidad', () => Launchers.openUrl('${Env.webUrl}/privacidad.html'), external: true),
          _Item(PhosphorIconsDuotone.userMinus, 'Eliminar mi cuenta', () => showAppSheet<void>(context, builder: (_) => const _DeleteAccountSheet())),
          _Item(PhosphorIconsDuotone.signOut, 'Cerrar sesión', () => _logout(context, ref), danger: true),
        ]
      ),
    ];

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
          children: [
            ScreenHeader(kicker: ref.watch(churchLabelProvider), title: 'Más', bottomGap: 20),
            Row(children: [
              InitialsAvatar(Fmt.initials(user.fullName), size: 56),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(user.fullName, style: AppText.base(size: 20, weight: FontWeight.w600)),
                  Text(user.email, style: AppText.rowSub),
                  const SizedBox(height: 6),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    AppTag.accent(user.roleName, fontSize: 13),
                    if (user.churchName != null) AppTag(user.churchName!, fontSize: 13),
                  ]),
                ]),
              ),
            ]),
            for (final (title, items) in groups)
              if (items.isNotEmpty) ...[
                Padding(padding: const EdgeInsets.only(top: 30, bottom: 2), child: Kicker(title)),
                for (final it in items)
                  InkWell(
                    onTap: it.onTap,
                    highlightColor: AppColors.neutral200,
                    child: Container(
                      constraints: const BoxConstraints(minHeight: 56),
                      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.rowLine))),
                      child: Row(children: [
                        Ic(it.icon, size: 24, color: it.danger ? AppColors.magenta700 : AppColors.cyan),
                        const SizedBox(width: 14),
                        Expanded(child: Text(it.label, style: AppText.base(size: 17, color: it.danger ? AppColors.magenta700 : AppColors.text))),
                        if (it.detail != null) ...[
                          Flexible(child: Text(it.detail!, overflow: TextOverflow.ellipsis, style: AppText.base(size: 14, color: AppColors.neutral700))),
                          const SizedBox(width: 6),
                        ],
                        if (!it.danger)
                          Ic(it.external ? PhosphorIconsDuotone.arrowSquareOut : PhosphorIconsDuotone.caretRight, size: 18, color: AppColors.neutral600),
                      ]),
                    ),
                  ),
              ],
            const SizedBox(height: 24),
            Text('Gestión Cristiana TMDV · Versión $version', style: AppText.base(size: 13, color: AppColors.neutral600)),
          ],
        ),
      ),
    );
  }
}

/// Baja de cuenta (Apple 5.1.1(v) / Google Play). Explica qué se borra y qué no.
/// Depende de `DELETE /api/auth/me` (T1.6); mientras no exista, orienta al usuario.
class _DeleteAccountSheet extends ConsumerStatefulWidget {
  const _DeleteAccountSheet();
  @override
  ConsumerState<_DeleteAccountSheet> createState() => _DeleteAccountSheetState();
}

class _DeleteAccountSheetState extends ConsumerState<_DeleteAccountSheet> {
  final _pw = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _pw.dispose();
    super.dispose();
  }

  Future<void> _delete() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(repoProvider).deleteAccount(_pw.text);
      if (!mounted) return;
      Navigator.of(context).pop();
      showAppSnack('Tu cuenta fue dada de baja.');
      await ref.read(authProvider.notifier).logout();
    } catch (e) {
      final ex = ApiException.from(e);
      setState(() => _error = ex.kind == ApiErrorKind.notFound
          ? 'La baja desde la app aún no está disponible. Pide a tu administrador que desactive tu cuenta desde el sistema web.'
          : ex.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Eliminar mi cuenta', style: AppText.base(size: 22, weight: FontWeight.w600)),
        const SizedBox(height: 10),
        Text(
          'Tu usuario se desactiva y ya no podrás entrar a la app ni a la web. '
          'Los datos de la iglesia (miembros, eventos, actas y asistencia) no se borran: pertenecen al ministerio, no a tu cuenta.',
          style: AppText.base(size: 16, height: 1.45, color: AppColors.neutral800),
        ),
        const SizedBox(height: 16),
        LabeledField(label: 'Confirma con tu contraseña', child: AppTextField(controller: _pw, obscure: true, onChanged: (_) => setState(() {}))),
        if (_error != null) ...[
          const SizedBox(height: 10),
          Text(_error!, style: AppText.base(size: 15, color: AppColors.magenta700)),
        ],
        const SizedBox(height: 16),
        PrimaryButton.danger(label: 'Eliminar mi cuenta', height: 52, loading: _loading, onPressed: _pw.text.isEmpty ? null : _delete),
      ]),
    );
  }
}
