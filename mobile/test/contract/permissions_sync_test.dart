import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import '../support/server_defaults.dart';

/// Contrato: la copia de permisos usada en las pruebas de roles debe coincidir
/// con `server/config/permissions.js`. Si el servidor cambia, esta prueba falla
/// y obliga a actualizar test/support/server_defaults.dart.
void main() {
  test('DEFAULTS y MODULES coinciden con server/config/permissions.js', () async {
    final script = "const p=require('../server/config/permissions.js');"
        "console.log(JSON.stringify({modules:Object.fromEntries(p.MODULES.map(m=>[m.key,m.actions])),defaults:p.DEFAULTS}))";
    final ProcessResult result;
    try {
      result = await Process.run('node', ['-e', script], stdoutEncoding: utf8, stderrEncoding: utf8);
    } on ProcessException {
      markTestSkipped('node no está instalado');
      return;
    }
    expect(result.exitCode, 0, reason: '${result.stderr}');
    final server = jsonDecode(result.stdout as String) as Map<String, dynamic>;
    expect(server['modules'], serverModules);
    expect(server['defaults'], serverDefaults);
  });
}
