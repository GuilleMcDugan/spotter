// Spanish → English sound term translations
// ALL entries use \b word boundaries to prevent matching inside longer words
// Order: longer/compound phrases FIRST, then single words
const MAP: [RegExp, string][] = [
  // --- Compound phrases (must come before single-word matches) ---
  [/\bpaisaje sonoro\b/g, 'soundscape'],
  [/\bambiente sonoro\b/g, 'soundscape'],
  [/\baire acondicionado\b/g, 'air conditioning'],
  [/\btelefonon movil\b|\bmovil\b/g, 'mobile phone'],
  [/\bsala de estar\b/g, 'living room'],
  [/\bmañana temprana\b/g, 'early morning'],
  [/\bcaja de cambios\b/g, 'gearbox'],
  [/\bpaso a marcha\b/g, 'gear shift'],
  // --- Ambiences & environments ---
  [/\batmosfera\b|\batmósfera\b|\bambiental\b/g, 'ambience'],
  [/\bambiente\b/g, 'ambience'],
  [/\bexterior\b/g, 'outdoor'],
  [/\binterior\b/g, 'indoor'],
  [/\brural\b|\bcampo\b/g, 'rural'],
  [/\burbano\b|\bciudad\b/g, 'urban'],
  [/\bcalle\b/g, 'street'],
  [/\bbosque\b/g, 'forest'],
  [/\bocéano\b|\bocéano\b/g, 'ocean'],
  [/\bmar\b/g, 'sea'],
  [/\bplaya\b/g, 'beach'],
  [/\brio\b|\brío\b/g, 'river'],
  [/\blago\b/g, 'lake'],
  [/\bcueva\b/g, 'cave'],
  // --- Time / weather ---
  [/\bamanecer\b/g, 'dawn'],
  [/\batardecer\b|\bocaso\b/g, 'dusk'],
  [/\bnoche\b/g, 'night'],
  [/\bmañana\b/g, 'morning'],
  [/\blluvioso\b|\blluvia\b/g, 'rain'],
  [/\btrueno\b/g, 'thunder'],
  [/\bviento\b/g, 'wind'],
  [/\bbrisa\b/g, 'breeze'],
  [/\bniebla\b|\bneblina\b/g, 'fog'],
  [/\bnieve\b/g, 'snow'],
  // --- Nature sounds ---
  [/\bpajaros\b|\bpájaros\b|\baves\b/g, 'birds'],
  [/\bhierba\b/g, 'grass'],
  [/\binsectos\b|\bgrillos\b/g, 'insects crickets'],
  [/\bperro\b/g, 'dog'],
  [/\bgato\b/g, 'cat'],
  [/\bcaballo\b/g, 'horse'],
  // --- People / social ---
  [/\bsilencio\b/g, 'silence'],
  [/\btrafico\b|\btráfico\b/g, 'traffic'],
  [/\bpasos\b|\bpisadas\b/g, 'footsteps'],
  [/\bmurmullo\b|\bmultitud\b/g, 'crowd murmur'],
  [/\bsusurro\b/g, 'whisper'],
  [/\bgritos\b|\bgrito\b|\bgritar\b/g, 'scream'],
  [/\bllanto\b|\bllorar\b/g, 'crying'],
  [/\brisa\b/g, 'laughter'],
  [/\baplausos\b|\baplauso\b/g, 'applause'],
  [/\bvoz\b|\bvoces\b/g, 'voice'],
  // --- Rooms & buildings ---
  [/\bsalon\b|\bsalón\b/g, 'living room'],
  [/\bcocina\b/g, 'kitchen'],
  [/\bbaño\b/g, 'bathroom'],
  [/\bpasillo\b|\bcorredor\b/g, 'corridor'],
  [/\bsotano\b|\bsótano\b/g, 'basement'],
  [/\balmacen\b|\balmacén\b/g, 'warehouse'],
  [/\bfabrica\b|\bfábrica\b/g, 'factory'],
  [/\boficina\b/g, 'office'],
  [/\bmercado\b/g, 'market'],
  [/\biglesia\b|\bcatedral\b/g, 'church'],
  [/\brestaurante\b/g, 'restaurant'],
  [/\bescuela\b|\bclase\b|\baula\b/g, 'classroom'],
  [/\bhospital\b/g, 'hospital'],
  [/\bbar\b/g, 'bar'],
  [/\bsala\b|\bhabitacion\b|\bcuarto\b/g, 'room'],
  // --- Actions & impacts ---
  [/\bpuerta\b/g, 'door'],
  [/\bgolpe\b|\bimpacto\b/g, 'thud impact'],
  [/\bexplosion\b|\bexplosión\b/g, 'explosion'],
  [/\bdisparo\b|\bpistola\b/g, 'gunshot'],
  [/\bcrujido\b|\bcrujir\b/g, 'creak'],
  [/\brotura\b|\bromper\b/g, 'breaking'],
  [/\bacelerando\b|\baceleracion\b|\baceleración\b/g, 'accelerating'],
  [/\bfrenando\b|\bfrenada\b/g, 'braking'],
  [/\barranque\b/g, 'engine start'],
  [/\bmarcha\b/g, 'gear'],
  // --- Objects ---
  [/\bteclado\b/g, 'keyboard typing'],
  [/\btelefono\b|\bteléfono\b/g, 'telephone'],
  [/\breloj\b/g, 'clock ticking'],
  [/\bcristal\b|\bvidrio\b/g, 'glass'],
  [/\bmadera\b/g, 'wood'],
  [/\bmetal\b/g, 'metal'],
  [/\bpapel\b/g, 'paper'],
  [/\bfluorescente\b/g, 'fluorescent hum'],
  // --- Vehicles (specific first, then general) ---
  [/\bfurgoneta\b|\bfurgon\b/g, 'van'],
  [/\bcamioneta\b/g, 'pickup truck'],
  [/\bautobús\b|\bautobus\b/g, 'bus'],
  [/\bmotocicleta\b|\bciclomotor\b/g, 'motorcycle'],
  [/\bavion\b|\bavión\b|\baereopuerto\b|\baereopuerto\b/g, 'airplane'],
  [/\bhelicoptero\b|\bhelicóptero\b/g, 'helicopter'],
  [/\btren\b/g, 'train'],
  [/\bbarco\b|\bpuerto\b/g, 'ship'],
  [/\bcoche\b|\bautomovil\b|\bautomóvil\b/g, 'car'],
  [/\bcamion\b|\bcamión\b/g, 'truck'],
  [/\bmoto\b/g, 'motorcycle'],
  [/\bsirena\b/g, 'siren'],
  [/\balarma\b/g, 'alarm'],
  // --- Electronics / appliances ---
  [/\bordenador\b|\bcomputadora\b/g, 'computer'],
  [/\bimpresora\b/g, 'printer'],
  [/\bnevera\b|\brefrigerador\b/g, 'refrigerator hum'],
  [/\blavadora\b/g, 'washing machine'],
  [/\bventilador\b/g, 'fan'],
  [/\bcampana\b/g, 'bell'],
  // --- General sounds ---
  [/\bmusica\b|\bmúsica\b|\bmelodia\b|\bmelodía\b/g, 'music'],
  [/\bmotor\b/g, 'engine'],
  [/\bagua\b|\bgoteo\b/g, 'water'],
  [/\bfuego\b|\bllamas\b/g, 'fire'],
  [/\bruido\b/g, 'noise'],
  [/\bzumbido\b/g, 'hum'],
  [/\beco\b/g, 'echo'],
  [/\btension\b|\btensión\b|\btenso\b/g, 'tension'],
  [/\binterrogatorio\b/g, 'interrogation'],
  [/\bcarnaval\b/g, 'carnival'],
  // --- Qualities ---
  [/\bdistante\b|\blejano\b/g, 'distant'],
  [/\bcercano\b/g, 'close'],
  [/\bsuave\b|\btenue\b/g, 'soft'],
  [/\bfuerte\b|\bintenso\b/g, 'loud'],
  [/\bgrave\b/g, 'low'],
  [/\bagudo\b/g, 'high pitched'],
  [/\bseco\b|\bseca\b/g, 'dry'],
  [/\bhumedo\b|\bhúmedo\b/g, 'wet'],
  [/\britimico\b|\brítmico\b/g, 'rhythmic'],
  [/\bcontinuo\b/g, 'continuous'],
  [/\bintermitente\b/g, 'intermittent'],
  [/\brapido\b|\brápido\b|\bveloz\b/g, 'fast'],
  [/\blento\b/g, 'slow'],
  // --- Misc context nouns ---
  [/\bfondo\b/g, 'background'],
  [/\bescena\b/g, 'scene'],
  [/\bentorno\b|\bescenario\b/g, 'environment'],
  [/\btono\b/g, 'tone'],
  [/\bpresencia\b/g, 'presence'],
  [/\bpersonas\b|\bpersona\b|\bgente\b/g, 'people'],
  [/\bespacio\b/g, 'space'],
]

