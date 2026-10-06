/** How to copy the text of a listing – the fallback when automatic retrieval is not possible. */
export function CopyTextHelp() {
  return (
    <div className="copy-help">
      <p className="copy-help__intro">
        So geht es bei mobile.de, AutoScout24, Kleinanzeigen, eBay und jeder anderen Seite.
      </p>
      <div>
        <p className="copy-help__title">Am Computer</p>
        <ol>
          <li>Öffne das Inserat im Browser.</li>
          <li>
            Markiere die ganze Seite mit <kbd>Strg</kbd> + <kbd>A</kbd> (Mac: <kbd>⌘</kbd> +{' '}
            <kbd>A</kbd>) und kopiere sie mit <kbd>Strg</kbd> + <kbd>C</kbd>.
          </li>
          <li>Füge den Text hier ein. Überflüssiges wie Menüs darf mit drin sein.</li>
        </ol>
      </div>
      <div>
        <p className="copy-help__title">Am Smartphone</p>
        <ol>
          <li>
            Öffne das Inserat im Browser, nicht in der App – in den Apps lässt sich der Text meist
            nicht markieren. Den Link bekommst du in der App über „Teilen“.
          </li>
          <li>Tippe lange auf den Text, wähle „Alles auswählen“ und dann „Kopieren“.</li>
          <li>Füge den Text hier ein.</li>
        </ol>
      </div>
    </div>
  );
}
