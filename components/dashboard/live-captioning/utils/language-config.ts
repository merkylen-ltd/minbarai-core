import { LanguageSpecificConfig } from '../types'

// Language-specific VoiceFlow configuration
export const getLanguageSpecificConfig = (languageCode: string): LanguageSpecificConfig => {
  const config: LanguageSpecificConfig = {}
  
  // Arabic variants
  if (languageCode === 'ar') {
    config.alternativeLanguageCodes = ['ar-SA', 'ar-EG', 'ar-MA', 'ar-AE', 'ar-JO', 'ar-LB', 'ar-KW', 'ar-QA', 'ar-TN', 'ar-DZ']
  }
  
  // English variants
  else if (languageCode === 'en') {
    config.alternativeLanguageCodes = ['en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN', 'en-IE', 'en-NZ', 'en-ZA']
  }
  
  // Chinese variants
  else if (languageCode === 'zh') {
    config.alternativeLanguageCodes = ['zh-CN', 'zh-TW', 'zh-HK']
  }
  
  // Spanish variants
  else if (languageCode === 'es') {
    config.alternativeLanguageCodes = ['es-ES', 'es-MX', 'es-AR', 'es-CO', 'es-PE', 'es-VE', 'es-CL', 'es-EC', 'es-GT', 'es-CU', 'es-BO', 'es-DO', 'es-HN', 'es-PY', 'es-SV', 'es-NI', 'es-CR', 'es-PA', 'es-UY', 'es-PR']
  }
  
  // Portuguese variants
  else if (languageCode === 'pt') {
    config.alternativeLanguageCodes = ['pt-BR', 'pt-PT']
  }
  
  // French variants
  else if (languageCode === 'fr') {
    config.alternativeLanguageCodes = ['fr-FR', 'fr-CA', 'fr-BE', 'fr-CH', 'fr-LU', 'fr-MC']
  }
  
  // German variants
  else if (languageCode === 'de') {
    config.alternativeLanguageCodes = ['de-DE', 'de-AT', 'de-CH', 'de-LU', 'de-LI']
  }
  
  // Russian variants
  else if (languageCode === 'ru') {
    config.alternativeLanguageCodes = ['ru-RU', 'ru-BY', 'ru-KZ', 'ru-KG', 'ru-MD', 'ru-UA']
  }
  
  // Hindi variants
  else if (languageCode === 'hi') {
    config.alternativeLanguageCodes = ['hi-IN']
  }
  
  // Japanese variants
  else if (languageCode === 'ja') {
    config.alternativeLanguageCodes = ['ja-JP']
  }
  
  // Korean variants
  else if (languageCode === 'ko') {
    config.alternativeLanguageCodes = ['ko-KR']
  }
  
  // Turkish variants
  else if (languageCode === 'tr') {
    config.alternativeLanguageCodes = ['tr-TR', 'tr-CY']
  }
  
  // Italian variants
  else if (languageCode === 'it') {
    config.alternativeLanguageCodes = ['it-IT', 'it-CH', 'it-SM', 'it-VA']
  }
  
  // Dutch variants
  else if (languageCode === 'nl') {
    config.alternativeLanguageCodes = ['nl-NL', 'nl-BE']
  }
  
  // Swedish variants
  else if (languageCode === 'sv') {
    config.alternativeLanguageCodes = ['sv-SE', 'sv-FI']
  }
  
  // Norwegian variants
  else if (languageCode === 'no') {
    config.alternativeLanguageCodes = ['nb-NO', 'nn-NO']
  }
  
  // Polish variants
  else if (languageCode === 'pl') {
    config.alternativeLanguageCodes = ['pl-PL']
  }
  
  // Czech variants
  else if (languageCode === 'cs') {
    config.alternativeLanguageCodes = ['cs-CZ']
  }
  
  // Hungarian variants
  else if (languageCode === 'hu') {
    config.alternativeLanguageCodes = ['hu-HU']
  }
  
  // Romanian variants
  else if (languageCode === 'ro') {
    config.alternativeLanguageCodes = ['ro-RO', 'ro-MD']
  }
  
  // Bulgarian variants
  else if (languageCode === 'bg') {
    config.alternativeLanguageCodes = ['bg-BG']
  }
  
  // Croatian variants
  else if (languageCode === 'hr') {
    config.alternativeLanguageCodes = ['hr-HR', 'hr-BA']
  }
  
  // Serbian variants
  else if (languageCode === 'sr') {
    config.alternativeLanguageCodes = ['sr-RS', 'sr-BA', 'sr-ME']
  }
  
  // Ukrainian variants
  else if (languageCode === 'uk') {
    config.alternativeLanguageCodes = ['uk-UA']
  }
  
  // Greek variants
  else if (languageCode === 'el') {
    config.alternativeLanguageCodes = ['el-GR', 'el-CY']
  }
  
  // Hebrew variants
  else if (languageCode === 'he') {
    config.alternativeLanguageCodes = ['he-IL']
  }
  
  // Thai variants
  else if (languageCode === 'th') {
    config.alternativeLanguageCodes = ['th-TH']
  }
  
  // Vietnamese variants
  else if (languageCode === 'vi') {
    config.alternativeLanguageCodes = ['vi-VN']
  }
  
  // Indonesian variants
  else if (languageCode === 'id') {
    config.alternativeLanguageCodes = ['id-ID']
  }
  
  // Malay variants
  else if (languageCode === 'ms') {
    config.alternativeLanguageCodes = ['ms-MY', 'ms-BN']
  }
  
  // Filipino variants
  else if (languageCode === 'fil') {
    config.alternativeLanguageCodes = ['fil-PH']
  }
  
  // Swahili variants
  else if (languageCode === 'sw') {
    config.alternativeLanguageCodes = ['sw-KE', 'sw-TZ', 'sw-UG']
  }
  
  // Persian variants
  else if (languageCode === 'fa') {
    config.alternativeLanguageCodes = ['fa-IR', 'fa-AF']
  }
  
  // Urdu variants
  else if (languageCode === 'ur') {
    config.alternativeLanguageCodes = ['ur-PK', 'ur-IN']
  }
  
  // Bengali variants
  else if (languageCode === 'bn') {
    config.alternativeLanguageCodes = ['bn-BD', 'bn-IN']
  }
  
  // Tamil variants
  else if (languageCode === 'ta') {
    config.alternativeLanguageCodes = ['ta-IN', 'ta-LK', 'ta-SG', 'ta-MY']
  }
  
  // Telugu variants
  else if (languageCode === 'te') {
    config.alternativeLanguageCodes = ['te-IN']
  }
  
  // Gujarati variants
  else if (languageCode === 'gu') {
    config.alternativeLanguageCodes = ['gu-IN']
  }
  
  // Kannada variants
  else if (languageCode === 'kn') {
    config.alternativeLanguageCodes = ['kn-IN']
  }
  
  // Malayalam variants
  else if (languageCode === 'ml') {
    config.alternativeLanguageCodes = ['ml-IN']
  }
  
  // Marathi variants
  else if (languageCode === 'mr') {
    config.alternativeLanguageCodes = ['mr-IN']
  }
  
  // Punjabi variants
  else if (languageCode === 'pa') {
    config.alternativeLanguageCodes = ['pa-Guru-IN', 'pa-Arab-PK']
  }
  
  // Sinhala variants
  else if (languageCode === 'si') {
    config.alternativeLanguageCodes = ['si-LK']
  }
  
  // Nepali variants
  else if (languageCode === 'ne') {
    config.alternativeLanguageCodes = ['ne-NP', 'ne-IN']
  }
  
  // Myanmar variants
  else if (languageCode === 'my') {
    config.alternativeLanguageCodes = ['my-MM']
  }
  
  // Khmer variants
  else if (languageCode === 'km') {
    config.alternativeLanguageCodes = ['km-KH']
  }
  
  // Lao variants
  else if (languageCode === 'lo') {
    config.alternativeLanguageCodes = ['lo-LA']
  }
  
  // Kazakh variants
  else if (languageCode === 'kk') {
    config.alternativeLanguageCodes = ['kk-KZ']
  }
  
  // Uzbek variants
  else if (languageCode === 'uz') {
    config.alternativeLanguageCodes = ['uz-UZ']
  }
  
  // Kyrgyz variants
  else if (languageCode === 'ky') {
    config.alternativeLanguageCodes = ['ky-KG']
  }
  
  // Tajik variants
  else if (languageCode === 'tg') {
    config.alternativeLanguageCodes = ['tg-TJ']
  }
  
  // Mongolian variants
  else if (languageCode === 'mn') {
    config.alternativeLanguageCodes = ['mn-MN']
  }
  
  // Georgian variants
  else if (languageCode === 'ka') {
    config.alternativeLanguageCodes = ['ka-GE']
  }
  
  // Armenian variants
  else if (languageCode === 'hy') {
    config.alternativeLanguageCodes = ['hy-AM']
  }
  
  // Azerbaijani variants
  else if (languageCode === 'az') {
    config.alternativeLanguageCodes = ['az-AZ']
  }
  
  // Estonian variants
  else if (languageCode === 'et') {
    config.alternativeLanguageCodes = ['et-EE']
  }
  
  // Latvian variants
  else if (languageCode === 'lv') {
    config.alternativeLanguageCodes = ['lv-LV']
  }
  
  // Lithuanian variants
  else if (languageCode === 'lt') {
    config.alternativeLanguageCodes = ['lt-LT']
  }
  
  // Finnish variants
  else if (languageCode === 'fi') {
    config.alternativeLanguageCodes = ['fi-FI']
  }
  
  // Danish variants
  else if (languageCode === 'da') {
    config.alternativeLanguageCodes = ['da-DK']
  }
  
  // Icelandic variants
  else if (languageCode === 'is') {
    config.alternativeLanguageCodes = ['is-IS']
  }
  
  // Slovak variants
  else if (languageCode === 'sk') {
    config.alternativeLanguageCodes = ['sk-SK']
  }
  
  // Slovenian variants
  else if (languageCode === 'sl') {
    config.alternativeLanguageCodes = ['sl-SI']
  }
  
  // Macedonian variants
  else if (languageCode === 'mk') {
    config.alternativeLanguageCodes = ['mk-MK']
  }
  
  // Albanian variants
  else if (languageCode === 'sq') {
    config.alternativeLanguageCodes = ['sq-AL', 'sq-XK', 'sq-MK']
  }
  
  // Maltese variants
  else if (languageCode === 'mt') {
    config.alternativeLanguageCodes = ['mt-MT']
  }
  
  // Welsh variants
  else if (languageCode === 'cy') {
    config.alternativeLanguageCodes = ['cy-GB']
  }
  
  // Irish variants
  else if (languageCode === 'ga') {
    config.alternativeLanguageCodes = ['ga-IE']
  }
  
  // Basque variants
  else if (languageCode === 'eu') {
    config.alternativeLanguageCodes = ['eu-ES']
  }
  
  // Catalan variants
  else if (languageCode === 'ca') {
    config.alternativeLanguageCodes = ['ca-ES', 'ca-AD', 'ca-FR', 'ca-IT']
  }
  
  // Galician variants
  else if (languageCode === 'gl') {
    config.alternativeLanguageCodes = ['gl-ES']
  }
  
  // Afrikaans variants
  else if (languageCode === 'af') {
    config.alternativeLanguageCodes = ['af-ZA']
  }
  
  // Amharic variants
  else if (languageCode === 'am') {
    config.alternativeLanguageCodes = ['am-ET']
  }
  
  // Hausa variants
  else if (languageCode === 'ha') {
    config.alternativeLanguageCodes = ['ha-NG', 'ha-GH']
  }
  
  // Yoruba variants
  else if (languageCode === 'yo') {
    config.alternativeLanguageCodes = ['yo-NG']
  }
  
  // Igbo variants
  else if (languageCode === 'ig') {
    config.alternativeLanguageCodes = ['ig-NG']
  }
  
  // Zulu variants
  else if (languageCode === 'zu') {
    config.alternativeLanguageCodes = ['zu-ZA']
  }
  
  // Xhosa variants
  else if (languageCode === 'xh') {
    config.alternativeLanguageCodes = ['xh-ZA']
  }
  
  // Sesotho variants
  else if (languageCode === 'st') {
    config.alternativeLanguageCodes = ['st-ZA', 'st-LS']
  }
  
  // Shona variants
  else if (languageCode === 'sn') {
    config.alternativeLanguageCodes = ['sn-ZW']
  }
  
  // Somali variants
  else if (languageCode === 'so') {
    config.alternativeLanguageCodes = ['so-SO', 'so-ET', 'so-KE', 'so-DJ']
  }
  
  // Pashto variants
  else if (languageCode === 'ps') {
    config.alternativeLanguageCodes = ['ps-AF', 'ps-PK']
  }
  
  // Sindhi variants
  else if (languageCode === 'sd') {
    config.alternativeLanguageCodes = ['sd-PK', 'sd-IN']
  }
  
  // Javanese variants
  else if (languageCode === 'jv') {
    config.alternativeLanguageCodes = ['jv-ID']
  }
  
  // Sundanese variants
  else if (languageCode === 'su') {
    config.alternativeLanguageCodes = ['su-ID']
  }
  
  // Cebuano variants
  else if (languageCode === 'ceb') {
    config.alternativeLanguageCodes = ['ceb-PH']
  }
  
  // Chichewa variants
  else if (languageCode === 'ny') {
    config.alternativeLanguageCodes = ['ny-MW', 'ny-ZW']
  }
  
  // Kinyarwanda variants
  else if (languageCode === 'rw') {
    config.alternativeLanguageCodes = ['rw-RW']
  }
  
  // Malagasy variants
  else if (languageCode === 'mg') {
    config.alternativeLanguageCodes = ['mg-MG']
  }
  
  // Samoan variants
  else if (languageCode === 'sm') {
    config.alternativeLanguageCodes = ['sm-WS', 'sm-AS']
  }
  
  // Maori variants
  else if (languageCode === 'mi') {
    config.alternativeLanguageCodes = ['mi-NZ']
  }
  
  // Fijian variants
  else if (languageCode === 'fj') {
    config.alternativeLanguageCodes = ['fj-FJ']
  }
  
  // Hawaiian variants
  else if (languageCode === 'haw') {
    config.alternativeLanguageCodes = ['haw-US']
  }
  
  // Yiddish variants
  else if (languageCode === 'yi') {
    config.alternativeLanguageCodes = ['yi-XX']
  }
  
  return config
}

