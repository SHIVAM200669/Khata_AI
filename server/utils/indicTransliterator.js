/**
 * Indic (Devanagari, Tamil, Telugu, Hinglish, Tanglish) to English / Latin transliteration
 * & standardization utility for customer names in KiranaPilot.
 */

// Common direct dictionary for high-frequency Indian customer names
const COMMON_INDIC_NAMES = {
  // Devanagari Hindi
  'करण': 'Karan',
  'कर्ण': 'Karan',
  'करन': 'Karan',
  'कारन': 'Karan',
  'रमेश': 'Ramesh',
  'सुरेश': 'Suresh',
  'महेश': 'Mahesh',
  'दिनेश': 'Dinesh',
  'नरेश': 'Naresh',
  'हरीश': 'Harish',
  'राजेश': 'Rajesh',
  'मुकेश': 'Mukesh',
  'कमलेश': 'Kamlesh',
  'योगेश': 'Yogesh',
  'अमित': 'Amit',
  'सुमित': 'Sumit',
  'अभिजीत': 'Abhijit',
  'विक्रम': 'Vikram',
  'मोहन': 'Mohan',
  'रोहन': 'Rohan',
  'सोहन': 'Sohan',
  'राकेश': 'Rakesh',
  'दीपक': 'Deepak',
  'संजय': 'Sanjay',
  'सुनील': 'Sunil',
  'अनिल': 'Anil',
  'अजय': 'Ajay',
  'विजय': 'Vijay',
  'प्रदीप': 'Pradeep',
  'संदीप': 'Sandeep',
  'कुलदीप': 'Kuldeep',
  'मनोज': 'Manoj',
  'विकास': 'Vikas',
  'पंकज': 'Pankaj',
  'राहुल': 'Rahul',
  'सतीश': 'Satish',
  'रोहित': 'Rohit',
  'मोहित': 'Mohit',
  'सोनू': 'Sonu',
  'मोनू': 'Monu',
  'राजू': 'Raju',
  'बबलू': 'Bablu',
  'पप्पू': 'Pappu',
  'राधे': 'Radhey',
  'श्याम': 'Shyam',
  'गोपाल': 'Gopal',
  'किशन': 'Kishan',
  'कृष्णा': 'Krishna',
  'विशाल': 'Vishal',
  'गौरव': 'Gaurav',
  'अंकुर': 'Ankur',
  'अमन': 'Aman',
  'आशीष': 'Ashish',
  'मनीष': 'Manish',
  'प्रवीण': 'Praveen',
  'नवीन': 'Naveen',
  'अशोक': 'Ashok',
  'संतोष': 'Santosh',
  'नीरज': 'Neeraj',
  'धीरज': 'Dheeraj',
  'पवन': 'Pawan',
  'सूरज': 'Suraj',
  'भरत': 'Bharat',
  'हेमंत': 'Hemant',
  'बसंत': 'Basant',
  'ललित': 'Lalit',
  'कमल': 'Kamal',
  'रवि': 'Ravi',
  'कवि': 'Kavi',
  'शशि': 'Shashi',
  'ऋषि': 'Rishi',
  'गिरीश': 'Girish',
  'गुप्ता': 'Gupta',
  'गुप्ता जी': 'Gupta Ji',
  'शर्मा': 'Sharma',
  'शर्मा जी': 'Sharma Ji',
  'वर्मा': 'Verma',
  'वर्मा जी': 'Verma Ji',
  'सिंह': 'Singh',
  'यादव': 'Yadav',
  'पटेल': 'Patel',
  'मिश्रा': 'Mishra',
  'पांडे': 'Pandey',
  'चौधरी': 'Choudhary',
  'जैन': 'Jain',
  'अग्रवाल': 'Agarwal',
  'बंसल': 'Bansal',
  'गोयल': 'Goyal',
  'मित्तल': 'Mittal',
  'कौशिक': 'Kaushik',
  'तिवारी': 'Tiwari',
  'दुबे': 'Dubey',
  'शुक्ला': 'Shukla',
  'सिसोदिया': 'Sisodia',
  'चौहान': 'Chauhan',
  'राठौड़': 'Rathore',
  'तोमर': 'Tomar',
  'ठाकुर': 'Thakur',
  'साहू': 'Sahu',

  // Tamil Names & Inflections
  'காரண்': 'Karan',
  'காரன்': 'Karan',
  'காரணுக்கு': 'Karan',
  'ரமேஷ்': 'Ramesh',
  'ரமேஷுக்கு': 'Ramesh',
  'சுரேஷ்': 'Suresh',
  'சுரேஷுக்கு': 'Suresh',
  'மகேஷ்': 'Mahesh',
  'தினேஷ்': 'Dinesh',
  'அமித்': 'Amit',
  'அபிஜித்': 'Abhijit',
  'விக்ரம்': 'Vikram',
  'மோகன்': 'Mohan',
  'ராகேஷ்': 'Rakesh',
  'தீபக்': 'Deepak',
  'சஞ்சய்': 'Sanjay',
  'சுனில்': 'Sunil',
  'அனில்': 'Anil',
  'அஜய்': 'Ajay',
  'விஜய்': 'Vijay',
  'பிரதீப்': 'Pradeep',
  'சந்தீப்': 'Sandeep',
  'மனோஜ்': 'Manoj',
  'விகாஸ்': 'Vikas',
  'பங்கஜ்': 'Pankaj',
  'ராகுல்': 'Rahul',
  'சதீஷ்': 'Satish',
  'ரோஹித்': 'Rohit',
  'குமார்': 'Kumar',
  'ராஜா': 'Raja',
  'செந்தில்': 'Senthil',
  'முருகன்': 'Murugan',
  'கார்த்திக்': 'Karthik',
  'சரவணன்': 'Saravanan',
  'கணேஷ்': 'Ganesh',
  'சுப்பிரமணி': 'Subramani'
};

