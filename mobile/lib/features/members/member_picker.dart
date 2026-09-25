import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/church_scope.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../../widgets/widgets.dart';

/// Hoja de búsqueda para elegir un miembro (roles de culto).
/// Devuelve el miembro elegido, o `MemberRef(0, '', '')` para "Sin asignar".
Future<MemberRef?> pickMember(BuildContext context, WidgetRef ref, {required String title}) {
  return showAppSheet<MemberRef>(context, builder: (ctx) => _MemberPicker(title: title));
}

class _MemberPicker extends ConsumerStatefulWidget {
  const _MemberPicker({required this.title});
  final String title;
  @override
  ConsumerState<_MemberPicker> createState() => _MemberPickerState();
}

class _MemberPickerState extends ConsumerState<_MemberPicker> {
  String _q = '';
  Future<Paged<Member>>? _future;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  void _search(String q) {
    setState(() {
      _q = q;
      _future = ref.read(repoProvider).members(
            filters: MemberFilters(search: q),
            limit: 30,
            scope: ref.read(churchQueryProvider),
          );
    });
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.7,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(widget.title, style: AppText.base(size: 20, weight: FontWeight.w600)),
        const SizedBox(height: 12),
        SearchField(hint: 'Buscar por nombre', onChanged: _search),
        const SizedBox(height: 8),
        InkWell(
          onTap: () => Navigator.of(context).pop(const MemberRef(0, '', '')),
          child: SizedBox(
            height: 52,
            child: Align(alignment: Alignment.centerLeft, child: Text('Sin asignar', style: AppText.base(size: 17, color: AppColors.neutral700))),
          ),
        ),
        const RowLine(),
        Expanded(
          child: FutureBuilder<Paged<Member>>(
            key: ValueKey(_q),
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) return const SkeletonList(rows: 5, padding: EdgeInsets.zero);
              if (snap.hasError) return StateView.fromError(snap.error!, onRetry: () => _search(_q));
              final items = snap.data!.items;
              if (items.isEmpty) return const InlineEmpty(title: 'Ningún miembro coincide con tu búsqueda.');
              return ListView.builder(
                itemCount: items.length,
                itemBuilder: (context, i) {
                  final m = items[i];
                  return InkWell(
                    onTap: () => Navigator.of(context).pop(MemberRef(m.id, m.firstName, m.lastName)),
                    child: Container(
                      height: 64,
                      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.rowLine))),
                      child: Row(children: [
                        InitialsAvatar(m.initials),
                        const SizedBox(width: 14),
                        Expanded(child: Text(m.fullName, style: AppText.rowName, overflow: TextOverflow.ellipsis)),
                      ]),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ]),
    );
  }
}
