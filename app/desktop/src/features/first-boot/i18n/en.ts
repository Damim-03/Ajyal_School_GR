import type { Dict } from "./ar";

/**
 * English — يجب أن يُطابق `Dict` مفتاحاً بمفتاح.
 *
 * والتصريحُ `: Dict` لا `as Dict`: الأوّل يفحص، والثاني يُسكت الفحص.
 * ومفتاحٌ ناقصٌ هنا خطأُ ترجمةٍ لا خطأُ نوع — فليكن خطأَ نوعٍ أيضاً.
 */
export const en: Dict = {
  meta: { dir: "ltr", label: "English", locale: "en-GB" },

  common: {
    continue: "Continue",
    back: "Back",
    retry: "Try again",
    notNow: "Not now",
    saving: "Saving…",
    step: "Step",
    of: "of",
    optional: "Optional",
    required: "Required",
    detected: "Detected",
    notDetected: "Not detected",
    yes: "Yes",
    no: "No",
    enabled: "Enabled",
    disabled: "Disabled",
    eyebrow: "First boot",
    resuming: "Continue setting up NexSchool",
    welcomeBack: "Welcome back",
  },

  booting: {
    title: "NexSchool",
    checking: "Checking system state…",
    offline: "Can't reach the server",
    offlineHint: "Make sure the NexSchool server is running, then try again.",
  },

  welcome: {
    title: "Welcome",
    lead: "Let's get your system ready.",
    body: "A few short steps, and NexSchool is ready to work.",
    action: "Let's begin",
  },

  language: {
    title: "Choose your language",
    description: "The language NexSchool speaks.",
  },

  region: {
    title: "Region and time",
    description: "How NexSchool writes dates and keeps time.",
    country: "Country",
    timezone: "Time zone",
    dateFormat: "Date format",
    now: "Right now",
    detected: "Taken from your operating system — change it if you like",
  },

  network: {
    title: "Network",
    description: "Where does the NexSchool server run?",
    local: "Local",
    localHint: "Server and database live on this machine.",
    server: "Server on the network",
    serverHint: "Another machine in the institution hosts them.",
    host: "Server address",
    port: "Port",
    test: "Test connection",
    testing: "Testing…",
    database: "Database",
    schema: "Database schema",
    auth: "Authentication service",
    reachable: "Connected",
    unreachable: "No response",
    failed: "Couldn't reach a server at this address.",
    internetOptional:
      "Internet is not required — NexSchool runs inside your network.",
    /* Internet status — measured, not assumed */
    internet: "This machine's internet connection",
    internetChecking: "Checking…",
    internetOnline: "Connected",
    internetOffline: "No internet",
    internetOnlineHint:
      "This machine reaches the internet. NexSchool doesn't need it — it runs inside your network either way.",
    internetOfflineHint:
      "This machine can't reach the internet — and that's fine. NexSchool runs entirely inside your network.",
    internetRecheck: "Check again",
  },

  display: {
    title: "Display",
    description: "Fit NexSchool to your screen.",
    scale: "Interface scale",
    small: "Small",
    default: "Default",
    large: "Large",
    density: "Density",
    comfortable: "Comfortable",
    compact: "Compact",
    window: "Window",
    windowed: "Windowed",
    maximized: "Maximised",
    fullscreen: "Full screen",
    preview: "Preview",
    previewTitle: "Students",
    previewRow: "Year 3 group — Mathematics",
    previewHint: "This is how screens look with this choice.",
  },

  performance: {
    title: "Performance",
    description: "How should NexSchool behave in the background?",
    balanced: "Balanced",
    balancedHint: "Right for most machines.",
    performance: "Performance",
    performanceHint: "Faster data refresh and full responsiveness.",
    powerSaving: "Power saving",
    powerSavingHint: "Less background work and calmer motion.",
    refresh: "Data refresh",
    motion: "Motion",
    minute: "Every minute",
    fiveMinutes: "Every five minutes",
    quarterHour: "Every fifteen minutes",
    full: "Full",
    calm: "Calm",
    still: "Still",
  },

  terms: {
    title: "Terms of use",
    description: "Read, then agree to continue.",
    agree: "I agree to the terms.",
    action: "Accept and continue",
    version: "Version",
    tabs: { terms: "Terms", privacy: "Privacy", license: "Licence" },
  },

  update: {
    title: "NexSchool update",
    checking: "Checking for updates…",
    upToDate: "You're up to date.",
    notConfigured: "Automatic updates aren't configured for this installation.",
    notConfiguredHint:
      "Updates are installed manually by your provider. This does not block setup.",
    appVersion: "Application version",
    serverVersion: "Server version",
    mismatch: "The application and server versions differ.",
    mismatchHint:
      "Some screens may misbehave. Align both versions before daily use.",
    recheck: "Check again",
    available: "Update available",
    installing: "Installing…",
    doNotClose: "Do not close NexSchool.",
    restart: "NexSchool needs to restart to finish the update.",
  },

  devices: {
    title: "Devices",
    description: "Let's see what's connected to this machine.",
    searching: "Searching…",
    none: "No compatible devices detected — this is not an error.",
    keyboard: "Keyboard",
    pointer: "Mouse",
    documentPrinter: "Document printer",
    receiptPrinter: "Receipt printer",
    scanner: "Scanner",
    barcode: "Barcode reader",
    pressAnyKey: "Press any key to confirm",
    moveMouse: "Move the mouse to confirm",
    testPrint: "Test print",
    testScan: "Scan a code to test",
    scanned: "Read:",
    verified: "Verified",
    rescan: "Search again",
    optionalNote:
      "Optional devices can be set up later in Settings — they don't hold up setup.",
    browserNote: "Printer and scanner detection works in the desktop app only.",
  },

  administrator: {
    title: "Administrator",
    description: "Create the main account for this installation.",
    firstName: "First name",
    lastName: "Last name",
    username: "Username",
    email: "Email",
    password: "Password",
    confirm: "Confirm password",
    action: "Create account",
    rules: {
      length: "Ten characters or more",
      upper: "An uppercase letter",
      lower: "A lowercase letter",
      digit: "A number",
      symbol: "A special character",
      match: "Both entries match",
    },
    usernameHint: "Latin letters, digits and . _ - only",
    taken: "That username is taken — pick another.",
    role: "Role: System administrator — full permissions",
  },

  institution: {
    title: "Your institution",
    description: "The name shown in the header and on every printout.",
    name: "Institution name",
    shortName: "Short name",
    nameEn: "Latin name",
    phone: "Phone",
    email: "Email",
    address: "Address",
    logo: "Logo",
    logoAction: "Choose image",
    logoRemove: "Remove",
    logoHint: "PNG or JPG — can be added later.",
    later: "Subjects, teachers and groups come after setup.",
  },

  academicYear: {
    title: "Academic year",
    description: "The current year that sessions and fees are booked against.",
    name: "Year",
    start: "Starts",
    end: "Ends",
    sessions: "Sessions per month",
    sessionsHint: "The ceiling of each subject's attendance sheet.",
    why: "Sheets, invoices and settlements all depend on it — work can't start without one.",
  },

  privacy: {
    title: "Privacy",
    description: "What leaves this machine? Nothing.",
    noTelemetry: "No usage analytics",
    noTelemetryHint:
      "NexSchool sends no data outside your institution's network — not now, not in the background.",
    noCrash: "No external crash reports",
    noCrashHint: "Crashes are never uploaded to any remote server.",
    diagnostics: "Local error log",
    diagnosticsHint:
      "Keeps recent errors on this machine only, so a hard-to-describe fault can be read back. Clearable in one click.",
  },

  recovery: {
    title: "Recovery",
    description: "A phone number for the institution's contact.",
    phone: "Phone number",
    hint: "Kept as a contact reference — the system sends no messages to it.",
    optional: "Optional — can be added later in Settings.",
  },

  verification: {
    title: "Almost ready.",
    running: "Verifying the system…",
    okTitle: "Everything is in place.",
    failedTitle: "Setup cannot be completed.",
    failedLead: "Missing:",
    action: "Finish setup",
    fix: "Fix",
    checks: {
      database: "Database connection",
      schema: "Database schema",
      language: "Language",
      region: "Region and time zone",
      institution: "Institution identity",
      administrator: "Administrator account",
      role: "Role",
      permissions: "Permissions",
      terms: "Terms acceptance",
      academicYear: "Academic year",
      devices: "Device configuration",
      appVersion: "Application version",
    },
  },

  ready: {
    title: "You're ready.",
    lead: "Your workspace is ready to use.",
    action: "Enter NexSchool",
  },

  errors: {
    generic: "We couldn't save your settings.",
    network: "We couldn't reach the server.",
    outOfOrder: "Setup state changed — it has been re-read.",
    alreadyCompleted: "Setup is already complete.",
    deviceMissing: "A required device is not available.",
    verificationFailed: "Final verification did not pass.",
    tryAgain: "Try again.",
  },

  onboarding: {
    title: "Welcome to NexSchool",
    lead: "Your system is ready. Now let's build your institution.",
    progress: "Institution setup",
    continueSetup: "Continue setup",
    explore: "Explore NexSchool",
    dismiss: "Hide this panel",
    areas: {
      stages: "Education stages",
      levels: "Levels",
      subjects: "Subjects",
      teachers: "Teachers",
      groups: "Study groups",
      classrooms: "Classrooms",
      schedules: "Schedules",
      fees: "Tuition fees",
      policies: "Settlement policies",
      students: "Students",
    },
  },
};