// Character-by-character Devanagari transliteration mapping
const DEVANAGARI_VOWELS = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'an', 'अः': 'ah'
};

const DEVANAGARI_MATRAS = {
  'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ँ': 'n', 'ः': 'h',
  '्': ''
};

const DEVANAGARI_CONSONANTS = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
  'क्ष': 'ksh', 'त्र': 'tr', 'ज्ञ': 'gy', 'श्र': 'shr',
  'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'फ़': 'f', 'ड़': 'd', 'ढ़': 'dh'
};

// Tamil character mapping
const TAMIL_CONSONANTS = {
  'க': 'k', 'ங': 'ng', 'ச': 's', 'ஞ': 'ny', 'ட': 't', 'ண': 'n',
  'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r',
  'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n',
  'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h', 'க்ஷ': 'ksh'
};

const TAMIL_VOWELS = {
  'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo',
  'எ': 'e', 'ஏ': 'ae', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oa', 'ஔ': 'au'
};

const TAMIL_MATRAS = {
  'ா': 'a', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo',
  'ெ': 'e', 'ே': 'ae', 'ை': 'ai', 'ொ': 'o', 'ோ': 'oa', 'ௌ': 'au',
  '்': ''
};

/**
 * Checks if a string contains Devanagari characters.
 */
export function hasDevanagari(str) {
  if (!str || typeof str !== 'string') return false;
  return /[\u0900-\u097F]/.test(str);
}

/**
 * Checks if a string contains Tamil characters.
 */
export function hasTamil(str) {
  if (!str || typeof str !== 'string') return false;
  return /[\u0B80-\u0BFF]/.test(str);
}

/**
 * Transliterates Devanagari text to standard Latin / English Title Case.
 */
export function transliterateDevanagariToEnglish(text) {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  if (COMMON_INDIC_NAMES[trimmed]) {
    return COMMON_INDIC_NAMES[trimmed];
  }

  const words = trimmed.split(/\s+/);
  const translatedWords = words.map(word => {
    // Strip case endings in Hindi (को, ने, का, की, के, से)
    const cleanWord = word.replace(/(को|ने|का|की|के|से)$/, '');

    if (COMMON_INDIC_NAMES[cleanWord]) {
      return COMMON_INDIC_NAMES[cleanWord];
    }

    if (!hasDevanagari(cleanWord)) {
      return cleanWord.charAt(0).toUpperCase() + cleanWord.slice(1);
    }

    let result = '';
    const chars = Array.from(cleanWord);
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const nextChar = chars[i + 1];

      if (DEVANAGARI_VOWELS[char]) {
        result += DEVANAGARI_VOWELS[char];
      } else if (DEVANAGARI_CONSONANTS[char]) {
        const cons = DEVANAGARI_CONSONANTS[char];
        if (nextChar === '्') {
          result += cons;
          i++;
        } else if (DEVANAGARI_MATRAS[nextChar]) {
          result += cons + DEVANAGARI_MATRAS[nextChar];
          i++;
        } else if (i === chars.length - 1) {
          result += cons;
        } else {
          result += cons + 'a';
        }
      } else if (DEVANAGARI_MATRAS[char]) {
        result += DEVANAGARI_MATRAS[char];
      } else {
        result += char;
      }
    }

    return result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();
  });

  return translatedWords.join(' ');
}

