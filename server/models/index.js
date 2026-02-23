const { sequelize } = require('../config/database');
const Role = require('./Role');
const User = require('./User');
const Church = require('./Church');
const Member = require('./Member');
const Mission = require('./Mission');
const WhiteField = require('./WhiteField');
const Event = require('./Event');
const EventAttendee = require('./EventAttendee');
const WeeklyAttendance = require('./WeeklyAttendance');
const Minute = require('./Minute');
const MinuteAttendee = require('./MinuteAttendee');
const Motion = require('./Motion');
const MotionVoter = require('./MotionVoter');
const MinisterialPosition = require('./MinisterialPosition');
const MinuteFile = require('./MinuteFile');

// =============================================
// ASOCIACIONES
// =============================================

// Role <-> User
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

// Church <-> User
Church.hasMany(User, { foreignKey: 'church_id', as: 'users' });
User.belongsTo(Church, { foreignKey: 'church_id', as: 'church' });

// Church <-> Member
Church.hasMany(Member, { foreignKey: 'church_id', as: 'members' });
Member.belongsTo(Church, { foreignKey: 'church_id', as: 'church' });

// Church <-> Mission
Church.hasMany(Mission, { foreignKey: 'church_id', as: 'missions' });
Mission.belongsTo(Church, { foreignKey: 'church_id', as: 'church' });

// Member <-> Mission (responsable)
Member.hasMany(Mission, { foreignKey: 'responsible_id', as: 'missions_led' });
Mission.belongsTo(Member, { foreignKey: 'responsible_id', as: 'responsible' });

// Church <-> WhiteField
Church.hasMany(WhiteField, { foreignKey: 'church_id', as: 'white_fields' });
WhiteField.belongsTo(Church, { foreignKey: 'church_id', as: 'church' });

// Member <-> WhiteField (responsable)
Member.hasMany(WhiteField, { foreignKey: 'responsible_id', as: 'white_fields_led' });
WhiteField.belongsTo(Member, { foreignKey: 'responsible_id', as: 'responsible' });

// Church <-> Event
Church.hasMany(Event, { foreignKey: 'church_id', as: 'events' });
Event.belongsTo(Church, { foreignKey: 'church_id', as: 'church' });

// User <-> Event (creador)
User.hasMany(Event, { foreignKey: 'created_by', as: 'events_created' });
Event.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// Event <-> EventAttendee <-> Member (N:M)
Event.hasMany(EventAttendee, { foreignKey: 'event_id', as: 'attendees' });
EventAttendee.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });
Member.hasMany(EventAttendee, { foreignKey: 'member_id', as: 'event_attendances' });
EventAttendee.belongsTo(Member, { foreignKey: 'member_id', as: 'member' });

// Church <-> WeeklyAttendance
Church.hasMany(WeeklyAttendance, { foreignKey: 'church_id', as: 'weekly_attendances' });
WeeklyAttendance.belongsTo(Church, { foreignKey: 'church_id', as: 'church' });

// User <-> WeeklyAttendance (creador)
User.hasMany(WeeklyAttendance, { foreignKey: 'created_by', as: 'attendance_records' });
WeeklyAttendance.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// Church <-> Minute
Church.hasMany(Minute, { foreignKey: 'church_id', as: 'minutes' });
Minute.belongsTo(Church, { foreignKey: 'church_id', as: 'church' });

// User <-> Minute (creador)
User.hasMany(Minute, { foreignKey: 'created_by', as: 'minutes_created' });
Minute.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// Minute <-> MinuteAttendee <-> Member (N:M)
Minute.hasMany(MinuteAttendee, { foreignKey: 'minute_id', as: 'attendees' });
MinuteAttendee.belongsTo(Minute, { foreignKey: 'minute_id', as: 'minute' });
Member.hasMany(MinuteAttendee, { foreignKey: 'member_id', as: 'minute_attendances' });
MinuteAttendee.belongsTo(Member, { foreignKey: 'member_id', as: 'member' });

// Minute <-> MinuteFile (1:N - múltiples archivos por acta)
Minute.hasMany(MinuteFile, { foreignKey: 'minute_id', as: 'files' });
MinuteFile.belongsTo(Minute, { foreignKey: 'minute_id', as: 'minute' });

// Minute <-> Motion
Minute.hasMany(Motion, { foreignKey: 'minute_id', as: 'motions' });
Motion.belongsTo(Minute, { foreignKey: 'minute_id', as: 'minute' });

// Motion <-> MotionVoter <-> Member (N:M)
Motion.hasMany(MotionVoter, { foreignKey: 'motion_id', as: 'voters' });
MotionVoter.belongsTo(Motion, { foreignKey: 'motion_id', as: 'motion' });
Member.hasMany(MotionVoter, { foreignKey: 'member_id', as: 'votes' });
MotionVoter.belongsTo(Member, { foreignKey: 'member_id', as: 'member' });

// =============================================
// CARGOS MINISTERIALES (NUEVO)
// =============================================

// Church <-> MinisterialPosition (1:N)
Church.hasMany(MinisterialPosition, { foreignKey: 'church_id', as: 'ministerial_positions' });
MinisterialPosition.belongsTo(Church, { foreignKey: 'church_id', as: 'church' });

// MinisterialPosition <-> Member (1:N)
MinisterialPosition.hasMany(Member, { foreignKey: 'position_id', as: 'members', constraints: false, });
Member.belongsTo(MinisterialPosition, { foreignKey: 'position_id', as: 'position', constraints: false, // ✅ clave para que no toque constraints en sync alter 
});


module.exports = {
  sequelize,
  Role,
  User,
  Church,
  Member,
  Mission,
  WhiteField,
  Event,
  EventAttendee,
  WeeklyAttendance,
  Minute,
  MinuteAttendee,
  Motion,
  MotionVoter,
  MinisterialPosition,
  MinuteFile,
};
