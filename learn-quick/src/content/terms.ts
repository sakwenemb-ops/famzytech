import type { legalInfo } from "@/lib/legal";
import type { Block, Policy } from "./privacy";

type Legal = ReturnType<typeof legalInfo>;
/** Live platform rules (Admin → Settings), so the terms always match how the site works. */
export type Rules = {
  commissionPct: number;
  freeCancelHours: number;
  minBookingNoticeHours: number;
  slotHoldMinutes: number;
  escrowReleaseHours: number;
  minPayoutXaf: string; // already formatted, e.g. "5 000 FCFA"
  payoutRequiresApproval: boolean;
  lessonMinutes: number;
};

export function termsOfUse(locale: "en" | "fr", l: Legal, r: Rules): Policy {
  return locale === "fr" ? fr(l, r) : en(l, r);
}

function fr(l: Legal, r: Rules): Policy {
  const s: Block[] = [
    {
      h: "1. Qui nous sommes",
      p: [
        `Learn Quick est une plateforme qui met en relation des élèves et des enseignants indépendants pour des cours d'anglais et de français en direct, et propose une bibliothèque d'exercices de traduction. Elle est éditée par ${l.company}, ${l.address} (${l.registration}).`,
        "En créant un compte ou en utilisant le site, vous acceptez les présentes conditions et notre politique de confidentialité. Si vous n'êtes pas d'accord, n'utilisez pas Learn Quick.",
      ],
    },
    {
      h: "2. Votre compte",
      list: [
        "Vous devez avoir 18 ans ou plus. Pour un enfant ou un adolescent, c'est un parent ou un tuteur qui crée le compte, réserve, paie et reste responsable de son utilisation.",
        "Vos informations doivent être exactes. Un seul compte par personne.",
        "Gardez votre mot de passe secret. Vous êtes responsable de ce qui est fait avec votre compte ; prévenez-nous immédiatement en cas d'utilisation suspecte.",
        "Vous pouvez supprimer votre compte à tout moment dans Paramètres.",
      ],
    },
    {
      h: "3. Le rôle de Learn Quick",
      list: [
        "Les enseignants sont des professionnels indépendants, pas des salariés de Learn Quick. Ils fixent leurs prix et leurs horaires et sont responsables du contenu de leurs cours.",
        "Avant de publier un profil, nous vérifions l'identité de l'enseignant et examinons ses diplômes et sa vidéo. Nous ne garantissons pas un résultat d'apprentissage ni la réussite à un examen.",
        "Learn Quick encaisse les paiements, les garde jusqu'à ce que le cours ait lieu, puis verse sa part à l'enseignant.",
      ],
    },
    {
      h: "4. Réserver un cours",
      list: [
        `Un cours dure ${r.lessonMinutes} minutes. Les horaires sont affichés dans votre fuseau horaire.`,
        `Un cours se réserve au moins ${r.minBookingNoticeHours} heures à l'avance. Pendant le paiement, l'horaire choisi vous est réservé ${r.slotHoldMinutes} minutes.`,
        "Le cours d'essai, à prix réduit, n'est possible qu'une fois par enseignant.",
        "Les forfaits de 5, 10 ou 20 cours bénéficient de la remise affichée par l'enseignant. Les cours d'un forfait n'expirent pas et ne s'utilisent qu'avec cet enseignant.",
        "La réservation est confirmée quand le paiement est validé. Vous recevez une confirmation et un reçu.",
        "La salle de cours ouvre 10 minutes avant l'heure du cours. Il faut une connexion internet ; vous pouvez passer en audio seul si la connexion est faible.",
      ],
    },
    {
      h: "5. Prix et paiement",
      list: [
        "Les prix sont en francs CFA (FCFA), toutes charges de la plateforme comprises. Des frais de votre opérateur Mobile Money peuvent s'appliquer.",
        "Vous payez avec MTN Mobile Money ou Orange Money (par l'intermédiaire de Campay) ou avec le solde de votre portefeuille Learn Quick. Vous validez chaque paiement sur votre téléphone ; nous ne connaissons jamais votre code PIN.",
        "Un paiement non validé dans le temps imparti expire et l'horaire est libéré. Si un paiement arrive malgré tout, ou pour un montant différent, il est crédité sur votre portefeuille.",
        "Les remboursements sont versés sur votre portefeuille Learn Quick. Vous pouvez utiliser ce solde pour d'autres cours ou le retirer vers votre compte Mobile Money depuis la page Portefeuille.",
      ],
    },
    {
      h: "6. Annulations, changements d'horaire et absences",
      table: {
        head: ["Situation", "Ce qui se passe"],
        rows: [
          [`L'élève annule ou déplace le cours au moins ${r.freeCancelHours} heures avant`, "Gratuit : remboursement complet sur le portefeuille (ou cours rendu au forfait)"],
          [`L'élève annule moins de ${r.freeCancelHours} heures avant`, "Pas de remboursement : l'enseignant est payé, car il a réservé ce temps"],
          ["L'enseignant annule, à tout moment", "Remboursement complet de l'élève (ou cours rendu au forfait)"],
          ["L'enseignant ne se connecte pas au cours", "Remboursement complet de l'élève"],
          ["L'élève ne se connecte pas au cours", "L'enseignant est payé"],
        ],
      },
      p: ["La présence est enregistrée automatiquement par la salle de cours. Le déplacement d'un cours n'est possible que vers un horaire libre du même enseignant."],
    },
    {
      h: "7. Signaler un problème avec un cours",
      list: [
        `Si un cours s'est mal passé (cours écourté, problème technique important, comportement inapproprié), signalez-le depuis « Mes cours » dans les ${r.escrowReleaseHours} heures qui suivent la fin du cours.`,
        "Le paiement de l'enseignant reste bloqué pendant l'examen. L'enseignant peut donner sa version. Notre équipe consulte la présence, le chat et le compte rendu du cours.",
        "Nous décidons d'un remboursement total, de moitié ou d'aucun remboursement, et prévenons les deux parties avec une explication. Cette décision est prise de bonne foi ; si vous n'êtes pas d'accord, écrivez-nous.",
      ],
    },
    {
      h: "8. Règles pour les enseignants",
      list: [
        "Votre profil n'est publié qu'après la vérification de votre identité et l'approbation de votre candidature. Vos informations, diplômes et vidéo doivent être authentiques.",
        `Learn Quick prélève une commission de ${r.commissionPct} % sur le prix de chaque cours ; vous recevez le reste. Le taux est fixé au moment de la réservation.`,
        `Vos gains deviennent disponibles ${r.escrowReleaseHours} heures après la fin du cours, sauf si un problème est signalé. Retrait minimum : ${r.minPayoutXaf}${r.payoutRequiresApproval ? " ; chaque retrait est vérifié par notre équipe avant l'envoi" : ""}.`,
        "Vous êtes indépendant : vous déclarez vous-même vos revenus et payez les impôts et cotisations qui vous concernent.",
        "Soyez à l'heure, préparez vos cours et prévenez le plus tôt possible si vous devez annuler. Les absences et annulations répétées peuvent entraîner la suspension de votre profil.",
        "Avec les élèves mineurs, adoptez une attitude strictement professionnelle : cours uniquement dans la salle Learn Quick, aucune demande de coordonnées personnelles, aucun contact en dehors de la plateforme.",
      ],
    },
    {
      h: "9. Rester sur la plateforme",
      list: [
        "Les cours trouvés sur Learn Quick doivent être réservés et payés sur Learn Quick. Proposer ou accepter un paiement en dehors du site est interdit.",
        "Pour votre protection, les numéros de téléphone, e-mails et liens sont masqués dans les messages tant que l'élève n'a pas payé un premier cours avec l'enseignant.",
        "En dehors de la plateforme, nous ne pouvons ni vous rembourser, ni régler un litige, ni vérifier qui est en face de vous. Un contournement peut entraîner la suspension des deux comptes.",
      ],
    },
    {
      h: "10. Comportement",
      p: ["Sur Learn Quick, il est interdit de :"],
      list: [
        "harceler, menacer, insulter ou discriminer qui que ce soit ;",
        "partager des contenus illégaux, sexuels, violents ou haineux ;",
        "enregistrer, photographier ou diffuser un cours ou une personne sans son accord ;",
        "se faire passer pour quelqu'un d'autre, frauder, ou utiliser les moyens de paiement d'une autre personne ;",
        "tenter d'accéder aux comptes d'autres personnes ou de perturber le fonctionnement du site.",
      ],
    },
    {
      h: "11. La bibliothèque de traduction",
      list: [
        "La bibliothèque est gratuite pour les élèves et les enseignants.",
        "Les traductions libres peuvent être corrigées par une intelligence artificielle. Elle peut se tromper : utilisez ses corrections comme une aide, pas comme une vérité absolue.",
        "Le certificat d'entraînement atteste d'un résultat à un exercice Learn Quick. Ce n'est pas un diplôme officiel (comme le DELF, le TCF ou l'IELTS).",
      ],
    },
    {
      h: "12. Contenus et propriété intellectuelle",
      list: [
        "Vous restez propriétaire de ce que vous publiez (profil, vidéo, messages, supports de cours). Vous nous autorisez à l'afficher et à le stocker pour faire fonctionner le service, et uniquement pour cela.",
        "Le site, la marque Learn Quick et les exercices de la bibliothèque nous appartiennent. Vous pouvez les utiliser pour apprendre, pas les copier ou les revendre.",
        "Ne publiez que des contenus que vous avez le droit d'utiliser.",
      ],
    },
    {
      h: "13. Suspension et fermeture du compte",
      list: [
        "Nous pouvons suspendre un compte qui ne respecte pas ces conditions, avec effet immédiat si nécessaire pour protéger les utilisateurs. Les cours à venir sont alors annulés et les élèves remboursés.",
        "Vous pouvez supprimer votre compte dans Paramètres une fois vos cours à venir terminés ou annulés et votre solde retiré.",
        "Si votre enseignant quitte Learn Quick ou est suspendu, contactez-nous : les cours non utilisés de vos forfaits vous sont remboursés.",
      ],
    },
    {
      h: "14. Responsabilité",
      list: [
        "Nous faisons de notre mieux pour que le site fonctionne en permanence, mais des interruptions peuvent arriver (maintenance, panne d'internet ou d'un opérateur Mobile Money).",
        "Si un cours ne peut pas avoir lieu à cause de notre plateforme, nous vous remboursons ce cours. Sauf disposition légale contraire, notre responsabilité est limitée au montant que vous avez payé pour le cours concerné.",
        "Nous ne sommes pas responsables de la qualité de votre connexion internet, de votre appareil, ni des échanges qui ont lieu en dehors de Learn Quick.",
        "Rien dans ces conditions ne limite les droits que la loi vous accorde en tant que consommateur.",
      ],
    },
    {
      h: "15. Modifications",
      p: ["Nous pouvons modifier ces conditions, par exemple pour une nouvelle fonctionnalité ou un changement de la loi. Pour un changement important, nous vous prévenons au moins 15 jours à l'avance par notification ou par e-mail. Les cours déjà payés restent soumis aux règles en vigueur au moment de la réservation."],
    },
    {
      h: "16. Droit applicable et litiges",
      p: [
        "Ces conditions sont régies par le droit camerounais. En cas de désaccord, contactez-nous d'abord : nous cherchons toujours une solution amiable.",
        `À défaut d'accord, le litige sera porté devant les tribunaux compétents de ${l.court}, sauf règle légale contraire protégeant le consommateur.`,
      ],
    },
    {
      h: "17. Nous contacter",
      p: [`Questions, problème avec un cours ou un paiement : utilisez la page Contact ou écrivez à ${l.support}.`],
    },
  ];
  return {
    title: "Conditions d'utilisation",
    updated: "Dernière mise à jour :",
    intro: ["Ces conditions expliquent les règles de Learn Quick pour les élèves, les parents et les enseignants : réservations, paiements, annulations, remboursements et comportement. Elles sont écrites pour être lues : prenez quelques minutes."],
    sections: s,
  };
}

