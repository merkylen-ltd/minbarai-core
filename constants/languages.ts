/**
 * Language Constants
 * Shared language mappings and configurations
 */

// Type definitions
export interface LanguagePair {
  source: string;
  target: string;
}

export interface LanguageConfig {
  code: string;
  name: string;
  speechRecognitionCode?: string;
  family: LanguageFamily;
  isRTL: boolean;
}

export type LanguageFamily = 'arabic' | 'chinese' | 'cyrillic' | 'devanagari' | 'greek' | 'hebrew' | 'latin' | 'thai';

// Language code to full name mapping (200+ languages)
export const LANGUAGE_NAMES: Record<string, string> = {
  // Major Languages
  ar: 'Arabic',
  en: 'English',
  zh: 'Chinese',
  hi: 'Hindi',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ru: 'Russian',
  ja: 'Japanese',
  pt: 'Portuguese',
  it: 'Italian',
  ko: 'Korean',
  tr: 'Turkish',
  nl: 'Dutch',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  fi: 'Finnish',
  pl: 'Polish',
  cs: 'Czech',
  hu: 'Hungarian',
  ro: 'Romanian',
  bg: 'Bulgarian',
  hr: 'Croatian',
  sk: 'Slovak',
  sl: 'Slovenian',
  et: 'Estonian',
  lv: 'Latvian',
  lt: 'Lithuanian',
  el: 'Greek',
  he: 'Hebrew',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ms: 'Malay',
  tl: 'Filipino',
  sw: 'Swahili',
  am: 'Amharic',
  ha: 'Hausa',
  yo: 'Yoruba',
  ig: 'Igbo',
  zu: 'Zulu',
  af: 'Afrikaans',
  sq: 'Albanian',
  hy: 'Armenian',
  az: 'Azerbaijani',
  eu: 'Basque',
  be: 'Belarusian',
  bn: 'Bengali',
  bs: 'Bosnian',
  ca: 'Catalan',
  ceb: 'Cebuano',
  ny: 'Chichewa',
  co: 'Corsican',
  cy: 'Welsh',
  eo: 'Esperanto',
  fa: 'Persian',
  fj: 'Fijian',
  gl: 'Galician',
  ka: 'Georgian',
  gu: 'Gujarati',
  ht: 'Haitian Creole',
  haw: 'Hawaiian',
  iw: 'Hebrew',
  hm: 'Hmong',
  is: 'Icelandic',
  ga: 'Irish',
  jw: 'Javanese',
  kn: 'Kannada',
  kk: 'Kazakh',
  km: 'Khmer',
  rw: 'Kinyarwanda',
  ky: 'Kyrgyz',
  lo: 'Lao',
  la: 'Latin',
  lb: 'Luxembourgish',
  mk: 'Macedonian',
  mg: 'Malagasy',
  ml: 'Malayalam',
  mt: 'Maltese',
  mi: 'Maori',
  mr: 'Marathi',
  mn: 'Mongolian',
  my: 'Myanmar (Burmese)',
  ne: 'Nepali',
  ps: 'Pashto',
  pa: 'Punjabi',
  sm: 'Samoan',
  gd: 'Scots Gaelic',
  sr: 'Serbian',
  st: 'Sesotho',
  sn: 'Shona',
  sd: 'Sindhi',
  si: 'Sinhala',
  so: 'Somali',
  su: 'Sundanese',
  tg: 'Tajik',
  ta: 'Tamil',
  te: 'Telugu',
  uk: 'Ukrainian',
  ur: 'Urdu',
  uz: 'Uzbek',
  xh: 'Xhosa',
  yi: 'Yiddish',
  // Additional languages
  aa: 'Afar',
  ab: 'Abkhazian',
  ae: 'Avestan',
  ak: 'Akan',
  an: 'Aragonese',
  av: 'Avaric',
  ay: 'Aymara',
  ba: 'Bashkir',
  bh: 'Bihari',
  bi: 'Bislama',
  bm: 'Bambara',
  bo: 'Tibetan',
  br: 'Breton',
  ch: 'Chamorro',
  cu: 'Church Slavic',
  cv: 'Chuvash',
  dv: 'Divehi',
  dz: 'Dzongkha',
  ee: 'Ewe',
  fo: 'Faroese',
  ff: 'Fulah',
  gn: 'Guarani',
  gv: 'Manx',
  hz: 'Herero',
  ia: 'Interlingua',
  ie: 'Interlingue',
  ik: 'Inupiaq',
  io: 'Ido',
  jv: 'Javanese',
  kg: 'Kongo',
  ki: 'Kikuyu',
  kj: 'Kuanyama',
  kr: 'Kanuri',
  ks: 'Kashmiri',
  ku: 'Kurdish',
  kv: 'Komi',
  kw: 'Cornish',
  lg: 'Ganda',
  li: 'Limburgish',
  ln: 'Lingala',
  lu: 'Luba-Katanga',
  mh: 'Marshallese',
  na: 'Nauru',
  ng: 'Ndonga',
  nn: 'Norwegian Nynorsk',
  nr: 'South Ndebele',
  nv: 'Navajo',
  oc: 'Occitan',
  oj: 'Ojibwa',
  om: 'Oromo',
  os: 'Ossetian',
  pi: 'Pali',
  qu: 'Quechua',
  rm: 'Romansh',
  rn: 'Rundi',
  sc: 'Sardinian',
  se: 'Northern Sami',
  sg: 'Sango',
  ss: 'Swati',
  ty: 'Tahitian',
  tw: 'Twi',
  ug: 'Uighur',
  ve: 'Venda',
  vo: 'Volapük',
  wa: 'Walloon',
  wo: 'Wolof',
  za: 'Zhuang',
  // Extended language support
  'zh-cn': 'Chinese (Simplified)',
  'zh-tw': 'Chinese (Traditional)',
  'pt-br': 'Portuguese (Brazil)',
  'pt-pt': 'Portuguese (Portugal)',
  'en-us': 'English (US)',
  'en-gb': 'English (UK)',
  'en-au': 'English (Australia)',
  'en-ca': 'English (Canada)',
  'es-es': 'Spanish (Spain)',
  'es-mx': 'Spanish (Mexico)',
  'es-ar': 'Spanish (Argentina)',
  'fr-fr': 'French (France)',
  'fr-ca': 'French (Canada)',
  'de-de': 'German (Germany)',
  'de-at': 'German (Austria)',
  'de-ch': 'German (Switzerland)',
  'it-it': 'Italian (Italy)',
  'it-ch': 'Italian (Switzerland)',
  'nl-nl': 'Dutch (Netherlands)',
  'nl-be': 'Dutch (Belgium)',
  'sv-se': 'Swedish (Sweden)',
  'sv-fi': 'Swedish (Finland)',
  'no-no': 'Norwegian (Norway)',
  'no-nb': 'Norwegian (Bokmål)',
  'no-nn': 'Norwegian (Nynorsk)',
  'da-dk': 'Danish (Denmark)',
  'fi-fi': 'Finnish (Finland)',
  'pl-pl': 'Polish (Poland)',
  'cs-cz': 'Czech (Czech Republic)',
  'hu-hu': 'Hungarian (Hungary)',
  'ro-ro': 'Romanian (Romania)',
  'bg-bg': 'Bulgarian (Bulgaria)',
  'hr-hr': 'Croatian (Croatia)',
  'sk-sk': 'Slovak (Slovakia)',
  'sl-si': 'Slovenian (Slovenia)',
  'et-ee': 'Estonian (Estonia)',
  'lv-lv': 'Latvian (Latvia)',
  'lt-lt': 'Lithuanian (Lithuania)',
  'el-gr': 'Greek (Greece)',
  'he-il': 'Hebrew (Israel)',
  'th-th': 'Thai (Thailand)',
  'vi-vn': 'Vietnamese (Vietnam)',
  'id-id': 'Indonesian (Indonesia)',
  'ms-my': 'Malay (Malaysia)',
  'tl-ph': 'Filipino (Philippines)',
  'sw-ke': 'Swahili (Kenya)',
  'am-et': 'Amharic (Ethiopia)',
  'ha-ng': 'Hausa (Nigeria)',
  'yo-ng': 'Yoruba (Nigeria)',
  'ig-ng': 'Igbo (Nigeria)',
  'zu-za': 'Zulu (South Africa)',
  'af-za': 'Afrikaans (South Africa)',
  'sq-al': 'Albanian (Albania)',
  'hy-am': 'Armenian (Armenia)',
  'az-az': 'Azerbaijani (Azerbaijan)',
  'eu-es': 'Basque (Spain)',
  'be-by': 'Belarusian (Belarus)',
  'bn-bd': 'Bengali (Bangladesh)',
  'bs-ba': 'Bosnian (Bosnia)',
  'ca-es': 'Catalan (Spain)',
  'ceb-ph': 'Cebuano (Philippines)',
  'ny-mw': 'Chichewa (Malawi)',
  'co-fr': 'Corsican (France)',
  'cy-gb': 'Welsh (UK)',
  'eo-xx': 'Esperanto',
  'fa-ir': 'Persian (Iran)',
  'fj-fj': 'Fijian (Fiji)',
  'gl-es': 'Galician (Spain)',
  'ka-ge': 'Georgian (Georgia)',
  'gu-in': 'Gujarati (India)',
  'ht-ht': 'Haitian Creole (Haiti)',
  'haw-us': 'Hawaiian (US)',
  'hm-vn': 'Hmong (Vietnam)',
  'is-is': 'Icelandic (Iceland)',
  'ga-ie': 'Irish (Ireland)',
  'jv-id': 'Javanese (Indonesia)',
  'kn-in': 'Kannada (India)',
  'kk-kz': 'Kazakh (Kazakhstan)',
  'km-kh': 'Khmer (Cambodia)',
  'rw-rw': 'Kinyarwanda (Rwanda)',
  'ky-kg': 'Kyrgyz (Kyrgyzstan)',
  'lo-la': 'Lao (Laos)',
  'la-va': 'Latin (Vatican)',
  'lb-lu': 'Luxembourgish (Luxembourg)',
  'mk-mk': 'Macedonian (Macedonia)',
  'mg-mg': 'Malagasy (Madagascar)',
  'ml-in': 'Malayalam (India)',
  'mt-mt': 'Maltese (Malta)',
  'mi-nz': 'Maori (New Zealand)',
  'mr-in': 'Marathi (India)',
  'mn-mn': 'Mongolian (Mongolia)',
  'my-mm': 'Myanmar (Burmese)',
  'ne-np': 'Nepali (Nepal)',
  'ps-af': 'Pashto (Afghanistan)',
  'pa-in': 'Punjabi (India)',
  'sm-ws': 'Samoan (Samoa)',
  'gd-gb': 'Scots Gaelic (UK)',
  'sr-rs': 'Serbian (Serbia)',
  'st-ls': 'Sesotho (Lesotho)',
  'sn-zw': 'Shona (Zimbabwe)',
  'sd-pk': 'Sindhi (Pakistan)',
  'si-lk': 'Sinhala (Sri Lanka)',
  'so-so': 'Somali (Somalia)',
  'su-id': 'Sundanese (Indonesia)',
  'tg-tj': 'Tajik (Tajikistan)',
  'ta-in': 'Tamil (India)',
  'te-in': 'Telugu (India)',
  'uk-ua': 'Ukrainian (Ukraine)',
  'ur-pk': 'Urdu (Pakistan)',
  'uz-uz': 'Uzbek (Uzbekistan)',
  'xh-za': 'Xhosa (South Africa)',
  'yi-xx': 'Yiddish'
};

