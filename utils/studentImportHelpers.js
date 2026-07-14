const XLSX = require('xlsx');
const { CLASS_LEVELS, ARMS } = require('../config/schoolLevels');

const COLUMN_ALIASES = {
  studentId: ['student id', 'studentid', 'id'],
  firstName: ['first name', 'firstname', 'first'],
  middleName: ['middle name', 'middlename', 'middle'],
  lastName: ['last name', 'lastname', 'last', 'surname'],
  arm: ['arm'],
  classLevel: ['class level', 'classlevel', 'class']
};

const TEMPLATE_HEADERS = [
  'Student ID',
  'First Name',
  'Middle Name',
  'Last Name',
  'Arm',
  'Class Level'
];

const TEMPLATE_SAMPLE = [
  'SLC2024001',
  'Jane',
  'Mary',
  'Doe',
  'A',
  'JSS 1'
];

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildHeaderMap(headers) {
  const map = {};

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (!normalized) return;

    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(normalized)) {
        map[field] = index;
      }
    }
  });

  return map;
}

function cellValue(row, index) {
  if (index == null || index < 0) return '';
  const value = row[index];
  if (value == null) return '';
  return String(value).trim();
}

function normalizeClassLevel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const matched = CLASS_LEVELS.find((level) => level.toLowerCase() === raw.toLowerCase());
  return matched || raw;
}

function normalizeArm(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  return ARMS.includes(raw) ? raw : raw;
}

function parseStudentRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('The Excel file has no worksheets.');
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: '',
    blankrows: false
  });

  if (!rows.length) {
    throw new Error('The Excel file is empty.');
  }

  const headerMap = buildHeaderMap(rows[0]);
  const requiredFields = ['studentId', 'firstName', 'lastName', 'classLevel'];
  const missing = requiredFields.filter((field) => headerMap[field] == null);

  if (missing.length) {
    throw new Error(
      `Missing required column(s): ${missing.join(', ')}. Download the template and use the exact headers.`
    );
  }

  const students = [];
  const errors = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNumber = i + 1;
    const student = {
      studentId: cellValue(row, headerMap.studentId),
      firstName: cellValue(row, headerMap.firstName),
      middleName: cellValue(row, headerMap.middleName),
      lastName: cellValue(row, headerMap.lastName),
      arm: normalizeArm(cellValue(row, headerMap.arm)),
      classLevel: normalizeClassLevel(cellValue(row, headerMap.classLevel))
    };

    const isBlank = !student.studentId && !student.firstName && !student.lastName && !student.classLevel;
    if (isBlank) continue;

    const rowErrors = [];
    if (!student.studentId) rowErrors.push('Student ID is required');
    if (!student.firstName) rowErrors.push('First Name is required');
    if (!student.lastName) rowErrors.push('Last Name is required');
    if (!student.classLevel) rowErrors.push('Class Level is required');
    if (student.classLevel && !CLASS_LEVELS.includes(student.classLevel)) {
      rowErrors.push(`Class Level must be one of: ${CLASS_LEVELS.join(', ')}`);
    }
    if (student.arm && !ARMS.includes(student.arm)) {
      rowErrors.push(`Arm must be one of: ${ARMS.join(', ')}`);
    }

    if (rowErrors.length) {
      errors.push({ rowNumber, studentId: student.studentId || '(blank)', messages: rowErrors });
      continue;
    }

    students.push(student);
  }

  if (!students.length && !errors.length) {
    throw new Error('No student rows found in the Excel file.');
  }

  return { students, errors };
}

function buildImportTemplateBuffer() {
  const worksheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_SAMPLE]);
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 8 },
    { wch: 12 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  parseStudentRows,
  buildImportTemplateBuffer,
  TEMPLATE_HEADERS
};
