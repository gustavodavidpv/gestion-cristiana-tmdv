import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/tokens.dart';
import '../../data/repositories.dart';
import '../../widgets/widgets.dart';

/// Recuperar contraseña en dos pasos: pedir código → restablecer con código.
///
/// Mientras T1.5 no envíe correos reales, el servidor no manda el código en
/// producción; por eso el texto remite al administrador como alternativa.
class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();
  final _code = TextEditingController();
  final _pw = TextEditingController();
  bool _codeSent = false;
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    _pw.dispose();
    super.dispose();
  }

  Future<void> _request() async {
    if (!_email.text.contains('@')) {
      setState(() => _error = 'Escribe un correo válido.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(repoProvider).forgotPassword(_email.text);
      setState(() => _codeSent = true);
    } catch (e) {
      setState(() => _error = ApiException.from(e).message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _reset() async {
    if (_code.text.trim().length != 6) {
      setState(() => _error = 'El código tiene 6 dígitos.');
      return;
    }
    if (_pw.text.length < 6) {
      setState(() => _error = 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final msg = await ref.read(repoProvider).resetPassword(_email.text, _code.text, _pw.text);
      if (!mounted) return;
      showAppSnack(msg.isNotEmpty ? msg : 'Contraseña restablecida. Ya puedes iniciar sesión.');
      Navigator.of(context).pop();
    } catch (e) {
      setState(() => _error = ApiException.from(e).message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const BackHeader(label: 'Iniciar sesión'),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                children: [
                  Text('Recuperar contraseña', style: AppText.title(30)),
                  const SizedBox(height: 10),
                  Text(
                    _codeSent
                        ? 'Si el correo está registrado, recibirás un código de 6 dígitos. Si no te llega, pide a tu administrador que restablezca tu contraseña desde el sistema web.'
                        : 'Escribe el correo con el que entras a la app y te enviaremos un código para crear una contraseña nueva.',
                    style: AppText.base(size: 16, height: 1.45, color: AppColors.neutral800),
                  ),
                  const SizedBox(height: 22),
                  LabeledField(
                    label: 'Correo',
                    child: AppTextField(controller: _email, keyboardType: TextInputType.emailAddress, autofillHints: const [AutofillHints.email]),
                  ),
                  if (_codeSent) ...[
                    const SizedBox(height: 16),
                    LabeledField(
                      label: 'Código',
                      child: AppTextField(
                        controller: _code,
                        keyboardType: TextInputType.number,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
                        autofillHints: const [AutofillHints.oneTimeCode],
                      ),
                    ),
                    const SizedBox(height: 16),
                    LabeledField(
                      label: 'Contraseña nueva',
                      child: AppTextField(controller: _pw, obscure: true, hint: 'Mínimo 6 caracteres', autofillHints: const [AutofillHints.newPassword]),
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: AppText.base(size: 15, color: AppColors.magenta700)),
                  ],
                  const SizedBox(height: 24),
                  PrimaryButton(
                    label: _codeSent ? 'Cambiar contraseña' : 'Enviar código',
                    loading: _loading,
                    onPressed: _codeSent ? _reset : _request,
                  ),
                  if (_codeSent) LinkButton(label: 'Enviar otro código', onPressed: _loading ? null : _request),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
