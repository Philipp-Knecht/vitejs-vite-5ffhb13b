# Development and test fixtures

Synthetic listing pages used when `LISTING_FETCH_MODE=fixtures` (development and
tests only – the configuration rejects this mode in production). They are **not
real listings**; names, phone numbers and e-mail addresses are fictional.

| Ad id (URL suffix) | Content |
| --- | --- |
| `2911111111` | BMW 530d Touring (private seller, contact data to test redaction) |
| `2912345678` | Audi A7 Sportback (mileage contradiction in the description) |
| `2913333333` | Mercedes-Benz E 350 d T-Modell (commercial seller) |
| `2919999999` | Block page as shown to blocked IP ranges → text fallback |
| `2918888888` | Listing no longer available |

Any other ad id behaves like a failed retrieval. Example URL:
`https://www.kleinanzeigen.de/s-anzeige/audi-a7/2912345678-216-3331`
