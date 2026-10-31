import type { CarModel, Generation } from '@kaufcheck/catalog';
import { generationImage } from '@kaufcheck/catalog/images';

const NEW_TAB = <span className="visually-hidden"> (öffnet in neuem Tab)</span>;

/**
 * The photo of a generation with the credit its licence asks for. A generation without a
 * free photo gets an empty frame when others of the model have one, so the tabs stay put.
 */
export function GenerationPhoto({
  model,
  generation,
}: {
  model: CarModel;
  generation: Generation;
}) {
  const image = generationImage(generation.id);
  if (!image) {
    if (!model.generations.some((item) => generationImage(item.id))) return null;
    return (
      <div className="model-photo">
        <div className="model-photo__frame model-photo__frame--empty">
          <p>Kein freies Foto dieser Generation</p>
        </div>
        <p className="model-photo__credit" />
      </div>
    );
  }
  return (
    <figure className="model-photo">
      <div className="model-photo__frame">
        <img
          src={image.src}
          width={image.width}
          height={image.height}
          alt={`${model.make} ${model.model}, Generation ${generation.name}`}
          fetchPriority="high"
          decoding="async"
        />
      </div>
      <figcaption className="model-photo__credit">
        Foto „{image.title}“ von {image.author},{' '}
        {image.licenseUrl ? (
          <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer license">
            {image.license}
            {NEW_TAB}
          </a>
        ) : (
          image.license
        )}
        , verkleinert
        {image.platesHidden &&
          `, Kennzeichen unkenntlich gemacht${image.shareAlike ? ', Bearbeitung unter derselben Lizenz' : ''}`}{' '}
        –{' '}
        <a href={image.source} target="_blank" rel="noopener noreferrer">
          Wikimedia Commons
          {NEW_TAB}
        </a>
      </figcaption>
    </figure>
  );
}
