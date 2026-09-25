import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/auth_controller.dart';
import '../data/models.dart';
import '../features/auth/forgot_password_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/club/club_screen.dart';
import '../features/club/student_history_screen.dart';
import '../features/events/event_detail_screen.dart';
import '../features/events/event_form_screen.dart';
import '../features/events/events_screen.dart';
import '../features/events/register_attendance_screen.dart';
import '../features/home/home_screen.dart';
import '../features/members/member_detail_screen.dart';
import '../features/members/member_form_screen.dart';
import '../features/members/members_screen.dart';
import '../features/minutes/minute_detail_screen.dart';
import '../features/minutes/minutes_screen.dart';
import '../features/more/more_screen.dart';
import '../features/weekly/weekly_form_screen.dart';
import '../features/weekly/weekly_screen.dart';
import 'shell.dart';
import 'system_screens.dart';

final rootNavigatorKey = GlobalKey<NavigatorState>();

/// Rutas de la app. El esquema `gctmdv` está declarado en Android/iOS; los deep
/// links (`gctmdv:///evento/12` → `/evento/12`) quedan por verificar en dispositivo.
class Routes {
  Routes._();
  static const splash = '/splash';
  static const update = '/actualizar';
  static const login = '/login';
  static const forgot = '/login/recuperar';
  static const inicio = '/inicio';
  static const miembros = '/miembros';
  static const eventos = '/eventos';
  static const club = '/club';
  static const mas = '/mas';
  static const semanal = '/semanal';
  static const semanalNueva = '/semanal/registrar';
  static const actas = '/actas';
  static const miembroNuevo = '/miembro-nuevo';
  static const eventoNuevo = '/evento-nuevo';
  static String miembro(int id) => '/miembro/$id';
  static String miembroEditar(int id) => '/miembro/$id/editar';
  static String evento(int id) => '/evento/$id';
  static String eventoEditar(int id) => '/evento/$id/editar';
  static String registrar(int id) => '/evento/$id/registrar';
  static String acta(int id) => '/actas/$id';
  static String participante(int id) => '/club/participante/$id';
}

/// Puente entre Riverpod y `refreshListenable` de go_router.
class _AuthListenable extends ChangeNotifier {
  void ping() => notifyListeners();
}

final routerProvider = Provider<GoRouter>((ref) {
  final listenable = _AuthListenable();
  ref.listen(authProvider.select((s) => s.status), (_, _) => listenable.ping());
  ref.onDispose(listenable.dispose);

  int id(GoRouterState s) => int.parse(s.pathParameters['id']!);

  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: Routes.splash,
    refreshListenable: listenable,
    redirect: (context, state) {
      final auth = ref.read(authProvider);
      final loc = state.matchedLocation;
      switch (auth.status) {
        case AuthStatus.loading:
          return loc == Routes.splash ? null : Routes.splash;
        case AuthStatus.updateRequired:
          return loc == Routes.update ? null : Routes.update;
        case AuthStatus.signedOut:
          return loc.startsWith(Routes.login) ? null : Routes.login;
        case AuthStatus.signedIn:
          if (loc == Routes.splash || loc == Routes.update || loc.startsWith(Routes.login)) return Routes.inicio;
          return null;
      }
    },
    routes: [
      GoRoute(path: Routes.splash, builder: (_, _) => const SplashScreen()),
      GoRoute(path: Routes.update, builder: (_, _) => const UpdateRequiredScreen()),
      GoRoute(
        path: Routes.login,
        builder: (_, _) => const LoginScreen(),
        routes: [GoRoute(path: 'recuperar', builder: (_, _) => const ForgotPasswordScreen())],
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => AppShell(navigationShell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: Routes.inicio, builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.miembros, builder: (_, _) => const MembersScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.eventos, builder: (_, _) => const EventsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.club, builder: (_, _) => const ClubScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: Routes.mas, builder: (_, _) => const MoreScreen())]),
        ],
      ),
      // Pantallas hijas: se apilan sobre las pestañas (sin tab bar).
      GoRoute(path: Routes.miembroNuevo, builder: (_, _) => const MemberFormScreen()),
      GoRoute(
        path: '/miembro/:id',
        builder: (_, s) => MemberDetailScreen(memberId: id(s), backLabel: s.extra is String ? s.extra as String : 'Miembros'),
        routes: [GoRoute(path: 'editar', builder: (_, s) => MemberFormScreen(member: s.extra is Member ? s.extra as Member : null, memberId: id(s)))],
      ),
      GoRoute(path: Routes.eventoNuevo, builder: (_, s) => EventFormScreen(initialDate: s.extra is DateTime ? s.extra as DateTime : null)),
      GoRoute(
        path: '/evento/:id',
        builder: (_, s) => EventDetailScreen(eventId: id(s), backLabel: s.extra is String ? s.extra as String : 'Eventos'),
        routes: [
          GoRoute(path: 'editar', builder: (_, s) => EventFormScreen(event: s.extra is ChurchEvent ? s.extra as ChurchEvent : null, eventId: id(s))),
          GoRoute(path: 'registrar', builder: (_, s) => RegisterAttendanceScreen(eventId: id(s))),
        ],
      ),
      GoRoute(
        path: '/club/participante/:id',
        builder: (_, s) => StudentHistoryScreen(studentId: id(s), name: s.extra is String ? s.extra as String : 'Participante'),
      ),
      GoRoute(
        path: Routes.semanal,
        builder: (_, _) => const WeeklyScreen(),
        routes: [
          GoRoute(path: 'registrar', builder: (_, s) => WeeklyFormScreen(existing: s.extra is WeeklyFormArgs ? s.extra as WeeklyFormArgs : null)),
        ],
      ),
      GoRoute(
        path: Routes.actas,
        builder: (_, _) => const MinutesScreen(),
        routes: [GoRoute(path: ':id', builder: (_, s) => MinuteDetailScreen(minuteId: id(s)))],
      ),
    ],
  );
});
