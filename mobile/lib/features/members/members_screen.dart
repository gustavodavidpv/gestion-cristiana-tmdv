import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../app/router.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/church_scope.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils/format.dart';
import '../../core/utils/launchers.dart';
import '../../core/utils/panama_time.dart';
import '../../data/models.dart';
import '../../data/paged_list.dart';
import '../../data/repositories.dart';
import '../../widgets/widgets.dart';

const memberTypes = ['Miembro', 'Visitante', 'Familiar', 'Infante', 'Candidato a bautismo', 'Otro'];

/// Catálogo de cargos (null si el rol no tiene `positions.view`).
final positionsProvider = FutureProvider<List<Position>?>((ref) => ref.read(repoProvider).positions());

/// Señal para recargar la lista tras crear/editar/eliminar.
class MembersVersion extends Notifier<int> {
  @override
  int build() => 0;
  void bump() => state++;
}

final membersVersionProvider = NotifierProvider<MembersVersion, int>(MembersVersion.new);

class MembersScreen extends ConsumerStatefulWidget {
  const MembersScreen({super.key});
  @override
  ConsumerState<MembersScreen> createState() => _MembersScreenState();
}

class _MembersScreenState extends ConsumerState<MembersScreen> {
  MemberFilters _filters = const MemberFilters();
  late PagedList<Member> _list;
  final _scroll = ScrollController();
  int? _grandTotal;

