import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../core/auth/auth_controller.dart';
import '../core/auth/models.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/tokens.dart';
import '../widgets/widgets.dart';

/// Definición de una pestaña: índice de rama en el StatefulShellRoute y
/// permiso que la habilita (null = siempre visible).
class TabDef {
  final int branch;
  final String label;
  final IconData icon;
  final String? module;
  const TabDef(this.branch, this.label, this.icon, this.module);
}

const tabInicio = TabDef(0, 'Inicio', PhosphorIconsDuotone.house, 'dashboard');
const tabMiembros = TabDef(1, 'Miembros', PhosphorIconsDuotone.users, 'members');
const tabEventos = TabDef(2, 'Eventos', PhosphorIconsDuotone.calendarBlank, 'events');
const tabClub = TabDef(3, 'Club', PhosphorIconsDuotone.bookOpenText, 'bible_club');
const tabMas = TabDef(4, 'Más', PhosphorIconsDuotone.dotsThreeCircle, null);

/// Pestañas visibles según el mapa de permisos (nunca por nombre de rol).
/// Si el usuario registra asistencia pero no administra miembros, Eventos va
/// antes que Miembros (su tarea principal), como en el diseño para "Asistencia".
List<TabDef> visibleTabs(Permissions p) {
  final eventsFirst = p.can('events', 'attendance') && !p.can('members', 'create');
  final ordered = eventsFirst
      ? [tabInicio, tabEventos, tabMiembros, tabClub, tabMas]
      : [tabInicio, tabMiembros, tabEventos, tabClub, tabMas];
  return ordered.where((t) => t.module == null || p.can(t.module!)).toList();
}

class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.navigationShell});
  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final perms = ref.watch(permissionsProvider);
    final tabs = visibleTabs(perms);
    final current = navigationShell.currentIndex;
    final allowed = tabs.any((t) => t.branch == current);

    return Scaffold(
      body: allowed
          ? navigationShell
          : SafeArea(
              child: StateView(
                icon: PhosphorIconsDuotone.lockSimple,
                title: 'No tienes acceso a este módulo',
                body: 'Pide a tu administrador que lo habilite.',
                buttonLabel: 'Volver al inicio',
                onPressed: () => navigationShell.goBranch(tabs.first.branch),
              ),
            ),
      bottomNavigationBar: Container(
        color: AppColors.surface,
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 60,
            child: Row(
              children: [
                for (final t in tabs)
                  Expanded(
                    child: _TabButton(
                      tab: t,
                      active: t.branch == current,
                      onTap: () => navigationShell.goBranch(t.branch, initialLocation: t.branch == current),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TabButton extends StatelessWidget {
  const _TabButton({required this.tab, required this.active, required this.onTap});
  final TabDef tab;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.cyan700 : AppColors.neutral700;
    return Semantics(
      button: true,
      selected: active,
      label: tab.label,
      excludeSemantics: true,
      child: InkResponse(
        onTap: onTap,
        radius: 36,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Ic(tab.icon, size: 26, color: color),
            const SizedBox(height: 2),
            Text(tab.label, style: AppText.base(size: 13, color: color, weight: active ? FontWeight.w600 : FontWeight.w400)),
          ],
        ),
      ),
    );
  }
}