// Speech recognition language codes (for browser compatibility and Google STT API)
export const SPEECH_RECOGNITION_LANGUAGES: Record<string, string> = {
  // Major Languages
  af: 'af-ZA',     // Afrikaans (South Africa)
  am: 'am-ET',     // Amharic (Ethiopia)
  ar: 'ar-SA',     // Arabic (Saudi Arabia)
  az: 'az-AZ',     // Azerbaijani (Azerbaijan)
  be: 'be-BY',     // Belarusian (Belarus)
  bg: 'bg-BG',     // Bulgarian (Bulgaria)
  bn: 'bn-BD',     // Bengali (Bangladesh)
  bs: 'bs-BA',     // Bosnian (Bosnia and Herzegovina)
  ca: 'ca-ES',     // Catalan (Spain)
  cs: 'cs-CZ',     // Czech (Czech Republic)
  cy: 'cy-GB',     // Welsh (UK)
  da: 'da-DK',     // Danish (Denmark)
  de: 'de-DE',     // German (Germany)
  el: 'el-GR',     // Greek (Greece)
  en: 'en-US',     // English (US)
  es: 'es-ES',     // Spanish (Spain)
  et: 'et-EE',     // Estonian (Estonia)
  eu: 'eu-ES',     // Basque (Spain)
  fa: 'fa-IR',     // Persian (Iran)
  fi: 'fi-FI',     // Finnish (Finland)
  fil: 'fil-PH',   // Filipino (Philippines)
  fr: 'fr-FR',     // French (France)
  gl: 'gl-ES',     // Galician (Spain)
  gu: 'gu-IN',     // Gujarati (India)
  he: 'he-IL',     // Hebrew (Israel)
  hi: 'hi-IN',     // Hindi (India)
  hr: 'hr-HR',     // Croatian (Croatia)
  hu: 'hu-HU',     // Hungarian (Hungary)
  hy: 'hy-AM',     // Armenian (Armenia)
  id: 'id-ID',     // Indonesian (Indonesia)
  is: 'is-IS',     // Icelandic (Iceland)
  it: 'it-IT',     // Italian (Italy)
  ja: 'ja-JP',     // Japanese (Japan)
  jv: 'jv-ID',     // Javanese (Indonesia)
  ka: 'ka-GE',     // Georgian (Georgia)
  kk: 'kk-KZ',     // Kazakh (Kazakhstan)
  km: 'km-KH',     // Khmer (Cambodia)
  kn: 'kn-IN',     // Kannada (India)
  ko: 'ko-KR',     // Korean (South Korea)
  lo: 'lo-LA',     // Lao (Laos)
  lt: 'lt-LT',     // Lithuanian (Lithuania)
  lv: 'lv-LV',     // Latvian (Latvia)
  mk: 'mk-MK',     // Macedonian (North Macedonia)
  ml: 'ml-IN',     // Malayalam (India)
  mn: 'mn-MN',     // Mongolian (Mongolia)
  mr: 'mr-IN',     // Marathi (India)
  ms: 'ms-MY',     // Malay (Malaysia)
  mt: 'mt-MT',     // Maltese (Malta)
  my: 'my-MM',     // Myanmar (Burmese)
  ne: 'ne-NP',     // Nepali (Nepal)
  nl: 'nl-NL',     // Dutch (Netherlands)
  no: 'nb-NO',     // Norwegian Bokmål (Norway)
  pa: 'pa-Guru-IN', // Punjabi (Gurmukhi India)
  pl: 'pl-PL',     // Polish (Poland)
  pt: 'pt-BR',     // Portuguese (Brazil)
  ro: 'ro-RO',     // Romanian (Romania)
  ru: 'ru-RU',     // Russian (Russia)
  si: 'si-LK',     // Sinhala (Sri Lanka)
  sk: 'sk-SK',     // Slovak (Slovakia)
  sl: 'sl-SI',     // Slovenian (Slovenia)
  sq: 'sq-AL',     // Albanian (Albania)
  sr: 'sr-RS',     // Serbian (Serbia)
  su: 'su-ID',     // Sundanese (Indonesia)
  sv: 'sv-SE',     // Swedish (Sweden)
  sw: 'sw-KE',     // Swahili (Kenya)
  ta: 'ta-IN',     // Tamil (India)
  te: 'te-IN',     // Telugu (India)
  th: 'th-TH',     // Thai (Thailand)
  tr: 'tr-TR',     // Turkish (Turkey)
  uk: 'uk-UA',     // Ukrainian (Ukraine)
  ur: 'ur-PK',     // Urdu (Pakistan)
  uz: 'uz-UZ',     // Uzbek (Uzbekistan)
  vi: 'vi-VN',     // Vietnamese (Vietnam)
  yue: 'yue-Hant-HK', // Chinese, Cantonese (Traditional Hong Kong)
  zh: 'zh-CN',     // Chinese, Mandarin (Simplified China)
  zu: 'zu-ZA',     // Zulu (South Africa)
  
  // Extended language variants for better coverage
  'ar-DZ': 'ar-DZ', // Arabic (Algeria)
  'ar-EG': 'ar-EG', // Arabic (Egypt)
  'ar-JO': 'ar-JO', // Arabic (Jordan)
  'ar-KW': 'ar-KW', // Arabic (Kuwait)
  'ar-LB': 'ar-LB', // Arabic (Lebanon)
  'ar-MA': 'ar-MA', // Arabic (Morocco)
  'ar-QA': 'ar-QA', // Arabic (Qatar)
  'ar-TN': 'ar-TN', // Arabic (Tunisia)
  'ar-AE': 'ar-AE', // Arabic (United Arab Emirates)
  'bn-IN': 'bn-IN', // Bengali (India)
  'en-AU': 'en-AU', // English (Australia)
  'en-CA': 'en-CA', // English (Canada)
  'en-GH': 'en-GH', // English (Ghana)
  'en-IN': 'en-IN', // English (India)
  'en-IE': 'en-IE', // English (Ireland)
  'en-KE': 'en-KE', // English (Kenya)
  'en-NZ': 'en-NZ', // English (New Zealand)
  'en-NG': 'en-NG', // English (Nigeria)
  'en-PH': 'en-PH', // English (Philippines)
  'en-ZA': 'en-ZA', // English (South Africa)
  'en-TZ': 'en-TZ', // English (Tanzania)
  'en-GB': 'en-GB', // English (United Kingdom)
  'es-AR': 'es-AR', // Spanish (Argentina)
  'es-BO': 'es-BO', // Spanish (Bolivia)
  'es-CL': 'es-CL', // Spanish (Chile)
  'es-CO': 'es-CO', // Spanish (Colombia)
  'es-CR': 'es-CR', // Spanish (Costa Rica)
  'es-DO': 'es-DO', // Spanish (Dominican Republic)
  'es-EC': 'es-EC', // Spanish (Ecuador)
  'es-SV': 'es-SV', // Spanish (El Salvador)
  'es-GT': 'es-GT', // Spanish (Guatemala)
  'es-HN': 'es-HN', // Spanish (Honduras)
  'es-MX': 'es-MX', // Spanish (Mexico)
  'es-NI': 'es-NI', // Spanish (Nicaragua)
  'es-PA': 'es-PA', // Spanish (Panama)
  'es-PY': 'es-PY', // Spanish (Paraguay)
  'es-PE': 'es-PE', // Spanish (Peru)
  'es-PR': 'es-PR', // Spanish (Puerto Rico)
  'es-US': 'es-US', // Spanish (United States)
  'es-UY': 'es-UY', // Spanish (Uruguay)
  'es-VE': 'es-VE', // Spanish (Venezuela)
  'fr-CA': 'fr-CA', // French (Canada)
  'pt-PT': 'pt-PT', // Portuguese (Portugal)
  'sw-TZ': 'sw-TZ', // Swahili (Tanzania)
  'ta-MY': 'ta-MY', // Tamil (Malaysia)
  'ta-SG': 'ta-SG', // Tamil (Singapore)
  'ta-LK': 'ta-LK', // Tamil (Sri Lanka)
  'ur-IN': 'ur-IN', // Urdu (India)
  'zh-TW': 'zh-TW'  // Chinese, Mandarin (Traditional Taiwan)
};

