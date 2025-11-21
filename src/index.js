import './styles.css';
import { initGame, startGame, playAgain, showLogin } from './game.js';

// Make game functions available globally
window.startGame = startGame;
window.playAgain = playAgain;
window.showLogin = showLogin;

// Optional: still have these if you want extra manual control later
const MUSIC_1_URL = "https://gooztzrspeikvynifjll.supabase.co/storage/v1/object/public/Musics/music1.mp3";
const MUSIC_2_URL = "https://gooztzrspeikvynifjll.supabase.co/storage/v1/object/public/Musics/music2.mp3";

let currentMusic = 2;

// Global audio state shared with game.js
let isMusicMuted = true;      // start muted
let musicVolume = 0.4;        // 0–1

window.isMusicMuted = isMusicMuted;
window.musicVolume = musicVolume;

// (Optional) helper if you ever want to manually switch via console
window.playMusic = function (track = 1) {
  const audio = document.getElementById('bg-music');

  if (!audio) {
    console.error("bg-music element missing");
    return;
  }

  currentMusic = track;
  audio.src = track === 2 ? MUSIC_2_URL : MUSIC_1_URL;

  audio.volume = window.musicVolume;
  audio.muted = window.isMusicMuted;

  audio.play()
    .then(() => console.log("Music playing:", audio.src))
    .catch(err => console.error("Music play failed:", err));
};

// ===========================================
// Initialization + MUTE TOGGLE + VOLUME SLIDER
// ===========================================
document.addEventListener('DOMContentLoaded', async () => {
  const loader = document.getElementById('loader');
  const musicToggle = document.getElementById('music-toggle');
  const audio = document.getElementById('bg-music');
  const volumeSlider = document.getElementById('volume-slider');

  if (audio) {
    audio.muted = isMusicMuted;      // start muted
    audio.volume = musicVolume;      // starting volume
  }

  // 🟡 MUTE / UNMUTE BUTTON
  if (musicToggle && audio) {
    musicToggle.textContent = "🔇 Music Off";

    musicToggle.addEventListener('click', () => {
      isMusicMuted = !isMusicMuted;
      window.isMusicMuted = isMusicMuted;

      audio.muted = isMusicMuted;

      if (isMusicMuted) {
        musicToggle.textContent = "🔇 Music Off";
      } else {
        musicToggle.textContent = "🔊 Music On";
        // Use stored volume when unmuting
        audio.volume = window.musicVolume;
        if (audio.paused) {
          audio.play().catch(err => console.log('Play failed:', err));
        }
      }
    });
  }

  // 🎚 VOLUME SLIDER
  if (volumeSlider && audio) {
    // initial slider value (0–100)
    volumeSlider.value = musicVolume * 100;

    volumeSlider.addEventListener('input', () => {
      const v = volumeSlider.value / 100;  // 0–1
      musicVolume = v;
      window.musicVolume = v;

      if (!audio.muted) {
        audio.volume = v;
      }
    });
  }

  // 🟢 Game initialization
  try {
    console.log('Starting game initialization...');
    await initGame();
    console.log('Game initialization complete');

    if (loader) {
      loader.remove();
    }
  } catch (error) {
    console.error('Error initializing game:', error);
    if (loader) {
      loader.innerHTML = '<p>Error loading quiz. Please try again.</p>';
    }
    alert('Error initializing game: ' + error.message);
  }
});
