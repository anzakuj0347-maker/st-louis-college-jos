require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Page = require('../models/Page');
const Event = require('../models/Event');
const News = require('../models/News');
const HeroSlide = require('../models/HeroSlide');
const User = require('../models/User');
const Admin = require('../models/Admin');
const Subject = require('../models/Subject');
const Staff = require('../models/Staff');
const Result = require('../models/Result');
const AcademicSession = require('../models/AcademicSession');
const leadershipContent = require('../config/leadershipContent');

const pages = [
  {
    slug: 'school-history',
    title: 'School History',
    section: 'about',
    content: `<p>St. Louis College Jos is a Catholic Girls' school established by the Rt. Rev. Dr. John Reddington (SMA), the first Catholic Bishop of Jos and proprietor of the Catholic schools, on the 25th of January, 1960.</p>
<p>Bishop Reddington invited the St Louis Sisters (SSL) who were already running a very successful secondary school for girls in Kano, to do the same on the Plateau for the Church, to cater for the education of girls. The bishop had prior to this established two schools for boys, namely St Murumba College Jos (Day school) and St Joseph's College Vom (Boarding).</p>
<p>For over six decades, St. Louis College Jos has remained a beacon of academic excellence, moral formation, and leadership development for young women in Plateau State and across Nigeria.</p>`
  },
  {
    slug: 'vision-and-mission',
    title: 'Vision and Mission',
    section: 'about',
    content: `<h3>Our Vision</h3>
<p>To be a leading Catholic girls' secondary school in Nigeria, producing confident, compassionate, and competent young women who excel in academics, character, and service to society.</p>
<h3>Our Mission</h3>
<p>To provide holistic education rooted in Catholic values, fostering intellectual curiosity, spiritual growth, and social responsibility through quality teaching, disciplined learning, and a nurturing community.</p>`
  },
  {
    slug: 'school-anthem',
    title: 'School Anthem',
    section: 'about',
    content: `<p><em>(Placeholder — replace with the official St. Louis College Jos school anthem lyrics.)</em></p>
<pre>
St. Louis our dear school,
Stand we true and bold,
Learning, faith and service,
Stories yet untold.
On the Plateau we rise,
With grace and dignity,
St. Louis College Jos,
Our pride eternally.
</pre>`
  },
  {
    slug: 'school-leadership',
    title: 'School Leadership',
    section: 'about',
    content: leadershipContent
  },
  {
    slug: 'jss',
    title: 'Junior Secondary School (JSS)',
    section: 'academics',
    content: `<p>The Junior Secondary School (JSS 1–3) programme at St. Louis College Jos provides a strong foundation in literacy, numeracy, sciences, and the arts, aligned with the Nigerian basic education curriculum.</p>
<ul><li>JSS 1 – Foundation year with orientation and core subjects</li><li>JSS 2 – Intermediate skills development</li><li>JSS 3 – BECE preparation and transition to SSS</li></ul>`
  },
  {
    slug: 'sss',
    title: 'Senior Secondary School (SSS)',
    section: 'academics',
    content: `<p>The Senior Secondary School (SSS 1–3) offers Science, Commercial, and Arts streams, preparing students for WAEC, NECO, and JAMB examinations.</p>
<ul><li>SSS 1 – Stream selection and subject specialization</li><li>SSS 2 – Advanced coursework and project work</li><li>SSS 3 – Final examinations and university preparation</li></ul>`
  },
  {
    slug: 'subjects-offerings',
    title: 'Subjects Offerings',
    section: 'academics',
    content: `<h3>Core Subjects</h3><p>English Language, Mathematics, Civic Education, Christian Religious Studies</p>
<h3>Science Stream</h3><p>Physics, Chemistry, Biology, Further Mathematics, Agricultural Science</p>
<h3>Commercial Stream</h3><p>Economics, Commerce, Accounting, Government, Geography</p>
<h3>Arts/Humanities</h3><p>Literature in English, History, Government, French, Visual Arts</p>
<h3>Electives</h3><p>Computer Studies, Home Economics, Music, Physical & Health Education</p>`
  },
  {
    slug: 'academic-calendar',
    title: 'Academic Calendar',
    section: 'academics',
    content: `<table class="data-table"><thead><tr><th>Term</th><th>Period</th><th>Notes</th></tr></thead><tbody>
<tr><td>First Term</td><td>September – December</td><td>Resumption, Mid-term break, End-of-term exams</td></tr>
<tr><td>Second Term</td><td>January – April</td><td>Inter-house sports, Career week</td></tr>
<tr><td>Third Term</td><td>May – July</td><td>WAEC/NECO, Graduation, Long vacation</td></tr>
</tbody></table>
<p><em>Exact dates are published at the start of each session.</em></p>`
  },
  {
    slug: 'admission-requirement',
    title: 'Admission Requirement',
    section: 'admission',
    content: `<ul>
<li>Completed application form</li>
<li>Birth certificate or sworn affidavit of age</li>
<li>Last two academic report cards / transcripts</li>
<li>Passport photographs (4 copies)</li>
<li>Medical fitness certificate</li>
<li>Baptismal card (for Catholic students) or letter of good standing</li>
<li>Entrance examination pass</li>
</ul>`
  },
  {
    slug: 'apply-now',
    title: 'Apply Now',
    section: 'admission',
    content: `<p>Admission is currently <strong>open</strong>. To apply for St. Louis College Jos:</p>
<ol>
<li>Download the application form from the school office or Downloads section</li>
<li>Complete all required fields accurately</li>
<li>Attach supporting documents listed under Admission Requirements</li>
<li>Pay the application fee at the bursary</li>
<li>Submit your file and await entrance examination date</li>
</ol>
<p>Contact the Admissions Office: <a href="mailto:info@stlouisvillejos.sch.ng">info@stlouisvillejos.sch.ng</a></p>`
  },
  {
    slug: 'entrance-exam-details',
    title: 'Entrance Exam Details',
    section: 'admission',
    content: `<h3>Examination Format</h3>
<p>The entrance examination covers English Language, Mathematics, and General Paper (Verbal & Quantitative Reasoning).</p>
<h3>Duration</h3><p>2 hours 30 minutes</p>
<h3>What to Bring</h3>
<ul><li>Examination slip</li><li>HB pencils and eraser</li><li>Valid identification</li></ul>
<p><em>Exam dates and venues are communicated after application submission.</em></p>`
  },
  {
    slug: 'club-and-society',
    title: 'Club and Society',
    section: 'student-life',
    content: `<ul>
<li>Literary and Debating Society</li><li>JETS Club (Junior Engineers, Technicians & Scientists)</li>
<li>Press Club</li><li>Drama & Cultural Society</li><li>Legion of Mary / Catholic Students Movement</li>
<li>Red Cross Society</li><li>Young Farmers Club</li></ul>`
  },
  {
    slug: 'sports-activities',
    title: 'Sports Activities',
    section: 'student-life',
    content: `<p>St. Louis College Jos promotes physical fitness through inter-house competitions and external tournaments.</p>
<ul><li>Athletics & Track Events</li><li>Football & Volleyball</li><li>Table Tennis & Badminton</li>
<li>Basketball</li><li>Swimming (where facilities permit)</li><li>Annual Inter-House Sports Day</li></ul>`
  },
  {
    slug: 'school-events',
    title: 'School Events',
    section: 'student-life',
    content: `<ul>
<li>Annual Speech & Prize Giving Day</li><li>Founder's Day Celebration (January 25)</li>
<li>Cultural Day</li><li>Career Guidance Week</li><li>Parents-Teachers Association (PTA) Meetings</li>
<li>Carol Service & Graduation Ceremony</li></ul>`
  },
  {
    slug: 'student-leadership',
    title: 'Student Leadership',
    section: 'student-life',
    content: `<p>Student leadership at St. Louis College Jos is structured through:</p>
<ul><li>School Prefects (Head Girl, Deputy, Senior Prefects)</li>
<li>House Captains and Vice Captains</li><li>Class Monitors</li>
<li>Club and Society Executives</li></ul>
<p>Leaders are selected based on academic performance, conduct, and demonstrated service.</p>`
  },
  {
    slug: 'holiday-assignment',
    title: 'Holiday Assignment',
    section: 'downloads',
    content: `<p>Download holiday assignments for the current break:</p>
<ul>
<li><a href="#">JSS 1 Holiday Assignment (PDF)</a></li>
<li><a href="#">JSS 2 Holiday Assignment (PDF)</a></li>
<li><a href="#">JSS 3 Holiday Assignment (PDF)</a></li>
<li><a href="#">SSS 1 Holiday Assignment (PDF)</a></li>
<li><a href="#">SSS 2 Holiday Assignment (PDF)</a></li>
<li><a href="#">SSS 3 Holiday Assignment (PDF)</a></li>
</ul>
<p><em>PDF files can be uploaded and linked here when ready.</em></p>`
  }
];

