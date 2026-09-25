import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/church_scope.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils/format.dart';
import '../../data/models.dart';
import '../../data/paged_list.dart';
import '../../data/repositories.dart';
import '../../widgets/widgets.dart';
import '../members/members_screen.dart';
import 'event_detail_screen.dart';
import 'events_screen.dart';

class _Person {
  final int id;
  final String name;
  final String? type;
  const _Person(this.id, this.name, this.type);
}

/// Registrar asistentes — variante "Lista" (flujo principal).
///
/// Reglas del diseño:
/// - Primero los ya registrados, luego el resto alfabético (paginado de 40).
/// - Tocar a un ya registrado → aviso; su decisión de fe sí se puede cambiar.
/// - Marcar decisión en alguien no seleccionado también lo selecciona;
///   desmarcar a alguien elimina su decisión.
/// - La selección sobrevive a la búsqueda.
/// - El servidor REEMPLAZA la lista: se envían registrados + nuevos.
class RegisterAttendanceScreen extends ConsumerWidget {
  const RegisterAttendanceScreen({super.key, required this.eventId});
  final int eventId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(eventProvider(eventId)).when(
          loading: () => const Scaffold(body: SafeArea(child: SkeletonList())),
          error: (e, _) => Scaffold(
            body: SafeArea(
              child: Column(children: [
                const BackHeader(label: 'Evento'),
                Expanded(child: StateView.fromError(e, onRetry: () => ref.invalidate(eventProvider(eventId)))),
              ]),
            ),
          ),
          data: (e) => _Register(event: e),
        );
  }
}

class _Register extends ConsumerStatefulWidget {
  const _Register({required this.event});
  final ChurchEvent event;
  @override
  ConsumerState<_Register> createState() => _RegisterState();
}

class _RegisterState extends ConsumerState<_Register> {
  late final Map<int, _Person> _registered = {
    for (final a in widget.event.attendees) a.memberId: _Person(a.memberId, a.name, a.memberType),
  };
  late final Set<int> _initialDecisions = {for (final a in widget.event.attendees) if (a.faithDecision) a.memberId};

  /// Seleccionados en orden de toque (incluye a los ya registrados).
  late final Map<int, _Person> _selected = {..._registered};
  late final Set<int> _decisions = {..._initialDecisions};

  /// Visitantes creados en esta pantalla (se muestran arriba).
  final List<_Person> _added = [];

