/**
 * Makes offered in the search. `id` is KaufCheck's own slug (search URLs, model pages);
 * the platform codes are what each marketplace expects in its own search links.
 */
export interface Make {
  id: string;
  name: string;
  /** Make in the platforms' URLs (AutoScout24 lists, mobile.de and Autohero model pages). */
  platformSlug: string;
  /** Numeric make id in mobile.de search links (`ms=<id>;;;`), only where confirmed. */
  mobileDe?: number;
  /** Value of `autos.marke_s` on Kleinanzeigen, only where confirmed. */
  kleinanzeigen?: string;
}

export const MAKES: readonly Make[] = [
  {
    id: 'vw',
    name: 'Volkswagen',
    platformSlug: 'volkswagen',
    mobileDe: 25200,
    kleinanzeigen: 'volkswagen',
  },
  { id: 'mercedes', name: 'Mercedes-Benz', platformSlug: 'mercedes-benz', mobileDe: 17200 },
  { id: 'bmw', name: 'BMW', platformSlug: 'bmw', mobileDe: 3500, kleinanzeigen: 'bmw' },
  { id: 'audi', name: 'Audi', platformSlug: 'audi' },
  { id: 'opel', name: 'Opel', platformSlug: 'opel', mobileDe: 19000 },
  { id: 'ford', name: 'Ford', platformSlug: 'ford' },
  { id: 'skoda', name: 'Škoda', platformSlug: 'skoda' },
  { id: 'seat', name: 'Seat', platformSlug: 'seat' },
  { id: 'cupra', name: 'Cupra', platformSlug: 'cupra' },
  { id: 'renault', name: 'Renault', platformSlug: 'renault' },
  { id: 'dacia', name: 'Dacia', platformSlug: 'dacia' },
  { id: 'peugeot', name: 'Peugeot', platformSlug: 'peugeot' },
  { id: 'citroen', name: 'Citroën', platformSlug: 'citroen' },
  { id: 'fiat', name: 'Fiat', platformSlug: 'fiat' },
  { id: 'toyota', name: 'Toyota', platformSlug: 'toyota' },
  { id: 'hyundai', name: 'Hyundai', platformSlug: 'hyundai' },
  { id: 'kia', name: 'Kia', platformSlug: 'kia' },
  { id: 'nissan', name: 'Nissan', platformSlug: 'nissan' },
  { id: 'mazda', name: 'Mazda', platformSlug: 'mazda' },
  { id: 'volvo', name: 'Volvo', platformSlug: 'volvo' },
  { id: 'mini', name: 'MINI', platformSlug: 'mini' },
  { id: 'smart', name: 'smart', platformSlug: 'smart' },
  { id: 'suzuki', name: 'Suzuki', platformSlug: 'suzuki' },
  { id: 'honda', name: 'Honda', platformSlug: 'honda' },
  { id: 'tesla', name: 'Tesla', platformSlug: 'tesla', kleinanzeigen: 'tesla' },
  { id: 'mitsubishi', name: 'Mitsubishi', platformSlug: 'mitsubishi' },
  { id: 'jeep', name: 'Jeep', platformSlug: 'jeep' },
  { id: 'porsche', name: 'Porsche', platformSlug: 'porsche' },
  { id: 'land-rover', name: 'Land Rover', platformSlug: 'land-rover' },
  { id: 'alfa-romeo', name: 'Alfa Romeo', platformSlug: 'alfa-romeo' },
  { id: 'mg', name: 'MG', platformSlug: 'mg' },
  { id: 'ds', name: 'DS Automobiles', platformSlug: 'ds-automobiles' },
  { id: 'jaguar', name: 'Jaguar', platformSlug: 'jaguar' },
  { id: 'lexus', name: 'Lexus', platformSlug: 'lexus' },
  { id: 'subaru', name: 'Subaru', platformSlug: 'subaru' },
  { id: 'byd', name: 'BYD', platformSlug: 'byd' },
  { id: 'polestar', name: 'Polestar', platformSlug: 'polestar' },
];

const BY_ID = new Map(MAKES.map((make) => [make.id, make]));

export function makeById(id: string | null | undefined): Make | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}
