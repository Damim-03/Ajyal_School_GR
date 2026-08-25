/**
 * نصوصُ الشروط والخصوصية والرخصة — **نصوصُ NexSchool وحدها**.
 *
 * ولا سطرَ منقولٌ عن أيّ جهةٍ أخرى: هذه وثيقةُ هذا المنتَج، تصف ما
 * يفعله هذا البرنامجُ فعلاً — أنّه يعمل داخل شبكة المؤسسة، وأنّ
 * البيانات تبقى في قاعدتها، وأنّ النسخَ الاحتياطيَّ مسؤوليتُها.
 *
 * **وقصيرةٌ بقصد.** صفحاتٌ من العبارات الجاهزة لا يقرؤها أحد، ووثيقةٌ
 * لا تُقرأ لا تُنشئ موافقةً حقيقية. فما هنا ما يعني المؤسسةَ فعلاً.
 *
 * ورقمُ النسخة في `TERMS_VERSION` بالخادم — وهو ما يُحفظ مع الموافقة.
 * ورفعُه يعني نصّاً جديداً يجب أن يُعرض من جديد (§14)، فلا تُعدَّل
 * هذه النصوصُ إلّا مع رفعِه.
 */

import type { Language } from "../types/firstBoot.types";

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  terms: LegalSection[];
  privacy: LegalSection[];
  license: LegalSection[];
}

const AR: LegalDocument = {
  terms: [
    {
      heading: "نطاقُ الاستعمال",
      paragraphs: [
        "NexSchool برنامجُ إدارةٍ مدرسيةٍ يُركَّب داخل المؤسسة ويعمل على أجهزتها وشبكتها. ورخصةُ الاستعمال ممنوحةٌ للمؤسسة المذكورةِ في هذا التركيب دون غيرها.",
        "الاستعمالُ مقصورٌ على المخوَّلين من المؤسسة. وحسابُ المدير المُنشأُ في هذه التهيئة يملك الصلاحياتِ كاملةً، ومسؤوليةُ ما يُفعل به على صاحبه.",
      ],
    },
    {
      heading: "البياناتُ ومسؤوليتُها",
      paragraphs: [
        "كلُّ ما يُدخَل في البرنامج — الطلبةُ والأساتذةُ والحضورُ والمبالغُ — ملكُ المؤسسة، ويُحفظ في قاعدة بياناتها التي تديرها هي.",
        "النسخُ الاحتياطيُّ مسؤوليةُ المؤسسة. والبرنامجُ يوفّر أداةَ نسخٍ واستعادة في «الإعدادات ← الصيانة»، ولا يحتفظ بنسخةٍ خارج أجهزتها.",
        "دقّةُ البيانات الماليةِ والأكاديمية مسؤوليةُ من يُدخلها. والبرنامجُ يحسب ما يُملى عليه، ولا يُغني عن مراجعةِ من يملك القرار.",
      ],
    },
    {
      heading: "حدودُ الضمان",
      paragraphs: [
        "يُقدَّم البرنامجُ كما هو. ولا يضمن المزوِّدُ خلوَّه من كلّ خلل، ولا يتحمّل خسارةَ بياناتٍ نتجت عن عطبِ عتادٍ أو انقطاعِ تيّارٍ أو غيابِ نسخةٍ احتياطية.",
        "ولا يُسأل المزوِّدُ عن استعمالٍ مخالفٍ للقوانين المعمول بها في بلد المؤسسة.",
      ],
    },
  ],

  privacy: [
    {
      heading: "لا شيءَ يخرج من شبكتك",
      paragraphs: [
        "NexSchool لا يرسل بياناتِ المؤسسة إلى أيّ خادمٍ خارجيّ. ولا إحصاءاتِ استعمالٍ ولا تقاريرَ أعطالٍ تُرفع تلقائياً.",
        "الاتصالُ الوحيدُ الذي يُجريه البرنامجُ هو بين نافذتِه وخادمِه — وكلاهما داخل شبكة المؤسسة.",
      ],
    },
    {
      heading: "ما يُحفظ في الجهاز",
      paragraphs: [
        "يحفظ البرنامجُ في الجهاز تفضيلاتِه (اللغةُ والمقياسُ وعنوانُ الخادم والطابعةُ المختارة) لا بياناتِ الطلبة.",
        "وسِجلُّ الأعطالِ المحلّيُّ — إن فُعّل — يحفظ آخرَ الأخطاء في هذا الجهاز وحده، ويُمحى بإطفائه.",
      ],
    },
    {
      heading: "بياناتُ الأشخاص",
      paragraphs: [
        "تحفظ المؤسسةُ في البرنامج بياناتِ طلبةٍ وأساتذة، وبعضُها شخصيّ. والمؤسسةُ هي المسؤولةُ عن جمعها ومعالجتها وفقَ قوانين بلدها.",
        "وصلاحياتُ المستخدمين تُضبط من «الإعدادات ← الأدوار» لتقييد من يرى ماذا.",
      ],
    },
  ],

  license: [
    {
      heading: "الرخصة",
      paragraphs: [
        "تُمنح المؤسسةُ حقَّ استعمال البرنامج على أجهزتها لأغراض إدارتها التعليمية.",
        "ولا يجوز إعادةُ بيعه أو توزيعُه أو ترخيصُه من الباطن، ولا فكُّ تركيبه أو تعديلُه بغيرِ إذنٍ من المزوِّد.",
        "وتبقى حقوقُ الملكية الفكرية للبرنامج ولاسمه ولعلامته عائدةً إلى مالكه.",
      ],
    },
  ],
};

