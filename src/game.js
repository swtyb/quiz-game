// game.js
import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

const MUSIC_1_URL = "https://gooztzrspeikvynifjll.supabase.co/storage/v1/object/public/Musics/music1.mp3"; // intro/results
const MUSIC_3_URL = "https://gooztzrspeikvynifjll.supabase.co/storage/v1/object/public/Musics/music3.mp3"; // quiz
const SFX_CORRECT = "https://gooztzrspeikvynifjll.supabase.co/storage/v1/object/public/Musics/CorrectAnswer.m4a";
const SFX_WRONG   = "https://gooztzrspeikvynifjll.supabase.co/storage/v1/object/public/Musics/WrongAnswer.mp3";

const NUM_TEXT_QUESTIONS_PER_GAME = 5;   // how many text Qs to pick
const MAX_IMAGE_QUESTIONS_PER_GAME = 5;  // how many image Qs to use

function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ----------  PRE-LOADER  ---------- */
async function preloadAssets() {
  const { data, error } = await client
    .from('questions')
    .select('image_url');
  if (error) {
    console.error(error);
    return;
  }

  const urls = data.map(q => q.image_url);
  await Promise.all(
    urls.map(url => new Promise((res, rej) => {
      const img = new Image();
      img.onload = img.onerror = res;   // resolve even on error
      img.src = url;
    }))
  );
}

/* ----------  FIXED TIMER  ---------- */
let timer    = null;
let timeLeft = 20;   // 20s per question

// 🎮 GAME STATE
let currentPlayer = '';
let questions = [];
let currentQuestionIndex = 0;
let score = 0;

/* ----------  ANIMATIONS  ---------- */
function animateQuestionChange() {
  const box = document.querySelector('.question-box');
  const answers = document.getElementById('answers');

  if (box) box.classList.add('fade-out');
  if (answers) answers.classList.add('fade-out');

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 300);
  });
}

function animateQuestionIn() {
  const box = document.querySelector('.question-box');
  const answers = document.getElementById('answers');

  if (!box || !answers) return;

  box.classList.remove('fade-out');
  answers.classList.remove('fade-out');

  box.classList.add('question-transition');
  answers.classList.add('question-transition');

  setTimeout(() => {
    box.classList.add('question-transition-active');
    answers.classList.add('question-transition-active');
  }, 35);

  setTimeout(() => {
    box.classList.remove('question-transition');
    answers.classList.remove('question-transition');
    box.classList.remove('question-transition-active');
    answers.classList.remove('question-transition-active');
  }, 450);
}

/* ----------  MUSIC HELPERS  ---------- */

// Smoothly fade out current track, switch, then fade in new track
function switchMusicSmooth(newSrc) {
  const audio = document.getElementById('bg-music');
  if (!audio) return;

  const isMuted = window.isMusicMuted === true;
  const targetVolume = (typeof window.musicVolume === 'number')
    ? window.musicVolume
    : 0.4;

  // If muted, just switch silently and keep it muted
  if (isMuted) {
    audio.src = newSrc;
    audio.volume = targetVolume;
    audio.muted = true;
    return;
  }

  let v = audio.volume;

  // FADE OUT
  const fadeOut = setInterval(() => {
    v -= 0.05;
    if (v <= 0) {
      v = 0;
      audio.volume = 0;
      clearInterval(fadeOut);

      // Switch track after fading out
      audio.src = newSrc;
      audio.muted = false;
      audio.play().catch(err => console.log("Music play error:", err));

      // FADE IN
      let v2 = 0;
      const fadeIn = setInterval(() => {
        v2 += 0.05;
        audio.volume = Math.min(v2, targetVolume);
        if (v2 >= targetVolume) {
          clearInterval(fadeIn);
        }
      }, 50);
    } else {
      audio.volume = v;
    }
  }, 50);
}

// SFX helper
function playSFX(url) {
  const sfx = new Audio(url);

  // respect mute setting
  sfx.muted = window.isMusicMuted === true;

  sfx.volume = 0.8;   // tweak if needed
  sfx.play().catch(err => console.log("SFX play error:", err));
}

/* ----------  FEEDBACK OVERLAY (✓ / ✕ FLASH) ---------- */

function showFeedback(type) {
  const overlay = document.getElementById('feedback-overlay');
  const icon = overlay ? overlay.querySelector('.feedback-icon') : null;
  if (!overlay || !icon) return;

  // reset classes to restart animation
  overlay.classList.remove('correct', 'wrong', 'show');

  // force reflow
  void overlay.offsetWidth;

  if (type === 'correct') {
    overlay.classList.add('correct');
    icon.textContent = '✓';
  } else {
    overlay.classList.add('wrong');
    icon.textContent = '✕';
  }

  overlay.classList.add('show');

  // hide after short flash
  setTimeout(() => {
    overlay.classList.remove('show');
  }, 250);
}

