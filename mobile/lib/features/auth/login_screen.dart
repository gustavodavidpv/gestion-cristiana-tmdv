import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../app/router.dart';
import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../core/utils/format.dart';
import '../../core/utils/panama_time.dart';
import '../../widgets/widgets.dart';
import 'church_logo.dart';

/// Login — variante "Portada" (cabecera de periódico).
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _pw = TextEditingController();
  bool _showPw = false;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    ref.read(sessionStoreProvider).lastEmail().then((e) {
      if (e != null && mounted && _email.text.isEmpty) setState(() => _email.text = e);
    });
  }

  @override
  void dispose() {
    _email.dispose();
    _pw.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    FocusScope.of(context).unfocus();
    if (_email.text.trim().isEmpty || _pw.text.isEmpty) {
      setState(() => _error = 'Escribe tu correo y tu contraseña.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(authProvider.notifier).login(_email.text, _pw.text);
    } catch (e) {
      final ex = ApiException.from(e);
      setState(() {
        _error = ex.kind == ApiErrorKind.unauthorized
            ? (ex.message.contains('desactivada') ? ex.message : 'Correo o contraseña incorrectos.')
            : ex.isNetwork
                ? 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.'
                : ex.message;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final expired = ref.watch(authProvider).expired;
    final branding = ref.watch(brandingProvider).value;
    final version = ref.watch(appVersionProvider);
    final today = PanamaTime.now();
    final pwError = _error != null && _error!.contains('incorrectos');

    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
              sliver: SliverFillRemaining(
                hasScrollBody: false,
                child: AutofillGroup(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SizedBox(height: 20),
                      const Align(alignment: Alignment.centerLeft, child: ChurchLogo(size: 88)),
                      const SizedBox(height: 20),
                      Masthead(left: 'Ciudad de Panamá', right: Text(Fmt.longDate(today))),
                      const SizedBox(height: 26),
                      Text(
                        branding?.title ?? 'Gestión Cristiana TMDV',
                        style: AppText.base(size: 46, weight: FontWeight.w600, height: 0.98, letterSpacing: -1.15),
                      ),
                      const SizedBox(height: 10),
                      Text('Gestión Cristiana',
                          style: AppText.base(size: 22, fontStyle: FontStyle.italic, color: AppColors.neutral800)),
                      const Spacer(),
                      const SizedBox(height: 16),
                      if (expired) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          decoration: BoxDecoration(color: AppColors.cyan100, borderRadius: BorderRadius.circular(AppRadii.md)),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            const Ic(PhosphorIconsDuotone.clockCountdown, size: 20, color: AppColors.cyan900),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text('Tu sesión expiró. Inicia sesión otra vez.',
                                  style: AppText.base(size: 15, color: AppColors.cyan900)),
                            ),
                          ]),
                        ),
                        const SizedBox(height: 18),
                      ],
                      LabeledField(
                        label: 'Correo',
                        child: AppTextField(
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          autofillHints: const [AutofillHints.email, AutofillHints.username],
                        ),
                      ),
                      const SizedBox(height: 16),
                      LabeledField(
                        label: 'Contraseña',
                        child: AppTextField(
                          controller: _pw,
                          hint: 'Tu contraseña',
                          obscure: !_showPw,
                          hasError: pwError,
                          textInputAction: TextInputAction.done,
                          autofillHints: const [AutofillHints.password],
                          onSubmitted: (_) => _login(),
                          suffix: SquareIconButton(
                            icon: _showPw ? PhosphorIconsDuotone.eyeSlash : PhosphorIconsDuotone.eye,
                            size: 22,
                            color: AppColors.neutral700,
                            label: _showPw ? 'Ocultar contraseña' : 'Mostrar contraseña',
                            onPressed: () => setState(() => _showPw = !_showPw),
                          ),
                        ),
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Row(children: [
                          const Ic(PhosphorIconsDuotone.warningCircle, size: 20, color: AppColors.magenta700),
                          const SizedBox(width: 8),
                          Expanded(child: Text(_error!, style: AppText.base(size: 15, color: AppColors.magenta700))),
                        ]),
                      ],
                      const SizedBox(height: 22),
                      PrimaryButton(
                        label: _loading ? 'Entrando…' : 'Entrar',
                        loading: _loading,
                        fontSize: 18,
                        onPressed: _login,
                      ),
                      const SizedBox(height: 4),
                      LinkButton(label: '¿Olvidaste tu contraseña?', onPressed: () => context.push(Routes.forgot)),
                      const SizedBox(height: 4),
                      Text('Versión $version',
                          textAlign: TextAlign.center, style: AppText.base(size: 13, color: AppColors.neutral600)),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