  String _q = '';
  late PagedList<Member> _list;
  final _scroll = ScrollController();
  bool _saving = false;

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
          filters: MemberFilters(search: _q),
          page: page,
          limit: 40,
          scope: ref.read(churchQueryProvider),
        ));
    l.addListener(() {
      if (mounted) setState(() {});
    });
    l.loadMore();
    return l;
  }

  @override
  void dispose() {
    _list.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _search(String q) {
    _q = q;
    _list.dispose();
    setState(() => _list = _newList());
  }

  bool get _hasChanges =>
      _selected.keys.any((id) => !_registered.containsKey(id)) ||
      _decisions.length != _initialDecisions.length ||
      !_decisions.containsAll(_initialDecisions);

  void _toggle(_Person p) {
    if (_registered.containsKey(p.id)) {
      showAppSnack('${p.name} ya está registrado en este evento.');
      return;
    }
    setState(() {
      if (_selected.containsKey(p.id)) {
        _selected.remove(p.id);
        _decisions.remove(p.id);
      } else {
        _selected[p.id] = p;
      }
    });
  }

  void _toggleDecision(_Person p) {
    setState(() {
      if (_decisions.contains(p.id)) {
        _decisions.remove(p.id);
      } else {
        _decisions.add(p.id);
        _selected.putIfAbsent(p.id, () => p);
      }
    });
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final rows = [for (final id in _selected.keys) (memberId: id, decision: _decisions.contains(id))];
      final (count, decisions) = await ref.read(repoProvider).saveAttendees(widget.event.id, rows);
      ref.read(eventsVersionProvider.notifier).bump();
      showAppSnack('Asistencia guardada · ${Fmt.plural(count, 'persona', 'personas')}, '
          '${Fmt.plural(decisions, 'decisión de fe', 'decisiones de fe')}.');
      if (mounted) context.pop();
    } catch (e) {
      showAppSnack(ApiException.from(e).message, error: true);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _newVisitor() async {
    final person = await showAppSheet<_Person>(context, builder: (ctx) => _VisitorSheet(scope: ref.read(churchQueryProvider)));
    if (person == null) return;
    ref.read(membersVersionProvider.notifier).bump();
    setState(() {
      _added.insert(0, person);
      _selected[person.id] = person;
    });
  }

  bool _matches(String name) => _q.isEmpty || name.toLowerCase().contains(_q.toLowerCase());

  @override
  Widget build(BuildContext context) {
    final online = ref.watch(isOnlineProvider);
    final perms = ref.watch(permissionsProvider);
    final e = widget.event;

    final top = <_Person>[
      ..._registered.values.where((p) => _matches(p.name)),
      ..._added.where((p) => !_registered.containsKey(p.id) && _matches(p.name)),
    ];
    final topIds = top.map((p) => p.id).toSet();
    final rest = _list.items
        .where((m) => !topIds.contains(m.id) && !_registered.containsKey(m.id))
        .map((m) => _Person(m.id, m.fullName, m.memberType))
        .toList();
    final rows = [...top, ...rest];
    final canSave = _hasChanges && _selected.isNotEmpty && online && !_saving;

    return Scaffold(
      bottomNavigationBar: FooterBar(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (!online)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text('Sin conexión. Tu selección se conserva; guarda cuando vuelva la red.',
                  style: AppText.base(size: 14, color: AppColors.magenta700)),
            ),
          PrimaryButton(
            label: _saving ? 'Guardando…' : 'Guardar asistencia (${_selected.length})',
            loading: _saving,
            onPressed: canSave ? _save : null,
          ),
          if (perms.can('members', 'create'))
            LinkButton(label: 'Nuevo visitante', icon: PhosphorIconsDuotone.userPlus, height: 44, fontSize: 16, onPressed: _newVisitor),
        ]),
      ),
      body: SafeArea(
        bottom: false,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const BackHeader(label: 'Evento'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Registrar asistencia', style: AppText.title(30)),
              const SizedBox(height: 4),
              Text('${e.title} · ${Fmt.shortDowDate(e.start)}, ${Fmt.time(e.start)}',
                  style: AppText.base(size: 15, color: AppColors.neutral800), maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 14),
              SearchField(hint: 'Buscar por nombre', onChanged: _search),
              Padding(
                padding: const EdgeInsets.only(top: 12, bottom: 8),
                child: Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
                  Expanded(
                    child: Text(Fmt.plural(_selected.length, 'seleccionado', 'seleccionados'),
                        style: AppText.base(size: 19, weight: FontWeight.w600, color: AppColors.cyan700)),
                  ),
                  Text(Fmt.plural(_decisions.length, 'decisión de fe', 'decisiones de fe'),
                      style: AppText.base(size: 15, color: AppColors.magenta700)),
                ]),
              ),
            ]),
          ),
          Expanded(child: _listBody(rows)),
        ]),
      ),
    );
  }

  Widget _listBody(List<_Person> rows) {
    if (_list.initialLoading && rows.isEmpty) return const SkeletonList();
    if (_list.error != null && rows.isEmpty) return StateView.fromError(_list.error!, onRetry: _list.refresh);
    if (rows.isEmpty) {
      return ListView(padding: const EdgeInsets.symmetric(horizontal: 20), children: const [
        InlineEmpty(title: 'Ningún miembro coincide con tu búsqueda.', body: 'Si es alguien nuevo, regístralo como visitante.'),
      ]);
    }
    return ListView.builder(
      controller: _scroll,
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
      itemCount: rows.length + (_list.hasMore || _list.loading ? 1 : 0),
      itemBuilder: (context, i) {
        if (i >= rows.length) return const LoadingMore();
        final p = rows[i];
        return _AttendeeRow(
          person: p,
          registered: _registered.containsKey(p.id),
          selected: _selected.containsKey(p.id),
          decision: _decisions.contains(p.id),
          onToggle: () => _toggle(p),
          onDecision: () => _toggleDecision(p),
        );
      },
    );
  }
}