  @override
  void initState() {
    super.initState();
    _list = _newList();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 400) _list.loadMore();
    });
  }

  PagedList<Member> _newList() {
    final l = PagedList<Member>((page) => ref.read(repoProvider).members(
          filters: _filters,
          page: page,
          limit: 30,
          scope: ref.read(churchQueryProvider),
        ));
    l.addListener(() {
      if (_filters.isEmpty && !l.loading && l.error == null) _grandTotal = l.total;
      if (mounted) setState(() {});
    });
    l.loadMore();
    return l;
  }

  void _apply(MemberFilters f) {
    if (f == _filters) return;
    setState(() => _filters = f);
    _reload();
  }

  void _reload() {
    _list.dispose();
    _list = _newList();
  }

  @override
  void dispose() {
    _list.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _pickType() async {
    final picked = await showOptionsSheet<String>(
      context,
      title: 'Tipo de miembro',
      selected: _filters.memberType ?? '',
      options: [const SheetOption('Todos', ''), for (final t in memberTypes) SheetOption(t, t)],
    );
    if (picked == null) return;
    _apply(_filters.copyWith(memberType: () => picked.isEmpty ? null : picked));
  }

  Future<void> _pickPosition(List<Position> positions) async {
    final picked = await showOptionsSheet<int>(
      context,
      title: 'Cargo ministerial',
      selected: _filters.positionId ?? 0,
      options: [const SheetOption('Todos', 0), for (final p in positions) SheetOption(p.name, p.id)],
    );
    if (picked == null) return;
    _apply(_filters.copyWith(positionId: () => picked == 0 ? null : picked));
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(membersVersionProvider, (_, _) => _reload());
    ref.listen(churchQueryProvider, (_, _) => _reload());
    final perms = ref.watch(permissionsProvider);
    final positions = ref.watch(positionsProvider).value;
    final month = PanamaTime.now().month;
    final f = _filters;

    String countLabel;
    if (_list.initialLoading) {
      countLabel = 'Cargando…';
    } else if (f.isEmpty) {
      countLabel = Fmt.plural(_list.total, 'miembro', 'miembros');
    } else {
      countLabel = _grandTotal != null
          ? '${Fmt.plural(_list.total, 'resultado', 'resultados')} de $_grandTotal'
          : Fmt.plural(_list.total, 'resultado', 'resultados');
    }

    final positionName = f.positionId == null ? null : positions?.where((p) => p.id == f.positionId).firstOrNull?.name;

    return Scaffold(
      floatingActionButton: perms.can('members', 'create')
          ? AppFab(label: 'Nuevo miembro', onPressed: () => context.push(Routes.miembroNuevo))
          : null,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                ScreenHeader(kicker: ref.watch(churchLabelProvider), title: 'Miembros'),
                SearchField(
                  hint: 'Buscar por nombre o correo',
                  onChanged: (q) => _apply(_filters.copyWith(search: q)),
                ),
              ]),
            ),
            const SizedBox(height: 12),
            ChipScroller(children: [
              AppChip(label: f.memberType ?? 'Tipo', selected: f.memberType != null, caret: true, onTap: _pickType),
              if (positions != null && positions.isNotEmpty)
                AppChip(label: positionName ?? 'Cargo', selected: f.positionId != null, caret: true, onTap: () => _pickPosition(positions)),
              AppChip(label: 'Bautizados', selected: f.baptizedOnly, onTap: () => _apply(f.copyWith(baptizedOnly: !f.baptizedOnly))),
              AppChip(
                label: 'Cumpleaños de ${Fmt.monthName(month)}',
                selected: f.birthMonth != null,
                onTap: () => _apply(f.copyWith(birthMonth: () => f.birthMonth == null ? month : null)),
              ),
            ]),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: SizedBox(
                height: 44,
                child: Row(children: [
                  Expanded(child: Text(countLabel, style: AppText.base(size: 14, color: AppColors.neutral700))),
                  if (f.hasFilters)
                    LinkButton(
                      label: 'Limpiar filtros',
                      fontSize: 15,
                      height: 44,
                      onPressed: () => _apply(MemberFilters(search: f.search)),
                    ),
                ]),
              ),
            ),
            Expanded(child: _body(perms.can('members', 'create'))),
          ],
        ),
      ),
    );
  }

  Widget _body(bool hasFab) {
    if (_list.initialLoading) return const SkeletonList();
    if (_list.error != null && _list.items.isEmpty) {
      return StateView.fromError(_list.error!, onRetry: _list.refresh);
    }
    if (_list.items.isEmpty) {
      return ListView(padding: const EdgeInsets.symmetric(horizontal: 20), children: [
        InlineEmpty(
          icon: PhosphorIconsDuotone.magnifyingGlass,
          title: _filters.isEmpty ? 'Aún no hay miembros registrados.' : 'Ningún miembro coincide con tu búsqueda.',
          actionLabel: _filters.hasFilters ? 'Limpiar filtros' : null,
          onAction: () => _apply(const MemberFilters()),
        ),
      ]);
    }
    return RefreshIndicator(
      color: AppColors.cyan700,
      onRefresh: _list.refresh,
      child: ListView.builder(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(20, 0, 20, hasFab ? 96 : 24),
        itemCount: _list.items.length + (_list.hasMore || _list.error != null ? 1 : 0),
        itemBuilder: (context, i) {
          if (i >= _list.items.length) {
            if (_list.error != null) {
              return Center(child: LinkButton(label: 'Reintentar', onPressed: _list.loadMore));
            }
            return const LoadingMore(label: 'Cargando más miembros…');
          }
          return MemberRow(member: _list.items[i], onTap: () => context.push(Routes.miembro(_list.items[i].id)));
        },
      ),
    );
  }
}

/// Fila de miembro: avatar 40, nombre 17/600, "Tipo · Cargo", llamar y WhatsApp.
class MemberRow extends StatelessWidget {
  const MemberRow({super.key, required this.member, required this.onTap});
  final Member member;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      highlightColor: AppColors.neutral200,
      child: Container(
        constraints: const BoxConstraints(minHeight: 72),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.rowLine))),
        child: Row(children: [
          InitialsAvatar(member.initials),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(member.fullName, style: AppText.rowName, maxLines: 1, overflow: TextOverflow.ellipsis),
              Text(member.subtitle, style: AppText.rowSub, maxLines: 1, overflow: TextOverflow.ellipsis),
            ]),
          ),
          if (member.hasPhone) ...[
            SquareIconButton(
              icon: PhosphorIconsDuotone.phone,
              color: AppColors.cyan,
              width: 44,
              label: 'Llamar a ${member.firstName}',
              onPressed: () => Launchers.call(member.phone!),
            ),
            Transform.translate(
              offset: const Offset(10, 0),
              child: SquareIconButton(
                icon: PhosphorIconsDuotone.whatsappLogo,
                color: AppColors.cyan,
                width: 44,
                label: 'WhatsApp a ${member.firstName}',
                onPressed: () => Launchers.whatsapp(member.phone!),
              ),
            ),
          ],
        ]),
      ),
    );
  }
}
