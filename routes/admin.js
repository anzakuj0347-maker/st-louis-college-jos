const express = require('express');
const multer = require('multer');
const router = express.Router();
const adminNav = require('../config/adminNav');
const { requireAdmin } = require('../middleware/adminAuth');
const { getSyncPreview, runSync, isSyncAvailable } = require('../utils/syncService');
const Admin = require('../models/Admin');
const Subject = require('../models/Subject');
const User = require('../models/User');
const Staff = require('../models/Staff');
const Result = require('../models/Result');
const AcademicSession = require('../models/AcademicSession');
const { generateStudentPassword, getClassTier, getSubjectFilterForTier, createStudentRecord } = require('../utils/studentHelpers');
const { parseStudentRows, buildImportTemplateBuffer } = require('../utils/studentImportHelpers');
const { generateLoginPassword } = require('../utils/passwordHelpers');
const { CLASS_LEVELS, ARMS, TERMS } = require('../config/schoolLevels');
const { buildCredentials, filterCredentials } = require('../utils/credentialHelpers');
const { getFeeAccess, normalizeFeeStatus } = require('../utils/feeHelpers');

async function normalizeStaffAssignments(staff) {
  if (staff.classAssignments?.length) return staff.classAssignments;

  if (staff.assignedSubjects?.length) {
    staff.classAssignments = staff.assignedSubjects.map((subjectId) => ({
      subject: subjectId,
      classLevel: 'JSS 1'
    }));
    staff.assignedSubjects = [];
    await staff.save();
  }
  return staff.classAssignments || [];
}

const renderAdmin = (res, view, data) => {
  res.render(view, {
    adminNav,
    ...data
  });
};

const studentImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    const ext = file.originalname.toLowerCase();
    if (allowed.includes(file.mimetype) || ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      return cb(null, true);
    }
    cb(new Error('Upload an Excel file (.xlsx or .xls).'));
  }
});

async function renderStudentsPage(res, data = {}) {
  const students = data.students || await User.find().select('-password').populate('offeredSubjects', 'code name').sort('studentId');
  renderAdmin(res, 'admin/students', {
    title: 'Student Management',
    pageTitle: 'Student Management',
    activeSection: 'students',
    students,
    editStudent: null,
    error: null,
    success: null,
    searchPlaceholder: 'Search by ID, name, arm or class...',
    ...data
  });
}

router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/slc-admin/subjects');
  renderAdmin(res, 'admin/login', { title: 'Admin Login', error: null });
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username: username?.trim() });
    if (!admin || !(await admin.comparePassword(password))) {
      return renderAdmin(res, 'admin/login', {
        title: 'Admin Login',
        error: 'Invalid username or password.'
      });
    }
    req.session.admin = { id: admin._id, username: admin.username, name: admin.name };
    res.redirect('/slc-admin/subjects');
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAdmin, (req, res) => {
  delete req.session.admin;
  res.redirect('/slc-admin/login');
});

router.get('/', requireAdmin, (req, res) => {
  res.redirect('/slc-admin/subjects');
});

