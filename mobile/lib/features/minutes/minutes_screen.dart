import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../app/router.dart';
import '../../core/church_scope.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils/format.dart';
import '../../data/models.dart';
import '../../data/paged_list.dart';
import '../../data/repositories.dart';
import '../../widgets/widgets.dart';

class MinutesScreen extends ConsumerStatefulWidget {
  const MinutesScreen({super.key});
  @override
  ConsumerState<MinutesScreen> createState() => _MinutesScreenState();
}

class _MinutesScreenState extends ConsumerState<MinutesScreen> {
  late final PagedList<Minute> _list;
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _list = PagedList<Minute>((page) => ref.read(repoProvider).minutes(page: page, scope: ref.read(churchQueryProvider)))
      ..addListener(() {
        if (mounted) setState(() {});
      })
      ..loadMore();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 300) _list.loadMore();
    });
  }

  @override
  void dispose() {
    _list.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const BackHeader(label: 'Más'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Kicker(ref.watch(churchLabelProvider)),
              const SizedBox(height: 6),
              Text('Actas', style: AppText.title(30)),
              const SizedBox(height: 4),
              Text(_list.initialLoading ? 'Cargando…' : Fmt.plural(_list.total, 'acta', 'actas'),
                  style: AppText.base(size: 14, color: AppColors.neutral700)),
              const SizedBox(height: 6),
            ]),
          ),
          Expanded(child: _body()),
        ]),
      ),
    );
  }

  Widget _body() {
    if (_list.initialLoading) return const SkeletonList(avatar: false);
    if (_list.error != null && _list.items.isEmpty) return StateView.fromError(_list.error!, onRetry: _list.refresh);
    if (_list.items.isEmpty) {
      return const StateView(icon: PhosphorIconsDuotone.fileText, title: 'Aún no hay actas.', body: 'Las actas se redactan desde el sistema web.');
    }
    return RefreshIndicator(
      color: AppColors.cyan700,
      onRefresh: _list.refresh,
      child: ListView.builder(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 34),
        itemCount: _list.items.length + (_list.hasMore ? 1 : 0),
        itemBuilder: (context, i) {
          if (i >= _list.items.length) return const LoadingMore();
          final m = _list.items[i];
          return InkWell(
            onTap: () async {
              await context.push(Routes.acta(m.id));
              _list.refresh();
            },
            highlightColor: AppColors.neutral200,
            child: Container(
              constraints: const BoxConstraints(minHeight: 88),
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.rowLine))),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(m.title, style: AppText.rowName),
                    Text([if (m.date != null) Fmt.shortDate(m.date!), ?m.createdBy].join(' · '), style: AppText.rowSub),
                    const SizedBox(height: 6),
                    Wrap(spacing: 6, children: [
                      AppTag(Fmt.plural(m.files.length, 'archivo', 'archivos'), fontSize: 13),
                    ]),
                  ]),
                ),
                const Ic(PhosphorIconsDuotone.caretRight, size: 18, color: AppColors.neutral600),
              ]),
            ),
          );
        },
      ),
    );
  }
}
