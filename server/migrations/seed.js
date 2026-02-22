const { sequelize, Role, User, Church, MinisterialPosition } = require('../models');

const seed = async () => {
  try {
    console.log('🌱 Sembrando datos iniciales...');

    await sequelize.sync({ alter: true });

    // ===== ROLES (incluyendo SuperAdmin) =====
    const roles = [
      { name: 'SuperAdmin', description: 'Acceso total al sistema sin restricción de iglesia (cross-tenant)' },
      { name: 'Administrador', description: 'Acceso total dentro de su iglesia (single-tenant)' },
      { name: 'Secretaría', description: 'Puede ver y alimentar datos de la iglesia' },
      { name: 'Líder', description: 'Puede crear eventos y registrar asistencia' },
      { name: 'Visitante', description: 'Solo puede ver información básica' },
    ];

    for (const roleData of roles) {
      await Role.findOrCreate({
        where: { name: roleData.name },
        defaults: roleData,
      });
    }
    console.log('   ✅ Roles creados (incluye SuperAdmin)');

    // ===== IGLESIA DE EJEMPLO =====
    const [church] = await Church.findOrCreate({
      where: { name: 'Iglesia TMDV - Central' },
      defaults: {
        name: 'Iglesia TMDV - Central',
        address: 'Dirección de la Iglesia',
        phone: '+507 0000-0000',
        responsible: 'Pastor Principal',
        membership_count: 0,
        avg_weekly_attendance: 0,
        faith_decisions_year: 0,
        faith_decisions_ref_year: new Date().getFullYear(),
        ordained_preachers: 0,
        unordained_preachers: 0,
        ordained_deacons: 0,
        unordained_deacons: 0,
      },
    });
    console.log('   ✅ Iglesia de ejemplo creada');

    // ===== CARGOS MINISTERIALES POR DEFECTO =====
    const defaultPositions = [
      { name: 'Predicador Ordenado', description: 'Predicador con ordenación oficial' },
      { name: 'Predicador No Ordenado', description: 'Predicador sin ordenación oficial' },
      { name: 'Diácono Ordenado', description: 'Diácono con ordenación oficial' },
      { name: 'Diácono No Ordenado', description: 'Diácono sin ordenación oficial' },
      { name: 'Pastor', description: 'Pastor de la congregación' },
      { name: 'Líder de Alabanza', description: 'Responsable del ministerio de alabanza' },
      { name: 'Maestro de Escuela Dominical', description: 'Responsable de enseñanza dominical' },
    ];

    for (const pos of defaultPositions) {
      await MinisterialPosition.findOrCreate({
        where: { church_id: church.id, name: pos.name },
        defaults: { ...pos, church_id: church.id, is_active: true },
      });
    }
    console.log('   ✅ Cargos ministeriales por defecto creados');

    // ===== USUARIO SUPER ADMIN =====
    const superAdminRole = await Role.findOne({ where: { name: 'SuperAdmin' } });
    await User.findOrCreate({
      where: { email: 'superadmin@tmdv.org' },
      defaults: {
        email: 'superadmin@tmdv.org',
        password_hash: 'super123456',
        full_name: 'Super Administrador',
        role_id: superAdminRole.id,
        church_id: church.id,
        is_active: true,
      },
    });
    console.log('   ✅ Usuario SuperAdmin creado');

    // ===== USUARIO ADMIN =====
    const adminRole = await Role.findOne({ where: { name: 'Administrador' } });
    await User.findOrCreate({
      where: { email: 'admin@tmdv.org' },
      defaults: {
        email: 'admin@tmdv.org',
        password_hash: 'admin123456',
        full_name: 'Administrador TMDV',
        role_id: adminRole.id,
        church_id: church.id,
        is_active: true,
      },
    });
    console.log('   ✅ Usuario administrador creado');

    console.log('');
    console.log('   🔑 SuperAdmin: superadmin@tmdv.org / super123456');
    console.log('   📧 Admin:      admin@tmdv.org / admin123456');
    console.log('');
    console.log('✅ Seed completado exitosamente.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  }
};

seed();
