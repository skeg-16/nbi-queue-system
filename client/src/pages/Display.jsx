import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../context/SocketContext';

export default function Display() {
  useEffect(() => { document.title = "NBI Queue Display"; }, []);
  const socket = useSocket();
  const [unlocked, setUnlocked] = useState(false);
  const [time, setTime] = useState('00:00:00');
  const [date, setDate] = useState('Loading...');
  const [queueText, setQueueText] = useState('---');
  const [isTextMode, setIsTextMode] = useState(false);
  const [isPriority, setIsPriority] = useState(false);
  const [recentNumbers, setRecentNumbers] = useState([]);
  const [servingTimer, setServingTimer] = useState('00:00');
  const [showTimer, setShowTimer] = useState(false);
  const [flash, setFlash] = useState(false);

  const sfxPlayerRef = useRef(null);
  const voicePlayerRef = useRef(null);
  const voicesRef = useRef([]);
  const selectedVoiceRef = useRef(null);
  const currentRateRef = useRef(0.85);
  const lastAnnouncementRef = useRef(null);
  const servingTimerIntervalRef = useRef(null);
  const startTimestampRef = useRef(null);

  // Clock
  useEffect(() => {
    function updateDateTime() {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    }
    updateDateTime();
    const id = setInterval(updateDateTime, 1000);
    return () => clearInterval(id);
  }, []);

  function shortenCcd(ccd) {
    if (!ccd || ccd === '---') return '---';
    const parts = ccd.split('-');
    return parts.length > 1 ? '#' + parts[parts.length - 1] : ccd;
  }

  function playChimeSound(priority = false) {
    const audioCtx = audioCtxRef.current;
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const playNote = (frequency, startTime, duration) => {
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime + startTime);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime + startTime);
      gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + startTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + startTime + duration);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start(audioCtx.currentTime + startTime);
      oscillator.stop(audioCtx.currentTime + startTime + duration);
    };

    if (priority) {
      playNote(1000, 0, 0.4);
      playNote(1000, 0.5, 0.4);
    } else {
      playNote(700, 0, 0.8);
    }
  }

  function getBestVoice(voicesList) {
    if (voicesList.length === 0) return null;
    const priorityNames = [
      'natasha', 'microsoft jenny online', 'microsoft aria online',
      'google uk english female', 'samantha', 'karen', 'victoria',
      'google us english', 'microsoft hazel', 'microsoft catherine',
      'microsoft susan', 'microsoft heera', 'microsoft zira'
    ];
    for (const name of priorityNames) {
      const match = voicesList.find(v => v.name.toLowerCase().includes(name));
      if (match) return match;
    }
    const femaleMatch = voicesList.find(v => v.name.toLowerCase().includes('female'));
    if (femaleMatch) return femaleMatch;

    const maleNames = ['david', 'mark', 'guy', 'george', 'daniel', 'arthur', 'male'];
    const englishVoices = voicesList.filter(v => v.lang.startsWith('en'));
    const nonMalePH = englishVoices.find(v => v.lang.startsWith('en-PH') && !maleNames.some(m => v.name.toLowerCase().includes(m)));
    if (nonMalePH) return nonMalePH;
    const nonMaleUS = englishVoices.find(v => v.lang.startsWith('en-US') && !maleNames.some(m => v.name.toLowerCase().includes(m)));
    if (nonMaleUS) return nonMaleUS;
    const nonMaleAny = englishVoices.find(v => !maleNames.some(m => v.name.toLowerCase().includes(m)));
    if (nonMaleAny) return nonMaleAny;
    return englishVoices.find(v => v.lang.startsWith('en-US')) || voicesList[0];
  }

  function loadVoicesAsync() {
    return new Promise(resolve => {
      if (!('speechSynthesis' in window)) return resolve([]);
      const initial = window.speechSynthesis.getVoices();
      if (initial.length > 0) return resolve(initial);
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        resolve(window.speechSynthesis.getVoices());
      }, { once: true });
    });
  }

  function loadAndSelectVoices() {
    loadVoicesAsync().then(v => {
      const englishVoices = Array.from(v).filter(voice => voice.lang.startsWith('en'));
      const preferredNames = ['natasha', 'aria', 'jenny', 'ana', 'michelle', 'guy', 'samantha', 'victoria', 'karen', 'rosa', 'james', 'online', 'natural'];
      let customVoicesList = englishVoices.filter(voice =>
        preferredNames.some(p => voice.name.toLowerCase().includes(p))
      );
      if (customVoicesList.length < 10) {
        for (let i = 0; i < englishVoices.length && customVoicesList.length < 15; i++) {
          if (!customVoicesList.includes(englishVoices[i])) customVoicesList.push(englishVoices[i]);
        }
      }
      if (customVoicesList.length === 0) customVoicesList = englishVoices.slice(0, 15);
      else customVoicesList = customVoicesList.slice(0, 15);

      customVoicesList.push({ name: 'Cloud TTS (Fallback)', lang: 'en-US', voiceURI: 'cloud_tts' });

      voicesRef.current = customVoicesList;
      selectedVoiceRef.current =
        customVoicesList.find(v => v.name.toLowerCase().includes('natasha')) ||
        customVoicesList.find(v => {
          const l = v.name.toLowerCase();
          return l.includes('aria') || l.includes('jenny') || l.includes('samantha');
        }) || customVoicesList[0];

      const simpleVoices = customVoicesList.map(voice => ({ name: voice.name, lang: voice.lang, voiceURI: voice.voiceURI }));
      socket.emit('register_display_voices', simpleVoices);
      if (selectedVoiceRef.current) {
        socket.emit('update_voice_settings', { voiceURI: selectedVoiceRef.current.voiceURI });
      }
    });
  }

  function speakParts(parts, index) {
    if (index >= parts.length) return;
    const part = parts[index];
    const utterance = new SpeechSynthesisUtterance(part.text);
    if (part.voice) utterance.voice = part.voice;
    utterance.rate = part.rate;
    utterance.pitch = part.pitch;
    utterance.volume = part.volume;
    utterance.onend = () => speakParts(parts, index + 1);
    utterance.onerror = () => speakParts(parts, index + 1);
    window.speechSynthesis.speak(utterance);
  }

  function playVoiceAnnouncement(numberStr, priority = false, skipDelay = false, complainantName = '', isRepeat = false) {
    if (!unlocked) return;

    let num = numberStr.replace('#', '').trim().replace(/^0+/, '');
    if (num === '') num = '0';

    const delay = skipDelay ? 0 : 600;

    setTimeout(() => {
      const fullText = priority
        ? (isRepeat ? 'Calling again. Priority number ' : 'Calling Priority number ') + num + ', please proceed to interview room.'
        : (isRepeat ? 'Calling again. Number ' : 'Calling Number ') + num + ', please proceed to interview room.';

      function triggerSpeech() {
        if (voicePlayerRef.current) {
          voicePlayerRef.current.src = `/api/tts?text=${encodeURIComponent(fullText)}&lang=en`;
          voicePlayerRef.current.volume = 0.8;
          voicePlayerRef.current.play().catch(e => console.error('Cloud TTS Audio Tag Play Error:', e));
        }
      }

      if (sfxPlayerRef.current) {
        sfxPlayerRef.current.currentTime = 0;
        sfxPlayerRef.current.volume = 0.8;
        const playPromise = sfxPlayerRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => setTimeout(triggerSpeech, 1200))
            .catch(() => setTimeout(triggerSpeech, 50));
        } else {
          setTimeout(triggerSpeech, 1200);
        }
      } else {
        setTimeout(triggerSpeech, 50);
      }
    }, delay);
  }

  // Unlock overlay tap
  function handleUnlock() {
    setUnlocked(true);
    
    if (sfxPlayerRef.current) {
      sfxPlayerRef.current.volume = 0.8;
      const p = sfxPlayerRef.current.play();
      if (p !== undefined) {
        p.then(() => { sfxPlayerRef.current.pause(); sfxPlayerRef.current.currentTime = 0; }).catch(() => { });
      }
    }

    if (voicePlayerRef.current) {
      voicePlayerRef.current.volume = 0.8;
      // Play a tiny 1-second silent MP3 to officially unlock the element without a network request
      voicePlayerRef.current.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5LjI3LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIwBRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojo6Ojw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8AAAAAATGF2YzU5LjM3AAAAAAAAAAAAAAAAJAAAAAAAAAAAASO5w1MAAAAAAAAAAAAAAAAAAAAA//MUZAAAAAGkAAAAAAAAAABKRAwEAA/EygABAEAD5QAAACwAAAACgAD6hAAA//MUZAMAAAGkAAAAAAAAAABKRAwEAA/EygABAEAD5QAAACwAAAACgAD6hAAA//MUZAYAAAGkAAAAAAAAAABKRAwEAA/EygABAEAD5QAAACwAAAACgAD6hAAA//MUZAoAAAGkAAAAAAAAAABKRAwEAA/EygABAEAD5QAAACwAAAACgAD6hAAA";
      const p = voicePlayerRef.current.play();
      if (p !== undefined) {
        p.then(() => { voicePlayerRef.current.pause(); voicePlayerRef.current.currentTime = 0; }).catch(() => { });
      }
    }
  }

  // Socket listeners + voice init + heartbeat
  useEffect(() => {
    loadAndSelectVoices();

    socket.on('voice_settings_update', settings => {
      currentRateRef.current = settings.rate || 0.85;
      if (settings.voiceURI && voicesRef.current.length > 0) {
        const match = voicesRef.current.find(v => v.voiceURI === settings.voiceURI);
        if (match) selectedVoiceRef.current = match;
      } else if (!settings.voiceURI && voicesRef.current.length > 0) {
        selectedVoiceRef.current = getBestVoice(voicesRef.current);
      }
    });

    socket.on('trigger_test_voice_display', () => {
      playVoiceAnnouncement('13', false, true, 'Test Person');
    });

    socket.on('trigger_repeat', () => {
      if (lastAnnouncementRef.current && lastAnnouncementRef.current.number !== '---') {
        const a = lastAnnouncementRef.current;
        playVoiceAnnouncement(a.number, a.isPriority, true, a.name, true);
      }
    });

    socket.on('display_update', data => {
      if (data.skipMessage) {
        setIsTextMode(true);
        setQueueText(data.skipMessage);
        setTimeout(() => {
          setIsTextMode(false);
          setQueueText(shortenCcd(data.currentlyServing));
        }, 3000);
      } else {
        setIsTextMode(false);
        const cleanNum = shortenCcd(data.currentlyServing);
        setQueueText(cleanNum);
        setIsPriority(!!data.isPriority);

        lastAnnouncementRef.current = { number: cleanNum, isPriority: data.isPriority, name: data.currentlyServingName };

        if (data.triggerChime) {
          playVoiceAnnouncement(cleanNum, data.isPriority, false, data.currentlyServingName);

          setFlash(true);
          setTimeout(() => setFlash(false), 500);
        }

        if (data.startTimestamp) {
          startTimestampRef.current = data.startTimestamp;
          setShowTimer(true);
          clearInterval(servingTimerIntervalRef.current);
          const updateTimer = () => {
            const diffMs = new Date() - new Date(startTimestampRef.current);
            if (diffMs >= 0) {
              const mins = Math.floor(diffMs / 60000).toString().padStart(2, '0');
              const secs = Math.floor((diffMs % 60000) / 1000).toString().padStart(2, '0');
              setServingTimer(`${mins}:${secs}`);
            }
          };
          updateTimer();
          servingTimerIntervalRef.current = setInterval(updateTimer, 1000);
        } else {
          setShowTimer(false);
          clearInterval(servingTimerIntervalRef.current);
        }
      }
      setRecentNumbers(data.recentNumbers || []);
    });

    const heartbeat = setInterval(() => {
      fetch('/api/ping').catch(err => console.log('Heartbeat failed', err));
    }, 5 * 60 * 1000);

    return () => {
      socket.off('voice_settings_update');
      socket.off('trigger_test_voice_display');
      socket.off('trigger_repeat');
      socket.off('display_update');
      clearInterval(heartbeat);
      clearInterval(servingTimerIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(`Fullscreen error: ${err.message}`));
    } else {
      document.exitFullscreen();
    }
  }

  return (
    <>
      {!unlocked && (
        <div className="overlay-unlock" onClick={handleUnlock}>
          <img src="/assets/nbi.png" alt="NBI Logo" className="overlay-logo" />
          <h1>NBI Cybercrime Division</h1>
          <h2>Queue Display System</h2>
          <div className="tap-text">Tap anywhere to activate display</div>
          <div className="sub-text">Audio announcements will be enabled</div>
        </div>
      )}

      <div
        className="display-container"
        style={{
          width: '100vw',
          height: '100vh',
          margin: 'auto',
          overflow: 'hidden',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: 'radial-gradient(circle at 50% 40%, #1a365d 0%, var(--background-color, #050e1d) 80%)'
        }}
      >
        <header className="header">
          <div className="brand">
            <img src="/assets/nbi.png" alt="NBI Logo" style={{ height: '6vh', objectFit: 'contain' }} />
            <div className="brand-text">
              <div className="brand-title">NBI Cybercrime Division</div>
              <div style={{ fontSize: '1.1rem', color: '#ffffff', marginTop: 4, letterSpacing: '1.5px', fontWeight: '700', textTransform: 'uppercase', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                Powered by: PLM Computer Science Interns '27
              </div>
            </div>
          </div>
          <div className="datetime-container">
            <div className="time">{time}</div>
            <div className="date">{date}</div>
          </div>
          <button className="fullscreen-btn" onClick={toggleFullscreen} title="Toggle Fullscreen">⛶</button>
        </header>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', paddingBottom: 'clamp(1rem, 4vh, 3rem)' }}>
        <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', paddingBottom: 0 }}>
          <div className="serving-label">Now Serving</div>
          {isPriority && <div className="serving-priority-badge">PRIORITY</div>}
          <div
            className={`queue-number-box ${isPriority ? 'priority' : ''}`}
            style={flash ? { transform: 'scale(1.05)', boxShadow: `0 30px 80px ${isPriority ? 'rgba(204,34,34,0.8)' : 'rgba(241,196,15,0.8)'}` } : {}}
          >
            <div
              className={`queue-number ${isTextMode ? 'is-text' : ''} ${isPriority ? 'priority' : ''}`}
              style={isPriority ? { color: '#ff3333', textShadow: '0 0 30px rgba(255,51,51,0.6)' } : {}}
            >
              {queueText}
            </div>
          </div>

          {showTimer && (
            <div className="time-inside-pill">
              <span style={{ display: 'inline-block', width: 14, height: 14, background: '#28a745', borderRadius: '50%', boxShadow: '0 0 10px #28a745' }} />
              Time Inside: <span style={{ fontWeight: 700 }}>{servingTimer}</span>
            </div>
          )}
        </main>

        <div className="recent-container" style={{ margin: 0, flex: 'none' }}>
          <div className="recent-label">Previously Served</div>
          <ul className="recent-list">
            {recentNumbers.length === 0 ? (
              <li className="recent-item">---</li>
            ) : (
              recentNumbers.map((num, i) => (
                <li key={i} className="recent-item">{shortenCcd(num)}</li>
              ))
            )}
          </ul>
        </div>
      </div>
        <div className="bottom-scroll-container">
        <div className="bottom-scroll">
          {[...Array(5)].map((_, i) => (
            <span key={i} className="scroll-text">WELCOME TO NBI CYBERCRIME DIVISION • PLEASE WAIT FOR YOUR NUMBER TO BE CALLED • FOR INQUIRIES, PLEASE CONTACT: ccd@nbi.gov.ph / +63 929 660 7861 • THANK YOU • </span>
          ))}
        </div>
      </div>
      <audio ref={sfxPlayerRef} src="/assets/sound.mp3" preload="auto" style={{ display: 'none' }} />
      <audio ref={voicePlayerRef} preload="auto" style={{ display: 'none' }} />
    </div>
    </>
  );
}