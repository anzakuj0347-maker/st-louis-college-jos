module.exports = [
  { label: 'Home Page', path: '/', type: 'link' },
  {
    label: 'About Us',
    type: 'dropdown',
    children: [
      { label: 'School History', path: '/about/school-history' },
      { label: 'Vision and Mission', path: '/about/vision-and-mission' },
      { label: 'School Anthem', path: '/about/school-anthem' },
      { label: 'School Leadership', path: '/about/school-leadership' }
    ]
  },
  {
    label: 'Academics',
    type: 'dropdown',
    children: [
      { label: 'Junior Secondary School (JSS)', path: '/academics/jss' },
      { label: 'Senior Secondary School (SSS)', path: '/academics/sss' },
      { label: 'Subjects Offerings', path: '/academics/subjects-offerings' },
      { label: 'Academic Calendar', path: '/academics/academic-calendar' }
    ]
  },
  {
    label: 'Admission',
    type: 'dropdown',
    children: [
      { label: 'Admission Requirement', path: '/admission/admission-requirement' },
      { label: 'Apply Now', path: '/admission/apply-now' },
      { label: 'Entrance Exam Details', path: '/admission/entrance-exam-details' }
    ]
  },
  {
    label: 'Student Life',
    type: 'dropdown',
    children: [
      { label: 'Club and Society', path: '/student-life/club-and-society' },
      { label: 'Sports Activities', path: '/student-life/sports-activities' },
      { label: 'School Events', path: '/student-life/school-events' },
      { label: 'Student Leadership', path: '/student-life/student-leadership' }
    ]
  },
  {
    label: 'Downloads',
    type: 'dropdown',
    children: [
      { label: 'Holiday Assignment', path: '/downloads/holiday-assignment' }
    ]
  },
  {
    label: 'Check Result',
    type: 'dropdown',
    children: [
      { label: 'Student Login', path: '/results/login' }
    ]
  },
  { label: 'Contact Us', path: '/contact', type: 'link' }
];