/* ----------  INIT GAME  ---------- */

async function initGame() {
  await loadQuestions();
  await loadLeaderboard();
}

// 📥 LOAD QUESTIONS FROM SUPABASE
async function loadQuestions() {
  const { data, error } = await client.from('questions').select('*');

  if (error) {
    console.error('Error loading questions:', error);
    alert('Database error! Check console for details.');
    return;
  }

  // Separate text vs image questions by question_type
  const textQuestions  = data.filter(q => q.question_type === 'text');
  const imageQuestions = data.filter(q => q.question_type !== 'text'); // e.g. 'image'

  // Randomly pick text questions
  const shuffledText = shuffleArray(textQuestions);
  const selectedText = shuffledText.slice(0, NUM_TEXT_QUESTIONS_PER_GAME);

  // Use up to MAX_IMAGE_QUESTIONS_PER_GAME image questions
  const selectedImages = imageQuestions.slice(0, MAX_IMAGE_QUESTIONS_PER_GAME);

  // Combine image + text, then shuffle order so they’re mixed
  const combined = [...selectedImages, ...selectedText];
  questions = shuffleArray(combined);

  console.log('Loaded questions (final pool):', questions);
}


/* ----------  LEADERBOARD (LOGIN) ---------- */

async function loadLeaderboard() {
  const { data, error } = await client
    .from('scores')
    .select('*')
    .order('score', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error loading leaderboard:', error);
    document.getElementById('top-scores').innerHTML = '<p>Error loading scores</p>';
    return;
  }

  const scoresElement = document.getElementById('top-scores');
  if (!data || data.length === 0) {
    scoresElement.innerHTML = '<p>No scores yet! Be the first!</p>';
    return;
  }

  scoresElement.innerHTML = data.map((score, index) => `
    <div class="leaderboard-item">
      <span>${index + 1}. ${score.player_name}</span>
      <span>${score.score} pts</span>
    </div>
  `).join('');
}

/* ----------  START GAME  ---------- */

async function startGame() {
  const username = document.getElementById('username').value.trim();
  if (!username) {
    alert('Please enter your name!');
    return;
  }

  currentPlayer = username;

  // Always get a fresh random set from Supabase
  await loadQuestions();

  if (!questions || questions.length === 0) {
    alert('No questions found!');
    return;
  }

  // Switch to quiz music (music3) with fade
  switchMusicSmooth(MUSIC_3_URL);

  showScreen('game-screen');
  document.getElementById('player-name').textContent = currentPlayer;
  score = 0;
  currentQuestionIndex = 0;

  loadQuestion();
}


/* ----------  LOAD QUESTION  ---------- */

function loadQuestion() {
  if (currentQuestionIndex >= questions.length) {
    endGame();
    return;
  }

  const question = questions[currentQuestionIndex];
  document.getElementById('score').textContent = score;
  const picBox = document.getElementById('question-image');
  const txtBox = document.getElementById('question-text');

  // Update progress bar
  const progress = (currentQuestionIndex / questions.length) * 100;
  document.getElementById('progress-bar').style.width = progress + "%";

  if (question.question_type === 'text') {
    picBox.style.display = 'none';
    txtBox.style.display = 'block';
    txtBox.textContent = question.question_text;
  } else {
    txtBox.style.display = 'none';
    picBox.style.display = 'block';
    picBox.src = question.image_url;
  }

  // Create answer buttons
  const answersDiv = document.getElementById('answers');
  answersDiv.innerHTML = '';

  const answers = [
    question.correct_answer,
    question.option_b,
    question.option_c,
    question.option_d
  ].sort(() => Math.random() - 0.5);

  answers.forEach(answer => {
    const button = document.createElement('button');
    button.textContent = answer;

    // entrance animation
    button.classList.add('answer-enter');
    button.addEventListener('animationend', () => {
      button.classList.remove('answer-enter');
    }, { once: true });

    button.onclick = () => checkAnswer(answer, question.correct_answer);
    answersDiv.appendChild(button);
  });

  animateQuestionIn();
  startTimer();
}

/* ----------  TIMER  ---------- */

function startTimer() {
  clearInterval(timer);          // kill any old interval
  timeLeft = 20;
  tick();                        // show first number immediately

  timer = setInterval(() => {
    timeLeft--;
    tick();
    if (timeLeft <= 0) {
      clearInterval(timer);
      nextQuestion();
    }
  }, 1000);
}

