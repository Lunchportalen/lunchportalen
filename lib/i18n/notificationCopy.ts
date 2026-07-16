/**
 * FASE 11 — lokaliserte notifikasjonstekster (15/15 språk, edge-safe).
 *
 * Ansattbekreftelser bruker ANSATTES språk (profiles.preferred_locale);
 * provider-varsler bruker PROVIDERENS språk (provider_settings.locale).
 * Fail-closed: ukjent/tomt språk → nb. Ordre-ID-er, datoer og kanoniske
 * statuser oversettes aldri — kun meldingstekst.
 */

export type OrderNotificationCopy = {
  deliveredSubject: (date: string) => string;
  deliveredBody: (date: string) => string;
  dispatchedSubject: (date: string) => string;
  dispatchedBody: (orderId: string, date: string) => string;
};

const NB: OrderNotificationCopy = {
  deliveredSubject: (d) => `Lunsj levert – ${d} – Lunchportalen`,
  deliveredBody: (d) => `Hei,\n\nLunsjen din for ${d} er levert. God lunsj!\n\nMed vennlig hilsen\nLunchportalen`,
  dispatchedSubject: (d) => `Ordre ut for levering – ${d} – Lunchportalen`,
  dispatchedBody: (id, d) => `Ordre ${id} for ${d} er markert «Klar for levering» og er på vei ut.\n\nDenne meldingen er sendt automatisk fra Lunchportalen.`,
};

