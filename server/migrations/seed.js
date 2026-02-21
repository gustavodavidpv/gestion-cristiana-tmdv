const { sequelize, Role, User, Church } = require('../models');

const seed = async () => {
  try {
    console.log('🌱 Sembrando datos iniciales...');

    await sequelize.sync({ alter: true });

    // ===== ROLES =====
    const roles = [
      { name: 'Administrador', description: 'Acceso total al sistema' },
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
    console.log('   ✅ Roles creados');

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

    // ===== USUARIO ADMIN =====
    const adminRole = await Role.findOne({ where: { name: 'Administrador' } });
    await User.findOrCreate({
      where: { email: 'admin@tmdv.org' },
      defaults: {
        email: 'admin@tmdv.org',
        password_hash: 'admin123456', // Se hashea automáticamente por el hook
        full_name: 'Administrador TMDV',
        role_id: adminRole.id,
        church_id: church.id,
        is_active: true,
      },
    });
    console.log('   ✅ Usuario administrador creado');
    console.log('');
    console.log('   📧 Email: admin@tmdv.org');
    console.log('   🔑 Password: admin123456');
    console.log('');
    console.log('✅ Seed completado exitosamente.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error en seed:', error);
    process.exit(1);
  }
};

seed();
