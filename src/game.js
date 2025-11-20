import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const client = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ----------  PRE-LOADER  ---------- */
async function preloadAssets(){
  const { data, error } = await client
        .from('questions')
        .select('image_url');
  if (error){ console.error(error); return; }

  const urls = data.map(q => q.image_url);
  await Promise.all(
    urls.map(url => new Promise((res,rej)=>{
      const img = new Image();
      img.onload = img.onerror = res;   // resolve even on error
      img.src = url;
    }))
  );
}

/* ----------  FIXED TIMER  ---------- */
let timer      = null;
let timeLeft   = 10;

// 🎮 GAME STATE
let currentPlayer = '';
let questions = [];
let currentQuestionIndex = 0;
let score = 0;


// 🚀 INIT GAME
async function initGame() {
    await loadQuestions();  // If you load from Supabase later
    await loadLeaderboard();
}

// 📥 LOAD QUESTIONS FROM LOCAL FILE
async function loadQuestions() {
    const { data, error } = await client.from('questions').select('*');
    
    if (error) {
        console.error('Error loading questions:', error);
        alert('Database error! Check console for details.');
        return;
    }
    
    questions = data;
    console.log('Loaded questions:', questions); // Debug log
}

// 🏆 LOAD LEADERBOARD FROM LOCAL STORAGE
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
    if (data.length === 0) {
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

// 🎯 START GAME
function startGame() {
    const username = document.getElementById('username').value.trim();
    if (!username) {
        alert('Please enter your name!');
        return;
    }

    currentPlayer = username;
    
    if (questions.length === 0) {
        alert('No questions found!');
        return;
    }

    showScreen('game-screen');
    document.getElementById('player-name').textContent = currentPlayer;
    score = 0;
    currentQuestionIndex = 0;
    
    loadQuestion();
}

// ❓ LOAD QUESTION
function loadQuestion() {
    if (currentQuestionIndex >= questions.length) {
        endGame();
        return;
    }

    const question = questions[currentQuestionIndex];
    document.getElementById('score').textContent = score;
    const picBox = document.getElementById('question-image');
    const txtBox = document.getElementById('question-text');

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
        button.onclick = () => checkAnswer(answer, question.correct_answer);
        answersDiv.appendChild(button);
    });

    startTimer();
}

// ⏱️ TIMER
function startTimer(){
  clearInterval(timer);          // kill any old interval
  timeLeft = 10;
  tick();                        // show first number immediately

  timer = setInterval(()=>{
    timeLeft--;
    tick();
    if (timeLeft <= 0){
      clearInterval(timer);
      nextQuestion();            // single, reliable call
    }
  }, 1000);
}

function tick(){
  document.getElementById('timer').textContent = timeLeft;
}

// ✅ CHECK ANSWER
function checkAnswer(selected, correct) {
    clearInterval(timer);
    
    const buttons = document.querySelectorAll('#answers button');
    buttons.forEach(button => {
        button.disabled = true;
        if (button.textContent === correct) {
            button.classList.add('correct');
        } else if (button.textContent === selected && selected !== correct) {
            button.classList.add('wrong');
        }
    });

    if (selected === correct) {
        // Speed bonus: more points for faster answers
        const points = 10 + timeLeft;
        score += points;
        document.getElementById('score').textContent = score;
    }

    setTimeout(nextQuestion, 2000);
}

// ➡️ NEXT QUESTION
function nextQuestion() {
    currentQuestionIndex++;
    loadQuestion();
}

// 🏁 END GAME
async function endGame() {
    // Save score to Supabase database
    const { error } = await client
        .from('scores')
        .insert([{ 
            player_name: currentPlayer, 
            score: score 
        }]);

    if (error) {
        console.error('Error saving score:', error);
        alert('Could not save score to leaderboard');
    }

    // Show results
    document.getElementById('final-score').textContent = score;
    document.getElementById('results-text').textContent = 
        `You got ${score} points, ${currentPlayer}!`;

    // Load final leaderboard
    await loadFinalLeaderboard();
    showScreen('results-screen');
}

// 🏆 LOAD FINAL LEADERBOARD
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

// 🔄 RESTART GAME
function playAgain() {
    showScreen('game-screen');
    score = 0;
    currentQuestionIndex = 0;
    loadQnpmuestion();
}

// 🏠 BACK TO LOGIN
function showLogin() {
    showScreen('login-screen');
    document.getElementById('username').value = '';
    loadLeaderboard();
}

// 🖥️ SCREEN MANAGEMENT
function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenName).classList.add('active');
}

export { initGame, startGame, playAgain, showLogin };