import type { CarModel, Generation } from '@kaufcheck/catalog';
import { generationImage, type GenerationImage } from '@kaufcheck/catalog/images';
import { cn } from '../../lib/format';

const NEW_TAB = <span className="visually-hidden"> (öffnet in neuem Tab)</span>;

/** What the licence asks for: title, author, licence, what was changed, the file page. */
function Credit({ image }: { image: GenerationImage }) {
  return (
    <>
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
    </>
  );
}

/**
 * The photo of a generation with the credit its licence asks for. A generation without a
 * free photo gets an empty frame when others of the model have one. The credits of all
 * generations share one place, only the shown one visible: it is as high as the longest,
 * so the tabs below stay put.
 */
export function GenerationPhoto({
  model,
  generation,
}: {
  model: CarModel;
  generation: Generation;
}) {
  const credits = model.generations.flatMap((item) => {
    const image = generationImage(item.id);
    return image ? [{ id: item.id, image }] : [];
  });
  if (credits.length === 0) return null;
  const image = generationImage(generation.id);
  const Wrapper = image ? 'figure' : 'div';
  const Caption = image ? 'figcaption' : 'div';
  return (
    <Wrapper className="model-photo">
      {image ? (
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
      ) : (
        <div className="model-photo__frame model-photo__frame--empty">
          <p>Kein freies Foto dieser Generation</p>
        </div>
      )}
      <Caption className="model-photo__credits">
        {credits.map((credit) => (
          <span
            key={credit.id}
            className={cn('model-photo__credit', credit.id !== generation.id && 'is-hidden')}
          >
            <Credit image={credit.image} />
          </span>
        ))}
      </Caption>
    </Wrapper>
  );
}
