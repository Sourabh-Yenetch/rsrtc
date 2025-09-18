
import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { BusCard } from './components/BusCard';
import { MicrophoneIcon, SearchIcon, SwapIcon } from './components/Icons';
import { useVoiceRecognition } from './hooks/useVoiceRecognition';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import { DUMMY_BUSES, translations } from './constants';
import { Language } from './types';
import type { Bus } from './types';
import { getDepartureDate, formatTime } from './utils/timeHelper';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(Language.ENGLISH);
  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  const [buses, setBuses] = useState<Bus[]>([]);
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'error' | 'success' | 'no_buses'>('idle');
  const [error, setError] = useState('');

  const t = translations[lang];

  const { isListening, transcript, startListening, stopListening, error: recognitionError, hasRecognitionSupport } = useVoiceRecognition(lang);
  const { speak } = useSpeechSynthesis();

  const parseQueryWithAI = useCallback(async (text: string) => {
    setStatus('processing');
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are a helpful assistant for a bus booking app. Analyze the following user query: "${text}". Extract the source city, the destination city, and identify the language of the query. The language should be one of 'en-IN' or 'hi-IN'.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              from: { type: Type.STRING, description: 'The departure city.' },
              to: { type: Type.STRING, description: 'The destination city.' },
              language: {
                type: Type.STRING,
                description: "The detected language of the query, either 'en-IN' or 'hi-IN'.",
                enum: [Language.ENGLISH, Language.HINDI]
              }
            },
            required: ['from', 'to', 'language']
          },
        },
      });
      
      const result = JSON.parse(response.text);

      if (result.from && result.to && result.language) {
        if (result.language === Language.ENGLISH || result.language === Language.HINDI) {
            setLang(result.language);
        }
        setFromCity(result.from);
        setToCity(result.to);
      } else {
        throw new Error("Could not parse cities and language from response.");
      }
    } catch (e) {
      console.error("Error processing query:", e);
      setStatus('error');
      setError(t.error);
      speak(t.error, lang);
    }
  }, [lang, speak, t.error]);


  useEffect(() => {
    if (transcript) {
      parseQueryWithAI(transcript);
    }
  }, [transcript, parseQueryWithAI]);
  
  useEffect(() => {
    if (isListening) {
      setStatus('listening');
    } else if (status === 'listening') {
      if (!transcript) {
        setStatus('idle');
      }
    }
  }, [isListening, status, transcript]);

  useEffect(() => {
    if (recognitionError) {
      setStatus('error');
      setError(t.error);
    }
  }, [recognitionError, t.error]);
  
  const searchBuses = useCallback(() => {
    if (fromCity && toCity) {
        setStatus('processing');
        // Simulate API call
        setTimeout(() => {
            const from = fromCity.toLowerCase().trim();
            const to = toCity.toLowerCase().trim();

            const foundBuses = DUMMY_BUSES.filter(bus => 
                (bus.from.en.toLowerCase() === from || bus.from.hi === from) &&
                (bus.to.en.toLowerCase() === to || bus.to.hi === to)
            ).sort((a, b) => {
                const departureA = getDepartureDate(a.departureTime);
                const departureB = getDepartureDate(b.departureTime);
                return departureA.getTime() - departureB.getTime();
            });

            setBuses(foundBuses);

            if (foundBuses.length > 0) {
                setStatus('success');
                
                // The first bus in the sorted list is the next available one.
                const firstBus = foundBuses[0];

                // Construct announcement
                const currentLangKey = lang === Language.ENGLISH ? 'en' : 'hi';
                const fromLocationName = firstBus.from[currentLangKey];
                const toLocationName = firstBus.to[currentLangKey];
                
                const generalAnnouncement = t.foundBuses
                    .replace('{count}', foundBuses.length.toString())
                    .replace('{from}', fromLocationName)
                    .replace('{to}', toLocationName);
                
                const detailedAnnouncement = t.firstBusDetails
                    .replace('{name}', firstBus.name)
                    .replace('{type}', firstBus.type)
                    .replace('{platform}', firstBus.platform.toString())
                    .replace('{departureTime}', formatTime(firstBus.departureTime))
                    .replace('{fare}', firstBus.fare.toString());
                
                speak(generalAnnouncement + detailedAnnouncement, lang);

            } else {
                setStatus('no_buses');
                speak(t.noBuses, lang);
            }
        }, 300);
    }
  }, [fromCity, toCity, lang, speak, t.noBuses, t.foundBuses, t.firstBusDetails]);

  useEffect(() => {
      if (fromCity && toCity) {
          searchBuses();
      }
  }, [fromCity, toCity, searchBuses]);

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      setBuses([]);
      setFromCity('');
      setToCity('');
      setStatus('idle');
      setError('');
      startListening();
    }
  };
  
  const handleSwap = () => {
      setFromCity(toCity);
      setToCity(fromCity);
  }

  const handleSearchClick = () => {
    setBuses([]);
    if(fromCity && toCity) {
        const query = `Buses from ${fromCity} to ${toCity}`;
        parseQueryWithAI(query);
    }
  }

  const getStatusMessage = () => {
    switch (status) {
      case 'listening': return t.listening;
      case 'processing': return t.processing;
      case 'error': return error || t.error;
      case 'no_buses': return t.noBuses;
      case 'idle':
      case 'success':
      default:
        return t.placeholder;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans">
      <header className="bg-white dark:bg-slate-800 shadow-md p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <img src="https://www.rsrtconline.rajasthan.gov.in/Images/logo.png" alt="RSRTC Logo" className="h-10 w-10 object-contain" />
          <h1 className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">{t.title}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm sm:text-base">
            <button className={`p-1 rounded ${lang === Language.ENGLISH ? 'font-bold text-indigo-600' : ''}`} onClick={() => setLang(Language.ENGLISH)}>EN</button>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <button className={`p-1 rounded ${lang === Language.HINDI ? 'font-bold text-indigo-600' : ''}`} onClick={() => setLang(Language.HINDI)}>HI</button>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 mb-8 max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative flex-1 w-full">
                    <input 
                        type="text"
                        value={fromCity}
                        onChange={(e) => setFromCity(e.target.value)}
                        placeholder={t.from}
                        className="w-full p-4 pl-12 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                </div>

                <button onClick={handleSwap} className="p-2 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors" aria-label="Swap cities">
                    <SwapIcon className="w-5 h-5 text-slate-600 dark:text-slate-300"/>
                </button>
                
                <div className="relative flex-1 w-full">
                    <input 
                        type="text"
                        value={toCity}
                        onChange={(e) => setToCity(e.target.value)}
                        placeholder={t.to}
                        className="w-full p-4 pl-12 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 pointer-events-none">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
                <button 
                  onClick={handleSearchClick}
                  disabled={!fromCity || !toCity || status === 'processing' || isListening}
                  className="w-full sm:w-48 bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 ease-in-out shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                    <SearchIcon className="w-5 h-5" />
                    <span>{t.search}</span>
                </button>
                {hasRecognitionSupport && (
                  <button 
                    onClick={handleMicClick}
                    disabled={status === 'processing'}
                    className={`relative rounded-full p-4 transition-all duration-300 ease-in-out shadow-lg ${isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'} disabled:bg-slate-400 disabled:cursor-not-allowed`}
                    aria-label={isListening ? 'Stop listening' : 'Start listening'}
                  >
                    <MicrophoneIcon className="w-8 h-8 text-white" />
                  </button>
                )}
            </div>
             <p className="text-center mt-4 text-slate-500 dark:text-slate-400 min-h-[24px]">
                {getStatusMessage()}
            </p>
        </div>

        {(status === 'no_buses' || (status === 'error' && !isListening)) && (
            <div className="text-center py-10">
                <p className="text-lg text-slate-500">{getStatusMessage()}</p>
            </div>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {buses.map(bus => (
            <BusCard key={bus.id} bus={bus} lang={lang} />
          ))}
        </div>
      </main>
    </div>
  );
};

export default App;