/**
 * Transliterates Tamil text to standard Latin / English Title Case.
 */
export function transliterateTamilToEnglish(text) {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  // Direct dictionary check
  if (COMMON_INDIC_NAMES[trimmed]) {
    return COMMON_INDIC_NAMES[trimmed];
  }

  // Strip common Tamil dative suffix -ukku (உக்கு / க்கு)
  const stripped = trimmed.replace(/(ுக்கு|க்கு|இடம்|ஐ)$/, '');
  if (COMMON_INDIC_NAMES[stripped]) {
    return COMMON_INDIC_NAMES[stripped];
  }

  const words = stripped.split(/\s+/);
  const translatedWords = words.map(word => {
    if (COMMON_INDIC_NAMES[word]) {
      return COMMON_INDIC_NAMES[word];
    }

    let result = '';
    const chars = Array.from(word);
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const nextChar = chars[i + 1];

      if (TAMIL_VOWELS[char]) {
        result += TAMIL_VOWELS[char];
      } else if (TAMIL_CONSONANTS[char]) {
        const cons = TAMIL_CONSONANTS[char];
        if (nextChar === '்') {
          result += cons;
          i++;
        } else if (TAMIL_MATRAS[nextChar]) {
          result += cons + TAMIL_MATRAS[nextChar];
          i++;
        } else if (i === chars.length - 1) {
          result += cons;
        } else {
          result += cons + 'a';
        }
      } else if (TAMIL_MATRAS[char]) {
        result += TAMIL_MATRAS[char];
      } else {
        result += char;
      }
    }

    return result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();
  });

  return translatedWords.join(' ');
}

/**
 * Standardizes any customer name to clean, English Title Case.
 * E.g., "करण" -> "Karan", "காரண்" -> "Karan", "karan" -> "Karan", "ramesh" -> "Ramesh"
 */
export function standardizeCustomerName(name) {
  if (!name || typeof name !== 'string') return null;
  let clean = name.trim();
  if (!clean || clean.toLowerCase() === 'null' || clean.toLowerCase() === 'none') return null;

  // Strip postposition markers if accidentally attached
  clean = clean.replace(/\b(ko|ne|ka|ki|ke|se|ku|ukku|kku)\b/gi, '').trim();

  if (hasDevanagari(clean)) {
    return transliterateDevanagariToEnglish(clean);
  }

  if (hasTamil(clean)) {
    return transliterateTamilToEnglish(clean);
  }

  // Capitalize each word in Latin script
  return clean
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export const transliterateIndicToEnglish = standardizeCustomerName;

/**
 * Checks if two customer names match phonetically or across Devanagari/Tamil/English scripts.
 */
export function isCustomerNameMatch(name1, name2) {
  if (!name1 || !name2) return false;
  const norm1 = (standardizeCustomerName(name1) || '').toLowerCase();
  const norm2 = (standardizeCustomerName(name2) || '').toLowerCase();
  if (norm1 === norm2) return true;

  const clean1 = norm1.replace(/[^a-z0-9]/g, '');
  const clean2 = norm2.replace(/[^a-z0-9]/g, '');
  return clean1 === clean2;
}

/**
 * Normalizes a name query token for entity candidate searching.
 * Returns { raw: string, standardized: string, firstToken: string, cleanNormalized: string }
 */
export function normalizeNameTokens(nameQuery) {
  const std = standardizeCustomerName(nameQuery) || '';
  const clean = std.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const tokens = clean.split(/\s+/).filter(Boolean);
  return {
    raw: nameQuery,
    standardized: std,
    clean,
    firstToken: tokens[0] || '',
    tokens
  };
}