// Comprehensive supported language pairs for translation
export const SUPPORTED_LANGUAGE_PAIRS: LanguagePair[] = [
  // Arabic pairs
  { source: 'ar', target: 'de' }, { source: 'ar', target: 'en' }, { source: 'ar', target: 'fr' }, { source: 'ar', target: 'es' },
  { source: 'ar', target: 'it' }, { source: 'ar', target: 'pt' }, { source: 'ar', target: 'ru' }, { source: 'ar', target: 'zh' },
  { source: 'ar', target: 'ja' }, { source: 'ar', target: 'ko' }, { source: 'ar', target: 'hi' }, { source: 'ar', target: 'tr' },
  
  // English pairs
  { source: 'en', target: 'ar' }, { source: 'en', target: 'de' }, { source: 'en', target: 'fr' }, { source: 'en', target: 'es' },
  { source: 'en', target: 'it' }, { source: 'en', target: 'pt' }, { source: 'en', target: 'ru' }, { source: 'en', target: 'zh' },
  { source: 'en', target: 'ja' }, { source: 'en', target: 'ko' }, { source: 'en', target: 'hi' }, { source: 'en', target: 'tr' },
  { source: 'en', target: 'nl' }, { source: 'en', target: 'sv' }, { source: 'en', target: 'da' }, { source: 'en', target: 'no' },
  { source: 'en', target: 'fi' }, { source: 'en', target: 'pl' }, { source: 'en', target: 'cs' }, { source: 'en', target: 'hu' },
  
  // German pairs
  { source: 'de', target: 'ar' }, { source: 'de', target: 'en' }, { source: 'de', target: 'fr' }, { source: 'de', target: 'es' },
  { source: 'de', target: 'it' }, { source: 'de', target: 'pt' }, { source: 'de', target: 'ru' }, { source: 'de', target: 'nl' },
  
  // French pairs
  { source: 'fr', target: 'ar' }, { source: 'fr', target: 'en' }, { source: 'fr', target: 'de' }, { source: 'fr', target: 'es' },
  { source: 'fr', target: 'it' }, { source: 'fr', target: 'pt' }, { source: 'fr', target: 'ru' },
  
  // Spanish pairs
  { source: 'es', target: 'ar' }, { source: 'es', target: 'en' }, { source: 'es', target: 'de' }, { source: 'es', target: 'fr' },
  { source: 'es', target: 'it' }, { source: 'es', target: 'pt' }, { source: 'es', target: 'ru' },
  
  // Italian pairs
  { source: 'it', target: 'ar' }, { source: 'it', target: 'en' }, { source: 'it', target: 'de' }, { source: 'it', target: 'fr' },
  { source: 'it', target: 'es' }, { source: 'it', target: 'pt' }, { source: 'it', target: 'ru' },
  
  // Portuguese pairs
  { source: 'pt', target: 'ar' }, { source: 'pt', target: 'en' }, { source: 'pt', target: 'de' }, { source: 'pt', target: 'fr' },
  { source: 'pt', target: 'es' }, { source: 'pt', target: 'it' }, { source: 'pt', target: 'ru' },
  
  // Russian pairs
  { source: 'ru', target: 'ar' }, { source: 'ru', target: 'en' }, { source: 'ru', target: 'de' }, { source: 'ru', target: 'fr' },
  { source: 'ru', target: 'es' }, { source: 'ru', target: 'it' }, { source: 'ru', target: 'pt' },
  
  // Chinese pairs
  { source: 'zh', target: 'ar' }, { source: 'zh', target: 'en' }, { source: 'zh', target: 'de' }, { source: 'zh', target: 'fr' },
  { source: 'zh', target: 'es' }, { source: 'zh', target: 'it' }, { source: 'zh', target: 'pt' }, { source: 'zh', target: 'ru' },
  { source: 'zh', target: 'ja' }, { source: 'zh', target: 'ko' },
  
  // Japanese pairs
  { source: 'ja', target: 'ar' }, { source: 'ja', target: 'en' }, { source: 'ja', target: 'de' }, { source: 'ja', target: 'fr' },
  { source: 'ja', target: 'es' }, { source: 'ja', target: 'it' }, { source: 'ja', target: 'pt' }, { source: 'ja', target: 'ru' },
  { source: 'ja', target: 'zh' }, { source: 'ja', target: 'ko' },
  
  // Korean pairs
  { source: 'ko', target: 'ar' }, { source: 'ko', target: 'en' }, { source: 'ko', target: 'de' }, { source: 'ko', target: 'fr' },
  { source: 'ko', target: 'es' }, { source: 'ko', target: 'it' }, { source: 'ko', target: 'pt' }, { source: 'ko', target: 'ru' },
  { source: 'ko', target: 'zh' }, { source: 'ko', target: 'ja' },
  
  // Hindi pairs
  { source: 'hi', target: 'ar' }, { source: 'hi', target: 'en' }, { source: 'hi', target: 'de' }, { source: 'hi', target: 'fr' },
  { source: 'hi', target: 'es' }, { source: 'hi', target: 'it' }, { source: 'hi', target: 'pt' }, { source: 'hi', target: 'ru' },
  
  // Turkish pairs
  { source: 'tr', target: 'ar' }, { source: 'tr', target: 'en' }, { source: 'tr', target: 'de' }, { source: 'tr', target: 'fr' },
  { source: 'tr', target: 'es' }, { source: 'tr', target: 'it' }, { source: 'tr', target: 'pt' }, { source: 'tr', target: 'ru' },
  
  // Additional language pairs for comprehensive coverage
  { source: 'nl', target: 'en' }, { source: 'nl', target: 'de' }, { source: 'nl', target: 'fr' },
  { source: 'sv', target: 'en' }, { source: 'sv', target: 'de' }, { source: 'sv', target: 'no' }, { source: 'sv', target: 'da' },
  { source: 'da', target: 'en' }, { source: 'da', target: 'de' }, { source: 'da', target: 'sv' }, { source: 'da', target: 'no' },
  { source: 'no', target: 'en' }, { source: 'no', target: 'de' }, { source: 'no', target: 'sv' }, { source: 'no', target: 'da' },
  { source: 'fi', target: 'en' }, { source: 'fi', target: 'de' }, { source: 'fi', target: 'sv' },
  { source: 'pl', target: 'en' }, { source: 'pl', target: 'de' }, { source: 'pl', target: 'ru' },
  { source: 'cs', target: 'en' }, { source: 'cs', target: 'de' }, { source: 'cs', target: 'sk' },
  { source: 'hu', target: 'en' }, { source: 'hu', target: 'de' },
  { source: 'sk', target: 'en' }, { source: 'sk', target: 'de' }, { source: 'sk', target: 'cs' },
  { source: 'ro', target: 'en' }, { source: 'ro', target: 'de' }, { source: 'ro', target: 'fr' },
  { source: 'bg', target: 'en' }, { source: 'bg', target: 'de' }, { source: 'bg', target: 'ru' },
  { source: 'hr', target: 'en' }, { source: 'hr', target: 'de' }, { source: 'hr', target: 'sr' },
  { source: 'sr', target: 'en' }, { source: 'sr', target: 'de' }, { source: 'sr', target: 'hr' },
  { source: 'sl', target: 'en' }, { source: 'sl', target: 'de' }, { source: 'sl', target: 'it' },
  { source: 'et', target: 'en' }, { source: 'et', target: 'de' }, { source: 'et', target: 'ru' },
  { source: 'lv', target: 'en' }, { source: 'lv', target: 'de' }, { source: 'lv', target: 'ru' },
  { source: 'lt', target: 'en' }, { source: 'lt', target: 'de' }, { source: 'lt', target: 'ru' },
  { source: 'el', target: 'en' }, { source: 'el', target: 'de' }, { source: 'el', target: 'fr' },
  { source: 'he', target: 'en' }, { source: 'he', target: 'ar' }, { source: 'he', target: 'fr' },
  { source: 'th', target: 'en' }, { source: 'th', target: 'zh' },
  { source: 'vi', target: 'en' }, { source: 'vi', target: 'zh' }, { source: 'vi', target: 'fr' },
  { source: 'id', target: 'en' }, { source: 'id', target: 'ar' }, { source: 'id', target: 'ms' },
  { source: 'ms', target: 'en' }, { source: 'ms', target: 'ar' }, { source: 'ms', target: 'id' },
  { source: 'tl', target: 'en' }, { source: 'tl', target: 'es' },
  { source: 'sw', target: 'en' }, { source: 'sw', target: 'ar' }, { source: 'sw', target: 'fr' },
  { source: 'am', target: 'en' }, { source: 'am', target: 'ar' },
  { source: 'fa', target: 'en' }, { source: 'fa', target: 'ar' }, { source: 'fa', target: 'tr' },
  { source: 'ur', target: 'en' }, { source: 'ur', target: 'ar' }, { source: 'ur', target: 'hi' },
  { source: 'bn', target: 'en' }, { source: 'bn', target: 'hi' },
  { source: 'ta', target: 'en' }, { source: 'ta', target: 'hi' },
  { source: 'te', target: 'en' }, { source: 'te', target: 'hi' },
  { source: 'ml', target: 'en' }, { source: 'ml', target: 'hi' },
  { source: 'kn', target: 'en' }, { source: 'kn', target: 'hi' },
  { source: 'gu', target: 'en' }, { source: 'gu', target: 'hi' },
  { source: 'pa', target: 'en' }, { source: 'pa', target: 'hi' }, { source: 'pa', target: 'ur' },
  { source: 'mr', target: 'en' }, { source: 'mr', target: 'hi' },
  { source: 'ne', target: 'en' }, { source: 'ne', target: 'hi' },
  { source: 'si', target: 'en' }, { source: 'si', target: 'ta' },
  { source: 'my', target: 'en' }, { source: 'my', target: 'zh' },
  { source: 'km', target: 'en' }, { source: 'km', target: 'th' }, { source: 'km', target: 'vi' },
  { source: 'lo', target: 'en' }, { source: 'lo', target: 'th' }, { source: 'lo', target: 'vi' },
  { source: 'ka', target: 'en' }, { source: 'ka', target: 'ru' },
  { source: 'hy', target: 'en' }, { source: 'hy', target: 'ru' },
  { source: 'az', target: 'en' }, { source: 'az', target: 'ru' }, { source: 'az', target: 'tr' },
  { source: 'kk', target: 'en' }, { source: 'kk', target: 'ru' },
  { source: 'ky', target: 'en' }, { source: 'ky', target: 'ru' },
  { source: 'uz', target: 'en' }, { source: 'uz', target: 'ru' },
  { source: 'tg', target: 'en' }, { source: 'tg', target: 'ru' }, { source: 'tg', target: 'fa' },
  { source: 'mn', target: 'en' }, { source: 'mn', target: 'ru' }, { source: 'mn', target: 'zh' },
  { source: 'be', target: 'en' }, { source: 'be', target: 'ru' },
  { source: 'uk', target: 'en' }, { source: 'uk', target: 'ru' }, { source: 'uk', target: 'de' },
  { source: 'mk', target: 'en' }, { source: 'mk', target: 'de' }, { source: 'mk', target: 'bg' },
  { source: 'sq', target: 'en' }, { source: 'sq', target: 'de' }, { source: 'sq', target: 'it' },
  { source: 'bs', target: 'en' }, { source: 'bs', target: 'de' }, { source: 'bs', target: 'hr' }, { source: 'bs', target: 'sr' },
  { source: 'mt', target: 'en' }, { source: 'mt', target: 'it' }, { source: 'mt', target: 'ar' },
  { source: 'cy', target: 'en' }, { source: 'cy', target: 'de' },
  { source: 'ga', target: 'en' }, { source: 'ga', target: 'de' },
  { source: 'gd', target: 'en' }, { source: 'gd', target: 'de' },
  { source: 'is', target: 'en' }, { source: 'is', target: 'de' }, { source: 'is', target: 'da' }, { source: 'is', target: 'no' },
  { source: 'fo', target: 'en' }, { source: 'fo', target: 'da' },
  { source: 'eu', target: 'en' }, { source: 'eu', target: 'es' }, { source: 'eu', target: 'fr' },
  { source: 'ca', target: 'en' }, { source: 'ca', target: 'es' }, { source: 'ca', target: 'fr' },
  { source: 'gl', target: 'en' }, { source: 'gl', target: 'es' }, { source: 'gl', target: 'pt' },
  { source: 'af', target: 'en' }, { source: 'af', target: 'de' }, { source: 'af', target: 'nl' },
  { source: 'zu', target: 'en' }, { source: 'zu', target: 'af' },
  { source: 'xh', target: 'en' }, { source: 'xh', target: 'af' },
  { source: 'yo', target: 'en' }, { source: 'yo', target: 'fr' },
  { source: 'ig', target: 'en' }, { source: 'ig', target: 'fr' },
  { source: 'ha', target: 'en' }, { source: 'ha', target: 'ar' }, { source: 'ha', target: 'fr' }
];