class _AttendeeRow extends StatelessWidget {
  const _AttendeeRow({
    required this.person,
    required this.registered,
    required this.selected,
    required this.decision,
    required this.onToggle,
    required this.onDecision,
  });
  final _Person person;
  final bool registered;
  final bool selected;
  final bool decision;
  final VoidCallback onToggle;
  final VoidCallback onDecision;

  @override
  Widget build(BuildContext context) {
    final checked = selected || registered;
    final boxColor = registered ? AppColors.cyan800 : AppColors.cyan700;
    return Container(
      constraints: const BoxConstraints(minHeight: 72),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.rowLine))),
      child: Row(children: [
        Expanded(
          child: Semantics(
            checked: checked,
            label: '${person.name}${registered ? ', ya registrado' : ''}',
            excludeSemantics: true,
            child: InkWell(
              onTap: onToggle,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: 72),
                child: Row(children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 120),
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: checked ? boxColor : Colors.transparent,
                      border: Border.all(color: checked ? boxColor : AppColors.neutral500, width: 2),
                      borderRadius: BorderRadius.circular(AppRadii.md),
                    ),
                    child: checked ? const Center(child: Ic(PhosphorIconsBold.check, size: 18, color: AppColors.bg)) : null,
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                      Text(person.name, style: AppText.rowName, maxLines: 1, overflow: TextOverflow.ellipsis),
                      Text(
                        registered ? 'Ya registrado' : (person.type ?? 'Miembro'),
                        style: AppText.base(size: 14, color: registered ? AppColors.cyan700 : AppColors.neutral700),
                      ),
                    ]),
                  ),
                ]),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Semantics(
          button: true,
          selected: decision,
          label: 'Decisión de fe de ${person.name}',
          excludeSemantics: true,
          child: GestureDetector(
            onTap: onDecision,
            child: Container(
              height: 40,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: decision ? AppColors.magenta100 : AppColors.bg,
                border: Border.all(color: decision ? AppColors.magenta : AppColors.divider),
                borderRadius: BorderRadius.circular(AppRadii.md),
              ),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Ic(PhosphorIconsDuotone.cross, size: 18, color: decision ? AppColors.magenta800 : AppColors.text),
                const SizedBox(width: 6),
                Text('Decisión', style: AppText.base(size: 14, color: decision ? AppColors.magenta800 : AppColors.text)),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}

/// Hoja "Nuevo visitante": crea el miembro como Visitante y lo devuelve marcado.
class _VisitorSheet extends ConsumerStatefulWidget {
  const _VisitorSheet({required this.scope});
  final Map<String, dynamic> scope;
  @override
  ConsumerState<_VisitorSheet> createState() => _VisitorSheetState();
}

class _VisitorSheetState extends ConsumerState<_VisitorSheet> {
  final _first = TextEditingController();
  final _last = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    super.dispose();
  }

  bool get _valid => _first.text.trim().isNotEmpty && _last.text.trim().isNotEmpty;

  Future<void> _add() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final m = await ref.read(repoProvider).saveMember(null, {
        'first_name': _first.text.trim(),
        'last_name': _last.text.trim(),
        'member_type': 'Visitante',
        ...widget.scope,
      });
      if (mounted) Navigator.of(context).pop(_Person(m.id, m.fullName, 'Visitante'));
    } catch (e) {
      setState(() => _error = ApiException.from(e).message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Nuevo visitante', style: AppText.base(size: 22, weight: FontWeight.w600)),
        const SizedBox(height: 12),
        LabeledField(
          label: 'Nombres *',
          child: AppTextField(controller: _first, textCapitalization: TextCapitalization.words, onChanged: (_) => setState(() {})),
        ),
        const SizedBox(height: 12),
        LabeledField(
          label: 'Apellidos *',
          child: AppTextField(controller: _last, textCapitalization: TextCapitalization.words, onChanged: (_) => setState(() {})),
        ),
        const SizedBox(height: 10),
        Text('Se guarda como Visitante y queda marcado en esta asistencia.', style: AppText.base(size: 14, color: AppColors.neutral700)),
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(_error!, style: AppText.base(size: 14, color: AppColors.magenta700)),
        ],
        const SizedBox(height: 14),
        PrimaryButton(label: 'Agregar y marcar', loading: _saving, onPressed: _valid ? _add : null),
      ]),
    );
  }
}