/* ----- Subjects ----- */
router.get('/subjects', requireAdmin, async (req, res, next) => {
  try {
    const subjects = await Subject.find().sort('name');
    renderAdmin(res, 'admin/subjects', {
      title: 'Subject Management',
      pageTitle: 'Subject Management',
      activeSection: 'subjects',
      subjects,
      editSubject: null,
      error: null,
      success: req.query.success || null,
      searchPlaceholder: 'Search by code, name, class or department...'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/subjects', requireAdmin, async (req, res, next) => {
  try {
    const { name, code, classLevel, department } = req.body;
    await Subject.create({ name, code: code?.toUpperCase(), classLevel, department });
    res.redirect('/slc-admin/subjects?success=Subject added successfully.');
  } catch (err) {
    if (err.code === 11000) {
      const subjects = await Subject.find().sort('name');
      return renderAdmin(res, 'admin/subjects', {
        title: 'Subject Management',
        pageTitle: 'Subject Management',
        activeSection: 'subjects',
        subjects,
        editSubject: null,
        error: 'Subject code already exists.',
        success: null,
        searchPlaceholder: 'Search by code, name, class or department...'
      });
    }
    next(err);
  }
});

router.get('/subjects/:id/edit', requireAdmin, async (req, res, next) => {
  try {
    const [subjects, editSubject] = await Promise.all([
      Subject.find().sort('name'),
      Subject.findById(req.params.id)
    ]);
    if (!editSubject) return res.redirect('/slc-admin/subjects');
    renderAdmin(res, 'admin/subjects', {
      title: 'Subject Management',
      pageTitle: 'Subject Management',
      activeSection: 'subjects',
      subjects,
      editSubject,
      error: null,
      success: null,
      searchPlaceholder: 'Search by code, name, class or department...'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/subjects/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, code, classLevel, department } = req.body;
    await Subject.findByIdAndUpdate(
      req.params.id,
      { name, code: code?.toUpperCase(), classLevel, department },
      { timestamps: true }
    );
    res.redirect('/slc-admin/subjects?success=Subject updated successfully.');
  } catch (err) {
    next(err);
  }
});

router.post('/subjects/:id/delete', requireAdmin, async (req, res, next) => {
  try {
    await Subject.findByIdAndDelete(req.params.id);
    res.redirect('/slc-admin/subjects?success=Subject deleted.');
  } catch (err) {
    next(err);
  }
});

/* ----- Students ----- */
router.get('/students', requireAdmin, async (req, res, next) => {
  try {
    const students = await User.find().select('-password').populate('offeredSubjects', 'code name').sort('studentId');
    renderAdmin(res, 'admin/students', {
      title: 'Student Management',
      pageTitle: 'Student Management',
      activeSection: 'students',
      students,
      editStudent: null,
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      success: req.query.success ? decodeURIComponent(req.query.success) : null,
      searchPlaceholder: 'Search by ID, name, arm or class...'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/students', requireAdmin, async (req, res, next) => {
  try {
    const { studentId, firstName, middleName, lastName, classLevel, arm } = req.body;
    const { student, plainPassword } = await createStudentRecord(User, Subject, {
      studentId,
      firstName,
      middleName,
      lastName,
      classLevel,
      arm
    });

    const message = `Student added. ID: ${student.studentId}. Check Result login password: ${plainPassword}`;
    res.redirect(`/slc-admin/students?success=${encodeURIComponent(message)}`);
  } catch (err) {
    if (err.code === 11000) {
      return renderStudentsPage(res, { error: 'Student ID already exists.' });
    }
    next(err);
  }
});

router.get('/students/import/template', requireAdmin, (req, res) => {
  const buffer = buildImportTemplateBuffer();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="student-import-template.xlsx"');
  res.send(buffer);
});

router.post('/students/import', requireAdmin, (req, res, next) => {
  studentImportUpload.single('file')(req, res, (err) => {
    if (err) {
      return res.redirect(`/slc-admin/students?error=${encodeURIComponent(err.message)}`);
    }
    next();
  });
}, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.redirect(`/slc-admin/students?error=${encodeURIComponent('Choose an Excel file to import.')}`);
    }

    const { students, errors: parseErrors } = parseStudentRows(req.file.buffer);
    const importErrors = [...parseErrors];
    let imported = 0;

    for (const row of students) {
      try {
        await createStudentRecord(User, Subject, row);
        imported += 1;
      } catch (err) {
        if (err.code === 11000) {
          importErrors.push({
            rowNumber: null,
            studentId: row.studentId,
            messages: ['Student ID already exists']
          });
        } else {
          importErrors.push({
            rowNumber: null,
            studentId: row.studentId,
            messages: [err.message || 'Could not import student']
          });
        }
      }
    }

    if (!imported && importErrors.length) {
      const preview = importErrors
        .slice(0, 5)
        .map((item) => `${item.studentId}: ${item.messages.join(', ')}`)
        .join(' | ');
      return res.redirect(`/slc-admin/students?error=${encodeURIComponent(`Import failed. ${preview}`)}`);
    }

    let message = `${imported} student(s) imported successfully.`;
    if (importErrors.length) {
      const preview = importErrors
        .slice(0, 5)
        .map((item) => `${item.studentId}: ${item.messages.join(', ')}`)
        .join(' | ');
      const suffix = importErrors.length > 5 ? ` (+${importErrors.length - 5} more)` : '';
      message += ` ${importErrors.length} row(s) skipped: ${preview}${suffix}`;
    }

    res.redirect(`/slc-admin/students?success=${encodeURIComponent(message)}`);
  } catch (err) {
    if (err.message) {
      return res.redirect(`/slc-admin/students?error=${encodeURIComponent(err.message)}`);
    }
    next(err);
  }
});

router.get('/students/:id/offers', requireAdmin, async (req, res, next) => {
  try {
    const student = await User.findById(req.params.id).select('-password');
    if (!student) return res.redirect('/slc-admin/students');

    const classTier = getClassTier(student.classLevel);
    if (!classTier) {
      return res.redirect(`/slc-admin/students?error=${encodeURIComponent('Class level must include JSS or SSS (e.g. JSS 2, SSS 1).')}`);
    }

    const filter = getSubjectFilterForTier(classTier);
    const availableSubjects = await Subject.find(filter).sort('department name');
    const groupedSubjects = availableSubjects.reduce((groups, subject) => {
      const dept = subject.department || 'General';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(subject);
      return groups;
    }, {});

    const generalIds = availableSubjects
      .filter((s) => s.department === 'General')
      .map((s) => s._id.toString());
    const existingIds = (student.offeredSubjects || []).map((id) => id.toString());
    const selectedIds = [...new Set([...generalIds, ...existingIds])];

    renderAdmin(res, 'admin/student-offers', {
      title: 'Subject Offers',
      pageTitle: 'Subject Offers',
      activeSection: 'students',
      student,
      classTier,
      groupedSubjects,
      selectedIds,
      error: null,
      success: req.query.success ? decodeURIComponent(req.query.success) : null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/students/:id/offers', requireAdmin, async (req, res, next) => {
  try {
    const student = await User.findById(req.params.id);
    if (!student) return res.redirect('/slc-admin/students');

    const classTier = getClassTier(student.classLevel);
    if (!classTier) {
      return res.redirect(`/slc-admin/students?error=${encodeURIComponent('Class level must include JSS or SSS.')}`);
    }

    const filter = getSubjectFilterForTier(classTier);
    const availableSubjects = await Subject.find(filter);
    const generalIds = availableSubjects
      .filter((s) => s.department === 'General')
      .map((s) => s._id.toString());

    const submitted = Array.isArray(req.body.subjects) ? req.body.subjects : (req.body.subjects ? [req.body.subjects] : []);
    const allowedIds = new Set(availableSubjects.map((s) => s._id.toString()));
    const chosen = submitted.filter((id) => allowedIds.has(id));
    const finalIds = [...new Set([...generalIds, ...chosen])];

    student.offeredSubjects = finalIds;
    await student.save();

    res.redirect(`/slc-admin/students/${student._id}/offers?success=${encodeURIComponent('Subject offers saved successfully.')}`);
  } catch (err) {
    next(err);
  }
});

router.get('/students/:id/edit', requireAdmin, async (req, res, next) => {
  try {
    const [students, editStudent] = await Promise.all([
      User.find().select('-password').sort('studentId'),
      User.findById(req.params.id).select('-password')
    ]);
    if (!editStudent) return res.redirect('/slc-admin/students');
    renderAdmin(res, 'admin/students', {
      title: 'Student Management',
      pageTitle: 'Student Management',
      activeSection: 'students',
      students,
      editStudent,
      error: null,
      success: null,
      searchPlaceholder: 'Search by ID, name, arm or class...'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/students/:id', requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.redirect('/slc-admin/students');
    const { studentId, firstName, middleName, lastName, classLevel, arm, regeneratePassword } = req.body;
    user.studentId = studentId?.trim();
    user.firstName = firstName;
    user.middleName = middleName?.trim() || undefined;
    user.lastName = lastName;
    user.classLevel = classLevel;
    user.arm = arm?.trim() || undefined;

    let message = 'Student updated successfully.';
    if (regeneratePassword === 'on') {
      const plainPassword = generateStudentPassword();
      user.password = plainPassword;
      user.generatedPassword = plainPassword;
      message = `Student updated. New Check Result login password: ${plainPassword}`;
    }

    await user.save();
    res.redirect(`/slc-admin/students?success=${encodeURIComponent(message)}`);
  } catch (err) {
    next(err);
  }
});

router.post('/students/:id/delete', requireAdmin, async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    await Result.deleteMany({ student: req.params.id });
    res.redirect('/slc-admin/students?success=Student deleted.');
  } catch (err) {
    next(err);
  }
});

/* ----- Staff ----- */
router.get('/staff', requireAdmin, async (req, res, next) => {
  try {
    const staffList = await Staff.find().populate('classAssignments.subject', 'code name').sort('lastName');
    renderAdmin(res, 'admin/staff', {
      title: 'Staff Management',
      pageTitle: 'Staff Management',
      activeSection: 'staff',
      staffList,
      editStaff: null,
      error: null,
      success: req.query.success || null,
      searchPlaceholder: 'Search by ID, name or phone...'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/staff', requireAdmin, async (req, res, next) => {
  try {
    const { staffId, firstName, lastName, phone } = req.body;
    const plainPassword = generateLoginPassword('STF');
    await Staff.create({
      staffId: staffId?.trim(),
      firstName,
      lastName,
      phone: phone?.trim() || undefined,
      password: plainPassword,
      generatedPassword: plainPassword
    });
    const message = `Staff added. ID: ${staffId?.trim()}. Login password: ${plainPassword}`;
    res.redirect(`/slc-admin/staff?success=${encodeURIComponent(message)}`);
  } catch (err) {
    if (err.code === 11000) {
      const staffList = await Staff.find().populate('classAssignments.subject', 'code name').sort('lastName');
      return renderAdmin(res, 'admin/staff', {
        title: 'Staff Management',
        pageTitle: 'Staff Management',
        activeSection: 'staff',
        staffList,
        editStaff: null,
        error: 'Staff ID already exists.',
        success: null,
        searchPlaceholder: 'Search by ID, name or phone...'
      });
    }
    next(err);
  }
});

router.get('/staff/:id/edit', requireAdmin, async (req, res, next) => {
  try {
    const [staffList, editStaff] = await Promise.all([
      Staff.find().populate('classAssignments.subject', 'code name').sort('lastName'),
      Staff.findById(req.params.id)
    ]);
    if (!editStaff) return res.redirect('/slc-admin/staff');
    renderAdmin(res, 'admin/staff', {
      title: 'Staff Management',
      pageTitle: 'Staff Management',
      activeSection: 'staff',
      staffList,
      editStaff,
      error: null,
      success: null,
      searchPlaceholder: 'Search by ID, name or phone...'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/staff/:id', requireAdmin, async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.redirect('/slc-admin/staff');

    const { staffId, firstName, lastName, phone, regeneratePassword } = req.body;
    staff.staffId = staffId?.trim();
    staff.firstName = firstName;
    staff.lastName = lastName;
    staff.phone = phone?.trim() || undefined;

    let message = 'Staff member updated successfully.';
    if (regeneratePassword === 'on') {
      const plainPassword = generateLoginPassword('STF');
      staff.password = plainPassword;
      staff.generatedPassword = plainPassword;
      message = `Staff updated. New login password: ${plainPassword}`;
    }

    await staff.save();
    res.redirect(`/slc-admin/staff?success=${encodeURIComponent(message)}`);
  } catch (err) {
    next(err);
  }
});

router.post('/staff/:id/delete', requireAdmin, async (req, res, next) => {
  try {
    await Staff.findByIdAndDelete(req.params.id);
    res.redirect('/slc-admin/staff?success=Staff member deleted.');
  } catch (err) {
    next(err);
  }
});

router.get('/staff/:id/assign', requireAdmin, async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.redirect('/slc-admin/staff');

    await normalizeStaffAssignments(staff);

    const subjects = await Subject.find().sort('department name');
    const groupedSubjects = subjects.reduce((groups, subject) => {
      const dept = subject.department || 'General';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(subject);
      return groups;
    }, {});

    const assignmentsMap = {};
    (staff.classAssignments || []).forEach((a) => {
      assignmentsMap[a.subject.toString()] = a.classLevel;
    });

    renderAdmin(res, 'admin/staff-assign', {
      title: 'Assign Subjects',
      pageTitle: 'Assign Subjects',
      activeSection: 'staff',
      staff,
      groupedSubjects,
      assignmentsMap,
      classLevels: CLASS_LEVELS,
      error: null,
      success: req.query.success ? decodeURIComponent(req.query.success) : null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/staff/:id/assign', requireAdmin, async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.redirect('/slc-admin/staff');

    const allSubjects = await Subject.find().select('_id');
    const allowedIds = new Set(allSubjects.map((s) => s._id.toString()));

    const assignmentClasses = req.body.assignmentClasses || {};
    const assignmentSubjects = Array.isArray(req.body.assignmentSubjects)
      ? req.body.assignmentSubjects
      : (req.body.assignmentSubjects ? [req.body.assignmentSubjects] : []);

    staff.classAssignments = assignmentSubjects
      .filter((id) => allowedIds.has(id))
      .map((subjectId) => ({
        subject: subjectId,
        classLevel: assignmentClasses[subjectId]?.trim()
      }))
      .filter((a) => a.classLevel && CLASS_LEVELS.includes(a.classLevel));

    await staff.save();

    res.redirect(`/slc-admin/staff/${staff._id}/assign?success=${encodeURIComponent('Class assignments saved successfully.')}`);
  } catch (err) {
    next(err);
  }
});

/* ----- Passwords ----- */
router.get('/passwords', requireAdmin, async (req, res, next) => {
  try {
    const [students, staffList] = await Promise.all([
      User.find().select('studentId firstName middleName lastName classLevel arm generatedPassword').sort('studentId'),
      Staff.find().select('staffId firstName lastName phone generatedPassword').sort('staffId')
    ]);

    const credentials = buildCredentials(students, staffList);
    const studentClassLevels = [...new Set(students.map((s) => s.classLevel).filter(Boolean))].sort();
    const studentArms = [...new Set(students.map((s) => s.arm).filter(Boolean))].sort();

    renderAdmin(res, 'admin/passwords', {
      title: 'Manage Passwords',
      pageTitle: 'Manage Passwords',
      activeSection: 'passwords',
      credentials,
      classLevels: studentClassLevels.length ? studentClassLevels : CLASS_LEVELS,
      arms: studentArms.length ? studentArms : ARMS,
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      success: req.query.success ? decodeURIComponent(req.query.success) : null,
      searchPlaceholder: 'Search by ID, name or type...'
    });
  } catch (err) {
    next(err);
  }
});

router.get('/passwords/print', requireAdmin, async (req, res, next) => {
  try {
    const { type, classLevel, arm } = req.query;
    if (!type || !['student', 'staff'].includes(type)) {
      return res.redirect(`/slc-admin/passwords?error=${encodeURIComponent('Select Student or Staff before printing cards.')}`);
    }

    const [students, staffList] = await Promise.all([
      User.find().select('studentId firstName middleName lastName classLevel arm generatedPassword').sort('studentId'),
      Staff.find().select('staffId firstName lastName phone generatedPassword').sort('staffId')
    ]);

    const credentials = filterCredentials(buildCredentials(students, staffList), {
      type,
      classLevel: classLevel || '',
      arm: arm || ''
    });

    if (!credentials.length) {
      return res.redirect(`/slc-admin/passwords?error=${encodeURIComponent('No credentials match the selected print filters.')}`);
    }

    res.render('admin/passwords-print', {
      title: 'Print Login Cards',
      credentials,
      printType: type,
      classLevel: classLevel || '',
      arm: arm || ''
    });
  } catch (err) {
    next(err);
  }
});

router.post('/passwords/students/:id/regenerate', requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.redirect('/slc-admin/passwords');

    const plainPassword = generateStudentPassword();
    user.password = plainPassword;
    user.generatedPassword = plainPassword;
    await user.save();

    res.redirect(`/slc-admin/passwords?success=${encodeURIComponent(`New password for ${user.studentId}: ${plainPassword}`)}`);
  } catch (err) {
    next(err);
  }
});

router.post('/passwords/staff/:id/regenerate', requireAdmin, async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.redirect('/slc-admin/passwords');

    const plainPassword = generateLoginPassword('STF');
    staff.password = plainPassword;
    staff.generatedPassword = plainPassword;
    await staff.save();

    res.redirect(`/slc-admin/passwords?success=${encodeURIComponent(`New password for ${staff.staffId}: ${plainPassword}`)}`);
  } catch (err) {
    next(err);
  }
});

/* ----- Sessions ----- */
router.get('/sessions', requireAdmin, async (req, res, next) => {
  try {
    const sessions = await AcademicSession.find().sort({ name: 1, term: 1 });
    renderAdmin(res, 'admin/sessions', {
      title: 'Manage Session',
      pageTitle: 'Manage Session',
      activeSection: 'sessions',
      sessions,
      terms: TERMS,
      error: req.query.error ? decodeURIComponent(req.query.error) : null,
      success: req.query.success ? decodeURIComponent(req.query.success) : null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/sessions', requireAdmin, async (req, res, next) => {
  try {
    const name = req.body.name?.trim();
    const term = req.body.term?.trim();
    const isActive = req.body.isActive === 'true';

    if (!name) {
      return res.redirect(`/slc-admin/sessions?error=${encodeURIComponent('Session name is required.')}`);
    }

    if (!term || !TERMS.includes(term)) {
      return res.redirect(`/slc-admin/sessions?error=${encodeURIComponent('Please select a valid term.')}`);
    }

    const existing = await AcademicSession.findOne({ name, term });
    if (existing) {
      return res.redirect(`/slc-admin/sessions?error=${encodeURIComponent(`Session "${name}" for ${term} already exists.`)}`);
    }

    await AcademicSession.create({ name, term, isActive });
    res.redirect(`/slc-admin/sessions?success=${encodeURIComponent('Session created successfully.')}`);
  } catch (err) {
    if (err.code === 11000) {
      return res.redirect(`/slc-admin/sessions?error=${encodeURIComponent('That session and term combination already exists.')}`);
    }
    next(err);
  }
});

router.post('/sessions/:id/toggle', requireAdmin, async (req, res, next) => {
  try {
    const sessionDoc = await AcademicSession.findById(req.params.id);
    if (!sessionDoc) return res.redirect('/slc-admin/sessions');

    if (!sessionDoc.isActive) {
      sessionDoc.isActive = true;
    } else {
      sessionDoc.isActive = false;
    }

    await sessionDoc.save();
    const message = sessionDoc.isActive ? 'Session activated.' : 'Session deactivated.';
    res.redirect(`/slc-admin/sessions?success=${encodeURIComponent(message)}`);
  } catch (err) {
    next(err);
  }
});

router.post('/sessions/:id/delete', requireAdmin, async (req, res, next) => {
  try {
    await AcademicSession.findByIdAndDelete(req.params.id);
    res.redirect(`/slc-admin/sessions?success=${encodeURIComponent('Session deleted.')}`);
  } catch (err) {
    next(err);
  }
});

/* ----- Results ----- */
router.get('/results', requireAdmin, async (req, res, next) => {
  try {
    const [results, students, subjects] = await Promise.all([
      Result.find().populate('student', 'studentId firstName lastName classLevel').populate('subject', 'name code').sort('-createdAt'),
      User.find().select('studentId firstName lastName classLevel').sort('studentId'),
      Subject.find().sort('name')
    ]);
    renderAdmin(res, 'admin/results', {
      title: 'Result Management',
      pageTitle: 'Result Management',
      activeSection: 'results',
      results,
      students,
      subjects,
      editResult: null,
      error: null,
      success: req.query.success || null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/results', requireAdmin, async (req, res, next) => {
  try {
    const { student, subject, score, grade, term, session, arm } = req.body;
    const total = Number(score);
    await Result.create({
      student,
      subject,
      score: total,
      total,
      grade,
      term,
      session,
      arm: arm?.trim() || 'A'
    });
    res.redirect('/slc-admin/results?success=Result added successfully.');
  } catch (err) {
    if (err.code === 11000) {
      const [results, students, subjects] = await Promise.all([
        Result.find().populate('student', 'studentId firstName lastName classLevel').populate('subject', 'name code').sort('-createdAt'),
        User.find().select('studentId firstName lastName classLevel').sort('studentId'),
        Subject.find().sort('name')
      ]);
      return renderAdmin(res, 'admin/results', {
        title: 'Result Management',
        pageTitle: 'Result Management',
        activeSection: 'results',
        results,
        students,
        subjects,
        editResult: null,
        error: 'A result for this student, subject, term and session already exists.',
        success: null
      });
    }
    next(err);
  }
});

router.get('/results/:id/edit', requireAdmin, async (req, res, next) => {
  try {
    const [results, students, subjects, editResult] = await Promise.all([
      Result.find().populate('student', 'studentId firstName lastName classLevel').populate('subject', 'name code').sort('-createdAt'),
      User.find().select('studentId firstName lastName classLevel').sort('studentId'),
      Subject.find().sort('name'),
      Result.findById(req.params.id)
    ]);
    if (!editResult) return res.redirect('/slc-admin/results');
    renderAdmin(res, 'admin/results', {
      title: 'Result Management',
      pageTitle: 'Result Management',
      activeSection: 'results',
      results,
      students,
      subjects,
      editResult,
      error: null,
      success: null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/results/:id', requireAdmin, async (req, res, next) => {
  try {
    const { student, subject, score, grade, term, session, arm } = req.body;
    const total = Number(score);
    await Result.findByIdAndUpdate(req.params.id, {
      student, subject, score: total, total, grade, term, session, arm: arm?.trim() || 'A'
    });
    res.redirect('/slc-admin/results?success=Result updated successfully.');
  } catch (err) {
    next(err);
  }
});

router.post('/results/:id/delete', requireAdmin, async (req, res, next) => {
  try {
    await Result.findByIdAndDelete(req.params.id);
    res.redirect('/slc-admin/results?success=Result deleted.');
  } catch (err) {
    next(err);
  }
});

/* ----- Synchronise (local → Atlas) ----- */
router.get('/sync', requireAdmin, async (req, res, next) => {
  try {
    const preview = await getSyncPreview();
    renderAdmin(res, 'admin/sync', {
      title: 'Synchronise',
      pageTitle: 'Synchronise',
      activeSection: 'sync',
      preview,
      syncResult: null,
      error: null,
      success: req.query.success || null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/sync/run', requireAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  const send = (payload) => {
    res.write(`${JSON.stringify(payload)}\n`);
  };

  try {
    const previewBefore = await getSyncPreview();
    if (!previewBefore.canSubmit) {
      send({ type: 'error', message: previewBefore.reason || 'Synchronise is not ready yet.' });
      return res.end();
    }

    send({ type: 'progress', percent: 0, message: 'Starting synchronisation...', step: 0, totalSteps: 7 });

    const syncResult = await runSync((progress) => {
      send({ type: 'progress', ...progress });
    });

    send({ type: 'complete', syncResult });
    res.end();
  } catch (err) {
    send({ type: 'error', message: err.message || 'Synchronisation failed.' });
    res.end();
  }
});

router.post('/sync', requireAdmin, async (req, res, next) => {
  try {
    const previewBefore = await getSyncPreview();
    if (!previewBefore.canSubmit) {
      return renderAdmin(res, 'admin/sync', {
        title: 'Synchronise',
        pageTitle: 'Synchronise',
        activeSection: 'sync',
        preview: previewBefore,
        syncResult: null,
        error: previewBefore.reason || 'Synchronise is not ready yet. Check the steps above.',
        success: null
      });
    }
    const syncResult = await runSync();
    const preview = await getSyncPreview();
    const { totals } = syncResult;
    const successParts = [
      `${totals.created} new record(s) pushed`,
      `${totals.updated} updated`
    ];
    if (totals.deleted) successParts.push(`${totals.deleted} removed`);
    const success = `Synchronisation complete. ${successParts.join(', ')}.`;

    renderAdmin(res, 'admin/sync', {
      title: 'Synchronise',
      pageTitle: 'Synchronise',
      activeSection: 'sync',
      preview,
      syncResult,
      error: null,
      success
    });
  } catch (err) {
    const preview = await getSyncPreview().catch(() => ({ available: false }));
    renderAdmin(res, 'admin/sync', {
      title: 'Synchronise',
      pageTitle: 'Synchronise',
      activeSection: 'sync',
      preview,
      syncResult: null,
      error: err.message || 'Synchronisation failed.',
      success: null
    });
  }
});

/* ----- Promotion ----- */
async function renderPromotionPage(res, data = {}) {
  const fromClass = data.fromClass || '';
  const fromArm = data.fromArm || '';
  let students = [];

  if (fromClass && fromArm) {
    students = await User.find({ classLevel: fromClass, arm: fromArm })
      .select('studentId firstName middleName lastName classLevel arm')
      .sort({ lastName: 1, firstName: 1 });
  }

  renderAdmin(res, 'admin/promotion', {
    title: 'Student Promotion',
    pageTitle: 'Student Promotion',
    activeSection: 'promotion',
    classLevels: CLASS_LEVELS,
    arms: ARMS,
    fromClass,
    fromArm,
    toClass: data.toClass || '',
    toArm: data.toArm || '',
    students,
    error: data.error || null,
    success: data.success || null
  });
}

router.get('/promotion', requireAdmin, async (req, res, next) => {
  try {
    await renderPromotionPage(res, {
      fromClass: req.query.fromClass?.trim() || '',
      fromArm: req.query.fromArm?.trim() || '',
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/promotion', requireAdmin, async (req, res, next) => {
  try {
    const fromClass = req.body.fromClass?.trim() || '';
    const fromArm = req.body.fromArm?.trim() || '';
    const toClass = req.body.toClass?.trim() || '';
    const toArm = req.body.toArm?.trim() || '';
    const selected = Array.isArray(req.body.students)
      ? req.body.students
      : req.body.students
        ? [req.body.students]
        : [];

    if (!fromClass || !fromArm || !toClass || !toArm) {
      return renderPromotionPage(res, {
        fromClass,
        fromArm,
        toClass,
        toArm,
        error: 'Select the current class, arm, and promotion destination.'
      });
    }

    if (!CLASS_LEVELS.includes(fromClass) || !CLASS_LEVELS.includes(toClass)) {
      return renderPromotionPage(res, {
        fromClass,
        fromArm,
        error: 'Invalid class level selected.'
      });
    }

    if (!ARMS.includes(fromArm) || !ARMS.includes(toArm)) {
      return renderPromotionPage(res, {
        fromClass,
        fromArm,
        error: 'Invalid arm selected.'
      });
    }

    if (fromClass === toClass && fromArm === toArm) {
      return renderPromotionPage(res, {
        fromClass,
        fromArm,
        toClass,
        toArm,
        error: 'Promotion destination must be different from the current class and arm.'
      });
    }

    if (!selected.length) {
      return renderPromotionPage(res, {
        fromClass,
        fromArm,
        toClass,
        toArm,
        error: 'Select at least one student to promote.'
      });
    }

    const result = await User.updateMany(
      { _id: { $in: selected }, classLevel: fromClass, arm: fromArm },
      { $set: { classLevel: toClass, arm: toArm } }
    );

    const success = `Promoted ${result.modifiedCount} student(s) from ${fromClass} Arm ${fromArm} to ${toClass} Arm ${toArm}.`;
    res.redirect(`/slc-admin/promotion?fromClass=${encodeURIComponent(fromClass)}&fromArm=${encodeURIComponent(fromArm)}&success=${encodeURIComponent(success)}`);
  } catch (err) {
    next(err);
  }
});

/* ----- School Fees Status ----- */
async function renderFeesPage(res, data = {}) {
  const classLevel = data.classLevel || '';
  const arm = data.arm || '';
  let students = [];

  if (classLevel && arm) {
    const rows = await User.find({ classLevel, arm })
      .select('studentId firstName middleName lastName classLevel arm feeStatus')
      .sort({ lastName: 1, firstName: 1 });

    students = rows.map((student) => ({
      ...student.toObject(),
      access: getFeeAccess(student)
    }));
  }

  renderAdmin(res, 'admin/fees', {
    title: 'School Fees Status',
    pageTitle: 'School Fees Status',
    activeSection: 'fees',
    classLevels: CLASS_LEVELS,
    arms: ARMS,
    classLevel,
    arm,
    students,
    searchPlaceholder: 'Search by ID, name, fee status or access...',
    error: data.error || null,
    success: data.success || null
  });
}

router.get('/fees', requireAdmin, async (req, res, next) => {
  try {
    await renderFeesPage(res, {
      classLevel: req.query.classLevel?.trim() || '',
      arm: req.query.arm?.trim() || '',
      success: req.query.success || null,
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/fees', requireAdmin, async (req, res, next) => {
  try {
    const classLevel = req.body.classLevel?.trim() || '';
    const arm = req.body.arm?.trim() || '';
    const feeStatuses = req.body.feeStatus || {};

    if (!classLevel || !arm) {
      return renderFeesPage(res, {
        error: 'Select a class level and arm first.'
      });
    }

    if (!CLASS_LEVELS.includes(classLevel) || !ARMS.includes(arm)) {
      return renderFeesPage(res, {
        classLevel,
        arm,
        error: 'Invalid class level or arm selected.'
      });
    }

    const entries = Object.entries(feeStatuses);
    if (!entries.length) {
      return renderFeesPage(res, {
        classLevel,
        arm,
        error: 'No fee status changes to save.'
      });
    }

    let updatedCount = 0;
    for (const [studentId, statusValue] of entries) {
      const feeStatus = normalizeFeeStatus(statusValue);
      const result = await User.updateOne(
        { _id: studentId, classLevel, arm },
        { $set: { feeStatus } }
      );
      if (result.modifiedCount) updatedCount += 1;
    }

    const success = updatedCount
      ? `Updated fee status for ${updatedCount} student(s) in ${classLevel} Arm ${arm}.`
      : `Fee status saved for ${classLevel} Arm ${arm}.`;

    res.redirect(`/slc-admin/fees?classLevel=${encodeURIComponent(classLevel)}&arm=${encodeURIComponent(arm)}&success=${encodeURIComponent(success)}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
