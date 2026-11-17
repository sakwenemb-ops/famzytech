import type { legalInfo } from "@/lib/legal";

type Legal = ReturnType<typeof legalInfo>;
export type Block = { h: string; p?: string[]; list?: string[]; table?: { head: string[]; rows: string[][] } };
export type Policy = { title: string; updated: string; intro: string[]; sections: Block[] };

/**
 * The privacy policy, written from what the site actually does.
 * If you change how data is collected, stored or shared, update this text too.
 */
export function privacyPolicy(locale: "en" | "fr", l: Legal): Policy {
  return locale === "fr" ? fr(l) : en(l);
}

function fr(l: Legal): Policy {
  return {
    title: "Politique de confidentialité",
    updated: "Dernière mise à jour :",
    intro: [
      `Learn Quick est une plateforme de cours d'anglais et de français en direct, éditée par ${l.company}, ${l.address} (${l.registration}). Nous sommes responsables du traitement de vos données personnelles.`,
      "Cette page explique quelles données nous collectons, pourquoi, avec qui nous les partageons, combien de temps nous les gardons et quels sont vos droits. Nous appliquons la loi camerounaise n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel, la loi n° 2010/012 relative à la cybersécurité et à la cybercriminalité et, pour les personnes situées dans l'Union européenne, le RGPD.",
      `Pour toute question : ${l.email}.`,
    ],
    sections: [
      {
        h: "1. Les données que nous collectons",
        table: {
          head: ["Données", "Qui", "Pourquoi"],
          rows: [
            ["Nom, e-mail et/ou numéro de téléphone, mot de passe (enregistré sous forme chiffrée irréversible), pays, ville, fuseau horaire, langue", "Tous", "Créer et sécuriser votre compte, vous envoyer les codes de vérification"],
            ["Si vous utilisez « Continuer avec Google » : nom, e-mail et photo de votre compte Google", "Tous (au choix)", "Vous connecter sans mot de passe"],
            ["Langues apprises, niveaux, objectifs", "Élèves", "Vous proposer des enseignants et des exercices adaptés"],
            ["Photo, vidéo de présentation, biographie, tarifs, disponibilités, langues parlées", "Enseignants", "Votre profil public dans le catalogue"],
            ["Pièce d'identité (recto, verso), selfie, diplômes et certificats", "Enseignants", "Vérifier votre identité et vos qualifications avant la publication du profil"],
            ["Numéro Mobile Money, montants, historique des paiements, des remboursements et des retraits", "Élèves et enseignants", "Encaisser les cours, rembourser, verser les gains, tenir la comptabilité"],
            ["Réservations, heures de connexion à la classe, messages du chat, fichiers partagés, tableau blanc, notes partagées, notes et devoirs de l'enseignant", "Élèves et enseignants", "Faire fonctionner les cours, décider qui est payé (présence), traiter les litiges"],
            ["Messages entre élèves et enseignants", "Élèves et enseignants", "Vous permettre d'échanger avant et après les cours"],
            ["Avis et notes donnés après un cours", "Élèves", "Informer les autres élèves (votre prénom seulement est affiché)"],
            ["Réponses aux exercices de traduction, notes, certificats d'entraînement", "Élèves et enseignants", "Corriger vos traductions et suivre vos progrès"],
            ["Adresse IP et informations techniques de connexion", "Tous", "Sécurité : limiter les tentatives de connexion, prévenir la fraude"],
          ],
        },
        p: ["Nous ne demandons pas plus que ce qui est nécessaire. Nous ne collectons jamais votre code PIN Mobile Money : vous validez les paiements sur votre téléphone."],
      },
      {
        h: "2. Les cours en vidéo",
        list: [
          "La vidéo et le son passent directement entre le navigateur de l'élève et celui de l'enseignant. Ils sont chiffrés et ne sont ni enregistrés ni stockés par Learn Quick.",
          "Si un réseau bloque la connexion directe, l'appel passe par un serveur relais (TURN) qui transmet les données chiffrées sans pouvoir les lire.",
          "Le chat, les fichiers partagés, le tableau blanc et les notes de la classe sont enregistrés avec le cours, pour que vous puissiez les revoir.",
        ],
      },
      {
        h: "3. Pourquoi nous utilisons vos données (bases légales)",
        list: [
          "Exécuter le contrat qui nous lie : compte, réservations, cours, paiements, messages, bibliothèque.",
          "Respecter nos obligations légales : comptabilité, lutte contre la fraude, réponses aux autorités.",
          "Notre intérêt légitime : sécurité de la plateforme, vérification des enseignants, prévention des abus, amélioration du service.",
          "Votre consentement : connexion avec Google, e-mails et SMS facultatifs (vous pouvez les désactiver dans Paramètres → Notifications).",
        ],
        p: ["Nous ne vendons pas vos données. Nous n'affichons pas de publicité et n'utilisons pas de traceurs publicitaires."],
      },
      {
        h: "4. Ce que les autres utilisateurs voient",
        list: [
          "Profil d'un enseignant : nom, photo, vidéo, biographie, tarifs, disponibilités, avis, badges. Jamais ses documents d'identité ni son numéro de téléphone.",
          "Avis d'un élève : uniquement son prénom, sa note et son commentaire.",
          "Dans les messages, les numéros de téléphone, e-mails et liens sont masqués automatiquement tant que l'élève n'a pas payé un premier cours avec cet enseignant.",
        ],
      },
      {
        h: "5. Avec qui nous partageons vos données",
        p: ["Uniquement avec des prestataires qui nous aident à faire fonctionner le service, et seulement ce dont ils ont besoin :"],
        table: {
          head: ["Prestataire", "Rôle", "Données transmises", "Pays"],
          rows: [
            [l.host, "Hébergement du site et de la base de données", "Toutes les données du service", "France (Union européenne)"],
            ["Campay", "Paiements MTN Mobile Money et Orange Money", "Numéro de téléphone, montant, référence", "Cameroun"],
            ["MTN, Orange", "Opérateurs Mobile Money", "Numéro de téléphone, montant", "Cameroun"],
            ["Resend", "Envoi des e-mails", "Adresse e-mail, contenu de l'e-mail", "États-Unis / Union européenne"],
            ["Africa's Talking", "Envoi des SMS (codes, rappels)", "Numéro de téléphone, contenu du SMS", "Kenya"],
            ["Anthropic (Claude)", "Correction des traductions par l'IA", "Le texte à traduire et votre traduction, sans votre nom ni vos coordonnées", "États-Unis"],
            ["Google", "Connexion « Continuer avec Google » (si vous la choisissez)", "Données d'identification Google", "États-Unis"],
            ["Fournisseur TURN", "Relais des appels vidéo bloqués par certains réseaux", "Flux chiffrés, illisibles par le relais", "Selon le fournisseur"],
          ],
        },
        list: [
          "Selon ses conditions commerciales, Anthropic n'utilise pas les textes envoyés par notre service pour entraîner ses modèles.",
          "Nous pouvons aussi communiquer des données aux autorités lorsque la loi l'exige.",
          "Lorsque des données sont transférées hors du Cameroun, nous choisissons des prestataires qui offrent des garanties de sécurité et de confidentialité suffisantes.",
        ],
      },
      {
        h: "6. Combien de temps nous gardons vos données",
        table: {
          head: ["Données", "Durée"],
          rows: [
            ["Pièces d'identité et selfie des enseignants", "Supprimés automatiquement 90 jours après la décision sur la candidature"],
            ["Compte et profil", "Tant que le compte existe, puis supprimés ou anonymisés dans les 30 jours après la suppression du compte"],
            ["Paiements, remboursements, retraits et comptabilité", "10 ans (obligation comptable)"],
            ["Cours, chat de classe, messages, avis", "Tant que le compte existe ; plus longtemps seulement en cas de litige en cours"],
            ["Journal de sécurité (actions importantes)", "Jusqu'à 1 an"],
            ["Sauvegardes", "14 jours, puis effacées automatiquement"],
          ],
        },
      },
      {
        h: "7. Comment nous protégeons vos données",
        list: [
          "Connexion chiffrée (HTTPS) sur tout le site.",
          "Mots de passe enregistrés sous forme chiffrée irréversible (bcrypt) : personne, même nous, ne peut les lire.",
          "Pièces d'identité, selfies, diplômes et certificats chiffrés (AES-256) sur nos serveurs et accessibles uniquement à l'équipe qui vérifie les candidatures.",
          "Accès réservé selon le rôle, codes de vérification à usage unique, limitation des tentatives de connexion.",
          "Comptabilité en partie double qui empêche qu'un paiement soit compté deux fois ; les notifications de paiement sont toujours vérifiées auprès de Campay.",
          "Journal des actions importantes de l'équipe (validations, suspensions, remboursements).",
        ],
        p: ["Aucun système n'est parfait. En cas de violation de données présentant un risque pour vous, nous vous prévenons ainsi que l'autorité compétente dans les délais prévus par la loi."],
      },
      {
        h: "8. Cookies",
        p: ["Nous utilisons uniquement des cookies nécessaires au fonctionnement du site, qui ne demandent pas de consentement :"],
        list: [
          "Cookie de session : vous garder connecté (30 jours au maximum).",
          "Cookie de langue : retenir si vous préférez le français ou l'anglais.",
        ],
      },
      {
        h: "9. Enfants",
        p: [
          "Les comptes sont réservés aux personnes de 18 ans et plus. Pour un enfant ou un adolescent, c'est un parent ou un tuteur qui crée le compte, réserve et paie les cours, et accepte la présente politique au nom de l'enfant. Nous recommandons qu'un adulte soit présent ou à proximité pendant les cours des jeunes enfants.",
          `Si vous pensez qu'un mineur a créé un compte sans l'accord de ses parents, écrivez-nous à ${l.email} : nous le supprimerons.`,
        ],
      },
      {
        h: "10. Vos droits",
        p: ["Vous pouvez à tout moment :"],
        list: [
          "accéder à vos données et en obtenir une copie ;",
          "faire corriger des données inexactes (la plupart se modifient dans Paramètres) ;",
          "demander la suppression de votre compte et de vos données (sauf celles que la loi nous oblige à garder, comme la comptabilité) ;",
          "vous opposer à certains traitements ou en demander la limitation ;",
          "retirer votre consentement (par exemple désactiver les e-mails et SMS facultatifs) ;",
          "recevoir vos données dans un format réutilisable (portabilité).",
        ],
      },
      {
        h: "11. Comment exercer vos droits",
        p: [
          `Écrivez à ${l.email} depuis l'adresse e-mail ou en indiquant le numéro de téléphone de votre compte. Nous répondons dans un délai d'un mois au maximum et pouvons vous demander de prouver votre identité.`,
          "Si notre réponse ne vous satisfait pas, vous pouvez saisir l'autorité camerounaise de protection des données personnelles ou, si vous êtes dans l'Union européenne, l'autorité de votre pays (en France, la CNIL).",
        ],
      },
      {
        h: "12. Modifications",
        p: ["Nous pouvons modifier cette politique, par exemple si nous ajoutons une fonctionnalité. La date en haut de la page indique la dernière version. Pour tout changement important, nous vous prévenons par notification ou par e-mail avant qu'il s'applique."],
      },
    ],
  };
}