const COPY: Record<string, OrderNotificationCopy> = {
  nb: NB,
  en: {
    deliveredSubject: (d) => `Lunch delivered – ${d} – Lunchportalen`,
    deliveredBody: (d) => `Hi,\n\nYour lunch for ${d} has been delivered. Enjoy!\n\nBest regards\nLunchportalen`,
    dispatchedSubject: (d) => `Order out for delivery – ${d} – Lunchportalen`,
    dispatchedBody: (id, d) => `Order ${id} for ${d} has been marked "Ready for delivery" and is on its way.\n\nThis message was sent automatically by Lunchportalen.`,
  },
  sv: {
    deliveredSubject: (d) => `Lunch levererad – ${d} – Lunchportalen`,
    deliveredBody: (d) => `Hej,\n\nDin lunch för ${d} har levererats. Smaklig måltid!\n\nMed vänliga hälsningar\nLunchportalen`,
    dispatchedSubject: (d) => `Order ute för leverans – ${d} – Lunchportalen`,
    dispatchedBody: (id, d) => `Order ${id} för ${d} har markerats som "Klar för leverans" och är på väg.\n\nDetta meddelande skickades automatiskt från Lunchportalen.`,
  },
  da: {
    deliveredSubject: (d) => `Frokost leveret – ${d} – Lunchportalen`,
    deliveredBody: (d) => `Hej,\n\nDin frokost for ${d} er leveret. God frokost!\n\nMed venlig hilsen\nLunchportalen`,
    dispatchedSubject: (d) => `Ordre ude til levering – ${d} – Lunchportalen`,
    dispatchedBody: (id, d) => `Ordre ${id} for ${d} er markeret "Klar til levering" og er på vej.\n\nDenne besked er sendt automatisk fra Lunchportalen.`,
  },
  fi: {
    deliveredSubject: (d) => `Lounas toimitettu – ${d} – Lunchportalen`,
    deliveredBody: (d) => `Hei,\n\nLounaasi ${d} on toimitettu. Hyvää ruokahalua!\n\nYstävällisin terveisin\nLunchportalen`,
    dispatchedSubject: (d) => `Tilaus toimituksessa – ${d} – Lunchportalen`,
    dispatchedBody: (id, d) => `Tilaus ${id} päivälle ${d} on merkitty "Valmis toimitukseen" ja on matkalla.\n\nTämä viesti lähetettiin automaattisesti Lunchportalenista.`,
  },
  de: {
    deliveredSubject: (d) => `Mittagessen geliefert – ${d} – Lunchportalen`,
    deliveredBody: (d) => `Hallo,\n\nIhr Mittagessen für ${d} wurde geliefert. Guten Appetit!\n\nMit freundlichen Grüßen\nLunchportalen`,
    dispatchedSubject: (d) => `Bestellung in Zustellung – ${d} – Lunchportalen`,
    dispatchedBody: (id, d) => `Bestellung ${id} für ${d} wurde als "Lieferbereit" markiert und ist unterwegs.\n\nDiese Nachricht wurde automatisch von Lunchportalen gesendet.`,
  },
  fr: {
    deliveredSubject: (d) => `Déjeuner livré – ${d} – Lunchportalen`,
    deliveredBody: (d) => `Bonjour,\n\nVotre déjeuner du ${d} a été livré. Bon appétit !\n\nCordialement\nLunchportalen`,
    dispatchedSubject: (d) => `Commande en cours de livraison – ${d} – Lunchportalen`,
    dispatchedBody: (id, d) => `La commande ${id} du ${d} a été marquée « Prête pour la livraison » et est en route.\n\nCe message a été envoyé automatiquement par Lunchportalen.`,
  },
  es: {
    deliveredSubject: (d) => `Almuerzo entregado – ${d} – Lunchportalen`,
    deliveredBody: (d) => `Hola:\n\nTu almuerzo del ${d} ha sido entregado. ¡Buen provecho!\n\nAtentamente\nLunchportalen`,
    dispatchedSubject: (d) => `Pedido en reparto – ${d} – Lunchportalen`,
    dispatchedBody: (id, d) => `El pedido ${id} del ${d} se ha marcado como "Listo para entrega" y está en camino.\n\nEste mensaje se envió automáticamente desde Lunchportalen.`,
  },
  it: {
    deliveredSubject: (d) => `Pranzo consegnato – ${d} – Lunchportalen`,
    deliveredBody: (d) => `Ciao,\n\nIl tuo pranzo del ${d} è stato consegnato. Buon appetito!\n\nCordiali saluti\nLunchportalen`,
    dispatchedSubject: (d) => `Ordine in consegna – ${d} – Lunchportalen`,
    dispatchedBody: (id, d) => `L'ordine ${id} del ${d} è stato contrassegnato come "Pronto per la consegna" ed è in arrivo.\n\nQuesto messaggio è stato inviato automaticamente da Lunchportalen.`,
  },
  nl: {
    deliveredSubject: (d) => `Lunch bezorgd – ${d} – Lunchportalen`,
    deliveredBody: (d) => `Hallo,\n\nJe lunch voor ${d} is bezorgd. Eet smakelijk!\n\nMet vriendelijke groet\nLunchportalen`,
    dispatchedSubject: (d) => `Bestelling onderweg – ${d} – Lunchportalen`,
    dispatchedBody: (id, d) => `Bestelling ${id} voor ${d} is gemarkeerd als "Klaar voor bezorging" en is onderweg.\n\nDit bericht is automatisch verzonden door Lunchportalen.`,
  },
  pl: {
    deliveredSubject: (d) => `Lunch dostarczony – ${d} – Lunchportalen`,
    deliveredBody: (d) => `Cześć,\n\nTwój lunch na ${d} został dostarczony. Smacznego!\n\nZ poważaniem\nLunchportalen`,
    dispatchedSubject: (d) => `Zamówienie w dostawie – ${d} – Lunchportalen`,
    dispatchedBody: (id, d) => `Zamówienie ${id} na ${d} zostało oznaczone jako "Gotowe do dostawy" i jest w drodze.\n\nTa wiadomość została wysłana automatycznie przez Lunchportalen.`,
  },
  ro: {
    deliveredSubject: (d) => `Prânz livrat – ${d} – Lunchportalen`,
    deliveredBody: (d) => `Bună,\n\nPrânzul dvs. pentru ${d} a fost livrat. Poftă bună!\n\nCu stimă\nLunchportalen`,
    dispatchedSubject: (d) => `Comandă în livrare – ${d} – Lunchportalen`,
    dispatchedBody: (id, d) => `Comanda ${id} pentru ${d} a fost marcată "Gata de livrare" și este pe drum.\n\nAcest mesaj a fost trimis automat de Lunchportalen.`,
  },
  cs: {
    deliveredSubject: (d) => `Oběd doručen – ${d} – Lunchportalen`,
    deliveredBody: (d) => `Dobrý den,\n\nváš oběd na ${d} byl doručen. Dobrou chuť!\n\nS pozdravem\nLunchportalen`,
    dispatchedSubject: (d) => `Objednávka na cestě – ${d} – Lunchportalen`,
    dispatchedBody: (id, d) => `Objednávka ${id} na ${d} byla označena jako "Připraveno k doručení" a je na cestě.\n\nTato zpráva byla odeslána automaticky z Lunchportalen.`,
  },
  pt: {
    deliveredSubject: (d) => `Almoço entregue – ${d} – Lunchportalen`,
    deliveredBody: (d) => `Olá,\n\nO seu almoço de ${d} foi entregue. Bom apetite!\n\nCom os melhores cumprimentos\nLunchportalen`,
    dispatchedSubject: (d) => `Encomenda em entrega – ${d} – Lunchportalen`,
    dispatchedBody: (id, d) => `A encomenda ${id} de ${d} foi marcada como "Pronta para entrega" e está a caminho.\n\nEsta mensagem foi enviada automaticamente pela Lunchportalen.`,
  },
  el: {
    deliveredSubject: (d) => `Το γεύμα παραδόθηκε – ${d} – Lunchportalen`,
    deliveredBody: (d) => `Γεια σας,\n\nτο γεύμα σας για ${d} παραδόθηκε. Καλή όρεξη!\n\nΜε εκτίμηση\nLunchportalen`,
    dispatchedSubject: (d) => `Παραγγελία σε παράδοση – ${d} – Lunchportalen`,
    dispatchedBody: (id, d) => `Η παραγγελία ${id} για ${d} επισημάνθηκε ως «Έτοιμη για παράδοση» και είναι καθ' οδόν.\n\nΑυτό το μήνυμα στάλθηκε αυτόματα από το Lunchportalen.`,
  },
};

export const NOTIFICATION_COPY_LANGUAGES = Object.keys(COPY);

/** Fail-closed: ukjent/tomt språk → nb. Aksepterer både "de" og "de-DE". */
export function orderNotificationCopy(locale: string | null | undefined): OrderNotificationCopy {
  const key = String(locale ?? "").trim().toLowerCase().slice(0, 2);
  return COPY[key] ?? NB;
}
