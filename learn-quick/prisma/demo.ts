/**
 * Demo content for development and demos only (run with SEED_DEMO=1).
 * Every demo account uses an @demo.learnquick.test email so it is easy to find and delete.
 * People and reviews are fictional.
 */
import type { BadgeType, CefrLevel, Language, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

type DemoTeacher = {
  key: string;
  name: string;
  city: string;
  subjects: Language[];
  native: Language[];
  spoken: { language: string; level: CefrLevel | "NATIVE" }[];
  headlineEn: string;
  headlineFr: string;
  bioEn: string;
  bioFr: string;
  experienceEn?: string;
  experienceFr?: string;
  specialties: string[];
  rate: number;
  trial: number;
  badges: BadgeType[];
  certificate?: { name: string; issuer: string; year: number };
  education?: { university: string; degree: string; field: string; year: number };
  reviews: { rating: number; comment: string }[];
};

const TEACHERS: DemoTeacher[] = [
  {
    key: "brenda",
    name: "Brenda Fon",
    city: "Bamenda",
    subjects: ["ENGLISH"],
    native: ["ENGLISH"],
    spoken: [{ language: "ENGLISH", level: "NATIVE" }, { language: "FRENCH", level: "B2" }],
    headlineEn: "Friendly English teacher for IELTS and confident conversation",
    headlineFr: "Enseignante d'anglais bienveillante, IELTS et conversation",
    bioEn: "Hello! I'm Brenda, an English teacher from Bamenda. I help French-speaking learners gain confidence in spoken English through real conversations, clear explanations and lots of practice.\n\nMy lessons are relaxed but structured: we set a goal, practise it together, and I send you a short summary after every lesson.",
    bioFr: "Bonjour ! Je m'appelle Brenda, enseignante d'anglais à Bamenda. J'aide les francophones à prendre confiance à l'oral grâce à de vraies conversations, des explications claires et beaucoup de pratique.\n\nMes cours sont détendus mais structurés : nous fixons un objectif, nous le travaillons ensemble, et je vous envoie un court résumé après chaque cours.",
    experienceEn: "6 years teaching English in secondary schools and 3 years preparing adults for IELTS.",
    experienceFr: "6 ans d'enseignement de l'anglais au lycée et 3 ans de préparation d'adultes à l'IELTS.",
    specialties: ["CONVERSATION", "EXAM_PREP", "PRONUNCIATION"],
    rate: 5000,
    trial: 2000,
    badges: ["VERIFIED_ID", "CERTIFIED", "PROFESSIONAL"],
    certificate: { name: "TEFL (120 hours)", issuer: "TEFL Academy", year: 2019 },
    education: { university: "University of Bamenda", degree: "BA", field: "English Language", year: 2017 },
    reviews: [
      { rating: 5, comment: "Brenda is very patient. After one month I can finally speak in meetings without fear." },
      { rating: 5, comment: "Très bonne préparation à l'IELTS, j'ai obtenu 7.0 !" },
      { rating: 4, comment: "Good lessons, clear explanations. Sometimes the connection was slow but she adapted well." },
    ],
  },
  {
    key: "jeanpaul",
    name: "Jean-Paul Mbarga",
    city: "Yaoundé",
    subjects: ["FRENCH"],
    native: ["FRENCH"],
    spoken: [{ language: "FRENCH", level: "NATIVE" }, { language: "ENGLISH", level: "C1" }, { language: "Ewondo", level: "NATIVE" }],
    headlineEn: "French teacher and DELF/DALF examiner: grammar made simple",
    headlineFr: "Professeur de français et examinateur DELF/DALF : la grammaire en toute simplicité",
    bioEn: "I'm Jean-Paul, a French teacher in Yaoundé and a trained DELF/DALF examiner. I specialise in helping English speakers master French grammar and writing, step by step.",
    bioFr: "Je suis Jean-Paul, professeur de français à Yaoundé et examinateur DELF/DALF habilité. J'aide les anglophones à maîtriser la grammaire et l'écrit en français, étape par étape.",
    experienceEn: "10 years teaching French as a foreign language; DELF/DALF examiner since 2018.",
    experienceFr: "10 ans d'enseignement du FLE ; examinateur DELF/DALF depuis 2018.",
    specialties: ["EXAM_PREP", "GRAMMAR", "TRANSLATION"],
    rate: 6000,
    trial: 2500,
    badges: ["VERIFIED_ID", "CERTIFIED", "PROFESSIONAL", "TOP_RATED"],
    certificate: { name: "DELF/DALF examiner accreditation", issuer: "France Éducation international", year: 2018 },
    education: { university: "Université de Yaoundé I", degree: "Master", field: "Lettres modernes françaises", year: 2014 },
    reviews: [
      { rating: 5, comment: "Excellent teacher. I passed my DELF B2 thanks to his writing exercises." },
      { rating: 5, comment: "Very organised and always on time. Highly recommended." },
    ],
  },
  {
    key: "aicha",
    name: "Aïcha Bello",
    city: "Garoua",
    subjects: ["FRENCH", "ENGLISH"],
    native: ["FRENCH"],
    spoken: [{ language: "FRENCH", level: "NATIVE" }, { language: "ENGLISH", level: "C1" }, { language: "Fulfulde", level: "NATIVE" }],
    headlineEn: "Bilingual tutor for children and teenagers",
    headlineFr: "Tutrice bilingue pour enfants et adolescents",
    bioEn: "I teach both French and English to children aged 7 to 16, with games, stories and short exercises that keep them motivated.",
    bioFr: "J'enseigne le français et l'anglais aux enfants de 7 à 16 ans, avec des jeux, des histoires et de petits exercices qui les gardent motivés.",
    specialties: ["KIDS", "CONVERSATION", "GRAMMAR"],
    rate: 3500,
    trial: 1500,
    badges: ["VERIFIED_ID"],
    reviews: [],
  },
];

export async function seedDemo(db: PrismaClient) {
  const passwordHash = await bcrypt.hash("Demo12345", 12);

  // One demo student who wrote the reviews
  const studentEmail = "student@demo.learnquick.test";
  const studentUser = await db.user.upsert({
    where: { email: studentEmail },
    update: {},
    create: {
      email: studentEmail,
      name: "Paul Demo",
      role: "STUDENT",
      onboarded: true,
      emailVerified: new Date(),
      passwordHash,
      studentProfile: { create: { learningLanguages: ["ENGLISH", "FRENCH"], englishLevel: "B1", frenchLevel: "A2" } },
    },
    include: { studentProfile: true },
  });
  const student = studentUser.studentProfile!;

  for (const [i, d] of TEACHERS.entries()) {
    const email = `${d.key}@demo.learnquick.test`;
    if (await db.user.findUnique({ where: { email } })) continue;

    const avg = d.reviews.length ? d.reviews.reduce((a, r) => a + r.rating, 0) / d.reviews.length : 0;
    const user = await db.user.create({
      data: {
        email,
        name: d.name,
        role: "TEACHER",
        onboarded: true,
        emailVerified: new Date(),
        passwordHash,
        city: d.city,
        teacherProfile: {
          create: {
            subjects: d.subjects,
            nativeLanguages: d.native,
            spokenLanguages: d.spoken,
            countryOfBirth: "CM",
            headlineEn: d.headlineEn,
            headlineFr: d.headlineFr,
            bioEn: d.bioEn,
            bioFr: d.bioFr,
            experienceEn: d.experienceEn,
            experienceFr: d.experienceFr,
            specialties: d.specialties,
            hourlyRateXaf: d.rate,
            trialRateXaf: d.trial,
            isPublished: true,
            ratingAvg: Math.round(avg * 10) / 10,
            ratingCount: d.reviews.length,
            lessonsCompleted: d.reviews.length * 12 + i * 3, // Jean-Paul: 27 lessons, consistent with his Top rated badge
            badges: { create: d.badges.map((type) => ({ type })) },
            application: { create: { status: "APPROVED", submittedAt: new Date(), decidedAt: new Date(), termsAcceptedAt: new Date() } },
            certificates: d.certificate
              ? { create: { name: d.certificate.name, issuer: d.certificate.issuer, yearTo: d.certificate.year, verified: true } }
              : undefined,
            educations: d.education
              ? {
                  create: {
                    university: d.education.university,
                    degree: d.education.degree,
                    field: d.education.field,
                    yearTo: d.education.year,
                    verified: true,
                  },
                }
              : undefined,
          },
        },
      },
      include: { teacherProfile: true },
    });
    const teacher = user.teacherProfile!;

    // Each review belongs to a past, completed lesson
    for (const [j, r] of d.reviews.entries()) {
      const startsAt = new Date(Date.now() - (j + 1) * 9 * 86_400_000);
      const booking = await db.booking.create({
        data: {
          studentId: student.id,
          teacherId: teacher.id,
          type: "SINGLE",
          status: "COMPLETED",
          startsAt,
          endsAt: new Date(startsAt.getTime() + 50 * 60_000),
          priceXaf: d.rate,
          commissionPct: 18,
        },
      });
      await db.review.create({
        data: { bookingId: booking.id, studentId: student.id, teacherId: teacher.id, rating: r.rating, comment: r.comment, createdAt: startsAt },
      });
    }
  }
  console.log(`Demo data ready: ${TEACHERS.length} teachers, 1 student (password Demo12345, emails @demo.learnquick.test)`);
}