// RTL (Right-to-Left) languages
export const RTL_LANGUAGES = new Set([
  'ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ku', 'dv', 'ug', 'yi'
]);

// Language families for font selection
export const LANGUAGE_FAMILIES: Record<LanguageFamily, string[]> = {
  // Arabic script languages
  arabic: ['ar', 'fa', 'ur', 'ps', 'sd', 'ku', 'dv', 'ug'],
  // Chinese script languages
  chinese: ['zh', 'zh-cn', 'zh-tw', 'ja', 'ko'],
  // Cyrillic script languages
  cyrillic: ['ru', 'bg', 'mk', 'sr', 'uk', 'be', 'kk', 'ky', 'mn', 'tg', 'uz'],
  // Devanagari script languages
  devanagari: ['hi', 'ne', 'mr', 'sa'],
  // Greek script languages
  greek: ['el'],
  // Hebrew script languages
  hebrew: ['he', 'yi'],
  // Thai script languages
  thai: ['th'],
  // Latin script languages (default)
  latin: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'da', 'no', 'fi', 'pl', 'cs', 'hu', 'ro', 'hr', 'sk', 'sl', 'et', 'lv', 'lt', 'tr', 'id', 'ms', 'tl', 'sw', 'af', 'sq', 'eu', 'ca', 'gl', 'is', 'ga', 'mt', 'co', 'cy', 'gd', 'br', 'fo', 'rm', 'wa', 'lb', 'li', 'oc', 'sc', 'se', 'sm', 'ty', 'tw', 'wo', 'za', 'aa', 'ab', 'ae', 'ak', 'an', 'av', 'ay', 'ba', 'bh', 'bi', 'bm', 'bo', 'ch', 'cu', 'cv', 'dz', 'ee', 'ff', 'gn', 'gv', 'hz', 'ia', 'ie', 'ik', 'io', 'jv', 'kg', 'ki', 'kj', 'kr', 'ks', 'kv', 'kw', 'lg', 'ln', 'lu', 'mh', 'na', 'ng', 'nn', 'nr', 'nv', 'oj', 'om', 'os', 'pi', 'qu', 'rn', 'sg', 'ss', 'ug', 've', 'vo', 'ha', 'yo', 'ig', 'zu', 'am', 'haw', 'hm', 'kn', 'km', 'rw', 'lo', 'la', 'mg', 'ml', 'mi', 'my', 'pa', 'si', 'so', 'su', 'ta', 'te', 'xh', 'vi', 'bn', 'gu', 'te', 'kn', 'ml', 'ta', 'or', 'as', 'hy', 'ka', 'az']
};