const heroSlides = [
  { image: '/images/hero-01.png', title: 'Excellence in Education', subtitle: 'St. Louis College Jos — Forming Women of Faith and Learning', order: 1 },
  { image: '/images/hero-02.jfif', title: 'Our Students', subtitle: 'Young women prepared to lead with confidence', order: 2 },
  { image: '/images/hero-03.jfif', title: 'Campus Life', subtitle: 'A vibrant community on the Plateau', order: 3 },
  { image: '/images/hero-04.svg', title: 'Academic Excellence', subtitle: 'Rigorous programmes from JSS to SSS', order: 4 },
  { image: '/images/hero-05.svg', title: 'Faith & Character', subtitle: 'Rooted in Catholic values since 1960', order: 5 },
  { image: '/images/hero-06.svg', title: 'Science & Innovation', subtitle: 'Modern laboratories and ICT facilities', order: 6 },
  { image: '/images/hero-07.svg', title: 'Arts & Culture', subtitle: 'Celebrating creativity and Nigerian heritage', order: 7 },
  { image: '/images/hero-08.svg', title: 'Sports & Recreation', subtitle: 'Building healthy bodies and team spirit', order: 8 },
  { image: '/images/hero-09.svg', title: 'Leadership', subtitle: 'Empowering the next generation of leaders', order: 9 },
  { image: '/images/hero-10.svg', title: 'Community Service', subtitle: 'Serving Jos and beyond with compassion', order: 10 },
  { image: '/images/hero-11.svg', title: 'Admission Open', subtitle: 'Join the St. Louis family today', order: 11 },
  { image: '/images/hero-12.svg', title: 'Those Who Excel Reach the Stars', subtitle: 'St. Louis College Jos', order: 12 }
];