function en(l: Legal): Policy {
  return {
    title: "Privacy policy",
    updated: "Last updated:",
    intro: [
      `Learn Quick is a platform for live English and French lessons, run by ${l.company}, ${l.address} (${l.registration}). We are responsible for your personal data.`,
      "This page explains what data we collect, why, who we share it with, how long we keep it and what your rights are. We follow Cameroon's Law No. 2024/017 of 23 December 2024 on the protection of personal data, Law No. 2010/012 on cybersecurity and cybercrime and, for people in the European Union, the GDPR.",
      `Questions: ${l.email}.`,
    ],
    sections: [
      {
        h: "1. The data we collect",
        table: {
          head: ["Data", "Who", "Why"],
          rows: [
            ["Name, email and/or phone number, password (stored in irreversible encrypted form), country, city, time zone, language", "Everyone", "Create and secure your account, send you verification codes"],
            ["If you use \"Continue with Google\": the name, email and photo of your Google account", "Everyone (optional)", "Sign you in without a password"],
            ["Languages you learn, levels, goals", "Students", "Suggest suitable teachers and exercises"],
            ["Photo, introduction video, biography, prices, availability, languages spoken", "Teachers", "Your public profile in the catalogue"],
            ["Identity document (front, back), selfie, degrees and certificates", "Teachers", "Check your identity and qualifications before your profile is published"],
            ["Mobile Money number, amounts, history of payments, refunds and withdrawals", "Students and teachers", "Take payment for lessons, refund, pay out earnings, keep accounts"],
            ["Bookings, classroom connection times, classroom chat, shared files, whiteboard, shared notes, the teacher's notes and homework", "Students and teachers", "Run the lessons, decide who is paid (attendance), handle disputes"],
            ["Messages between students and teachers", "Students and teachers", "Let you talk before and after lessons"],
            ["Reviews and ratings given after a lesson", "Students", "Inform other students (only your first name is shown)"],
            ["Answers to translation exercises, scores, practice certificates", "Students and teachers", "Correct your translations and track your progress"],
            ["IP address and technical connection information", "Everyone", "Security: limit sign-in attempts, prevent fraud"],
          ],
        },
        p: ["We don't ask for more than we need. We never collect your Mobile Money PIN: you approve payments on your own phone."],
      },
      {
        h: "2. Video lessons",
        list: [
          "Video and sound go directly between the student's and the teacher's browsers. They are encrypted and are not recorded or stored by Learn Quick.",
          "If a network blocks the direct connection, the call goes through a relay server (TURN) that passes on the encrypted data without being able to read it.",
          "The classroom chat, shared files, whiteboard and notes are saved with the lesson so you can look at them again.",
        ],
      },
      {
        h: "3. Why we use your data (legal bases)",
        list: [
          "To perform our contract with you: account, bookings, lessons, payments, messages, library.",
          "To meet our legal obligations: accounting, fraud prevention, answering the authorities.",
          "Our legitimate interest: platform security, teacher verification, preventing abuse, improving the service.",
          "Your consent: Google sign-in, optional emails and SMS (you can turn them off in Settings → Notifications).",
        ],
        p: ["We don't sell your data. We show no advertising and use no advertising trackers."],
      },
      {
        h: "4. What other users can see",
        list: [
          "A teacher's profile: name, photo, video, biography, prices, availability, reviews, badges. Never their identity documents or phone number.",
          "A student's review: only their first name, rating and comment.",
          "In messages, phone numbers, emails and links are hidden automatically until the student has paid for a first lesson with that teacher.",
        ],
      },
      {
        h: "5. Who we share your data with",
        p: ["Only with service providers that help us run Learn Quick, and only what they need:"],
        table: {
          head: ["Provider", "Role", "Data shared", "Country"],
          rows: [
            [l.host, "Hosting the site and the database", "All service data", "France (European Union)"],
            ["Campay", "MTN Mobile Money and Orange Money payments", "Phone number, amount, reference", "Cameroon"],
            ["MTN, Orange", "Mobile Money operators", "Phone number, amount", "Cameroon"],
            ["Resend", "Sending emails", "Email address, email content", "United States / European Union"],
            ["Africa's Talking", "Sending SMS (codes, reminders)", "Phone number, SMS content", "Kenya"],
            ["Anthropic (Claude)", "AI correction of translations", "The text to translate and your translation, without your name or contact details", "United States"],
            ["Google", "\"Continue with Google\" sign-in (if you choose it)", "Google sign-in data", "United States"],
            ["TURN provider", "Relaying video calls blocked by some networks", "Encrypted streams the relay cannot read", "Depends on the provider"],
          ],
        },
        list: [
          "Under its commercial terms, Anthropic does not use the texts sent by our service to train its models.",
          "We may also share data with the authorities when the law requires it.",
          "When data is transferred outside Cameroon, we choose providers that offer adequate security and confidentiality safeguards.",
        ],
      },
      {
        h: "6. How long we keep your data",
        table: {
          head: ["Data", "How long"],
          rows: [
            ["Teachers' identity documents and selfie", "Deleted automatically 90 days after the decision on the application"],
            ["Account and profile", "As long as the account exists, then deleted or anonymised within 30 days of account deletion"],
            ["Payments, refunds, withdrawals and accounting", "10 years (accounting obligation)"],
            ["Lessons, classroom chat, messages, reviews", "As long as the account exists; longer only while a dispute is open"],
            ["Security log (important actions)", "Up to 1 year"],
            ["Backups", "14 days, then deleted automatically"],
          ],
        },
      },
      {
        h: "7. How we protect your data",
        list: [
          "Encrypted connection (HTTPS) on the whole site.",
          "Passwords stored in irreversible encrypted form (bcrypt): nobody, including us, can read them.",
          "Identity documents, selfies, degrees and certificates encrypted (AES-256) on our servers and visible only to the team that reviews applications.",
          "Access limited by role, one-time verification codes, limits on sign-in attempts.",
          "Double-entry accounting that prevents a payment from being counted twice; payment notifications are always checked with Campay.",
          "A log of important team actions (approvals, suspensions, refunds).",
        ],
        p: ["No system is perfect. If a data breach puts you at risk, we will inform you and the competent authority within the time limits set by law."],
      },
      {
        h: "8. Cookies",
        p: ["We only use cookies that the site needs to work, which do not require consent:"],
        list: [
          "Session cookie: keeps you signed in (30 days at most).",
          "Language cookie: remembers whether you prefer French or English.",
        ],
      },
      {
        h: "9. Children",
        p: [
          "Accounts are for people aged 18 and over. For a child or teenager, a parent or guardian creates the account, books and pays for lessons, and accepts this policy on the child's behalf. We recommend that an adult is present or nearby during young children's lessons.",
          `If you think a minor has created an account without their parents' consent, write to ${l.email} and we will delete it.`,
        ],
      },
      {
        h: "10. Your rights",
        p: ["At any time you can:"],
        list: [
          "access your data and get a copy of it;",
          "have inaccurate data corrected (most of it can be changed in Settings);",
          "ask for your account and data to be deleted (except what the law requires us to keep, such as accounting records);",
          "object to some processing or ask for it to be limited;",
          "withdraw your consent (for example, turn off optional emails and SMS);",
          "receive your data in a reusable format (portability).",
        ],
      },
      {
        h: "11. How to use your rights",
        p: [
          `Write to ${l.email} from the email address of your account, or give your account's phone number. We reply within one month at most and may ask you to prove your identity.`,
          "If you are not satisfied with our answer, you can contact Cameroon's personal data protection authority or, if you are in the European Union, the authority in your country (in France, the CNIL).",
        ],
      },
      {
        h: "12. Changes",
        p: ["We may change this policy, for example when we add a feature. The date at the top of the page shows the latest version. For any important change, we will tell you by notification or email before it applies."],
      },
    ],
  };
}
