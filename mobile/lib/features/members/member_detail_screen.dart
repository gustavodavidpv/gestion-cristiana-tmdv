import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../app/router.dart';
import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils/format.dart';
import '../../core/utils/launchers.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../../widgets/widgets.dart';
import 'members_screen.dart';

final memberProvider = FutureProvider.autoDispose.family<Member, int>((ref, id) => ref.read(repoProvider).member(id));

class MemberDetailScreen extends ConsumerWidget {
  const MemberDetailScreen({super.key, required this.memberId, this.backLabel = 'Miembros'});
  final int memberId;
  final String backLabel;

  Future<void> _menu(BuildContext context, WidgetRef ref, Member m) async {
    final perms = ref.read(permissionsProvider);
    final action = await showOptionsSheet<String>(context, title: m.fullName, options: [
      if (perms.can('members', 'edit')) const SheetOption('Editar', 'edit', icon: PhosphorIconsDuotone.pencilSimple),
      if (perms.can('members', 'delete')) const SheetOption('Eliminar miembro', 'delete', icon: PhosphorIconsDuotone.trash, danger: true),
    ]);
    if (!context.mounted) return;
    if (action == 'edit') {
      context.push(Routes.miembroEditar(m.id), extra: m);
    } else if (action == 'delete') {
      final ok = await showConfirmDialog(
        context,
        title: '¿Eliminar a ${m.fullName}?',
        body: 'Se borra su ficha y su historial de asistencia. Esta acción no se puede deshacer.',
        action: 'Eliminar',
      );
      if (!ok) return;
      try {
        await ref.read(repoProvider).deleteMember(m.id);
        ref.read(membersVersionProvider.notifier).bump();
        showAppSnack('${m.fullName} fue eliminado.');
        if (context.mounted) context.pop();
      } catch (e) {
        showAppSnack(ApiException.from(e).message, error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perms = ref.watch(permissionsProvider);
    final async = ref.watch(memberProvider(memberId));
    final canMenu = perms.can('members', 'edit') || perms.can('members', 'delete');

    return Scaffold(
      body: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          BackHeader(
            label: backLabel,
            trailing: canMenu && async.hasValue ? MoreButton(onPressed: () => _menu(context, ref, async.value!)) : null,
          ),
          Expanded(
            child: async.when(
              loading: () => const SkeletonList(rows: 6),
              error: (e, _) => StateView.fromError(e, onRetry: () => ref.invalidate(memberProvider(memberId))),
              data: (m) => _content(context, ref, m),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _content(BuildContext context, WidgetRef ref, Member m) {
    final perms = ref.watch(permissionsProvider);
    final actions = <(IconData, String, VoidCallback?)>[
      (PhosphorIconsDuotone.phone, 'Llamar', m.hasPhone ? () => Launchers.call(m.phone!) : null),
      (PhosphorIconsDuotone.whatsappLogo, 'WhatsApp', m.hasPhone ? () => Launchers.whatsapp(m.phone!) : null),
      if (perms.can('members', 'edit')) (PhosphorIconsDuotone.pencilSimple, 'Editar', () => context.push(Routes.miembroEditar(m.id), extra: m)),
    ];
    final sections = <(String, List<(String, String)>)>[
      (
        'Datos personales',
        [
          ('Edad', m.age != null ? '${m.age} años' : '—'),
          ('Cumpleaños', Fmt.birthday(m.birthDate)),
          ('Sexo', m.sex == 'M' ? 'Masculino' : m.sex == 'F' ? 'Femenino' : '—'),
        ]
      ),
      (
        'Contacto',
        [
          ('Teléfono', m.phone ?? '—'),
          ('Correo', m.email ?? '—'),
          ('Dirección', m.address ?? '—'),
        ]
      ),
      (
        'Iglesia',
        [
          ('Cargo ministerial', m.positionLabel ?? '—'),
          ('Tipo', m.memberType),
          ('Fecha de registro', m.createdAt != null ? Fmt.shortDate(m.createdAt!) : '—'),
        ]
      ),
    ];

    return RefreshIndicator(
      color: AppColors.cyan700,
      onRefresh: () => ref.refresh(memberProvider(memberId).future),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          Align(alignment: Alignment.centerLeft, child: InitialsAvatar(m.initials, size: 80)),
          const SizedBox(height: 16),
          Text(m.fullName, style: AppText.title(32)),
          const SizedBox(height: 10),
          Wrap(spacing: 6, runSpacing: 6, children: [
            AppTag.accent(m.memberType),
            if (m.positionLabel != null) AppTag(m.positionLabel!),
            AppTag(m.baptized ? 'Bautizado' : 'No bautizado'),
          ]),
          const SizedBox(height: 24),
          Row(children: [
            for (var i = 0; i < actions.length; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              Expanded(child: _ActionTile(icon: actions[i].$1, label: actions[i].$2, onTap: actions[i].$3)),
            ],
          ]),
          for (final (title, rows) in sections) ...[
            const SizedBox(height: 32),
            Kicker(title),
            const SizedBox(height: 6),
            for (final (k, v) in rows) KeyValueRow(k, v),
          ],
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: onTap == null ? 0.45 : 1,
      child: Material(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: InkWell(
          onTap: onTap,
          highlightColor: AppColors.cyan100,
          borderRadius: BorderRadius.circular(AppRadii.md),
          child: SizedBox(
            height: 68,
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Ic(icon, size: 26, color: AppColors.cyan),
              const SizedBox(height: 4),
              Text(label, style: AppText.base(size: 15, color: AppColors.cyan700)),
            ]),
          ),
        ),
      ),
    );
  }
}