const EN: LegalDocument = {
  terms: [
    {
      heading: "Scope of use",
      paragraphs: [
        "NexSchool is school-management software installed inside your institution and running on its machines and network. The licence is granted to the institution named in this installation and to no other.",
        "Use is limited to people authorised by the institution. The administrator account created during this setup holds full permissions, and responsibility for what is done with it rests with its holder.",
      ],
    },
    {
      heading: "Data and responsibility",
      paragraphs: [
        "Everything entered into the software — students, teachers, attendance, amounts — belongs to the institution and is stored in the database it administers.",
        "Backups are the institution's responsibility. The software provides backup and restore tools under Settings → Maintenance, and keeps no copy outside your machines.",
        "The accuracy of financial and academic data is the responsibility of whoever enters it. The software computes what it is given; it does not replace review by whoever holds the decision.",
      ],
    },
    {
      heading: "Limits of warranty",
      paragraphs: [
        "The software is provided as is. The provider does not warrant that it is free of every defect, and is not liable for data loss caused by hardware failure, power interruption, or a missing backup.",
        "The provider is not answerable for use that breaches the laws in force in the institution's country.",
      ],
    },
  ],

  privacy: [
    {
      heading: "Nothing leaves your network",
      paragraphs: [
        "NexSchool sends no institutional data to any external server. No usage analytics and no crash reports are uploaded automatically.",
        "The only connection the software makes is between its window and its server — both inside your institution's network.",
      ],
    },
    {
      heading: "What is kept on this machine",
      paragraphs: [
        "The software stores its preferences locally (language, scale, server address, selected printer) — not student data.",
        "The local error log, if enabled, keeps recent errors on this machine only, and is erased when it is switched off.",
      ],
    },
    {
      heading: "Personal data",
      paragraphs: [
        "The institution stores student and teacher records in the software, some of them personal. The institution is responsible for collecting and processing them under the laws of its country.",
        "User permissions are configured under Settings → Roles to restrict who sees what.",
      ],
    },
  ],

  license: [
    {
      heading: "Licence",
      paragraphs: [
        "The institution is granted the right to use the software on its machines for the purposes of its educational administration.",
        "It may not be resold, redistributed, or sub-licensed, nor reverse-engineered or modified without the provider's permission.",
        "Intellectual property rights in the software, its name, and its mark remain with its owner.",
      ],
    },
  ],
};

const FR: LegalDocument = {
  terms: [
    {
      heading: "Portée de l'utilisation",
      paragraphs: [
        "NexSchool est un logiciel de gestion scolaire installé au sein de votre établissement et fonctionnant sur ses machines et son réseau. La licence est accordée à l'établissement désigné dans cette installation, et à nul autre.",
        "L'utilisation est réservée aux personnes autorisées par l'établissement. Le compte administrateur créé lors de cette configuration détient toutes les permissions ; la responsabilité de son usage incombe à son titulaire.",
      ],
    },
    {
      heading: "Données et responsabilité",
      paragraphs: [
        "Tout ce qui est saisi dans le logiciel — élèves, enseignants, présences, montants — appartient à l'établissement et réside dans la base de données qu'il administre.",
        "Les sauvegardes relèvent de l'établissement. Le logiciel fournit des outils de sauvegarde et de restauration dans Réglages → Maintenance, et ne conserve aucune copie hors de vos machines.",
        "L'exactitude des données financières et pédagogiques relève de celui qui les saisit. Le logiciel calcule ce qu'on lui donne ; il ne remplace pas la vérification par le décideur.",
      ],
    },
    {
      heading: "Limites de garantie",
      paragraphs: [
        "Le logiciel est fourni en l'état. Le fournisseur ne garantit pas l'absence de tout défaut et n'est pas responsable des pertes de données dues à une panne matérielle, une coupure de courant ou l'absence de sauvegarde.",
        "Le fournisseur n'est pas responsable d'un usage contraire aux lois en vigueur dans le pays de l'établissement.",
      ],
    },
  ],

  privacy: [
    {
      heading: "Rien ne quitte votre réseau",
      paragraphs: [
        "NexSchool n'envoie aucune donnée de l'établissement à un serveur externe. Aucune statistique d'usage ni rapport d'incident n'est transmis automatiquement.",
        "La seule connexion établie par le logiciel relie sa fenêtre à son serveur — tous deux sur le réseau de l'établissement.",
      ],
    },
    {
      heading: "Ce qui est conservé sur cette machine",
      paragraphs: [
        "Le logiciel conserve localement ses préférences (langue, échelle, adresse du serveur, imprimante choisie) — et non les données des élèves.",
        "Le journal d'erreurs local, s'il est activé, conserve les erreurs récentes sur cette machine uniquement ; il est effacé à sa désactivation.",
      ],
    },
    {
      heading: "Données personnelles",
      paragraphs: [
        "L'établissement enregistre dans le logiciel des données d'élèves et d'enseignants, dont certaines sont personnelles. Il lui revient de les collecter et de les traiter conformément aux lois de son pays.",
        "Les permissions se règlent dans Réglages → Rôles afin de restreindre qui voit quoi.",
      ],
    },
  ],

  license: [
    {
      heading: "Licence",
      paragraphs: [
        "L'établissement reçoit le droit d'utiliser le logiciel sur ses machines pour les besoins de son administration pédagogique.",
        "Il ne peut être revendu, redistribué ni sous-licencié, ni désassemblé ou modifié sans l'accord du fournisseur.",
        "Les droits de propriété intellectuelle sur le logiciel, son nom et sa marque demeurent à son propriétaire.",
      ],
    },
  ],
};

export const LEGAL: Record<Language, LegalDocument> = {
  ar: AR,
  en: EN,
  fr: FR,
};