function tick() {
  const timerEl = document.getElementById('timer');
  if (!timerEl) return;

  timerEl.textContent = timeLeft;

  const pill = timerEl.closest('.timer-pill');
  if (!pill) return;

  // Remove old states
  pill.classList.remove('timer-ok', 'timer-warning', 'timer-danger');

  if (timeLeft > 10) {
    // 20–11 seconds → green
    pill.classList.add('timer-ok');
  } else if (timeLeft > 5) {
    // 10–6 seconds → yellow
    pill.classList.add('timer-warning');
  } else {
    // 5–0 seconds → red
    pill.classList.add('timer-danger');
  }
}

/* ----------  CHECK ANSWER  ---------- */

function checkAnswer(selected, correct) {
  clearInterval(timer);

  const buttons = document.querySelectorAll('#answers button');
  buttons.forEach(button => {
    button.disabled = true;

    if (button.textContent === correct) {
      button.classList.add('correct', 'answer-correct-anim');
    } else if (button.textContent === selected && selected !== correct) {
      button.classList.add('wrong', 'answer-wrong-anim');
    }
  });

  if (selected === correct) {
    playSFX(SFX_CORRECT);
    showFeedback('correct');

    const points = 10 + timeLeft;
    score += points;
    document.getElementById('score').textContent = score;

    // score pop animation
    const scoreEl = document.getElementById('score');
    if (scoreEl) {
      scoreEl.classList.remove('score-pop');
      void scoreEl.offsetWidth;  // reflow
      scoreEl.classList.add('score-pop');
    }
  } else {
    playSFX(SFX_WRONG);
    showFeedback('wrong');
  }

  setTimeout(nextQuestion, 2000);
}

/* ----------  NEXT QUESTION  ---------- */

async function nextQuestion() {
  await animateQuestionChange();
  currentQuestionIndex++;

  // If that was the last question, go straight to end screen
  if (currentQuestionIndex >= questions.length) {
    endGame();
    return;
  }

  loadQuestion();
  animateQuestionIn();
}

/* ----------  FINAL SCORE COUNT-UP ---------- */

function animateFinalScore(finalScore) {
  const el = document.getElementById('final-score');
  if (!el) return;

  const duration = 700; // ms
  const start = performance.now();

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const current = Math.floor(progress * finalScore);
    el.textContent = current;
    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      el.textContent = finalScore;
    }
  }

  requestAnimationFrame(frame);
}

/* ----------  END GAME  ---------- */

async function endGame() {
  // Switch back to intro music with fade
  switchMusicSmooth(MUSIC_1_URL);

  // Show results screen immediately
  showScreen('results-screen');

  // results screen pop animation
  const results = document.getElementById('results-screen');
  if (results) {
    results.classList.remove('results-enter');
    void results.offsetWidth;
    results.classList.add('results-enter');
  }

  // animate message + score
  const finalMessage = `You got ${score} points, ${currentPlayer}!`;
  const resultsText = document.getElementById('results-text');
  if (resultsText) {
    resultsText.textContent = finalMessage;
  }

  const scoreEl = document.getElementById('final-score');
  if (scoreEl) {
    scoreEl.textContent = '0';
    animateFinalScore(score);
  }

  // Save score + load leaderboard in the background
  try {
    const { error } = await client
      .from('scores')
      .insert([{
        player_name: currentPlayer,
        score: score
      }]);

    if (error) {
      console.error('Error saving score:', error);
      return;
    }

    await loadFinalLeaderboard();
  } catch (e) {
    console.error('Unexpected error saving score:', e);
  }
}


/* ----------  FINAL LEADERBOARD  ---------- */

async function loadFinalLeaderboard() {
  const { data, error } = await client
    .from('scores')
    .select('*')
    .order('score', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error loading leaderboard:', error);
    return;
  }

  const leaderboardElement = document.getElementById('leaderboard-scores');
  leaderboardElement.innerHTML = data.map((score, index) => `
    <div class="leaderboard-item">
      <span>${index + 1}. ${score.player_name}</span>
      <span>${score.score} pts</span>
      <small>${new Date(score.created_at).toLocaleDateString()}</small>
    </div>
  `).join('');
}

/* ----------  PLAY AGAIN  ---------- */

async function playAgain() {
  showScreen('game-screen');
  score = 0;
  currentQuestionIndex = 0;

  // Get a fresh random selection again
  await loadQuestions();

  // Back to quiz music with smooth transition
  switchMusicSmooth(MUSIC_3_URL);

  loadQuestion();
}


/* ----------  BACK TO LOGIN  ---------- */

function showLogin() {
  showScreen('login-screen');
  document.getElementById('username').value = '';
  loadLeaderboard();
}

/* ----------  SCREEN MANAGEMENT  ---------- */

function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenName).classList.add('active');
}

export { initGame, startGame, playAgain, showLogin };