// Popular languages for UI display (most commonly used)
export const POPULAR_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi', 'tr', 'nl', 'sv', 'da', 'no', 'fi', 'pl', 'cs', 'hu', 'ro', 'bg', 'hr', 'sk', 'sl', 'et', 'lv', 'lt', 'el', 'he', 'th', 'vi', 'id', 'ms', 'tl', 'sw', 'am', 'fa', 'ur', 'bn', 'ta', 'te', 'ml', 'kn', 'gu', 'pa', 'mr', 'ne', 'si', 'my', 'km', 'lo', 'ka', 'hy', 'az'
];

// Helper functions
export const getLanguageName = (code: string): string => {
  return LANGUAGE_NAMES[code] || code;
};

export const getSpeechRecognitionLanguage = (code: string): string => {
  // Direct match first
  if (SPEECH_RECOGNITION_LANGUAGES[code]) {
    return SPEECH_RECOGNITION_LANGUAGES[code];
  }
  
  // Extract base language code (remove country suffix)
  const baseCode = code.split('-')[0].toLowerCase();
  
  // Try base language code
  if (SPEECH_RECOGNITION_LANGUAGES[baseCode]) {
    return SPEECH_RECOGNITION_LANGUAGES[baseCode];
  }
  
  // No fallback - return the original code if not found
  return code;
};

