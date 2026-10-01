import { list, operatorLine, paragraph, type LegalContext, type LegalDocument } from './document';
import { formatLegalDay, ORDER_BUTTON_LABEL, TERMS_VERSION } from './offer';
import { CANCEL_PATH, TERMS_PATH, WITHDRAW_PATH, WITHDRAWAL_POLICY_PATH } from './withdrawal';

/**
 * Terms of service for KaufCheck Pro. Deliberately conservative: no
 * unilateral price changes, no consent by silence, liability limited only as
 * far as §§ 307, 309 Nr. 7 BGB allow, changes of the service only within
 * § 327r BGB.
 */
export function termsOfService({ operator, siteUrl }: LegalContext): LegalDocument {
  return {
    title: 'Allgemeine Geschäftsbedingungen für KaufCheck Pro',
    subtitle: `Stand: ${formatLegalDay(TERMS_VERSION)}`,
    sections: [
      {
        heading: '§ 1 Geltungsbereich und Anbieter',
        blocks: [
          paragraph(
            `(1) Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für den Vertrag über das kostenpflichtige Abonnement „KaufCheck Pro“, den du über die Website ${siteUrl} abschließt. Abweichende Bedingungen gelten nur, wenn wir ihnen ausdrücklich zustimmen.`,
          ),
          paragraph(
            `(2) Dein Vertragspartner ist ${operatorLine(operator)} („wir“). Über diese Kontaktdaten erreichst du uns auch mit Fragen und Beschwerden.`,
          ),
          paragraph(
            '(3) KaufCheck Pro bestellen kann, wer volljährig ist und seinen Wohnsitz in der Europäischen Union hat.',
          ),
          paragraph(
            '(4) Für die kostenlose Nutzung von KaufCheck ohne Pro gelten diese AGB nicht.',
          ),
        ],
      },
      {
        heading: '§ 2 Leistungen',
        blocks: [
          paragraph(
            '(1) KaufCheck wertet die Angaben aus Gebrauchtwagen-Inseraten aus, die du einfügst, und zeigt dir fehlende Angaben, Auffälligkeiten und Fragen an den Verkäufer. KaufCheck Pro erweitert den Umfang der Nutzung, zum Beispiel um mehr Prüfungen pro Monat. Den genauen Leistungsumfang nennen wir dir in der Bestellübersicht; wir schicken ihn dir mit der Vertragsbestätigung per E-Mail.',
          ),
          paragraph(
            '(2) Die Auswertungen entstehen automatisch aus den Angaben im jeweiligen Inserat. Sie sind Hinweise für deine eigene Prüfung und ersetzen weder eine Besichtigung noch eine technische Untersuchung oder eine Bewertung des Fahrzeugs. Für die Angaben im Inserat ist der jeweilige Verkäufer verantwortlich.',
          ),
          paragraph(
            '(3) KaufCheck Pro steht dir sofort nach Vertragsschluss in deinem KaufCheck-Konto zur Verfügung. Du brauchst dafür eine Internetverbindung und einen aktuellen Browser, etwa Chrome, Firefox, Safari oder Edge, mit aktiviertem JavaScript.',
          ),
          paragraph(
            '(4) Während der gesamten Vertragslaufzeit stellen wir dir die Aktualisierungen bereit, die nötig sind, damit KaufCheck Pro vertragsgemäß bleibt. Wartungsarbeiten oder Störungen können KaufCheck vorübergehend unterbrechen; wir halten solche Unterbrechungen so kurz wie möglich.',
          ),
        ],
      },
      {
        heading: '§ 3 Vertragsschluss',
        blocks: [
          paragraph(
            '(1) Die Darstellung von KaufCheck Pro auf unserer Website ist noch kein bindendes Angebot.',
          ),
          paragraph('(2) Der Vertrag kommt in diesen Schritten zustande:'),
          list([
            'Du meldest dich in deinem KaufCheck-Konto an und wählst auf der Seite „Pro“ die Schaltfläche „Weiter zur Bestellung“.',
            'In der Bestellübersicht siehst du Leistungsumfang, Preis, Laufzeit und Kündigungsbedingungen. Du akzeptierst diese AGB und verlangst, dass wir sofort nach Vertragsschluss mit der Leistung beginnen.',
            `Mit einem Klick auf „${ORDER_BUTTON_LABEL}“ gibst du ein verbindliches Angebot zum Abschluss des Vertrags ab. Den Eingang deiner Bestellung bestätigen wir dir sofort per E-Mail; diese Eingangsbestätigung ist noch keine Annahme.`,
            'Anschließend leiten wir dich zu unserem Zahlungsdienstleister Stripe weiter. Dort wählst du die Zahlungsart und gibst die Zahlung frei.',
            'Ist die Zahlung erfolgreich, nehmen wir dein Angebot an, indem wir dir den Vertragsschluss bestätigen – auf der Bestätigungsseite und per E-Mail. Damit ist der Vertrag geschlossen.',
          ]),
          paragraph(
            '(3) Brichst du die Zahlung bei Stripe ab oder gelingt sie nicht, kommt kein Vertrag zustande, und es entstehen dir keine Kosten.',
          ),
          paragraph(
            `(4) Bis zum Klick auf „${ORDER_BUTTON_LABEL}“ kannst du alle Angaben in der Bestellübersicht prüfen und die Bestellung jederzeit abbrechen, indem du die Seite verlässt. Möchtest du mit einem anderen Konto bestellen, meldest du dich ab und mit diesem Konto an. Bei Stripe kannst du deine Zahlungsangaben bis zur Freigabe der Zahlung ändern.`,
          ),
          paragraph('(5) Der Vertrag wird auf Deutsch geschlossen.'),
          paragraph(
            `(6) Wir speichern den Vertragstext, also deine Bestelldaten und diese AGB, und schicken ihn dir mit der Vertragsbestätigung per E-Mail. Auf der Website kannst du nach Vertragsschluss nur die jeweils aktuellen AGB unter ${siteUrl}${TERMS_PATH} abrufen, ausdrucken und speichern; bitte bewahre deshalb die E-Mail auf. Auf Anfrage schicken wir dir den Vertragstext erneut.`,
          ),
          paragraph('(7) Wir haben uns keinen besonderen Verhaltenskodizes unterworfen.'),
        ],
      },
      {
        heading: '§ 4 Preise und Zahlung',
        blocks: [
          paragraph(
            '(1) Es gilt der Preis, der dir in der Bestellübersicht angezeigt wird. Er ist ein Endpreis; ob er Umsatzsteuer enthält, steht in der Bestellübersicht. Weitere Kosten fallen nicht an.',
          ),
          paragraph(
            '(2) Der Preis ist monatlich im Voraus zu zahlen: zum ersten Mal bei Vertragsschluss, danach jeweils zu Beginn eines neuen Abrechnungsmonats. Ein Abrechnungsmonat beginnt am Tag des Vertragsschlusses und in den folgenden Monaten jeweils am entsprechenden Kalendertag.',
          ),
          paragraph(
            '(3) Die Zahlung wickelt für uns der Zahlungsdienstleister Stripe ab. Du kannst mit den Zahlungsarten zahlen, die auf der Seite „Pro“ genannt sind. Die monatlichen Beiträge zieht Stripe mit der Zahlungsart ein, die du bei der Bestellung gewählt oder später in deinem Konto unter „Abo verwalten“ hinterlegt hast.',
          ),
          paragraph(
            '(4) Gelingt ein Einzug nicht, versucht Stripe ihn in den folgenden Tagen erneut; KaufCheck Pro bleibt in dieser Zeit nutzbar. Gelingt der Einzug auch dann nicht, endet der Vertrag, und du nutzt KaufCheck kostenlos weiter.',
          ),
          paragraph(
            '(5) Den Preis eines laufenden Vertrags ändern wir nur, wenn du der Änderung ausdrücklich zustimmst.',
          ),
        ],
      },
      {
        heading: '§ 5 Laufzeit und Kündigung',
        blocks: [
          paragraph(
            '(1) Der Vertrag läuft auf unbestimmte Zeit und verlängert sich jeweils um einen Monat, solange ihn niemand kündigt. Die Mindestlaufzeit beträgt einen Monat.',
          ),
          paragraph(
            '(2) Du kannst jederzeit ohne Einhaltung einer Frist zum Ende des laufenden Abrechnungsmonats kündigen. KaufCheck Pro bleibt bis dahin nutzbar; für einen angebrochenen Abrechnungsmonat erstatten wir nichts. Nennst du in deiner Kündigung einen späteren Tag, endet der Vertrag mit Ablauf des Abrechnungsmonats, in den dieser Tag fällt. Nennst du keinen Zeitpunkt, endet der Vertrag zum frühestmöglichen Zeitpunkt.',
          ),
          paragraph(
            `(3) Kündigen kannst du über die Schaltfläche „Verträge hier kündigen“ am Ende jeder Seite (${siteUrl}${CANCEL_PATH}), in deinem Konto unter „Abo verwalten“ oder in Textform, etwa per E-Mail an ${operator.email}. Jede Kündigung bestätigen wir dir umgehend per E-Mail.`,
          ),
          paragraph(
            '(4) Wir können den Vertrag mit einer Frist von einem Monat zum Ende eines Abrechnungsmonats kündigen. Das Recht beider Seiten zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.',
          ),
          paragraph(
            '(5) Nach dem Ende des Vertrags nutzt du KaufCheck mit einem kostenlosen Konto weiter. Deine gespeicherten Angebote und Prüfungen bleiben erhalten; Funktionen, die nur KaufCheck Pro bietet, stehen dir dann nicht mehr zur Verfügung.',
          ),
          paragraph(
            '(6) Löschst du dein KaufCheck-Konto, endet ein laufender Vertrag mit der Löschung; für den bereits bezahlten Abrechnungsmonat erstatten wir nichts. Dein Widerrufsrecht bleibt davon unberührt.',
          ),
        ],
      },
      {
        heading: '§ 6 Widerrufsrecht',
        blocks: [
          paragraph(
            `Als Verbraucherin oder Verbraucher hast du ein gesetzliches Widerrufsrecht. Die Einzelheiten stehen in der Widerrufsbelehrung unter ${siteUrl}${WITHDRAWAL_POLICY_PATH}. Online widerrufen kannst du über die Schaltfläche „Vertrag widerrufen“ am Ende jeder Seite (${siteUrl}${WITHDRAW_PATH}).`,
          ),
        ],
      },
      {
        heading: '§ 7 Gewährleistung',
        blocks: [
          paragraph(
            `Für Mängel von KaufCheck Pro gelten die gesetzlichen Gewährleistungsrechte für digitale Produkte (§§ 327 ff. BGB). Mängel meldest du am einfachsten per E-Mail an ${operator.email}.`,
          ),
        ],
      },
      {
        heading: '§ 8 Haftung',
        blocks: [
          paragraph(
            '(1) Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung des Lebens, des Körpers oder der Gesundheit, nach dem Produkthaftungsgesetz und soweit wir eine Garantie übernommen haben.',
          ),
          paragraph(
            '(2) Verletzen wir leicht fahrlässig eine Pflicht, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung du regelmäßig vertrauen darfst (wesentliche Vertragspflicht), haften wir nur für den vorhersehbaren, vertragstypischen Schaden.',
          ),
          paragraph(
            '(3) Im Übrigen ist unsere Haftung für leicht fahrlässig verursachte Schäden ausgeschlossen.',
          ),
          paragraph(
            '(4) Diese Beschränkungen gelten auch zugunsten unserer Erfüllungsgehilfen. Sie betreffen nur Ansprüche auf Schadensersatz und auf Ersatz vergeblicher Aufwendungen; deine übrigen Rechte bei Mängeln, etwa auf Nacherfüllung, Minderung oder Beendigung des Vertrags, bleiben unberührt.',
          ),
        ],
      },
      {
        heading: '§ 9 Änderungen',
        blocks: [
          paragraph(
            '(1) Wir dürfen KaufCheck Pro über das hinaus ändern, was nötig ist, damit es vertragsgemäß bleibt, wenn es dafür einen triftigen Grund gibt – etwa neue technische Entwicklungen, eine geänderte Rechtslage oder geänderte Bedingungen von Dienstleistern, die wir für KaufCheck Pro einsetzen. Eine solche Änderung ist für dich kostenlos, und wir informieren dich klar und verständlich darüber (§ 327r BGB).',
          ),
          paragraph(
            '(2) Beeinträchtigt eine Änderung deinen Zugang zu KaufCheck Pro oder dessen Nutzung mehr als nur unerheblich, informieren wir dich rechtzeitig vorher per E-Mail über die Merkmale und den Zeitpunkt der Änderung und über dein Recht, den Vertrag innerhalb von 30 Tagen unentgeltlich zu beenden (§ 327r Abs. 2 bis 4 BGB).',
          ),
          paragraph(
            '(3) Diese AGB ändern wir für einen laufenden Vertrag nur, wenn du der Änderung zustimmst.',
          ),
        ],
      },
      {
        heading: '§ 10 Datenschutz',
        blocks: [
          paragraph(
            `Wie wir deine Daten verarbeiten, steht in der Datenschutzerklärung unter ${siteUrl}/datenschutz.`,
          ),
        ],
      },
      {
        heading: '§ 11 Streitbeilegung',
        blocks: [
          paragraph(
            'Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.',
          ),
        ],
      },
      {
        heading: '§ 12 Anwendbares Recht',
        blocks: [
          paragraph(
            'Es gilt deutsches Recht. Bist du Verbraucherin oder Verbraucher, gilt diese Rechtswahl nur, soweit dir dadurch nicht der Schutz entzogen wird, den dir die zwingenden Bestimmungen des Rechts des Staates gewähren, in dem du deinen gewöhnlichen Aufenthalt hast.',
          ),
        ],
      },
    ],
  };
}
