const { sequelize, Role, User, Church, MinisterialPosition } = require('../models');
const { SYSTEM_ROLES } = require('../config/roles');
const { ensureSystemRoles, ensureDefaultRolePermissions } = require('../utils/roleSetup');

const seed = async () => {
  try {
    console.log('Sembrando datos iniciales...');

    await sequelize.sync({ alter: true });

    await ensureSystemRoles();
    await ensureDefaultRolePermissions();
    console.log(`   Roles creados (${SYSTEM_ROLES.length} en total, incluye SuperAdmin y Asistencia)`);

    const [church] = await Church.findOrCreate({
      where: { name: 'Iglesia TMDV - Central' },
      defaults: {
        name: 'Iglesia TMDV - Central',
        address: 'Direccion de la Iglesia',
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
    console.log('   Iglesia de ejemplo creada');

    const defaultPositions = [
      { name: 'Predicador Ordenado', description: 'Predicador con ordenacion oficial' },
      { name: 'Predicador No Ordenado', description: 'Predicador sin ordenacion oficial' },
      { name: 'Diacono Ordenado', description: 'Diacono con ordenacion oficial' },
      { name: 'Diacono No Ordenado', description: 'Diacono sin ordenacion oficial' },
      { name: 'Pastor', description: 'Pastor de la congregacion' },
      { name: 'Lider de Alabanza', description: 'Responsable del ministerio de alabanza' },
      { name: 'Maestro de Escuela Dominical', description: 'Responsable de ensenanza dominical' },
    ];

    for (const position of defaultPositions) {
      await MinisterialPosition.findOrCreate({
        where: { church_id: church.id, name: position.name },
        defaults: { ...position, church_id: church.id, is_active: true },
      });
    }
    console.log('   Cargos ministeriales por defecto creados');

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
    console.log('   Usuario SuperAdmin creado');

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
    console.log('   Usuario administrador creado');

    console.log('');
    console.log('   SuperAdmin: superadmin@tmdv.org / super123456');
    console.log('   Admin:      admin@tmdv.org / admin123456');
    console.log('');
    console.log('Seed completado exitosamente.');

    process.exit(0);
  } catch (error) {
    console.error('Error en seed:', error);
    process.exit(1);
  }
};

seed();