// Alias for VoiceFlow/ASR usage
export const getASRLanguageCode = getSpeechRecognitionLanguage;

export const isLanguagePairSupported = (source: string, target: string): boolean => {
  return SUPPORTED_LANGUAGE_PAIRS.some(
    pair => pair.source === source && pair.target === target
  );
};

// Check if a language is supported by speech recognition
export const isSpeechRecognitionSupported = (code: string): boolean => {
  // Direct match
  if (SPEECH_RECOGNITION_LANGUAGES[code]) {
    return true;
  }
  
  // Extract base language code
  const baseCode = code.split('-')[0].toLowerCase();
  return SPEECH_RECOGNITION_LANGUAGES[baseCode] !== undefined;
};

// Check if a language is RTL (Right-to-Left)
export const isRTL = (langCode: string): boolean => {
  // Extract base language code (remove country suffix)
  const baseCode = langCode.split('-')[0].toLowerCase();
  return RTL_LANGUAGES.has(baseCode);
};

// Get language family for font selection
export const getLanguageFamily = (langCode: string): LanguageFamily => {
  // Extract base language code (remove country suffix)
  const baseCode = langCode.split('-')[0].toLowerCase();
  
  for (const [family, languages] of Object.entries(LANGUAGE_FAMILIES)) {
    if (languages.includes(baseCode) || languages.includes(langCode.toLowerCase())) {
      return family as LanguageFamily;
    }
  }
  
  // Default to latin for unknown languages
  return 'latin';
};

