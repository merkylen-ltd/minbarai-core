# Translation Prompt System

This directory contains modular prompt files for different languages in the translation API.

## Structure

```
prompts/
├── english.txt    # English translation prompts
├── german.txt     # German translation prompts  
├── turkish.txt    # Turkish translation prompts
├── bosnian.txt    # Bosnian translation prompts
├── generic.txt    # Generic fallback for unsupported languages
└── README.md      # This file
```

## Approved Quranic Translations by Language

### English
- **Sahih International** (preferred for modern English)
- **Yusuf Ali** (classic English translation)
- **Pickthall** (literary English translation)
- **Muhammad Asad** (contemporary English translation)

### German
- **Frank Bubenheim & Nadeem Elyas** (official German translation - preferred)
- **Rudi Paret** (academic German translation)

### Turkish
- **Diyanet İşleri Başkanlığı** (official Turkish translation - preferred)

### Bosnian
- **Enes Karić** (academic Bosnian translation - preferred)
- **Mustafa Mlivo** (traditional Bosnian translation)

### Generic/Other Languages
- Uses established, recognized translations in the target language
- Falls back to Arabic verse with note if no official translation available

## Adding New Languages

To add a new language:

1. Create a new `.txt` file in the `prompts/` directory
2. Follow the template structure with these sections:
   - Expert role description in target language
   - Translation task instructions
   - Critical rules for Quranic verses
   - Islamic terminology for the target language
   - Output format requirements
   - Example input/output
   - Placeholder `{text}` for the actual text to translate

3. Prompts are served via `GET /api/prompts?target=Lang&source=Lang`.
   - Ensure a `.txt` file exists here matching the target language mapping.

## Template Structure

Each prompt file should follow this structure:

```
You are an expert Islamic translator specializing in Arabic-to-[TARGET] religious content translation.

TRANSLATION TASK
Translate the following Arabic text to [TARGET] with utmost accuracy and reverence.

CRITICAL RULES FOR QURANIC VERSES:
- NEVER translate Quranic verses directly
- Use ONLY official [TARGET] translations: [LIST OF TRANSLATORS]
- Format: "[Arabic verse] — [Official Translation] (Surah Name X:Y)"

ISLAMIC TERMINOLOGY FOR [TARGET]:
- "As-salāmu ʿalaykum wa-raḥmatullāhi wa-barakātuh" → "[TARGET translation]"
- [Additional terminology mappings]

OUTPUT FORMAT:
- Return ONLY the [TARGET] translation
- No JSON, no quotes, no extra formatting
- Clean, readable [TARGET] text

EXAMPLE INPUT: "السلام عليكم ورحمه الله وبركاته قل هو الله احد"
EXAMPLE OUTPUT: "[TARGET example translation]"

TRANSLATE THIS TEXT:
{text}
```

## Benefits

- **Modular**: Easy to maintain and update individual language prompts
- **Scalable**: Simple to add new languages
- **Maintainable**: Clear separation of concerns
- **Consistent**: Standardized structure across all languages
- **Fallback**: Automatic fallback to English if language not supported
