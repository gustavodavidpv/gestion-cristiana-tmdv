import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils/format.dart';
import '../../data/models.dart';
import '../../data/repositories.dart';
import '../../widgets/widgets.dart';

final studentHistoryProvider = FutureProvider.autoDispose.family<List<ClubTransaction>, int>(
  (ref, id) => ref.read(repoProvider).studentHistory(id),
);

/// Historial de puntos y canjes de un participante.
class StudentHistoryScreen extends ConsumerWidget {
  const StudentHistoryScreen({super.key, required this.studentId, required this.name});
  final int studentId;
  final String name;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(studentHistoryProvider(studentId));
    return Scaffold(
      body: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const BackHeader(label: 'Club'),
          Expanded(
            child: async.when(
              loading: () => const SkeletonList(avatar: false),
              error: (e, _) => StateView.fromError(e, onRetry: () => ref.invalidate(studentHistoryProvider(studentId))),
              data: (txs) {
                final balance = txs.fold(0, (a, t) => a + t.points);
                final earned = txs.where((t) => t.points > 0).fold(0, (a, t) => a + t.points);
                final redeemed = txs.where((t) => t.points < 0).fold(0, (a, t) => a - t.points);
                return ListView(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
                  children: [
                    const Kicker('Historial'),
                    const SizedBox(height: 6),
                    Text(name, style: AppText.title(30)),
                    const SizedBox(height: 16),
                    Row(children: [
                      for (final (k, v) in [('Saldo', balance), ('Ganados', earned), ('Canjeados', redeemed)])
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('$v', style: AppText.base(size: 30, weight: FontWeight.w600, height: 1)),
                            const SizedBox(height: 6),
                            Text(k, style: AppText.base(size: 14, color: AppColors.neutral800)),
                          ]),
                        ),
                    ]),
                    const SizedBox(height: 16),
                    if (txs.isEmpty)
                      const InlineEmpty(icon: PhosphorIconsDuotone.star, title: 'Aún no tiene movimientos.'),
                    for (final t in txs) _TxRow(t),
                  ],
                );
              },
            ),
          ),
        ]),
      ),
    );
  }
}

class _TxRow extends StatelessWidget {
  const _TxRow(this.t);
  final ClubTransaction t;
  @override
  Widget build(BuildContext context) {
    final isRedeem = t.points < 0;
    final title = isRedeem ? 'Canje${t.item != null ? ': ${t.item}' : ''}' : (t.reason ?? (t.type == 'adjust' ? 'Ajuste' : 'Puntos'));
    final meta = [Fmt.shortDowDate(t.date), ?t.notes, if (t.createdBy != null) 'Registró: ${t.createdBy}'].join(' · ');
    return Container(
      constraints: const BoxConstraints(minHeight: 64),
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.rowLine))),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: AppText.rowName),
            Text(meta, style: AppText.rowSub),
          ]),
        ),
        const SizedBox(width: 12),
        Text(isRedeem ? '−${-t.points}' : '+${t.points}',
            style: AppText.base(size: 22, weight: FontWeight.w600, color: isRedeem ? AppColors.magenta700 : AppColors.cyan700)),
      ]),
    );
  }
}