function en(l: Legal, r: Rules): Policy {
  const s: Block[] = [
    {
      h: "1. Who we are",
      p: [
        `Learn Quick is a platform that connects students with independent teachers for live English and French lessons, and offers a library of translation exercises. It is run by ${l.company}, ${l.address} (${l.registration}).`,
        "By creating an account or using the site, you accept these terms and our privacy policy. If you do not agree, please do not use Learn Quick.",
      ],
    },
    {
      h: "2. Your account",
      list: [
        "You must be 18 or older. For a child or teenager, a parent or guardian creates the account, books, pays and remains responsible for its use.",
        "Your information must be accurate. One account per person.",
        "Keep your password secret. You are responsible for what is done with your account; tell us at once if you see suspicious use.",
        "You can delete your account at any time in Settings.",
      ],
    },
    {
      h: "3. What Learn Quick does",
      list: [
        "Teachers are independent professionals, not Learn Quick employees. They set their own prices and hours and are responsible for the content of their lessons.",
        "Before a profile is published, we check the teacher's identity and review their qualifications and video. We do not guarantee a learning result or success in an exam.",
        "Learn Quick takes the payment, holds it until the lesson has taken place, then pays the teacher their share.",
      ],
    },
    {
      h: "4. Booking a lesson",
      list: [
        `A lesson lasts ${r.lessonMinutes} minutes. Times are shown in your own time zone.`,
        `Lessons must be booked at least ${r.minBookingNoticeHours} hours ahead. During payment, the chosen time is held for you for ${r.slotHoldMinutes} minutes.`,
        "The reduced-price trial lesson is available once per teacher.",
        "Packs of 5, 10 or 20 lessons get the discount shown by the teacher. Pack lessons do not expire and can only be used with that teacher.",
        "A booking is confirmed when the payment is approved. You receive a confirmation and a receipt.",
        "The classroom opens 10 minutes before the lesson. You need an internet connection; you can switch to audio only if the connection is weak.",
      ],
    },
    {
      h: "5. Prices and payment",
      list: [
        "Prices are in CFA francs (FCFA), including all platform charges. Your Mobile Money operator may charge its own fees.",
        "You pay with MTN Mobile Money or Orange Money (through Campay) or with your Learn Quick wallet balance. You approve each payment on your phone; we never know your PIN.",
        "A payment not approved in time expires and the time slot is released. If a payment still arrives, or for a different amount, it is credited to your wallet.",
        "Refunds go to your Learn Quick wallet. You can use that balance for other lessons or withdraw it to your Mobile Money account from the Wallet page.",
      ],
    },
    {
      h: "6. Cancellations, rescheduling and absences",
      table: {
        head: ["Situation", "What happens"],
        rows: [
          [`The student cancels or moves the lesson at least ${r.freeCancelHours} hours before`, "Free: full refund to the wallet (or the lesson goes back into the pack)"],
          [`The student cancels less than ${r.freeCancelHours} hours before`, "No refund: the teacher is paid, because they kept that time free"],
          ["The teacher cancels, at any time", "Full refund to the student (or the lesson goes back into the pack)"],
          ["The teacher does not join the lesson", "Full refund to the student"],
          ["The student does not join the lesson", "The teacher is paid"],
        ],
      },
      p: ["Attendance is recorded automatically by the classroom. A lesson can only be moved to another free time of the same teacher."],
    },
    {
      h: "7. Reporting a problem with a lesson",
      list: [
        `If a lesson went wrong (cut short, a serious technical problem, inappropriate behaviour), report it from "My lessons" within ${r.escrowReleaseHours} hours after the lesson ends.`,
        "The teacher's payment stays on hold during the review. The teacher can give their side. Our team looks at attendance, the chat and the lesson record.",
        "We decide on a full refund, a half refund or no refund, and tell both people with an explanation. The decision is made in good faith; if you disagree, write to us.",
      ],
    },
    {
      h: "8. Rules for teachers",
      list: [
        "Your profile is only published after your identity is checked and your application is approved. Your information, qualifications and video must be genuine.",
        `Learn Quick takes a ${r.commissionPct}% fee from the price of each lesson; you receive the rest. The rate is fixed at the time of booking.`,
        `Your earnings become available ${r.escrowReleaseHours} hours after the lesson ends, unless a problem is reported. Minimum withdrawal: ${r.minPayoutXaf}${r.payoutRequiresApproval ? "; each withdrawal is checked by our team before it is sent" : ""}.`,
        "You are self-employed: you declare your own income and pay the taxes and contributions that apply to you.",
        "Be on time, prepare your lessons and give as much notice as possible if you must cancel. Repeated absences and cancellations can lead to your profile being suspended.",
        "With students under 18, behave in a strictly professional way: lessons only in the Learn Quick classroom, never ask for personal contact details, no contact outside the platform.",
      ],
    },
    {
      h: "9. Staying on the platform",
      list: [
        "Lessons found on Learn Quick must be booked and paid on Learn Quick. Offering or accepting payment outside the site is not allowed.",
        "For your protection, phone numbers, emails and links are hidden in messages until the student has paid for a first lesson with the teacher.",
        "Outside the platform we cannot refund you, settle a dispute or check who you are dealing with. Going around the platform can lead to both accounts being suspended.",
      ],
    },
    {
      h: "10. Behaviour",
      p: ["On Learn Quick, you must not:"],
      list: [
        "harass, threaten, insult or discriminate against anyone;",
        "share illegal, sexual, violent or hateful content;",
        "record, photograph or share a lesson or a person without their consent;",
        "pretend to be someone else, commit fraud, or use someone else's means of payment;",
        "try to access other people's accounts or disrupt the site.",
      ],
    },
    {
      h: "11. The translation library",
      list: [
        "The library is free for students and teachers.",
        "Free translations may be corrected by artificial intelligence. It can make mistakes: use its corrections as help, not as absolute truth.",
        "The practice certificate shows a result in a Learn Quick exercise. It is not an official diploma (such as DELF, TCF or IELTS).",
      ],
    },
    {
      h: "12. Content and intellectual property",
      list: [
        "You keep ownership of what you post (profile, video, messages, lesson materials). You allow us to display and store it to run the service, and only for that.",
        "The site, the Learn Quick brand and the library exercises belong to us. You may use them to learn, not copy or resell them.",
        "Only post content you have the right to use.",
      ],
    },
    {
      h: "13. Suspension and closing your account",
      list: [
        "We may suspend an account that breaks these terms, immediately if needed to protect users. Upcoming lessons are then cancelled and students refunded.",
        "You can delete your account in Settings once your upcoming lessons are finished or cancelled and your balance has been withdrawn.",
        "If your teacher leaves Learn Quick or is suspended, contact us: unused lessons in your packs are refunded.",
      ],
    },
    {
      h: "14. Liability",
      list: [
        "We do our best to keep the site running at all times, but interruptions can happen (maintenance, internet or Mobile Money outages).",
        "If a lesson cannot take place because of our platform, we refund that lesson. Unless the law says otherwise, our liability is limited to the amount you paid for the lesson concerned.",
        "We are not responsible for the quality of your internet connection or device, or for dealings that take place outside Learn Quick.",
        "Nothing in these terms limits the rights the law gives you as a consumer.",
      ],
    },
    {
      h: "15. Changes",
      p: ["We may change these terms, for example for a new feature or a change in the law. For an important change, we tell you at least 15 days in advance by notification or email. Lessons already paid for keep the rules that applied when they were booked."],
    },
    {
      h: "16. Governing law and disputes",
      p: [
        "These terms are governed by the law of Cameroon. If you disagree with something, contact us first: we always look for a friendly solution.",
        `If we cannot agree, the dispute will go to the competent courts of ${l.court}, unless a legal rule protecting consumers says otherwise.`,
      ],
    },
    {
      h: "17. Contact us",
      p: [`Questions, or a problem with a lesson or a payment: use the Contact page or write to ${l.support}.`],
    },
  ];
  return {
    title: "Terms of use",
    updated: "Last updated:",
    intro: ["These terms explain the rules of Learn Quick for students, parents and teachers: bookings, payments, cancellations, refunds and behaviour. They are written to be read: please take a few minutes."],
    sections: s,
  };
}