async function seed() {
  await connectDB();

  await Promise.all([
    Page.deleteMany({}),
    Event.deleteMany({}),
    News.deleteMany({}),
    HeroSlide.deleteMany({}),
    User.deleteMany({}),
    Admin.deleteMany({}),
    Subject.deleteMany({}),
    Staff.deleteMany({}),
    Result.deleteMany({}),
    AcademicSession.deleteMany({})
  ]);

  await Page.insertMany(pages);
  await HeroSlide.insertMany(heroSlides);

  await Event.insertMany([
    { title: 'Inter-House Sports Day', description: 'Annual athletics and team competitions', eventDate: new Date('2026-07-15T09:00:00'), location: 'School Field', featured: true },
    { title: 'Speech & Prize Giving', description: 'Recognition of academic and co-curricular achievements', eventDate: new Date('2026-07-22T10:00:00'), location: 'School Hall', featured: true },
    { title: 'PTA General Meeting', description: 'Parents and teachers quarterly meeting', eventDate: new Date('2026-08-05T14:00:00'), location: 'Conference Room', featured: true },
    { title: 'Career Guidance Week', description: 'University and career counselling for SSS students', eventDate: new Date('2026-08-12T09:00:00'), location: 'Various Venues', featured: true },
    { title: 'Cultural Day', description: 'Showcase of Nigerian cultures and traditions', eventDate: new Date('2026-09-20T10:00:00'), location: 'School Grounds', featured: true },
    { title: 'JSS Entrance Examination', description: 'Admission entrance exam for prospective students', eventDate: new Date('2026-10-10T08:00:00'), location: 'Examination Hall', featured: true },
    { title: 'Carol Service', description: 'Christmas celebration and carol service', eventDate: new Date('2026-12-15T16:00:00'), location: 'School Chapel', featured: true },
    { title: 'Founder\'s Day', description: 'Celebrating 66 years since establishment', eventDate: new Date('2027-01-25T10:00:00'), location: 'Main Auditorium', featured: true }
  ]);

  await News.insertMany([
    {
      title: 'Admission for 2026/2027 Session Now Open',
      excerpt: 'Applications are being accepted for JSS 1 and limited SSS places. Visit the Admission page for requirements.',
      content: 'Full admission details available on our Apply Now page.',
      publishedAt: new Date('2026-06-01'),
      featured: true
    },
    {
      title: 'St. Louis College Jos Celebrates Outstanding WAEC Results',
      excerpt: 'Our SSS 3 students achieved excellent results in the 2025 WAEC examinations with multiple distinctions.',
      content: 'Congratulations to all graduating students and dedicated staff.',
      publishedAt: new Date('2026-05-18'),
      featured: true
    },
    {
      title: 'New ICT Laboratory Commissioned',
      excerpt: 'A state-of-the-art computer laboratory has been commissioned to enhance digital literacy across all classes.',
      content: 'The laboratory supports coding, research, and e-learning initiatives.',
      publishedAt: new Date('2026-05-05'),
      featured: true
    }
  ]);

  await Admin.create({
    username: 'slcadmin',
    password: 'admin123',
    name: 'SLC Administrator'
  });

  const subjects = await Subject.insertMany([
    { name: 'English Language', code: 'ENG101', classLevel: 'Both', department: 'General' },
    { name: 'Mathematics', code: 'MTH101', classLevel: 'Both', department: 'General' },
    { name: 'Basic Science', code: 'BSC101', classLevel: 'JSS', department: 'General' },
    { name: 'Social Studies', code: 'SST101', classLevel: 'JSS', department: 'General' },
    { name: 'Civic Education', code: 'CVE101', classLevel: 'JSS', department: 'General' },
    { name: 'Biology', code: 'BIO201', classLevel: 'SSS', department: 'Science' },
    { name: 'Chemistry', code: 'CHM201', classLevel: 'SSS', department: 'Science' },
    { name: 'Physics', code: 'PHY201', classLevel: 'SSS', department: 'Science' },
    { name: 'Economics', code: 'ECO201', classLevel: 'SSS', department: 'Commercial' },
    { name: 'Commerce', code: 'COM201', classLevel: 'SSS', department: 'Commercial' },
    { name: 'Government', code: 'GOV201', classLevel: 'SSS', department: 'Arts' },
    { name: 'Literature in English', code: 'LIT201', classLevel: 'SSS', department: 'Arts' }
  ]);

  const staffData = [
    { staffId: 'STF001', firstName: 'Mary', lastName: 'Abdullahi', password: 'STF9K2M4', generatedPassword: 'STF9K2M4', phone: '08012345678', classAssignments: [
      { subject: subjects[5]._id, classLevel: 'SSS 2' },
      { subject: subjects[6]._id, classLevel: 'SSS 2' }
    ]},
    { staffId: 'STF002', firstName: 'John', lastName: 'Pam', password: 'STF8H3N5', generatedPassword: 'STF8H3N5', phone: '08087654321', classAssignments: [
      { subject: subjects[0]._id, classLevel: 'JSS 1' },
      { subject: subjects[1]._id, classLevel: 'JSS 2' }
    ]},
    { staffId: 'STF003', firstName: 'Esther', lastName: 'Danladi', password: 'STF7J4P6', generatedPassword: 'STF7J4P6', phone: '08099887766', classAssignments: [
      { subject: subjects[5]._id, classLevel: 'SSS 1' }
    ]}
  ];
  for (const entry of staffData) {
    await Staff.create(entry);
  }

  const student = await User.create({
    studentId: 'SLC2024001',
    password: 'SLC9K2M4',
    generatedPassword: 'SLC9K2M4',
    firstName: 'Grace',
    lastName: 'Okonkwo',
    classLevel: 'SSS 2',
    arm: 'A',
    offeredSubjects: subjects.filter((s) => s.classLevel === 'Both' || s.classLevel === 'SSS').map((s) => s._id)
  });

  await AcademicSession.create({ name: '2025/2026', term: 'First Term', isActive: true });

  await Result.insertMany([
    { student: student._id, subject: subjects[0]._id, firstAssignment: 8, secondAssignment: 7, firstTest: 9, secondTest: 8, exam: 46, total: 78, score: 78, grade: 'B3', remark: 'Good', term: 'Second Term', session: '2025/2026', arm: 'A' },
    { student: student._id, subject: subjects[1]._id, firstAssignment: 9, secondAssignment: 8, firstTest: 9, secondTest: 9, exam: 50, total: 85, score: 85, grade: 'B2', remark: 'Very Good', term: 'Second Term', session: '2025/2026', arm: 'A' },
    { student: student._id, subject: subjects[2]._id, firstAssignment: 7, secondAssignment: 7, firstTest: 8, secondTest: 7, exam: 43, total: 72, score: 72, grade: 'B3', remark: 'Good', term: 'Second Term', session: '2025/2026', arm: 'A' },
    { student: student._id, subject: subjects[3]._id, firstAssignment: 8, secondAssignment: 8, firstTest: 8, secondTest: 8, exam: 48, total: 80, score: 80, grade: 'B2', remark: 'Very Good', term: 'Second Term', session: '2025/2026', arm: 'A' },
    { student: student._id, subject: subjects[4]._id, firstAssignment: 9, secondAssignment: 9, firstTest: 9, secondTest: 9, exam: 52, total: 88, score: 88, grade: 'A1', remark: 'Excellent', term: 'Second Term', session: '2025/2026', arm: 'A' }
  ]);

  console.log('Database seeded successfully.');
  console.log('Demo student — ID: SLC2024001 | Password: SLC9K2M4');
  console.log('Admin panel — http://localhost:3000/slc-admin/login');
  console.log('Admin login — Username: slcadmin | Password: admin123');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