// Detect text language based on Unicode ranges
export const detectTextLanguage = (text: string): LanguageFamily => {
  if (!text || typeof text !== 'string') return 'latin';
  
  // Count characters in each script to determine dominant script
  const scriptCounts: Record<LanguageFamily, number> = {
    arabic: 0,
    hebrew: 0,
    chinese: 0,
    cyrillic: 0,
    devanagari: 0,
    greek: 0,
    thai: 0,
    latin: 0
  };
  
  for (const char of text) {
    const code = char.charCodeAt(0);
    
    // Arabic script (Arabic, Persian, Urdu, etc.)
    if ((code >= 0x0600 && code <= 0x06FF) || 
        (code >= 0x0750 && code <= 0x077F) || 
        (code >= 0x08A0 && code <= 0x08FF) || 
        (code >= 0xFB50 && code <= 0xFDFF) || 
        (code >= 0xFE70 && code <= 0xFEFF)) {
      scriptCounts.arabic++;
    }
    // Hebrew script
    else if ((code >= 0x0590 && code <= 0x05FF) || 
             code === 0x200F || code === 0x202D || code === 0x202E) {
      scriptCounts.hebrew++;
    }
    // Chinese script (Chinese, Japanese, Korean)
    else if ((code >= 0x4E00 && code <= 0x9FFF) || 
             (code >= 0x3400 && code <= 0x4DBF) || 
             (code >= 0xF900 && code <= 0xFAFF)) {
      scriptCounts.chinese++;
    }
    // Cyrillic script
    else if ((code >= 0x0400 && code <= 0x04FF) || 
             (code >= 0x0500 && code <= 0x052F) || 
             (code >= 0x2DE0 && code <= 0x2DFF) || 
             (code >= 0xA640 && code <= 0xA69F)) {
      scriptCounts.cyrillic++;
    }
    // Devanagari script (Hindi, Sanskrit, etc.)
    else if ((code >= 0x0900 && code <= 0x097F) || 
             (code >= 0xA8E0 && code <= 0xA8FF) || 
             (code >= 0x1CD0 && code <= 0x1CFF)) {
      scriptCounts.devanagari++;
    }
    // Greek script
    else if ((code >= 0x0370 && code <= 0x03FF) || 
             (code >= 0x1F00 && code <= 0x1FFF)) {
      scriptCounts.greek++;
    }
    // Thai script
    else if (code >= 0x0E00 && code <= 0x0E7F) {
      scriptCounts.thai++;
    }
    // Latin script (ASCII and extended Latin)
    else if ((code >= 0x0020 && code <= 0x007F) || 
             (code >= 0x00A0 && code <= 0x00FF) || 
             (code >= 0x0100 && code <= 0x017F) || 
             (code >= 0x0180 && code <= 0x024F)) {
      scriptCounts.latin++;
    }
  }
  
  // Find the script with the most characters
  let maxCount = 0;
  let dominantScript: LanguageFamily = 'latin';
  
  for (const [script, count] of Object.entries(scriptCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantScript = script as LanguageFamily;
    }
  }
  
  return dominantScript;
};