// Spanish stop words that add no sound information
const ES_STOP =
  /\b(con|al|de|del|la|el|los|las|un|una|unos|unas|y|e|o|u|en|por|para|que|se|su|sus|este|esta|estos|estas|ese|esa|esos|esas|muy|más|mas|pero|como|cuando|donde|también|tambien|solo|sobre|entre|sin|hasta|desde|hacia|mientras|durante|aunque|ya|ya|aun|aún|todavía|todavia|hay|ser|estar|tener|hacer|puede|pueden|tiene|tienen|gran|grande|poco|algo|junto|cerca|lejos|siempre|nunca|apenas|ligero|ligera|ligeros|ligeras|leve|tipico|típico|tipica|típica|propio|propia|bajo|baja|alto|alta|medio|media|nuevo|nueva|viejo|vieja|otro|otra|mismo|misma|tipo|tipos|forma|manera|modo|nivel|zona|parte|lado|frase|linea|punto|vista|caso|vez|veces|hecho|cosa|cosas|hombre|mujer|hombres|mujeres|niño|niña|primer|primero|primera|segundo|segunda|paso|empuje|efecto|sonido)\b/g

export function toSoundQuery(description: string): string {
  let result = description.toLowerCase()

  // 1. Translate known Spanish sound terms to English (word-boundary safe)
  for (const [re, replacement] of MAP) {
    result = result.replace(re, replacement)
  }

  // 2. Strip punctuation
  result = result.replace(/[—–\-,;:.!?¡¿()[\]]/g, ' ')

  // 3. Remove Spanish stop words
  result = result.replace(ES_STOP, ' ')

  // 4. Remove any token still containing Spanish accented chars (= untranslated)
  result = result.replace(/\S*[áéíóúüñÁÉÍÓÚÜÑ]\S*/g, ' ')

  return result
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

export function shortenQuery(query: string): string {
  return query.split(' ').slice(0, 3).join(' ')
}
