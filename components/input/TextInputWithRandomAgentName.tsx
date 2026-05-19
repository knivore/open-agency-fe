import React from 'react';
import { RotateCw } from 'lucide-react';
import {
  FieldError,
  FieldValues,
  RegisterOptions,
  UseFormRegister,
  UseFormSetValue,
} from 'react-hook-form';

interface TextInputProps {
  name: string;
  label: string;
  register: UseFormRegister<any>;
  setValue: UseFormSetValue<any>;
  error?: FieldError;
  validation?: RegisterOptions<FieldValues, string>;
}

const TextInputWithRandomAgentName = ({
                                        name,
                                        label,
                                        register,
                                        setValue,
                                        error,
                                        validation,
                                      }: TextInputProps) => {
  const generateRandomAgentName = () => {
    const chineseEnglishPrefixes1 = [
      'Wei', 'Xiao', 'Mei', 'Jun', 'Hui',
      'Yi', 'Zhi', 'Jia', 'Ying', 'Qian',
      'Ling', 'Ming', 'Lian', 'Jie', 'Min',
      'Ting', 'Hao', 'Wei', 'Xuan', 'Sing',
      'Kwang', 'Yun', 'Shu', 'Lee', 'Yu'
    ];
    const chineseEnglishPrefixes2 = [
      'Ling', 'Ming', 'Lian', 'Jie', 'Min',
      'Ting', 'Hao', 'Wei', 'Xuan', 'Hui',
      'Wei', 'Xiao', 'Mei', 'Jun', 'Sze',
      'Yi', 'Zhi', 'Jia', 'Ying', 'Qian',
      'Cheng', 'Yun', 'Xin', 'Cui', 'Ru',
    ];

    const chineseEnglishSuffixes = [
      'Tan', 'Lim', 'Lee', 'Ng', 'Wong',
      'Teo', 'Chua', 'Koh', 'Ong', 'Ho',
      'Goh', 'Kwok', 'Zhuo', 'Ang', 'Liew',
      'Keh', 'Lin', 'Tang', 'Neo', 'Hu', 'Soh',
      'Ooi', 'Chan', 'Tay', 'Ko', 'Leow', 'Lau',
      'Hay', 'Hang'
    ];
    const malayPrefixes = [
      'Aisyah', 'Hidayat', 'Sharifah', 'Syafiq', 'Roslan',
      'Farah', 'Amirul', 'Hakim', 'Nurul', 'Zain', 'Lokman',
      'Hafiz', 'Fazli', 'Farid', 'Taufiq', 'Umar',
      'Harith', 'Iman', 'Jamilah', 'Kamal', 'Liyaana',
      'Mira', 'Nadia', 'Puteri', 'Qistina', 'Rania',
    ];
    const malaySuffixes = [
      'Rahman', 'Ismail', 'Abdullah', 'Bakri', 'Aziz',
      'Hakim', 'Rafiq', 'Zulkarnain', 'Syed', 'Ibrahim',
      'Ghazali', 'Hamzah', 'Idris', 'Jamaluddin', 'Kassim',
      'Latiff', 'Mahmud', 'Mustafa', 'Nordin', 'Osman',
      'Ridzwan', 'Saad', 'Talib', 'Uthman', 'Wahab',
    ];
    const indianPrefixes = [
      'Arvind', 'Priya', 'Anand', 'Deepa', 'Santosh',
      'Lakshmi', 'Aditya', 'Sharma', 'Rajesh', 'Chandra',
      'Akash', 'Bhavna', 'Chetan', 'Divya', 'Esha',
      'Gaurav', 'Harini', 'Indira', 'Jaya', 'Kiran',
      'Leela', 'Manoj', 'Neha', 'Omkar', 'Praveen',
    ];
    const indianSuffixes = [
      'Kumar', 'Subramaniam', 'Ravi', 'Ramesh', 'Menon',
      'Sharma', 'Raj', 'Nair', 'Pillai', 'Iyer',
      'Achari', 'Balakrishnan', 'Chettiar', 'Devan', 'Elango',
      'Gopal', 'Harish', 'Iyengar', 'Jayaram', 'Kannan',
      'Lal', 'Madhavan', 'Naidu', 'Oommen', 'Patel',
    ];
    const eurasianPrefixes = [
      'Nina', 'Jonathan', 'Isabel', 'Michael', 'Melissa',
      'Sophia', 'David', 'Rachel', 'Samuel', 'Rebecca', 'Joseph',
      'Gordon', 'Alyssa', 'Evangeline', 'Alfred', 'Alden', 'Alice',
      'Anna', 'Eileen', 'Adel', 'Francine', 'Justina', 'Dan', 'Shenn',
      'Joyce', 'Michelle', 'Eugene', 'Samson', 'Brenda', 'Cherie', 'Rei',
    ];
    const eurasianSuffixes = [
      'de Souza', 'Fernandez', 'Rodrigues', 'Pereira', 'Gomes',
      'D\'Cruz', 'Martins', 'da Silva', 'Franco', 'Moreira', 'Coldwell', 'Fraser',
    ];

    // Concatenate and shuffle the prefixes
    function combineAndShufflePrefixes(arr1: string[], arr2: string[]) {
      const combined = [];
      const len1 = arr1.length;
      const len2 = arr2.length;
      const maxLen = Math.max(len1, len2);

      for (let i = 0; i < maxLen; i++) {
        const prefix1 = arr1[i % len1]; // Use modulo to wrap around
        const prefix2 = arr2[i % len2]; // Use modulo to wrap around
        combined.push(`${prefix1} ${prefix2}`);
      }

      // Shuffle the combined array (Fisher-Yates)
      for (let i = combined.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combined[i], combined[j]] = [combined[j], combined[i]];
      }
      return combined;
    }

    const shuffledChineseEnglishPrefixes = combineAndShufflePrefixes(chineseEnglishPrefixes1, chineseEnglishPrefixes2);
    const shuffledChineseEnglishEurasianPrefixes = combineAndShufflePrefixes(shuffledChineseEnglishPrefixes, eurasianPrefixes);
    const categories = [
      { prefixes: shuffledChineseEnglishPrefixes, suffixes: chineseEnglishSuffixes },
      { prefixes: shuffledChineseEnglishEurasianPrefixes, suffixes: chineseEnglishSuffixes },
      { prefixes: malayPrefixes, suffixes: malaySuffixes },
      { prefixes: indianPrefixes, suffixes: indianSuffixes },
      { prefixes: eurasianPrefixes, suffixes: eurasianSuffixes },
      { prefixes: eurasianPrefixes, suffixes: chineseEnglishSuffixes },
    ];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const { prefixes, suffixes } = randomCategory;
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${randomPrefix} ${randomSuffix}`;
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          {...register(name, validation)}
          className={`w-full rounded-md border px-3 py-2 text-sm ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        <button
          type="button"
          onClick={() => {
            const randomName = generateRandomAgentName();
            setValue(name, randomName, {
              shouldValidate: true,
              shouldDirty: true,
              shouldTouch: true,
            });
          }}
          className="absolute right-2 p-1 text-gray-400 hover:text-gray-600"
        >
          <RotateCw className="h-4 w-4" />
        </button>
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error.message}</p>
      )}
    </div>
  );
};

export default TextInputWithRandomAgentName;