// Get appropriate font family for text
export const getFontFamilyForText = (text: string, langCode?: string): LanguageFamily => {
  const detectedFamily = detectTextLanguage(text);
  
  // If language code is provided, use it as primary source
  if (langCode) {
    const codeFamily = getLanguageFamily(langCode);
    if (codeFamily !== 'latin') {
      return codeFamily;
    }
  }
  
  return detectedFamily;
};

// Check if text should be right-aligned
export const shouldAlignRight = (text: string, langCode?: string): boolean => {
  if (langCode) {
    return isRTL(langCode);
  }
  
  const family = detectTextLanguage(text);
  return family === 'arabic' || family === 'hebrew';
};

// Get language configuration
export const getLanguageConfig = (code: string): LanguageConfig => {
  const name = getLanguageName(code);
  const speechRecognitionCode = getASRLanguageCode(code);
  const family = getLanguageFamily(code);
  const isRTLLang = isRTL(code);
  
  return {
    code,
    name,
    speechRecognitionCode,
    family,
    isRTL: isRTLLang
  };
};

// Get all available translation targets for a source language
export const getAvailableTargets = (sourceLanguage: string): string[] => {
  return SUPPORTED_LANGUAGE_PAIRS
    .filter(pair => pair.source === sourceLanguage)
    .map(pair => pair.target);
};

// Get all available translation sources for a target language  
export const getAvailableSources = (targetLanguage: string): string[] => {
  return SUPPORTED_LANGUAGE_PAIRS
    .filter(pair => pair.target === targetLanguage)
    .map(pair => pair.source);
};

// Get popular languages with their configurations
export const getPopularLanguages = (): LanguageConfig[] => {
  return POPULAR_LANGUAGES.map(getLanguageConfig);
};

// Get all languages with their configurations
export const getAllLanguages = (): LanguageConfig[] => {
  return Object.keys(LANGUAGE_NAMES).map(getLanguageConfig);
};

// Search languages by name or code
export const searchLanguages = (query: string): LanguageConfig[] => {
  const lowerQuery = query.toLowerCase();
  return getAllLanguages().filter(lang => 
    lang.name.toLowerCase().includes(lowerQuery) || 
    lang.code.toLowerCase().includes(lowerQuery)
  );
};
