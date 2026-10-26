import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'app/router.dart';
import 'app/system_screens.dart';
import 'core/providers.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/tokens.dart';
import 'widgets/overlays.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
    systemNavigationBarColor: AppColors.surface,
    systemNavigationBarIconBrightness: Brightness.dark,
  ));

  final info = await PackageInfo.fromPlatform();

  runApp(ProviderScope(
    overrides: [appVersionProvider.overrideWithValue(info.version)],
    // Sin reintentos automáticos de Riverpod: los reintentos los decide el usuario ("Reintentar").
    retry: (_, _) => null,
    child: const TmdvApp(),
  ));
}

class TmdvApp extends ConsumerWidget {
  const TmdvApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Gestión Cristiana TMDV',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      themeMode: ThemeMode.light, // v1.0: solo modo claro (plan §3.2)
      routerConfig: ref.watch(routerProvider),
      scaffoldMessengerKey: scaffoldMessengerKey,
      locale: const Locale('es', '419'),
      supportedLocales: const [Locale('es', '419'), Locale('es')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) => OfflineBanner(child: child ?? const SizedBox.shrink()),
    );
  }
}
